namespace PlzBuyMe.Cdn.Services;

public interface IGt7ThumbnailResolver
{
    Gt7ThumbnailResolutionResult Resolve(string? make, string? model, int? year);
}

public sealed record Gt7ThumbnailResolutionResult(
    bool Found,
    string MatchLevel,
    string? Url,
    string? ExternalId,
    string? Make,
    string? Model,
    int? Year,
    string? Title);
