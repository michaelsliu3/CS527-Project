using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using PlzBuyMe.Api.Data;
using PlzBuyMe.Api.Dtos;
using PlzBuyMe.Api.Dtos.Admin;
using PlzBuyMe.Api.Dtos.Admin.Gm;
using PlzBuyMe.Api.Dtos.Auctions;
using PlzBuyMe.Api.Models;

namespace PlzBuyMe.Api.Services;

public class AuctionService : IAuctionService
{
    private const string UploadedImageSource = "uploaded";
    private const string Gt7DefaultImageSource = "gt7-default";
    private const string PlaceholderImageSource = "placeholder";
    private const int GmBulkCloseActiveMax = 500;

    private static readonly Regex CatalogCarExternalIdRegex = new(
        @"car(\d{3,7})",
        RegexOptions.Compiled | RegexOptions.CultureInvariant | RegexOptions.IgnoreCase);

    /// <summary>Second paragraph appended to close-out messages; UI renders it in smaller text after a blank line.</summary>
    private const string WalletBalanceDisclaimerParagraph =
        "Wallet and payment amounts can take a short moment to process and show up in your balance.";

    private static string WithWalletBalanceDisclaimer(string primary) =>
        $"{primary}\n\n{WalletBalanceDisclaimerParagraph}";

    private readonly AppDbContext _db;
    private readonly IAlertService _alertService;
    private readonly ICdnGt7ThumbnailResolver _cdnGt7ThumbnailResolver;
    private readonly IWalletService _walletService;
    private readonly ILogger<AuctionService> _logger;
    private readonly string _mediaPublicBaseUrl;

    public AuctionService(
        AppDbContext db,
        IAlertService alertService,
        ICdnGt7ThumbnailResolver cdnGt7ThumbnailResolver,
        IWalletService walletService,
        IConfiguration configuration,
        ILogger<AuctionService> logger)
    {
        _db = db;
        _alertService = alertService;
        _cdnGt7ThumbnailResolver = cdnGt7ThumbnailResolver;
        _walletService = walletService;
        _logger = logger;
        _mediaPublicBaseUrl = (configuration["MediaStorage:ServiceBaseUrl"] ?? "http://localhost:5090").TrimEnd('/');
    }

    public async Task<AuctionDetailDto?> CreateAuctionAsync(CreateAuctionDto dto, int sellerId)
    {
        var category = await _db.Categories
            .Include(c => c.CategoryFields)
            .FirstOrDefaultAsync(c => c.Id == dto.CategoryId);
        if (category == null)
            return null;

        string? imageUrl;
        string? imageStorageKey;
        string? imageSource;
        string? imageMatchLevel;

        var manifestCatalogId = HintManifestCatalogExternalId(dto.ImageStorageKey, dto.ImageUrl);
        if (manifestCatalogId != null)
        {
            imageUrl = $"{_mediaPublicBaseUrl}/media/cars/gt7/car{manifestCatalogId}.png";
            imageStorageKey = manifestCatalogId;
            imageSource = Gt7DefaultImageSource;
            imageMatchLevel = "manifest";
        }
        else
        {
            var uploadedImageValue = NormalizeMediaKey(dto.ImageStorageKey, dto.ImageUrl);
            var hasUploadedImage = !string.IsNullOrWhiteSpace(uploadedImageValue);
            imageUrl = uploadedImageValue;
            imageStorageKey = hasUploadedImage ? uploadedImageValue : null;
            imageSource = hasUploadedImage ? UploadedImageSource : null;
            imageMatchLevel = null;

            if (!hasUploadedImage)
            {
                var defaultResolution = await ResolveDefaultImageForCreateAsync(category, dto.FieldValues);
                if (defaultResolution.Found)
                {
                    var extId = ResolveCatalogCarIdForCreate(defaultResolution);
                    if (extId != null)
                    {
                        imageUrl = $"{_mediaPublicBaseUrl}/media/cars/gt7/car{extId}.png";
                        imageStorageKey = extId;
                        imageSource = Gt7DefaultImageSource;
                        imageMatchLevel = defaultResolution.MatchLevel;
                    }
                    else
                    {
                        imageUrl = null;
                        imageStorageKey = null;
                        imageSource = PlaceholderImageSource;
                        imageMatchLevel = "none";
                    }
                }
                else
                {
                    imageUrl = null;
                    imageStorageKey = null;
                    imageSource = PlaceholderImageSource;
                    imageMatchLevel = "none";
                }
            }
        }

        SanitizeGranTurismoBeforePersist(ref imageUrl, ref imageStorageKey, ref imageSource, ref imageMatchLevel);

        var item = new Item
        {
            SellerId = sellerId,
            CategoryId = dto.CategoryId,
            Title = dto.Title.Trim(),
            Description = string.IsNullOrWhiteSpace(dto.Description) ? null : dto.Description.Trim(),
            ImageUrl = imageUrl,
            ImageStorageKey = imageStorageKey,
            ImageSource = imageSource,
            ImageMatchLevel = imageMatchLevel,
            InitialPrice = dto.InitialPrice,
            BidIncrement = dto.BidIncrement,
            ReservePrice = dto.ReservePrice,
            CurrentPrice = dto.InitialPrice,
            CloseDateTime = dto.CloseDateTime.ToUniversalTime(),
            Status = ItemStatus.Active
        };
        _db.Items.Add(item);
        await _db.SaveChangesAsync();

        foreach (var fv in dto.FieldValues ?? new List<FieldValueDto>())
        {
            _db.ItemFieldValues.Add(new ItemFieldValue
            {
                ItemId = item.Id,
                FieldId = fv.FieldId,
                Value = fv.Value?.Trim() ?? string.Empty
            });
        }
        await _db.SaveChangesAsync();

        await _alertService.CheckAlertsForNewItemAsync(item);
        return await GetByIdAsync(item.Id);
    }

    private static string? NormalizeMediaKey(string? explicitKey, string? fallbackValue)
    {
        if (!string.IsNullOrWhiteSpace(explicitKey))
            return explicitKey.Trim();
        if (!string.IsNullOrWhiteSpace(fallbackValue))
            return fallbackValue.Trim();
        return null;
    }

    /// <summary>Matches <c>car####</c> in thumbnail/detail paths (CDN or third-party).</summary>
    private static string? TryExtractCatalogCarIdFromImagePath(string? text)
    {
        if (string.IsNullOrWhiteSpace(text))
            return null;
        var m = CatalogCarExternalIdRegex.Match(text);
        return m.Success ? m.Groups[1].Value : null;
    }

