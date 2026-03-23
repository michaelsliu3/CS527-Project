namespace PlzBuyMe.Cdn.Dtos.Media;

public sealed record UploadMediaResponseDto
{
    public required string Key { get; init; }
    public required string Url { get; init; }
}
