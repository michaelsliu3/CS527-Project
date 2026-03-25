using System.Net.Http.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace PlzBuyMe.Api.Services;

public sealed class CdnGt7ThumbnailResolver : ICdnGt7ThumbnailResolver
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<CdnGt7ThumbnailResolver> _logger;
    private readonly string _cdnBaseUrl;

    public CdnGt7ThumbnailResolver(
        IHttpClientFactory httpClientFactory,
        IConfiguration configuration,
        ILogger<CdnGt7ThumbnailResolver> logger)
    {
        _httpClientFactory = httpClientFactory;
        _logger = logger;
        _cdnBaseUrl = (configuration["MediaStorage:ServiceBaseUrl"] ?? "http://localhost:5090").TrimEnd('/');
    }

    public async Task<CdnGt7ThumbnailResolveResult> ResolveAsync(string? make, string? model, int? year, CancellationToken cancellationToken = default)
    {
        try
        {
            var queryParts = new List<string>();
            if (!string.IsNullOrWhiteSpace(make))
                queryParts.Add($"make={Uri.EscapeDataString(make.Trim())}");
            if (!string.IsNullOrWhiteSpace(model))
                queryParts.Add($"model={Uri.EscapeDataString(model.Trim())}");
            if (year.HasValue)
                queryParts.Add($"year={year.Value}");

            if (queryParts.Count == 0)
                return new CdnGt7ThumbnailResolveResult(false, "none", null, null, null);

            var requestUri = $"{_cdnBaseUrl}/api/media/gt7/resolve?{string.Join("&", queryParts)}";
            var client = _httpClientFactory.CreateClient(nameof(CdnGt7ThumbnailResolver));
            using var response = await client.GetAsync(requestUri, cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("GT7 resolver request failed with status {StatusCode} for {RequestUri}.", (int)response.StatusCode, requestUri);
                return new CdnGt7ThumbnailResolveResult(false, "none", null, null, null);
            }

            var payload = await response.Content.ReadFromJsonAsync<Gt7ResolveResponsePayload>(cancellationToken: cancellationToken);
            if (payload == null || !payload.Found || string.IsNullOrWhiteSpace(payload.Url))
                return new CdnGt7ThumbnailResolveResult(false, payload?.MatchLevel ?? "none", null, null, payload?.ExternalId);

            return new CdnGt7ThumbnailResolveResult(true, payload.MatchLevel ?? "none", payload.Url, payload.DetailUrl, payload.ExternalId);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to resolve GT7 thumbnail from CDN.");
            return new CdnGt7ThumbnailResolveResult(false, "none", null, null, null);
        }
    }

    public async Task<CdnGt7ThumbnailResolveResult> ResolveByExternalIdAsync(string? externalId, CancellationToken cancellationToken = default)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(externalId))
                return new CdnGt7ThumbnailResolveResult(false, "none", null, null, null);

            var requestUri = $"{_cdnBaseUrl}/api/media/gt7/resolve-by-external-id?externalId={Uri.EscapeDataString(externalId.Trim())}";
            var client = _httpClientFactory.CreateClient(nameof(CdnGt7ThumbnailResolver));
            using var response = await client.GetAsync(requestUri, cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("GT7 resolver-by-id request failed with status {StatusCode} for {RequestUri}.", (int)response.StatusCode, requestUri);
                return new CdnGt7ThumbnailResolveResult(false, "none", null, null, null);
            }

            var payload = await response.Content.ReadFromJsonAsync<Gt7ResolveResponsePayload>(cancellationToken: cancellationToken);
            if (payload == null || !payload.Found || string.IsNullOrWhiteSpace(payload.Url))
                return new CdnGt7ThumbnailResolveResult(false, payload?.MatchLevel ?? "none", null, null, payload?.ExternalId);

            return new CdnGt7ThumbnailResolveResult(true, payload.MatchLevel ?? "none", payload.Url, payload.DetailUrl, payload.ExternalId);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to resolve GT7 thumbnail by externalId from CDN.");
            return new CdnGt7ThumbnailResolveResult(false, "none", null, null, null);
        }
    }

    private sealed record Gt7ResolveResponsePayload
    {
        [JsonPropertyName("found")]
        public bool Found { get; init; }

        [JsonPropertyName("matchLevel")]
        public string? MatchLevel { get; init; }

        [JsonPropertyName("url")]
        public string? Url { get; init; }

        [JsonPropertyName("detailUrl")]
        public string? DetailUrl { get; init; }

        [JsonPropertyName("externalId")]
        public string? ExternalId { get; init; }
    }
}