    /// <summary>
    /// GM manifest seed: numeric <c>externalId</c> only, no <see cref="CreateAuctionDto.ImageUrl"/> — not a user upload key.
    /// </summary>
    private static string? HintManifestCatalogExternalId(string? imageStorageKey, string? imageUrl)
    {
        if (!string.IsNullOrWhiteSpace(imageUrl))
            return null;
        if (string.IsNullOrWhiteSpace(imageStorageKey))
            return null;
        var k = imageStorageKey.Trim();
        return Regex.IsMatch(k, @"^\d{3,8}$") ? k : null;
    }

    private void SanitizeGranTurismoBeforePersist(
        ref string? imageUrl,
        ref string? imageStorageKey,
        ref string? imageSource,
        ref string? imageMatchLevel)
    {
        static bool IsGranTurismoHost(string? s) =>
            !string.IsNullOrWhiteSpace(s) && s.Contains("gran-turismo.com", StringComparison.OrdinalIgnoreCase);

        if (!IsGranTurismoHost(imageUrl) && !IsGranTurismoHost(imageStorageKey))
            return;

        var id = TryExtractCatalogCarIdFromImagePath(imageUrl) ?? TryExtractCatalogCarIdFromImagePath(imageStorageKey);
        if (id == null)
            return;

        imageUrl = $"{_mediaPublicBaseUrl}/media/cars/gt7/car{id}.png";
        imageStorageKey = id;
        imageSource = Gt7DefaultImageSource;
        if (string.IsNullOrWhiteSpace(imageMatchLevel))
            imageMatchLevel = "sanitized";
    }

    private static string? ResolveCatalogCarIdForCreate(CdnGt7ThumbnailResolveResult resolution)
    {
        if (!string.IsNullOrWhiteSpace(resolution.ExternalId))
        {
            var t = resolution.ExternalId.Trim();
            if (Regex.IsMatch(t, @"^\d{3,7}$"))
                return t;
        }

        return TryExtractCatalogCarIdFromImagePath(resolution.Url)
            ?? TryExtractCatalogCarIdFromImagePath(resolution.DetailUrl);
    }

    private static string? TryExtractCatalogCarExternalIdFromThirdPartyUrl(string? text)
    {
        if (string.IsNullOrWhiteSpace(text))
            return null;
        if (!text.Contains("gran-turismo.com", StringComparison.OrdinalIgnoreCase))
            return null;
        return TryExtractCatalogCarIdFromImagePath(text);
    }

    /// <summary>
    /// Catalog listings use a numeric storage key; legacy rows may only have third-party image URLs.
    /// Resolved paths use <c>MediaStorage:ServiceBaseUrl</c> so clients load mirrored CDN assets.
    /// </summary>
    private string? TryResolveCatalogCarExternalId(string? imageUrl, string? imageStorageKey, string? imageSource)
    {
        if (string.Equals(imageSource, Gt7DefaultImageSource, StringComparison.Ordinal)
            && !string.IsNullOrWhiteSpace(imageStorageKey))
        {
            var key = imageStorageKey.Trim();
            if (Regex.IsMatch(key, @"^\d{3,7}$"))
                return key;
        }

        return TryExtractCatalogCarExternalIdFromThirdPartyUrl(imageUrl)
            ?? TryExtractCatalogCarExternalIdFromThirdPartyUrl(imageStorageKey);
    }

    private string? NormalizeCatalogListingImage(string? imageUrl, string? imageStorageKey, string? imageSource)
    {
        var id = TryResolveCatalogCarExternalId(imageUrl, imageStorageKey, imageSource);
        if (id != null)
            return $"{_mediaPublicBaseUrl}/media/cars/gt7/car{id}.png";
        return imageUrl;
    }

    private (string? ImageUrl, string? DetailImageUrl) NormalizeCatalogDisplayImages(
        string? imageUrl,
        string? imageStorageKey,
        string? imageSource)
    {
        var id = TryResolveCatalogCarExternalId(imageUrl, imageStorageKey, imageSource);
        if (id != null)
        {
            return (
                $"{_mediaPublicBaseUrl}/media/cars/gt7/car{id}.png",
                $"{_mediaPublicBaseUrl}/media/cars/gt7/detail/car{id}.jpg");
        }

        return (imageUrl, imageUrl);
    }

    private AuctionListDto ToAuctionListDto(
        int id,
        string title,
        string? imageUrl,
        string? imageStorageKey,
        string? imageSource,
        string? imageMatchLevel,
        decimal currentPrice,
        DateTime closeDateTime,
        string statusLower,
        string categoryName,
        string sellerUsername,
        string? sellerDisplayNameColor,
        int bidCount) =>
        new()
        {
            Id = id,
            Title = title,
            ImageUrl = NormalizeCatalogListingImage(imageUrl, imageStorageKey, imageSource),
            ImageSource = imageSource,
            ImageMatchLevel = imageMatchLevel,
            CurrentPrice = currentPrice,
            CloseDateTime = closeDateTime,
            Status = statusLower,
            CategoryName = categoryName,
            SellerUsername = sellerUsername,
            SellerDisplayNameColor = sellerDisplayNameColor,
            BidCount = bidCount
        };

    private async Task<CdnGt7ThumbnailResolveResult> ResolveDefaultImageForCreateAsync(Category category, List<FieldValueDto>? fieldValues)
    {
        var map = (fieldValues ?? new List<FieldValueDto>())
            .GroupBy(v => v.FieldId)
            .ToDictionary(g => g.Key, g => g.First().Value?.Trim() ?? string.Empty);
        if (map.Count == 0)
            return new CdnGt7ThumbnailResolveResult(false, "none", null, null, null);

        var makeFieldId = category.CategoryFields.FirstOrDefault(f => f.FieldName == "Make")?.Id;
        var modelFieldId = category.CategoryFields.FirstOrDefault(f => f.FieldName == "Model")?.Id;
        var yearFieldId = category.CategoryFields.FirstOrDefault(f => f.FieldName == "Year")?.Id;

        map.TryGetValue(makeFieldId ?? -1, out var make);
        map.TryGetValue(modelFieldId ?? -1, out var model);
        map.TryGetValue(yearFieldId ?? -1, out var yearRaw);
        int? year = int.TryParse(yearRaw, out var parsedYear) ? parsedYear : null;

        return await _cdnGt7ThumbnailResolver.ResolveAsync(make, model, year);
    }

