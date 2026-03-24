using System.Collections.Concurrent;
using System.Net.Http.Headers;
using System.Text.RegularExpressions;
using Microsoft.Extensions.Options;
using PlzBuyMe.Cdn.Options;

namespace PlzBuyMe.Cdn.Middleware;

public sealed class Gt7ThumbnailMirrorMiddleware
{
    private const string Gt7ThumbnailBaseUrl = "https://www.gran-turismo.com/common/dist/gt7/carlist/car_thumbnails";
    private static readonly Regex Gt7MediaPathPattern = new(
        "^/media/(?:cars/)?gt7/(?<file>car(?<id>\\d{3,5})\\.png)$",
        RegexOptions.IgnoreCase | RegexOptions.Compiled | RegexOptions.CultureInvariant);

    private static readonly ConcurrentDictionary<string, SemaphoreSlim> DownloadLocks = new(StringComparer.Ordinal);

    private readonly RequestDelegate _next;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<Gt7ThumbnailMirrorMiddleware> _logger;
    private readonly string _storageRoot;

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

        var match = Gt7MediaPathPattern.Match(path);
        if (!match.Success)
        {
            await _next(context);
            return;
        }

        var relativeMediaPath = path["/media/".Length..].Replace('/', Path.DirectorySeparatorChar);
        var localPath = Path.Combine(_storageRoot, relativeMediaPath);
        if (!File.Exists(localPath))
        {
            await DownloadGt7ThumbnailIfMissingAsync(localPath, match.Groups["id"].Value, context.RequestAborted);
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
}
