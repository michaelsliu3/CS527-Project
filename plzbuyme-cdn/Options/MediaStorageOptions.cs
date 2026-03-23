namespace PlzBuyMe.Cdn.Options;

public sealed class MediaStorageOptions
{
    public string? StorageRoot { get; init; }
    public string PublicBaseUrl { get; init; } = "http://localhost:5090";
}
