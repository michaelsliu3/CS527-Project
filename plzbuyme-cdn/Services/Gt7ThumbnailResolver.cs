using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;
using Microsoft.Extensions.Options;
using PlzBuyMe.Cdn.Options;

namespace PlzBuyMe.Cdn.Services;

public sealed class Gt7ThumbnailResolver : IGt7ThumbnailResolver
{
    private static readonly Regex NonAlphanumeric = new("[^a-z0-9]+", RegexOptions.IgnoreCase | RegexOptions.Compiled | RegexOptions.CultureInvariant);
    private readonly string _manifestPath;
    private readonly string _publicBaseUrl;
    private readonly ILogger<Gt7ThumbnailResolver> _logger;
    private readonly Lazy<Gt7ResolverIndex> _index;

    public Gt7ThumbnailResolver(
        IWebHostEnvironment environment,
        IOptions<MediaStorageOptions> mediaStorageOptions,
        ILogger<Gt7ThumbnailResolver> logger)
    {
        _logger = logger;
        _publicBaseUrl = (mediaStorageOptions.Value.PublicBaseUrl ?? "http://localhost:5090").TrimEnd('/');
        _manifestPath = Path.Combine(environment.ContentRootPath, "tools", "car-assets", "manifests", "gt7-car-thumbnails.manifest.json");
        _index = new Lazy<Gt7ResolverIndex>(LoadIndex, LazyThreadSafetyMode.ExecutionAndPublication);
    }

    public Gt7ThumbnailResolutionResult Resolve(string? make, string? model, int? year)
    {
        var index = _index.Value;
        if (index.Entries.Count == 0)
        {
            return new Gt7ThumbnailResolutionResult(false, "none", null, null, null, null, null, null);
        }

        var normalizedMake = NormalizeText(make);
        var normalizedModel = NormalizeText(model);

        if (!string.IsNullOrWhiteSpace(normalizedMake) && !string.IsNullOrWhiteSpace(normalizedModel) && year.HasValue)
        {
            var exactKey = MakeModelYearKey(normalizedMake, normalizedModel, year.Value);
            if (index.ByMakeModelYear.TryGetValue(exactKey, out var exact))
            {
                return CreateResult(exact, "exact");
            }
        }

        if (!string.IsNullOrWhiteSpace(normalizedMake) && !string.IsNullOrWhiteSpace(normalizedModel))
        {
            var partialKey = MakeModelKey(normalizedMake, normalizedModel);
            if (index.ByMakeModel.TryGetValue(partialKey, out var partial))
            {
                return CreateResult(partial, "partial");
            }
        }

        if (!string.IsNullOrWhiteSpace(normalizedMake) && index.ByMake.TryGetValue(normalizedMake, out var makeOnly))
        {
            return CreateResult(makeOnly, "make-only");
        }

        return new Gt7ThumbnailResolutionResult(false, "none", null, null, null, null, null, null);
    }

    private Gt7ThumbnailResolutionResult CreateResult(Gt7AssetEntry entry, string matchLevel)
    {
        var url = $"{_publicBaseUrl}/media/cars/gt7/car{entry.ExternalId}.png";
        return new Gt7ThumbnailResolutionResult(
            true,
            matchLevel,
            url,
            entry.ExternalId,
            entry.Make,
            entry.Model,
            entry.Year,
            entry.Title);
    }

