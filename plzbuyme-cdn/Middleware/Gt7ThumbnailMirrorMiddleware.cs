using System.Collections.Concurrent;
using System.Net.Http.Headers;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.Extensions.Options;
using PlzBuyMe.Cdn.Options;

namespace PlzBuyMe.Cdn.Middleware;

public sealed class Gt7ThumbnailMirrorMiddleware
{
    private const string Gt7ThumbnailBaseUrl = "https://www.gran-turismo.com/common/dist/gt7/carlist/car_thumbnails";
    private const string ManifestRelativePath = "tools/car-assets/manifests/gt7-car-thumbnails.manifest.json";
    private static readonly Regex Gt7MediaPathPattern = new(
        "^/media/(?:cars/)?gt7/(?<file>car(?<id>\\d{3,5})\\.png)$",
        RegexOptions.IgnoreCase | RegexOptions.Compiled | RegexOptions.CultureInvariant);
    private static readonly Regex Gt7DetailMediaPathPattern = new(
        "^/media/(?:cars/)?gt7/detail/(?<file>car(?<id>\\d{3,5})\\.jpg)$",
        RegexOptions.IgnoreCase | RegexOptions.Compiled | RegexOptions.CultureInvariant);
    private static readonly Regex Gt7CardMediaPathPattern = new(
        "^/media/(?:cars/)?gt7/card/(?<file>car(?<id>\\d{3,5})\\.jpg)$",
        RegexOptions.IgnoreCase | RegexOptions.Compiled | RegexOptions.CultureInvariant);

    private static readonly ConcurrentDictionary<string, SemaphoreSlim> DownloadLocks = new(StringComparer.Ordinal);

    private readonly RequestDelegate _next;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<Gt7ThumbnailMirrorMiddleware> _logger;
    private readonly string _storageRoot;
    private readonly string _manifestPath;
    private readonly Lazy<IReadOnlyDictionary<string, string>> _detailUrlByExternalId;
    private readonly Lazy<IReadOnlyDictionary<string, string>> _cardUrlByExternalId;

    public Gt7ThumbnailMirrorMiddleware(
        RequestDelegate next,
        IHttpClientFactory httpClientFactory,
        IOptions<MediaStorageOptions> options,
        IWebHostEnvironment environment,
        ILogger<Gt7ThumbnailMirrorMiddleware> logger)
    {
        _next = next;
        _httpClientFactory = httpClientFactory;
        _logger = logger;
        _storageRoot = MediaStorageOptionsResolver.ResolveStorageRoot(options.Value, environment.ContentRootPath);
        _manifestPath = Path.Combine(environment.ContentRootPath, ManifestRelativePath);
        _detailUrlByExternalId = new Lazy<IReadOnlyDictionary<string, string>>(LoadDetailUrlIndex, LazyThreadSafetyMode.ExecutionAndPublication);
        _cardUrlByExternalId = new Lazy<IReadOnlyDictionary<string, string>>(LoadCardUrlIndex, LazyThreadSafetyMode.ExecutionAndPublication);
        Directory.CreateDirectory(_storageRoot);
    }

    public async Task InvokeAsync(HttpContext context)
    {
        if (!HttpMethods.IsGet(context.Request.Method) && !HttpMethods.IsHead(context.Request.Method))
        {
            await _next(context);
            return;
        }

        var path = context.Request.Path.Value;
        if (string.IsNullOrWhiteSpace(path))
        {
            await _next(context);
            return;
        }

        var thumbnailMatch = Gt7MediaPathPattern.Match(path);
        var detailMatch = Gt7DetailMediaPathPattern.Match(path);
        var cardMatch = Gt7CardMediaPathPattern.Match(path);
        if (!thumbnailMatch.Success && !detailMatch.Success && !cardMatch.Success)
        {
            await _next(context);
            return;
        }

        var relativeMediaPath = path["/media/".Length..].Replace('/', Path.DirectorySeparatorChar);
        var localPath = Path.Combine(_storageRoot, relativeMediaPath);
        if (!File.Exists(localPath))
        {
            if (thumbnailMatch.Success)
            {
                await DownloadGt7ThumbnailIfMissingAsync(localPath, thumbnailMatch.Groups["id"].Value, context.RequestAborted);
            }
            else if (detailMatch.Success)
            {
                await DownloadGt7DetailImageIfMissingAsync(localPath, detailMatch.Groups["id"].Value, context.RequestAborted);
            }
            else if (cardMatch.Success)
            {
                await DownloadGt7CardImageIfMissingAsync(localPath, cardMatch.Groups["id"].Value, context.RequestAborted);
            }
        }

        await _next(context);
    }

