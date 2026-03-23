namespace PlzBuyMe.Cdn.Options;

public static class MediaStorageOptionsResolver
{
    public static string ResolveStorageRoot(MediaStorageOptions options, string contentRootPath)
    {
        var storageRoot = string.IsNullOrWhiteSpace(options.StorageRoot)
            ? Path.Combine(contentRootPath, "storage")
            : options.StorageRoot;

        if (!Path.IsPathRooted(storageRoot))
            storageRoot = Path.GetFullPath(Path.Combine(contentRootPath, storageRoot));

        return storageRoot;
    }
}
