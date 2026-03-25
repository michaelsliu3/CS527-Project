namespace PlzBuyMe.Cdn.Dtos.Media;

public sealed record ResolveGt7ThumbnailResponseDto
{
    public required bool Found { get; init; }
    public required string MatchLevel { get; init; }
    public string? Url { get; init; }
    public string? DetailUrl { get; init; }
    public string? ExternalId { get; init; }
    public string? Make { get; init; }
    public string? Model { get; init; }
    public int? Year { get; init; }
    public string? Title { get; init; }
}