    public async Task PlaceBidAsync(int itemId, int bidderId, decimal amount)
    {
        var item = await _db.Items
            .Include(i => i.Seller)
            .FirstOrDefaultAsync(i => i.Id == itemId);
        if (item == null)
            throw new InvalidOperationException("Auction not found.");
        if (item.Status != ItemStatus.Active)
            throw new InvalidOperationException("Auction is not active.");
        if (item.CloseDateTime <= DateTime.UtcNow)
            throw new InvalidOperationException("This auction has ended.");
        if (item.SellerId == bidderId)
            throw new InvalidOperationException("Sellers cannot bid on their own items.");
        if (amount < item.CurrentPrice + item.BidIncrement)
            throw new InvalidOperationException("Bid too low.");

        await _walletService.ApplyBidHoldAsync(itemId, bidderId, amount);

        _db.Bids.Add(new Bid { ItemId = itemId, BidderId = bidderId, Amount = amount, IsAuto = false });
        var previousHighBidderId = await _db.Bids
            .Where(b => b.ItemId == itemId && b.BidderId != bidderId)
            .OrderByDescending(b => b.Amount)
            .Select(b => (int?)b.BidderId)
            .FirstOrDefaultAsync();
        item.CurrentPrice = amount;
        await NotifyOutbidAsync(item, previousHighBidderId, bidderId);
        await TriggerAutoBidsAsync(item, bidderId);
        await _db.SaveChangesAsync();
    }

    public async Task SetAutoBidAsync(int itemId, int bidderId, decimal upperLimit)
    {
        var item = await _db.Items.FirstOrDefaultAsync(i => i.Id == itemId);
        if (item == null)
            throw new InvalidOperationException("Auction not found.");
        if (item.Status != ItemStatus.Active)
            throw new InvalidOperationException("Auction is not active.");
        if (item.CloseDateTime <= DateTime.UtcNow)
            throw new InvalidOperationException("This auction has ended.");
        if (item.SellerId == bidderId)
            throw new InvalidOperationException("Sellers cannot set auto-bid on their own items.");
        if (upperLimit < item.CurrentPrice + item.BidIncrement)
            throw new InvalidOperationException("Upper limit must be at least current price plus increment.");

        var existing = await _db.AutoBids.FirstOrDefaultAsync(ab => ab.ItemId == itemId && ab.BidderId == bidderId);
        if (existing != null)
        {
            existing.UpperLimit = upperLimit;
            existing.IsActive = true;
        }
        else
            _db.AutoBids.Add(new AutoBid { ItemId = itemId, BidderId = bidderId, UpperLimit = upperLimit, IsActive = true });
        await _db.SaveChangesAsync();

        await TriggerAutoBidsAsync(item, excludeUserId: null);
        await _db.SaveChangesAsync();
    }

    private async Task NotifyOutbidAsync(Item item, int? outbidUserId, int newBidderId)
    {
        if (!outbidUserId.HasValue || outbidUserId == newBidderId)
            return;
        _db.Notifications.Add(new Notification
        {
            UserId = outbidUserId.Value,
            ItemId = item.Id,
            Type = NotificationType.Outbid,
            Message = $"You were outbid on \"{item.Title}\"."
        });
        await Task.CompletedTask;
    }

    private async Task TriggerAutoBidsAsync(Item item, int? excludeUserId)
    {
        if (item.Status != ItemStatus.Active || item.CloseDateTime <= DateTime.UtcNow)
            return;

        var autoBids = await _db.AutoBids
            .Where(ab => ab.ItemId == item.Id && ab.IsActive && ab.BidderId != excludeUserId)
            .OrderByDescending(ab => ab.UpperLimit)
            .ToListAsync();

        foreach (var ab in autoBids)
        {
            var needed = item.CurrentPrice + item.BidIncrement;
            if (needed <= ab.UpperLimit)
            {
                await _walletService.ApplyBidHoldAsync(item.Id, ab.BidderId, needed);

                _db.Bids.Add(new Bid
                {
                    ItemId = item.Id,
                    BidderId = ab.BidderId,
                    Amount = needed,
                    IsAuto = true
                });
                item.CurrentPrice = needed;
                _db.Notifications.Add(new Notification
                {
                    UserId = ab.BidderId,
                    ItemId = item.Id,
                    Type = NotificationType.AutoBidPlaced,
                    Message = $"Your auto-bid placed a bid of ${needed:N2} on \"{item.Title}\"."
                });
                var previousHigh = await _db.Bids
                    .Where(b => b.ItemId == item.Id && b.BidderId != ab.BidderId)
                    .OrderByDescending(b => b.Amount)
                    .Select(b => (int?)b.BidderId)
                    .FirstOrDefaultAsync();
                await NotifyOutbidAsync(item, previousHigh, ab.BidderId);
                await TriggerAutoBidsAsync(item, ab.BidderId);
                return;
            }

            ab.IsActive = false;
            _db.Notifications.Add(new Notification
            {
                UserId = ab.BidderId,
                ItemId = item.Id,
                Type = NotificationType.AutoLimitReached,
                Message = $"Your auto-bid limit was exceeded on \"{item.Title}\"."
            });
        }
    }

    public async Task CloseExpiredAsync()
    {
        var expired = await _db.Items
            .Where(i => i.Status == ItemStatus.Active && i.CloseDateTime <= DateTime.UtcNow)
            .ToListAsync();

        foreach (var item in expired)
            await ProcessActiveAuctionCloseByRulesAsync(item);

        await _db.SaveChangesAsync();
    }

