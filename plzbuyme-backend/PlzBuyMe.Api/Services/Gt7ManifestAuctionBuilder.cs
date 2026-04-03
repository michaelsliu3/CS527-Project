using System.Text.RegularExpressions;
using PlzBuyMe.Api.Dtos.Auctions;
using PlzBuyMe.Api.Models;

namespace PlzBuyMe.Api.Services;

/// <summary>Ports logic from <c>scripts/create-auctions-temp.mjs</c> for GM manifest seeding.</summary>
public static class Gt7ManifestAuctionBuilder
{
    private static readonly Regex TwoDigitYearRegex = new(@"'(\d{2})(?!.*'\d{2})", RegexOptions.Compiled);
    private static readonly Regex FullYearRegex = new(@"\b(19\d{2}|20\d{2})\b", RegexOptions.Compiled);
    private static readonly Regex ManifestCatalogExternalIdRegex = new(@"^\d{3,8}$", RegexOptions.Compiled);

    public const string StringKeySedans = "sedans";
    public const string StringKeySuvs = "suvs";
    public const string StringKeyTrucks = "trucks";
    public const string StringKeySportsCars = "sports-cars";
    public const string StringKeyElectric = "electric";
    public const string StringKeyCompactSedans = "compact-sedans";
    public const string StringKeyFullSizeSedans = "full-size-sedans";

    public static List<Gt7ManifestAsset> SelectAssets(IReadOnlyList<Gt7ManifestAsset> all, int count, string? titleKeyword)
    {
        var baseList = all.Where(a => !string.IsNullOrWhiteSpace(a.Make) && !string.IsNullOrWhiteSpace(a.Model)).ToList();
        if (!string.IsNullOrWhiteSpace(titleKeyword))
        {
            var kw = titleKeyword.Trim().ToLowerInvariant();
            baseList = baseList.Where(a => (a.Title ?? "").ToLowerInvariant().Contains(kw)).ToList();
        }

        var pool = baseList.ToList();
        ShuffleInPlace(pool);
        return pool.Take(Math.Min(count, pool.Count)).ToList();
    }

    public static int ResolveAssetYear(Gt7ManifestAsset asset)
    {
        if (asset.Year is int y && y > 0)
            return y;

        var title = asset.Title ?? "";
        var two = TwoDigitYearRegex.Match(title);
        if (two.Success && int.TryParse(two.Groups[1].Value, out var yy))
            return yy <= 29 ? 2000 + yy : 1900 + yy;

        var full = FullYearRegex.Match(title);
        if (full.Success && int.TryParse(full.Groups[1].Value, out var fy))
            return fy;

        return DateTime.UtcNow.Year;
    }

    /// <summary>Resolves a <see cref="Category.StringKey"/> for manifest import (matches seeded categories).</summary>
    public static string InferCategoryStringKey(Gt7ManifestAsset asset)
    {
        var text = $"{asset.Title ?? ""} {asset.Make ?? ""} {asset.Model ?? ""}".ToLowerInvariant();

        var electricKeywords = new[]
        {
            "tesla", "ev", "electric", "leaf", "bolt", "ioniq", "rivian", "taycan", "e-tron", "id.",
            "model 3", "model s", "model x", "model y"
        };
        if (electricKeywords.Any(k => text.Contains(k)))
            return StringKeyElectric;

        var truckKeywords = new[]
        {
            "truck", "pickup", "f-150", "silverado", "sierra", "ram", "tacoma", "tundra", "hilux", "r1t"
        };
        if (truckKeywords.Any(k => text.Contains(k)))
            return StringKeyTrucks;

        var suvKeywords = new[]
        {
            "suv", "rav4", "cr-v", "wrangler", "cherokee", "bronco", "defender", "cayenne", "tiguan",
            "forester", "outback", "x5", "q5", "glc"
        };
        if (suvKeywords.Any(k => text.Contains(k)))
            return StringKeySuvs;

        var sportsKeywords = new[]
        {
            "gt-r", "gtr", "911", "corvette", "mustang", "supra", "ferrari", "lamborghini", "mclaren",
            "porsche", "nsx", "viper", "amg gt", "zonda", "skyline", "rx-7", "mx-5", "miata"
        };
        if (sportsKeywords.Any(k => text.Contains(k)))
            return StringKeySportsCars;

        return StringKeySedans;
    }

