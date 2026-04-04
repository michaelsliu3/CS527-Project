namespace PlzBuyMe.Api.Dtos.Admin.Gm;

public record GmManifestCarRowDto
{
    public string? ExternalId { get; init; }
    public string? Title { get; init; }
    public string? Make { get; init; }
    public string? Model { get; init; }
    public int? Year { get; init; }
    public string? Color { get; init; }
    public string? SourceUrl { get; init; }
    public string? DetailSourceUrl { get; init; }
    public IReadOnlyList<int> CategoryIds { get; init; } = Array.Empty<int>();
    public IReadOnlyList<string> CategoryNames { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> CategoryStringKeys { get; init; } = Array.Empty<string>();
}
