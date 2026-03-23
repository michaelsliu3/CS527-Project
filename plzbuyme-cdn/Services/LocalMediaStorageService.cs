using System.Security.Cryptography;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Options;
using PlzBuyMe.Cdn.Options;

namespace PlzBuyMe.Cdn.Services;

public sealed class LocalMediaStorageService : IMediaStorageService
{
    private static readonly HashSet<string> AllowedFolders = new(StringComparer.Ordinal)
    {
        "avatars",
        "items"
    };

    private static readonly HashSet<string> AllowedExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".jpg",
        ".jpeg",
        ".png",
        ".gif",
        ".webp"
    };

    private readonly string _storageRoot;
    private readonly string _publicBaseUrl;

    public LocalMediaStorageService(IOptions<MediaStorageOptions> options, IWebHostEnvironment environment)
    {
        var resolvedOptions = options.Value;
        _storageRoot = MediaStorageOptionsResolver.ResolveStorageRoot(resolvedOptions, environment.ContentRootPath);
        _publicBaseUrl = (resolvedOptions.PublicBaseUrl ?? "http://localhost:5090").TrimEnd('/');

        Directory.CreateDirectory(_storageRoot);
    }

    public async Task<MediaUploadServiceResult> UploadAsync(
        IFormFile? file,
        string? folder,
        string? replaceKey,
        CancellationToken cancellationToken = default)
    {
        if (file == null || file.Length == 0)
            return new MediaUploadServiceResult(false, "file is required.", null);

        var normalizedFolder = (folder ?? string.Empty).Trim().ToLowerInvariant();
        if (!AllowedFolders.Contains(normalizedFolder))
            return new MediaUploadServiceResult(false, "folder must be one of: avatars, items.", null);

        var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (!AllowedExtensions.Contains(extension))
            return new MediaUploadServiceResult(false, "unsupported file extension.", null);

        if (!IsAllowedContentType(file.ContentType))
            return new MediaUploadServiceResult(false, "unsupported content type.", null);

        await using var readStream = file.OpenReadStream();
        using var hashStream = new MemoryStream();
        await readStream.CopyToAsync(hashStream, cancellationToken);
        var bytes = hashStream.ToArray();

        var hash = Convert.ToHexString(SHA256.HashData(bytes)).ToLowerInvariant();
        var year = DateTime.UtcNow.ToString("yyyy");
        var month = DateTime.UtcNow.ToString("MM");
        var key = $"{normalizedFolder}/{year}/{month}/{hash}{extension}";
        var targetPath = Path.Combine(_storageRoot, key.Replace('/', Path.DirectorySeparatorChar));
        var targetDirectory = Path.GetDirectoryName(targetPath)!;
        Directory.CreateDirectory(targetDirectory);

        if (!File.Exists(targetPath))
            await File.WriteAllBytesAsync(targetPath, bytes, cancellationToken);

        if (!string.IsNullOrWhiteSpace(replaceKey) && !string.Equals(replaceKey, key, StringComparison.OrdinalIgnoreCase))
            _ = TryDeleteInternal(replaceKey);

        return new MediaUploadServiceResult(
            true,
            null,
            new MediaUploadResult(
                key,
                $"{_publicBaseUrl}/media/{key}"));
    }

    public MediaDeleteServiceResult Delete(string? key)
    {
        if (string.IsNullOrWhiteSpace(key))
            return new MediaDeleteServiceResult(false, false, "key is required.");

        var deleted = TryDeleteInternal(Uri.UnescapeDataString(key));
        return deleted
            ? new MediaDeleteServiceResult(true, false, null)
            : new MediaDeleteServiceResult(false, true, null);
    }

    private bool TryDeleteInternal(string key)
    {
        if (!Regex.IsMatch(key, @"^[a-zA-Z0-9/_\.-]+$"))
            return false;

        var fullPath = Path.GetFullPath(Path.Combine(_storageRoot, key.Replace('/', Path.DirectorySeparatorChar)));
        var normalizedRoot = Path.GetFullPath(_storageRoot + Path.DirectorySeparatorChar);
        if (!fullPath.StartsWith(normalizedRoot, StringComparison.Ordinal))
            return false;
        if (!File.Exists(fullPath))
            return false;

        File.Delete(fullPath);
        return true;
    }

    private static bool IsAllowedContentType(string? contentType)
    {
        if (string.IsNullOrWhiteSpace(contentType))
            return false;

        var normalized = contentType.Trim().ToLowerInvariant();
        return normalized == "application/octet-stream"
               || normalized.StartsWith("image/", StringComparison.Ordinal)
               || normalized is "image/jpeg" or "image/png" or "image/gif" or "image/webp" or "image/jpg";
    }
}