    public async Task<PaginatedResultDto<AuctionListDto>> SearchAsync(SearchQueryDto query)
    {
        var page = Math.Max(1, query.Page);
        var pageSize = Math.Clamp(query.PageSize, 1, 50);

        var q = _db.Items
            .Include(i => i.Category)
            .Include(i => i.Seller)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(query.Q))
        {
            var term = query.Q.Trim();
            var likePattern = $"%{term}%";
            q = q.Where(i =>
                EF.Functions.Like(i.Title, likePattern) ||
                (i.Description != null && EF.Functions.Like(i.Description, likePattern)));
        }
        if (query.CategoryId.HasValue)
            q = q.Where(i => i.CategoryId == query.CategoryId.Value);
        if (query.MinPrice.HasValue)
            q = q.Where(i => i.CurrentPrice >= query.MinPrice.Value);
        if (query.MaxPrice.HasValue)
            q = q.Where(i => i.CurrentPrice <= query.MaxPrice.Value);
        if (!string.IsNullOrWhiteSpace(query.Status) && Enum.TryParse<ItemStatus>(query.Status, true, out var statusEnum))
            q = q.Where(i => i.Status == statusEnum);
        if (query.ClosingBefore.HasValue)
            q = q.Where(i => i.CloseDateTime <= query.ClosingBefore.Value.ToUniversalTime());
        if (query.ClosingAfter.HasValue)
            q = q.Where(i => i.CloseDateTime >= query.ClosingAfter.Value.ToUniversalTime());
        if (!string.IsNullOrWhiteSpace(query.Seller))
        {
            var sellerLower = query.Seller.Trim().ToLower();
            q = q.Where(i => i.Seller != null && i.Seller.Username.ToLower().Contains(sellerLower));
        }

        var fieldFilters = await BuildFieldFiltersAsync(query);
        foreach (var (fieldId, filter) in fieldFilters)
        {
            var fid = fieldId;
            if (filter.Text != null)
            {
                var textLower = filter.Text.Trim().ToLower();
                q = q.Where(i => i.ItemFieldValues.Any(iv => iv.FieldId == fid && iv.Value != null && iv.Value.ToLower().Contains(textLower)));
            }
            else if (filter.Min.HasValue || filter.Max.HasValue)
            {
                var min = filter.Min ?? int.MinValue;
                var max = filter.Max ?? int.MaxValue;
                var validIds = await _db.ItemFieldValues
                    .Where(iv => iv.FieldId == fid)
                    .Select(iv => new { iv.ItemId, iv.Value })
                    .ToListAsync();
                var idsInRange = validIds
                    .Where(x => int.TryParse(x.Value, out var v) && v >= min && v <= max)
                    .Select(x => x.ItemId)
                    .Distinct()
                    .ToList();
                q = q.Where(i => idsInRange.Contains(i.Id));
            }
            else if (filter.SelectValues != null && filter.SelectValues.Count > 0)
            {
                var values = filter.SelectValues;
                q = q.Where(i => i.ItemFieldValues.Any(iv => iv.FieldId == fid && values.Contains(iv.Value)));
            }
        }

        var sortKind = query.Sort?.ToLowerInvariant();
        var useFieldSort = sortKind is "year_newest" or "year_oldest" or "mileage_low" or "mileage_high";
        int? yearFieldId = null, mileageFieldId = null;
        if (query.CategoryId.HasValue && useFieldSort)
        {
            var fieldIds = await _db.CategoryFields
                .Where(f => f.CategoryId == query.CategoryId.Value && (f.FieldName == "Year" || f.FieldName == "Mileage"))
                .Select(f => new { f.FieldName, f.Id })
                .ToListAsync();
            yearFieldId = fieldIds.FirstOrDefault(f => f.FieldName == "Year")?.Id;
            mileageFieldId = fieldIds.FirstOrDefault(f => f.FieldName == "Mileage")?.Id;
        }

        List<AuctionListDto> items;
        int total;
        if (useFieldSort && (yearFieldId.HasValue || mileageFieldId.HasValue))
        {
            var orderedIds = await GetItemIdsOrderedByNumericFieldAsync(q, sortKind!, yearFieldId, mileageFieldId);
            total = orderedIds.Count;
            var idsForPage = orderedIds.Skip((page - 1) * pageSize).Take(pageSize).ToList();
            if (idsForPage.Count == 0)
                return new PaginatedResultDto<AuctionListDto> { Items = new List<AuctionListDto>(), TotalCount = total, Page = page, PageSize = pageSize };
            var rows = await _db.Items
                .Include(i => i.Category)
                .Include(i => i.Seller)
                .Where(i => idsForPage.Contains(i.Id))
                .Select(i => new
                {
                    i.Id,
                    i.Title,
                    i.ImageUrl,
                    i.ImageStorageKey,
                    i.ImageSource,
                    i.ImageMatchLevel,
                    i.CurrentPrice,
                    i.CloseDateTime,
                    i.Status,
                    CategoryName = i.Category.Name,
                    SellerUsername = i.Seller.Username,
                    SellerDisplayNameColor = i.Seller.DisplayNameColor,
                    BidCount = i.Bids.Count
                })
                .ToListAsync();
            var byId = rows.ToDictionary(r => r.Id);
            items = idsForPage.Select(id =>
            {
                var r = byId[id];
                return ToAuctionListDto(
                    r.Id,
                    r.Title,
                    r.ImageUrl,
                    r.ImageStorageKey,
                    r.ImageSource,
                    r.ImageMatchLevel,
                    r.CurrentPrice,
                    r.CloseDateTime,
                    r.Status.ToString().ToLowerInvariant(),
                    r.CategoryName,
                    r.SellerUsername,
                    r.SellerDisplayNameColor,
                    r.BidCount);
            }).ToList();
        }
        else
        {
            q = ApplySort(q, query.Sort, null, null);
            total = await q.CountAsync();
            var pageRows = await q
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(i => new
                {
                    i.Id,
                    i.Title,
                    i.ImageUrl,
                    i.ImageStorageKey,
                    i.ImageSource,
                    i.ImageMatchLevel,
                    i.CurrentPrice,
                    i.CloseDateTime,
                    i.Status,
                    CategoryName = i.Category.Name,
                    SellerUsername = i.Seller.Username,
                    SellerDisplayNameColor = i.Seller.DisplayNameColor,
                    BidCount = i.Bids.Count
                })
                .ToListAsync();
            items = pageRows.Select(r => ToAuctionListDto(
                r.Id,
                r.Title,
                r.ImageUrl,
                r.ImageStorageKey,
                r.ImageSource,
                r.ImageMatchLevel,
                r.CurrentPrice,
                r.CloseDateTime,
                r.Status.ToString().ToLowerInvariant(),
                r.CategoryName,
                r.SellerUsername,
                r.SellerDisplayNameColor,
                r.BidCount)).ToList();
        }

