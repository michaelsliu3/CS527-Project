using Microsoft.AspNetCore.Http;

namespace PlzBuyMe.Cdn.Dtos.Media;

public sealed record UploadMediaRequestDto
{
    public IFormFile? File { get; init; }
    public string? Folder { get; init; }
    public string? ReplaceKey { get; init; }
}