    /// <summary>
    /// Returns candidate category string keys in priority order.
    /// Prefers curated manifest categories; falls back to keyword-based inference.
    /// </summary>
    public static List<string> ResolveCategoryStringKeys(Gt7ManifestAsset asset)
    {
        var resolved = new List<string>();
        foreach (var raw in asset.Categories)
        {
            var normalized = NormalizeCategoryToStringKey(raw);
            if (normalized == null || resolved.Contains(normalized, StringComparer.Ordinal))
                continue;
            resolved.Add(normalized);
        }

        if (resolved.Count > 0)
            return resolved;

        return [InferCategoryStringKey(asset)];
    }

    private static string? NormalizeCategoryToStringKey(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw))
            return null;

        var trimmed = raw.Trim();
        var compact = trimmed.Replace(" ", "", StringComparison.Ordinal)
            .Replace("-", "", StringComparison.Ordinal)
            .ToLowerInvariant();
        return compact switch
        {
            "sedan" or "sedans" => StringKeySedans,
            "suv" or "suvs" => StringKeySuvs,
            "truck" or "trucks" => StringKeyTrucks,
            "sportscar" or "sportscars" => StringKeySportsCars,
            "electric" => StringKeyElectric,
            "compactsedan" or "compactsedans" => StringKeyCompactSedans,
            "fullsizesedan" or "fullsizesedans" => StringKeyFullSizeSedans,
            "cars" => "cars",
            _ => null
        };
    }

    /// <summary>
    /// Sets <see cref="CreateAuctionDto.ImageStorageKey"/> to the manifest <c>externalId</c> when it is numeric so
    /// <see cref="AuctionService.CreateAuctionAsync"/> can persist CDN paths without calling the resolve HTTP API.
    /// Never copies manifest image URLs into the DTO.
    /// </summary>
    public static CreateAuctionDto BuildCreateDto(
        Gt7ManifestAsset asset,
        Category category,
        int closeHoursMin,
        int closeHoursMax)
    {
        var fields = category.CategoryFields.ToList();
        int FieldId(string name) => fields.First(f => f.FieldName == name).Id;

        var year = ResolveAssetYear(asset);
        var hours = Random.Shared.Next(closeHoursMin, closeHoursMax + 1);
        var closeAt = DateTime.UtcNow.AddHours(hours);
        var initialPrice = Random.Shared.Next(6500, 85_000);
        var bidIncrement = Random.Shared.Next(50, 500);
        var reservePrice = initialPrice + Random.Shared.Next(300, 7000);
        var mileage = Random.Shared.Next(500, 180_000);
        var make = asset.Make!.Trim();
        var model = asset.Model!.Trim();
        var color = string.IsNullOrWhiteSpace(asset.Color) ? "Unknown" : asset.Color.Trim();
        var extId = asset.ExternalId?.Trim();
        var catalogKey = !string.IsNullOrEmpty(extId) && ManifestCatalogExternalIdRegex.IsMatch(extId)
            ? extId
            : null;

        return new CreateAuctionDto
        {
            Title = $"{make} {model} {year}",
            Description = $"GM seed listing (catalog id {asset.ExternalId}).",
            ImageUrl = null,
            ImageStorageKey = catalogKey,
            CategoryId = category.Id,
            InitialPrice = initialPrice,
            BidIncrement = bidIncrement,
            ReservePrice = reservePrice,
            CloseDateTime = closeAt,
            FieldValues =
            [
                new FieldValueDto(FieldId("Make"), make),
                new FieldValueDto(FieldId("Model"), model),
                new FieldValueDto(FieldId("Year"), year.ToString()),
                new FieldValueDto(FieldId("Mileage"), mileage.ToString()),
                new FieldValueDto(FieldId("Condition"), "Good"),
                new FieldValueDto(FieldId("Transmission"), "Automatic"),
                new FieldValueDto(FieldId("Fuel Type"), "Gasoline"),
                new FieldValueDto(FieldId("Exterior Color"), color)
            ]
        };
    }

    private static void ShuffleInPlace<T>(IList<T> list)
    {
        for (var i = list.Count - 1; i > 0; i--)
        {
            var j = Random.Shared.Next(i + 1);
            (list[i], list[j]) = (list[j], list[i]);
        }
    }
}
