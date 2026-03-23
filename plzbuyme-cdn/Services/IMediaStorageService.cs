using Microsoft.AspNetCore.Http;

namespace PlzBuyMe.Cdn.Services;

public interface IMediaStorageService
{
    Task<MediaUploadServiceResult> UploadAsync(IFormFile? file, string? folder, string? replaceKey, CancellationToken cancellationToken = default);
    MediaDeleteServiceResult Delete(string? key);
}

public sealed record MediaUploadServiceResult(bool Success, string? ErrorMessage, MediaUploadResult? Upload);
public sealed record MediaUploadResult(string Key, string Url);
public sealed record MediaDeleteServiceResult(bool Success, bool NotFound, string? ErrorMessage);
