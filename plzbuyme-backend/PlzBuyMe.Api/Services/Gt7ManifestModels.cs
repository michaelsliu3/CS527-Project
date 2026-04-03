using System.Text.Json.Serialization;

namespace PlzBuyMe.Api.Services;

public class Gt7ManifestFile
{
    [JsonPropertyName("assets")]
    public List<Gt7ManifestAsset> Assets { get; set; } = new();
}

public class Gt7ManifestAsset
{
    [JsonPropertyName("externalId")]
    public string? ExternalId { get; set; }

    [JsonPropertyName("sourceUrl")]
    public string? SourceUrl { get; set; }

    [JsonPropertyName("detailSourceUrl")]
    public string? DetailSourceUrl { get; set; }

    [JsonPropertyName("title")]
    public string? Title { get; set; }

    [JsonPropertyName("make")]
    public string? Make { get; set; }

    [JsonPropertyName("model")]
    public string? Model { get; set; }

    [JsonPropertyName("year")]
    public int? Year { get; set; }

    [JsonPropertyName("color")]
    public string? Color { get; set; }

    /// <summary>
    /// Optional curated category list (string keys or display names) ordered by primary relevance.
    /// Example: ["sedans", "sports-cars"].
    /// </summary>
    [JsonPropertyName("categories")]
    public List<string> Categories { get; set; } = new();
}
