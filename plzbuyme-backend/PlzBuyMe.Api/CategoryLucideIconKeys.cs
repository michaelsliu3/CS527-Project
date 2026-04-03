using System.Text.RegularExpressions;

namespace PlzBuyMe.Api;

/// <summary>Lucide icon keys: react-icons/lu export name without the Lu prefix (PascalCase).</summary>
public static class CategoryLucideIconKeys
{
    public const string Default = "Car";

    private static readonly Regex LucideIconKeyRegex = new(
        "^[A-Z][a-zA-Z0-9]{0,63}$",
        RegexOptions.CultureInvariant,
        TimeSpan.FromMilliseconds(100));

    /// <summary>Valid keys match Lucide PascalCase names (e.g. Car, CarFront, Bike).</summary>
    public static bool IsValidIconKeyFormat(string key) =>
        !string.IsNullOrEmpty(key) && key.Length <= 64 && LucideIconKeyRegex.IsMatch(key);
}
