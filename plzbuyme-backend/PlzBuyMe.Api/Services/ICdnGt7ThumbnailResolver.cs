namespace PlzBuyMe.Api.Services;

public interface ICdnGt7ThumbnailResolver
{
    Task<CdnGt7ThumbnailResolveResult> ResolveAsync(string? make, string? model, int? year, CancellationToken cancellationToken = default);
}

public sealed record CdnGt7ThumbnailResolveResult(
    bool Found,
    string MatchLevel,
    string? Url);