        return new PaginatedResultDto<AuctionListDto> { Items = items, TotalCount = total, Page = page, PageSize = pageSize };
    }

    private async Task<List<int>> GetItemIdsOrderedByNumericFieldAsync(
        IQueryable<Item> baseQuery,
        string sortKind,
        int? yearFieldId,
        int? mileageFieldId)
    {
        var itemIds = await baseQuery.Select(i => i.Id).ToListAsync();
        if (itemIds.Count == 0) return new List<int>();
        int? fieldId = sortKind switch
        {
            "year_newest" or "year_oldest" => yearFieldId,
            "mileage_low" or "mileage_high" => mileageFieldId,
            _ => null
        };
        if (!fieldId.HasValue) return itemIds;
        var values = await _db.ItemFieldValues
            .Where(iv => itemIds.Contains(iv.ItemId) && iv.FieldId == fieldId.Value)
            .Select(iv => new { iv.ItemId, iv.Value })
            .ToListAsync();
        var defaultVal = sortKind is "year_newest" or "mileage_high" ? 0 : int.MaxValue;
        var parsed = values
            .Select(x => (x.ItemId, Val: int.TryParse(x.Value, out var v) ? v : defaultVal))
            .GroupBy(x => x.ItemId)
            .ToDictionary(g => g.Key, g => g.First().Val);
        var desc = sortKind is "year_newest" or "mileage_high";
        return desc
            ? itemIds.OrderByDescending(id => parsed.GetValueOrDefault(id, 0)).ToList()
            : itemIds.OrderBy(id => parsed.GetValueOrDefault(id, int.MaxValue)).ToList();
    }

    private async Task<List<(int FieldId, FieldFilterValue Filter)>> BuildFieldFiltersAsync(SearchQueryDto query)
    {
        var result = new List<(int, FieldFilterValue)>();
        var categoryId = query.CategoryId;

        if (categoryId.HasValue)
        {
            var fieldsByName = await _db.CategoryFields
                .Where(f => f.CategoryId == categoryId.Value)
                .ToDictionaryAsync(f => f.FieldName, f => f.Id);

            if (!string.IsNullOrWhiteSpace(query.Make))
                AddTextFilter(fieldsByName, "Make", query.Make, result);
            if (!string.IsNullOrWhiteSpace(query.Model))
                AddTextFilter(fieldsByName, "Model", query.Model, result);
            if (query.YearMin.HasValue || query.YearMax.HasValue)
                AddNumberRangeFilter(fieldsByName, "Year", query.YearMin, query.YearMax, result);
            if (query.MileageMax.HasValue)
                AddNumberRangeFilter(fieldsByName, "Mileage", null, query.MileageMax, result);
            if (!string.IsNullOrWhiteSpace(query.ExteriorColor))
                AddTextFilter(fieldsByName, "Exterior Color", query.ExteriorColor, result);
            if (query.Condition != null && query.Condition.Count > 0)
                AddSelectFilter(fieldsByName, "Condition", query.Condition, result);
            if (query.Transmission != null && query.Transmission.Count > 0)
                AddSelectFilter(fieldsByName, "Transmission", query.Transmission, result);
            if (query.FuelType != null && query.FuelType.Count > 0)
                AddSelectFilter(fieldsByName, "Fuel Type", query.FuelType, result);
        }

        if (!string.IsNullOrWhiteSpace(query.FieldFilters))
        {
            try
            {
                var dict = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(query.FieldFilters);
                if (dict != null)
                {
                    foreach (var kv in dict)
                        if (int.TryParse(kv.Key, out var fieldId))
                        {
                            if (kv.Value.ValueKind == JsonValueKind.String)
                                result.Add((fieldId, new FieldFilterValue { Text = kv.Value.GetString() }));
                            else if (kv.Value.ValueKind == JsonValueKind.Object)
                            {
                                int? min = null, max = null;
                                if (kv.Value.TryGetProperty("min", out var minProp))
                                    min = minProp.TryGetInt32(out var m) ? m : null;
                                if (kv.Value.TryGetProperty("max", out var maxProp))
                                    max = maxProp.TryGetInt32(out var m) ? m : null;
                                result.Add((fieldId, new FieldFilterValue { Min = min, Max = max }));
                            }
                            else if (kv.Value.ValueKind == JsonValueKind.Array)
                            {
                                var list = new List<string>();
                                foreach (var e in kv.Value.EnumerateArray())
                                    if (e.ValueKind == JsonValueKind.String && e.GetString() is { } s)
                                        list.Add(s);
                                result.Add((fieldId, new FieldFilterValue { SelectValues = list }));
                            }
                        }
                }
            }
            catch (Exception ex)
            {
                _logger.LogDebug(ex, "Invalid FieldFilters JSON ignored: {FieldFilters}", query.FieldFilters);
            }
        }

        return result;
    }

    private static void AddTextFilter(Dictionary<string, int> fieldsByName, string name, string value, List<(int, FieldFilterValue)> result)
    {
        if (fieldsByName.TryGetValue(name, out var id))
            result.Add((id, new FieldFilterValue { Text = value.Trim() }));
    }

    private static void AddNumberRangeFilter(Dictionary<string, int> fieldsByName, string name, int? min, int? max, List<(int, FieldFilterValue)> result)
    {
        if (!min.HasValue && !max.HasValue) return;
        if (fieldsByName.TryGetValue(name, out var id))
            result.Add((id, new FieldFilterValue { Min = min, Max = max }));
    }

    private static void AddSelectFilter(Dictionary<string, int> fieldsByName, string name, List<string> values, List<(int, FieldFilterValue)> result)
    {
        if (fieldsByName.TryGetValue(name, out var id))
            result.Add((id, new FieldFilterValue { SelectValues = values }));
    }

    private static IQueryable<Item> ApplySort(IQueryable<Item> q, string? sort, int? yearFieldId, int? mileageFieldId)
    {
        var s = sort?.ToLowerInvariant();
        if (s == "price_asc") return q.OrderBy(i => i.CurrentPrice);
        if (s == "price_desc") return q.OrderByDescending(i => i.CurrentPrice);
        if (s == "closing_soon") return q.OrderBy(i => i.CloseDateTime);
        if (s == "newest") return q.OrderByDescending(i => i.CreatedAt);
        if (s == "most_bids") return q.OrderByDescending(i => i.Bids.Count);
        return q.OrderBy(i => i.CreatedAt);
    }

    private class FieldFilterValue
    {
        public string? Text { get; set; }
        public int? Min { get; set; }
        public int? Max { get; set; }
        public List<string>? SelectValues { get; set; }
    }

    public async Task<AuctionDetailDto?> GetByIdAsync(int id)
    {
        var item = await _db.Items
            .Include(i => i.Category)
            .Include(i => i.Seller)
            .Include(i => i.ItemFieldValues).ThenInclude(iv => iv.Field)
            .Include(i => i.Bids).ThenInclude(b => b.Bidder)
            .FirstOrDefaultAsync(i => i.Id == id);
        if (item == null)
            return null;

        var bidHistory = item.Bids
            .OrderByDescending(b => b.CreatedAt)
            .Select(b => new BidHistoryItemDto
            {
                Id = b.Id,
                BidderUsername = b.Bidder.Username,
                BidderAvatarUrl = b.Bidder.AvatarUrl,
                BidderDisplayNameColor = b.Bidder.DisplayNameColor,
                Amount = b.Amount,
                IsAuto = b.IsAuto,
                CreatedAt = b.CreatedAt
            })
            .ToList();

        var (displayImageUrl, detailImageUrl) = NormalizeCatalogDisplayImages(
            item.ImageUrl,
            item.ImageStorageKey,
            item.ImageSource);

        return new AuctionDetailDto
        {
            Id = item.Id,
            Title = item.Title,
            Description = item.Description,
            ImageUrl = displayImageUrl,
            DetailImageUrl = detailImageUrl,
            ImageSource = item.ImageSource,
            ImageMatchLevel = item.ImageMatchLevel,
            CategoryId = item.CategoryId,
            CategoryName = item.Category.Name,
            SellerId = item.SellerId,
            SellerUsername = item.Seller.Username,
            SellerAvatarUrl = item.Seller.AvatarUrl,
            SellerDisplayNameColor = item.Seller.DisplayNameColor,
            InitialPrice = item.InitialPrice,
            BidIncrement = item.BidIncrement,
            ReservePrice = item.ReservePrice,
            CurrentPrice = item.CurrentPrice,
            CloseDateTime = item.CloseDateTime,
            Status = item.Status.ToString().ToLowerInvariant(),
            WinnerId = item.WinnerId,
            CreatedAt = item.CreatedAt,
            FieldValues = item.ItemFieldValues.Select(iv => new CategoryFieldValueDto(iv.Field?.FieldName ?? "", iv.Value)).ToList(),
            BidHistory = bidHistory
        };
    }

    public async Task<List<AuctionListDto>> GetMineAsync(int userId, string? status = null)
    {
        var q = _db.Items
            .Include(i => i.Category)
            .Include(i => i.Seller)
            .Where(i => i.SellerId == userId);

        if (!string.IsNullOrWhiteSpace(status) && Enum.TryParse<ItemStatus>(status, true, out var statusEnum))
            q = q.Where(i => i.Status == statusEnum);

        var mineRows = await q
            .OrderByDescending(i => i.CreatedAt)
            .Select(i => new
            {
                i.Id,
                i.Title,
                i.ImageUrl,
                i.ImageStorageKey,
                i.ImageSource,
                i.ImageMatchLevel,
                i.CurrentPrice,
                i.CloseDateTime,
                i.Status,
                CategoryName = i.Category.Name,
                SellerUsername = i.Seller.Username,
                SellerDisplayNameColor = i.Seller.DisplayNameColor,
                BidCount = i.Bids.Count
            })
            .ToListAsync();
        return mineRows.Select(r => ToAuctionListDto(
            r.Id,
            r.Title,
            r.ImageUrl,
            r.ImageStorageKey,
            r.ImageSource,
            r.ImageMatchLevel,
            r.CurrentPrice,
            r.CloseDateTime,
            r.Status.ToString().ToLowerInvariant(),
            r.CategoryName,
            r.SellerUsername,
            r.SellerDisplayNameColor,
            r.BidCount)).ToList();
    }

    public async Task<List<AuctionListDto>> GetSimilarAsync(int itemId, int limit = 10)
    {
        var item = await _db.Items
            .Include(i => i.ItemFieldValues)
            .FirstOrDefaultAsync(i => i.Id == itemId);
        if (item == null)
            return new List<AuctionListDto>();

        var monthAgo = item.CreatedAt.AddMonths(-1);
        var sameCategory = await _db.Items
            .Include(i => i.Category)
            .Include(i => i.Seller)
            .Include(i => i.ItemFieldValues)
            .Include(i => i.Bids)
            .Where(i => i.CategoryId == item.CategoryId && i.Id != itemId && i.CreatedAt >= monthAgo)
            .ToListAsync();

        var itemValues = item.ItemFieldValues.Select(iv => iv.Value).ToHashSet();
        var scored = sameCategory
            .Select(i => new { Item = i, Score = i.ItemFieldValues.Count(iv => itemValues.Contains(iv.Value)) })
            .OrderByDescending(x => x.Score)
            .ThenByDescending(x => x.Item.CreatedAt)
            .Take(limit)
            .Select(x => ToAuctionListDto(
                x.Item.Id,
                x.Item.Title,
                x.Item.ImageUrl,
                x.Item.ImageStorageKey,
                x.Item.ImageSource,
                x.Item.ImageMatchLevel,
                x.Item.CurrentPrice,
                x.Item.CloseDateTime,
                x.Item.Status.ToString().ToLowerInvariant(),
                x.Item.Category.Name,
                x.Item.Seller.Username,
                x.Item.Seller.DisplayNameColor,
                x.Item.Bids.Count))
            .ToList();

        return scored;
    }

    public async Task<List<AuctionListDto>> GetHistoryAsync(int userId)
    {
        var itemIds = await _db.Bids.Where(b => b.BidderId == userId).Select(b => b.ItemId).Distinct().ToListAsync();
        var soldByUser = await _db.Items.Where(i => i.SellerId == userId).Select(i => i.Id).ToListAsync();
        var allIds = itemIds.Union(soldByUser).Distinct().ToList();
        if (allIds.Count == 0)
            return new List<AuctionListDto>();

        var histRows = await _db.Items
            .Include(i => i.Category)
            .Include(i => i.Seller)
            .Where(i => allIds.Contains(i.Id))
            .OrderByDescending(i => i.CreatedAt)
            .Select(i => new
            {
                i.Id,
                i.Title,
                i.ImageUrl,
                i.ImageStorageKey,
                i.ImageSource,
                i.ImageMatchLevel,
                i.CurrentPrice,
                i.CloseDateTime,
                i.Status,
                CategoryName = i.Category.Name,
                SellerUsername = i.Seller.Username,
                SellerDisplayNameColor = i.Seller.DisplayNameColor,
                BidCount = i.Bids.Count
            })
            .ToListAsync();
        return histRows.Select(r => ToAuctionListDto(
            r.Id,
            r.Title,
            r.ImageUrl,
            r.ImageStorageKey,
            r.ImageSource,
            r.ImageMatchLevel,
            r.CurrentPrice,
            r.CloseDateTime,
            r.Status.ToString().ToLowerInvariant(),
            r.CategoryName,
            r.SellerUsername,
            r.SellerDisplayNameColor,
            r.BidCount)).ToList();
    }

    public async Task<IReadOnlyList<string>> GetFieldValuesAsync(string fieldName, int? categoryId, string? prefix, int maxCount = 50)
    {
        var q = _db.ItemFieldValues
            .Include(iv => iv.Field)
            .Where(iv => iv.Field != null && iv.Field.FieldName == fieldName);
        if (categoryId.HasValue)
            q = q.Where(iv => iv.Field!.CategoryId == categoryId.Value);
        if (!string.IsNullOrWhiteSpace(prefix))
        {
            var p = prefix.Trim();
            q = q.Where(iv => iv.Value.StartsWith(p));
        }
        var values = await q
            .GroupBy(iv => iv.Value)
            .OrderByDescending(g => g.Count())
            .Take(maxCount)
            .Select(g => g.Key)
            .ToListAsync();
        return values;
    }

    public async Task<(string? Error, AuctionDetailDto? Detail)> AdminPatchAuctionAsync(
        int itemId,
        AdminPatchAuctionDto dto,
        int adminUserId)
    {
        var item = await _db.Items.FirstOrDefaultAsync(i => i.Id == itemId);
        if (item == null)
            return ("Auction not found.", null);

        var hasEnd = !string.IsNullOrWhiteSpace(dto.EndAuction);
        if (hasEnd && AdminPatchHasOtherFields(dto))
            return ("Send EndAuction alone, or omit it when updating fields.", null);

        if (hasEnd)
        {
            if (item.Status != ItemStatus.Active)
                return ("End auction is only valid for active listings.", null);

            switch (dto.EndAuction!.Trim().ToLowerInvariant())
            {
                case "natural":
                    await ProcessActiveAuctionCloseByRulesAsync(item);
                    break;
                case "closed":
                    await ForceCloseActiveWithoutSaleAsync(item);
                    break;
                case "sold":
                    var soldErr = await TryFinalizeActiveAsSoldWithTopBidAsync(item);
                    if (soldErr != null)
                        return (soldErr, null);
                    break;
                default:
                    return ("EndAuction must be natural, closed, or sold.", null);
            }

            item.CloseDateTime = DateTime.UtcNow;
            await _db.SaveChangesAsync();
            _logger.LogWarning("Admin {AdminId} ended auction {ItemId} via {Mode}", adminUserId, itemId, dto.EndAuction);
            return (null, await GetByIdAsync(itemId));
        }

        if (item.Status != ItemStatus.Active)
        {
            if (dto.Title != null)
                item.Title = dto.Title.Trim();
            if (dto.Description != null)
                item.Description = string.IsNullOrWhiteSpace(dto.Description) ? null : dto.Description.Trim();
            await _db.SaveChangesAsync();
            _logger.LogWarning("Admin {AdminId} updated metadata on non-active auction {ItemId}", adminUserId, itemId);
            return (null, await GetByIdAsync(itemId));
        }

        var hasBids = await _db.Bids.AnyAsync(b => b.ItemId == itemId);

        if (dto.Title != null)
            item.Title = dto.Title.Trim();
        if (dto.Description != null)
            item.Description = string.IsNullOrWhiteSpace(dto.Description) ? null : dto.Description.Trim();

        if (dto.CloseDateTime.HasValue)
        {
            var closeUtc = dto.CloseDateTime.Value.Kind == DateTimeKind.Unspecified
                ? DateTime.SpecifyKind(dto.CloseDateTime.Value, DateTimeKind.Utc)
                : dto.CloseDateTime.Value.ToUniversalTime();
            if (closeUtc <= DateTime.UtcNow)
                return ("Close date must be in the future.", null);
            item.CloseDateTime = closeUtc;
        }

        if (dto.BidIncrement.HasValue)
        {
            if (dto.BidIncrement.Value <= 0m)
                return ("Bid increment must be positive.", null);
            item.BidIncrement = dto.BidIncrement.Value;
        }

        if (dto.ReservePrice.HasValue)
        {
            if (dto.ReservePrice.Value < 0m)
                return ("Reserve cannot be negative.", null);
            item.ReservePrice = dto.ReservePrice.Value;
        }

        if (dto.InitialPrice.HasValue || dto.CurrentPrice.HasValue)
        {
            if (hasBids)
                return ("Cannot change initial or current price when bids exist.", null);
            if (dto.InitialPrice.HasValue)
            {
                if (dto.InitialPrice.Value < 0m)
                    return ("Initial price cannot be negative.", null);
                item.InitialPrice = dto.InitialPrice.Value;
            }

            if (dto.CurrentPrice.HasValue)
            {
                if (dto.CurrentPrice.Value < 0m)
                    return ("Current price cannot be negative.", null);
                item.CurrentPrice = dto.CurrentPrice.Value;
            }

            if (dto.InitialPrice.HasValue && !dto.CurrentPrice.HasValue)
                item.CurrentPrice = item.InitialPrice;
            else if (dto.CurrentPrice.HasValue && !dto.InitialPrice.HasValue)
                item.InitialPrice = item.CurrentPrice;
        }

        await _db.SaveChangesAsync();
        _logger.LogWarning("Admin {AdminId} patched active auction {ItemId}", adminUserId, itemId);
        return (null, await GetByIdAsync(itemId));
    }

    private static bool AdminPatchHasOtherFields(AdminPatchAuctionDto dto)
    {
        return dto.Title != null
            || dto.Description != null
            || dto.CloseDateTime.HasValue
            || dto.BidIncrement.HasValue
            || dto.ReservePrice.HasValue
            || dto.InitialPrice.HasValue
            || dto.CurrentPrice.HasValue;
    }

    private async Task ProcessActiveAuctionCloseByRulesAsync(Item item)
    {
        var highestBid = await _db.Bids
            .Where(b => b.ItemId == item.Id)
            .OrderByDescending(b => b.Amount)
            .FirstOrDefaultAsync();

        if (highestBid != null && highestBid.Amount >= item.ReservePrice)
        {
            item.Status = ItemStatus.Sold;
            item.WinnerId = highestBid.BidderId;
            await _walletService.FinalizeSoldAuctionAsync(item.Id, highestBid.BidderId, highestBid.Amount, item.SellerId);
            _db.Notifications.Add(new Notification
            {
                UserId = item.SellerId,
                ItemId = item.Id,
                Type = NotificationType.AuctionSold,
                Message = WithWalletBalanceDisclaimer(
                    $"Your listing \"{item.Title}\" sold for ${highestBid.Amount:N2}.")
            });
            _db.Notifications.Add(new Notification
            {
                UserId = highestBid.BidderId,
                ItemId = item.Id,
                Type = NotificationType.AuctionWon,
                Message = WithWalletBalanceDisclaimer($"You won the auction for \"{item.Title}\"!")
            });
            var losingBidderIds = await _db.Bids
                .Where(b => b.ItemId == item.Id && b.BidderId != highestBid.BidderId)
                .Select(b => b.BidderId)
                .ToListAsync();
            foreach (var loserId in losingBidderIds.Distinct())
            {
                _db.Notifications.Add(new Notification
                {
                    UserId = loserId,
                    ItemId = item.Id,
                    Type = NotificationType.AuctionLost,
                    Message = WithWalletBalanceDisclaimer(
                        $"You did not win the auction for \"{item.Title}\". Another bidder had the highest bid when it closed.")
                });
            }
        }
        else
        {
            await ForceCloseActiveWithoutSaleAsync(item);
        }
    }

    private async Task ForceCloseActiveWithoutSaleAsync(Item item)
    {
        await _walletService.ReleaseItemHoldAsync(item.Id);
        item.Status = ItemStatus.Closed;
        item.WinnerId = null;
        _db.Notifications.Add(new Notification
        {
            UserId = item.SellerId,
            ItemId = item.Id,
            Type = NotificationType.ReserveNotMet,
            Message = WithWalletBalanceDisclaimer($"Reserve price was not met on \"{item.Title}\".")
        });
        var bidderIds = (await _db.Bids
                .AsNoTracking()
                .Where(b => b.ItemId == item.Id)
                .Select(b => b.BidderId)
                .ToListAsync())
            .Distinct()
            .ToList();
        foreach (var bidderId in bidderIds)
        {
            _db.Notifications.Add(new Notification
            {
                UserId = bidderId,
                ItemId = item.Id,
                Type = NotificationType.ReserveNotMet,
                Message = WithWalletBalanceDisclaimer(
                    $"The auction for \"{item.Title}\" closed without meeting the reserve price. If you had funds held for your bid, they are available in your wallet again.")
            });
        }
    }

    private async Task<string?> TryFinalizeActiveAsSoldWithTopBidAsync(Item item)
    {
        var highestBid = await _db.Bids
            .Where(b => b.ItemId == item.Id)
            .OrderByDescending(b => b.Amount)
            .FirstOrDefaultAsync();
        if (highestBid == null)
            return "No bids to complete a sale.";
        if (highestBid.Amount < item.ReservePrice)
            return "Top bid is below reserve; use natural or adjust reserve first.";

        item.Status = ItemStatus.Sold;
        item.WinnerId = highestBid.BidderId;
        await _walletService.FinalizeSoldAuctionAsync(item.Id, highestBid.BidderId, highestBid.Amount, item.SellerId);
        _db.Notifications.Add(new Notification
        {
            UserId = item.SellerId,
            ItemId = item.Id,
            Type = NotificationType.AuctionSold,
            Message = WithWalletBalanceDisclaimer(
                $"Your listing \"{item.Title}\" sold for ${highestBid.Amount:N2}.")
        });
        _db.Notifications.Add(new Notification
        {
            UserId = highestBid.BidderId,
            ItemId = item.Id,
            Type = NotificationType.AuctionWon,
            Message = WithWalletBalanceDisclaimer($"You won the auction for \"{item.Title}\"!")
        });
        var losingBidderIds = await _db.Bids
            .Where(b => b.ItemId == item.Id && b.BidderId != highestBid.BidderId)
            .Select(b => b.BidderId)
            .ToListAsync();
        foreach (var loserId in losingBidderIds.Distinct())
        {
            _db.Notifications.Add(new Notification
            {
                UserId = loserId,
                ItemId = item.Id,
                Type = NotificationType.AuctionLost,
                Message = WithWalletBalanceDisclaimer(
                    $"You did not win the auction for \"{item.Title}\". Another bidder had the highest bid when it closed.")
            });
        }

        return null;
    }

    public async Task<(string? Error, GmBulkCloseAuctionsResultDto? Result)> GmBulkCloseActiveAuctionsAsync(string mode)
    {
        var m = mode?.Trim().ToLowerInvariant();
        if (m != "natural" && m != "closed")
            return ("Mode must be natural or closed.", null);

        var items = await _db.Items.Where(i => i.Status == ItemStatus.Active).ToListAsync();
        if (items.Count > GmBulkCloseActiveMax)
            return ($"Too many active auctions ({items.Count}). Maximum {GmBulkCloseActiveMax} per request.", null);

        var sold = 0;
        var closedNoSale = 0;

        foreach (var item in items)
        {
            if (m == "natural")
            {
                await ProcessActiveAuctionCloseByRulesAsync(item);
                if (item.Status == ItemStatus.Sold)
                    sold++;
                else if (item.Status == ItemStatus.Closed)
                    closedNoSale++;
            }
            else
            {
                await ForceCloseActiveWithoutSaleAsync(item);
                closedNoSale++;
            }

            item.CloseDateTime = DateTime.UtcNow;
        }

        await _db.SaveChangesAsync();
        _logger.LogWarning(
            "GM bulk closed {Count} active auctions via {Mode} (sold={Sold}, closedNoSale={Closed})",
            items.Count, m, sold, closedNoSale);

        return (null, new GmBulkCloseAuctionsResultDto
        {
            ProcessedCount = items.Count,
            SoldCount = sold,
            ClosedWithoutSaleCount = closedNoSale
        });
    }
}