    private Gt7ResolverIndex LoadIndex()
    {
        try
        {
            if (!File.Exists(_manifestPath))
            {
                _logger.LogWarning("GT7 thumbnail manifest not found: {ManifestPath}", _manifestPath);
                return Gt7ResolverIndex.Empty;
            }

            var manifestText = File.ReadAllText(_manifestPath);
            var manifest = JsonSerializer.Deserialize<Gt7ManifestDocument>(manifestText);
            var assets = manifest?.Assets ?? [];

            var entries = assets
                .Where(asset => !string.IsNullOrWhiteSpace(asset.ExternalId) && !string.IsNullOrWhiteSpace(asset.Make))
                .Select(asset => new Gt7AssetEntry(
                    asset.ExternalId!.Trim(),
                    asset.Make!.Trim(),
                    (asset.Model ?? string.Empty).Trim(),
                    asset.Year,
                    (asset.Title ?? string.Empty).Trim()))
                .ToList();

            var byMakeModelYear = new Dictionary<string, Gt7AssetEntry>(StringComparer.Ordinal);
            var byMakeModel = new Dictionary<string, Gt7AssetEntry>(StringComparer.Ordinal);
            var byMake = new Dictionary<string, Gt7AssetEntry>(StringComparer.Ordinal);

            foreach (var entry in entries.OrderByDescending(e => e.Year ?? 0))
            {
                var normalizedMake = NormalizeText(entry.Make);
                if (string.IsNullOrWhiteSpace(normalizedMake))
                    continue;

                if (!byMake.ContainsKey(normalizedMake))
                {
                    byMake[normalizedMake] = entry;
                }

                var normalizedModel = NormalizeText(entry.Model);
                if (string.IsNullOrWhiteSpace(normalizedModel))
                    continue;

                var makeModelKey = MakeModelKey(normalizedMake, normalizedModel);
                if (!byMakeModel.ContainsKey(makeModelKey))
                {
                    byMakeModel[makeModelKey] = entry;
                }

                if (entry.Year.HasValue)
                {
                    var makeModelYearKey = MakeModelYearKey(normalizedMake, normalizedModel, entry.Year.Value);
                    if (!byMakeModelYear.ContainsKey(makeModelYearKey))
                    {
                        byMakeModelYear[makeModelYearKey] = entry;
                    }
                }
            }

            _logger.LogInformation(
                "Loaded GT7 thumbnail manifest index with {EntryCount} entries ({MakeCount} makes).",
                entries.Count,
                byMake.Count);

            return new Gt7ResolverIndex(entries, byMakeModelYear, byMakeModel, byMake);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to load GT7 thumbnail manifest index.");
            return Gt7ResolverIndex.Empty;
        }
    }

    private static string MakeModelYearKey(string normalizedMake, string normalizedModel, int year)
        => $"{normalizedMake}|{normalizedModel}|{year}";

    private static string MakeModelKey(string normalizedMake, string normalizedModel)
        => $"{normalizedMake}|{normalizedModel}";

    private static string NormalizeText(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
            return string.Empty;

        var lower = value.Trim().ToLowerInvariant();
        var simplified = NonAlphanumeric.Replace(lower, " ");
        return string.Join(' ', simplified.Split(' ', StringSplitOptions.RemoveEmptyEntries));
    }

    private sealed record Gt7ResolverIndex(
        IReadOnlyList<Gt7AssetEntry> Entries,
        IReadOnlyDictionary<string, Gt7AssetEntry> ByMakeModelYear,
        IReadOnlyDictionary<string, Gt7AssetEntry> ByMakeModel,
        IReadOnlyDictionary<string, Gt7AssetEntry> ByMake)
    {
        public static readonly Gt7ResolverIndex Empty = new([], new Dictionary<string, Gt7AssetEntry>(), new Dictionary<string, Gt7AssetEntry>(), new Dictionary<string, Gt7AssetEntry>());
    }

    private sealed record Gt7AssetEntry(string ExternalId, string Make, string Model, int? Year, string Title);

    private sealed record Gt7ManifestDocument
    {
        [JsonPropertyName("assets")]
        public List<Gt7ManifestAsset>? Assets { get; init; }
    }

    private sealed record Gt7ManifestAsset
    {
        [JsonPropertyName("externalId")]
        public string? ExternalId { get; init; }

        [JsonPropertyName("make")]
        public string? Make { get; init; }

        [JsonPropertyName("model")]
        public string? Model { get; init; }

        [JsonPropertyName("year")]
        public int? Year { get; init; }

        [JsonPropertyName("title")]
        public string? Title { get; init; }
    }
}
