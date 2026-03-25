namespace PlzBuyMe.Cdn.Services;

public interface IGt7ThumbnailResolver
{
    Gt7ThumbnailResolutionResult Resolve(string? make, string? model, int? year);
    Gt7ThumbnailResolutionResult ResolveByExternalId(string? externalId);
}

public sealed record Gt7ThumbnailResolutionResult(
    bool Found,
    string MatchLevel,
    string? Url,
    string? DetailUrl,
    string? ExternalId,
    string? Make,
    string? Model,
    int? Year,
    string? Title);