    private async Task DownloadGt7ThumbnailIfMissingAsync(string localPath, string carId, CancellationToken cancellationToken)
    {
        var gate = DownloadLocks.GetOrAdd(localPath, _ => new SemaphoreSlim(1, 1));
        await gate.WaitAsync(cancellationToken);

        try
        {
            if (File.Exists(localPath))
                return;

            var remoteUrl = $"{Gt7ThumbnailBaseUrl}/car{carId}.png";
            var client = _httpClientFactory.CreateClient(nameof(Gt7ThumbnailMirrorMiddleware));

            using var request = new HttpRequestMessage(HttpMethod.Get, remoteUrl);
            request.Headers.UserAgent.Add(new ProductInfoHeaderValue("plzbuyme-cdn", "1.0"));
            request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("image/png"));
            request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("image/*", 0.8));

            using var response = await client.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("GT7 thumbnail fetch failed for car{CarId}: {StatusCode}", carId, (int)response.StatusCode);
                return;
            }

            var bytes = await response.Content.ReadAsByteArrayAsync(cancellationToken);
            if (bytes.Length == 0)
            {
                _logger.LogWarning("GT7 thumbnail response was empty for car{CarId}.", carId);
                return;
            }

            var directory = Path.GetDirectoryName(localPath);
            if (!string.IsNullOrWhiteSpace(directory))
                Directory.CreateDirectory(directory);

            await File.WriteAllBytesAsync(localPath, bytes, cancellationToken);
            _logger.LogInformation("Mirrored GT7 thumbnail for car{CarId} into local media cache.", carId);
        }
        catch (OperationCanceledException)
        {
            // Request cancelled; no-op.
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Unexpected error while mirroring GT7 thumbnail for car{CarId}.", carId);
        }
        finally
        {
            gate.Release();
        }
    }

    private async Task DownloadGt7DetailImageIfMissingAsync(string localPath, string externalId, CancellationToken cancellationToken)
    {
        var gate = DownloadLocks.GetOrAdd(localPath, _ => new SemaphoreSlim(1, 1));
        await gate.WaitAsync(cancellationToken);

        try
        {
            if (File.Exists(localPath))
                return;

            var index = _detailUrlByExternalId.Value;
            if (!index.TryGetValue(externalId, out var remoteUrl) || string.IsNullOrWhiteSpace(remoteUrl))
            {
                _logger.LogWarning("GT7 detail source URL not found for car{CarId}.", externalId);
                return;
            }

            var client = _httpClientFactory.CreateClient(nameof(Gt7ThumbnailMirrorMiddleware));
            using var request = new HttpRequestMessage(HttpMethod.Get, remoteUrl);
            request.Headers.UserAgent.Add(new ProductInfoHeaderValue("plzbuyme-cdn", "1.0"));
            request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("image/jpeg"));
            request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("image/*", 0.8));

            using var response = await client.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("GT7 detail fetch failed for car{CarId}: {StatusCode}", externalId, (int)response.StatusCode);
                return;
            }

            var bytes = await response.Content.ReadAsByteArrayAsync(cancellationToken);
            if (bytes.Length == 0)
            {
                _logger.LogWarning("GT7 detail response was empty for car{CarId}.", externalId);
                return;
            }

            var directory = Path.GetDirectoryName(localPath);
            if (!string.IsNullOrWhiteSpace(directory))
                Directory.CreateDirectory(directory);

            await File.WriteAllBytesAsync(localPath, bytes, cancellationToken);
            _logger.LogInformation("Mirrored GT7 detail image for car{CarId} into local media cache.", externalId);
        }
        catch (OperationCanceledException)
        {
            // Request cancelled; no-op.
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Unexpected error while mirroring GT7 detail image for car{CarId}.", externalId);
        }
        finally
        {
            gate.Release();
        }
    }

    private async Task DownloadGt7CardImageIfMissingAsync(string localPath, string externalId, CancellationToken cancellationToken)
    {
        var gate = DownloadLocks.GetOrAdd(localPath, _ => new SemaphoreSlim(1, 1));
        await gate.WaitAsync(cancellationToken);

        try
        {
            if (File.Exists(localPath))
                return;

            var index = _cardUrlByExternalId.Value;
            if (!index.TryGetValue(externalId, out var remoteUrl) || string.IsNullOrWhiteSpace(remoteUrl))
            {
                _logger.LogWarning("GT7 card source URL not found for car{CarId}.", externalId);
                return;
            }

            var client = _httpClientFactory.CreateClient(nameof(Gt7ThumbnailMirrorMiddleware));
            using var request = new HttpRequestMessage(HttpMethod.Get, remoteUrl);
            request.Headers.UserAgent.Add(new ProductInfoHeaderValue("plzbuyme-cdn", "1.0"));
            request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("image/jpeg"));
            request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("image/*", 0.8));

            using var response = await client.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("GT7 card fetch failed for car{CarId}: {StatusCode}", externalId, (int)response.StatusCode);
                return;
            }

            var bytes = await response.Content.ReadAsByteArrayAsync(cancellationToken);
            if (bytes.Length == 0)
            {
                _logger.LogWarning("GT7 card response was empty for car{CarId}.", externalId);
                return;
            }

            var directory = Path.GetDirectoryName(localPath);
            if (!string.IsNullOrWhiteSpace(directory))
                Directory.CreateDirectory(directory);

            await File.WriteAllBytesAsync(localPath, bytes, cancellationToken);
            _logger.LogInformation("Mirrored GT7 card image for car{CarId} into local media cache.", externalId);
        }
        catch (OperationCanceledException)
        {
            // Request cancelled; no-op.
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Unexpected error while mirroring GT7 card image for car{CarId}.", externalId);
        }
        finally
        {
            gate.Release();
        }
    }

    private IReadOnlyDictionary<string, string> LoadDetailUrlIndex()
    {
        try
        {
            if (!File.Exists(_manifestPath))
            {
                _logger.LogWarning("GT7 manifest missing for detail image mirroring: {ManifestPath}", _manifestPath);
                return new Dictionary<string, string>(StringComparer.Ordinal);
            }

            var json = File.ReadAllText(_manifestPath);
            using var doc = JsonDocument.Parse(json);
            if (!doc.RootElement.TryGetProperty("assets", out var assetsElement) || assetsElement.ValueKind != JsonValueKind.Array)
            {
                return new Dictionary<string, string>(StringComparer.Ordinal);
            }

            var map = new Dictionary<string, string>(StringComparer.Ordinal);
            foreach (var asset in assetsElement.EnumerateArray())
            {
                if (!asset.TryGetProperty("externalId", out var idElement) || idElement.ValueKind != JsonValueKind.String)
                    continue;
                if (!asset.TryGetProperty("detailSourceUrl", out var detailElement) || detailElement.ValueKind != JsonValueKind.String)
                    continue;

                var externalId = idElement.GetString()?.Trim();
                var detailUrl = detailElement.GetString()?.Trim();
                if (string.IsNullOrWhiteSpace(externalId) || string.IsNullOrWhiteSpace(detailUrl))
                    continue;
                map[externalId] = detailUrl;
            }

            _logger.LogInformation("Loaded GT7 detail mirror index with {Count} entries.", map.Count);
            return map;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to parse GT7 manifest detail URL index.");
            return new Dictionary<string, string>(StringComparer.Ordinal);
        }
    }

    private IReadOnlyDictionary<string, string> LoadCardUrlIndex()
    {
        try
        {
            if (!File.Exists(_manifestPath))
            {
                _logger.LogWarning("GT7 manifest missing for card image mirroring: {ManifestPath}", _manifestPath);
                return new Dictionary<string, string>(StringComparer.Ordinal);
            }

            var json = File.ReadAllText(_manifestPath);
            using var doc = JsonDocument.Parse(json);
            if (!doc.RootElement.TryGetProperty("assets", out var assetsElement) || assetsElement.ValueKind != JsonValueKind.Array)
            {
                return new Dictionary<string, string>(StringComparer.Ordinal);
            }

            var map = new Dictionary<string, string>(StringComparer.Ordinal);
            foreach (var asset in assetsElement.EnumerateArray())
            {
                if (!asset.TryGetProperty("externalId", out var idElement) || idElement.ValueKind != JsonValueKind.String)
                    continue;

                var externalId = idElement.GetString()?.Trim();
                if (string.IsNullOrWhiteSpace(externalId))
                    continue;

                string? selectedUrl = null;
                if (asset.TryGetProperty("galleryUrls", out var galleryElement) &&
                    galleryElement.ValueKind == JsonValueKind.Object &&
                    galleryElement.TryGetProperty("2_02", out var preferredElement) &&
                    preferredElement.ValueKind == JsonValueKind.String)
                {
                    selectedUrl = preferredElement.GetString()?.Trim();
                }

                if (string.IsNullOrWhiteSpace(selectedUrl) &&
                    asset.TryGetProperty("detailSourceUrl", out var detailElement) &&
                    detailElement.ValueKind == JsonValueKind.String)
                {
                    selectedUrl = detailElement.GetString()?.Trim();
                }

                if (!string.IsNullOrWhiteSpace(selectedUrl))
                {
                    map[externalId] = selectedUrl;
                }
            }

            _logger.LogInformation("Loaded GT7 card mirror index with {Count} entries.", map.Count);
            return map;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to parse GT7 manifest card URL index.");
            return new Dictionary<string, string>(StringComparer.Ordinal);
        }
    }
}
