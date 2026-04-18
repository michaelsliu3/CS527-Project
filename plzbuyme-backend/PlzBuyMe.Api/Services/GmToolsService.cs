using System.Linq;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using PlzBuyMe.Api;
using PlzBuyMe.Api.Data;
using PlzBuyMe.Api.Dtos.Admin.Gm;
using PlzBuyMe.Api.Dtos.Alerts;
using PlzBuyMe.Api.Dtos.Auctions;
using PlzBuyMe.Api.Dtos.Auth;
using PlzBuyMe.Api.Dtos.Questions;
using PlzBuyMe.Api.Models;

namespace PlzBuyMe.Api.Services;

public class GmToolsService : IGmToolsService
{
    private const int MaxManifestAuctionsBatch = 100;
    private const int MaxManifestSearchLimit = 50;
    private const int MaxAuctionsBatch = 50;
    private const int MaxSoldAuctionsBatch = 200;
    private const int MaxUsersBatch = 50;
    private const int MaxQuestionsBatch = 30;
    private const int MaxWalletRecipients = 30;
    private const decimal MaxWalletAmountEach = 10_000_000m;
    private const int MaxSampleAlerts = 10;
    private const int MaxSampleNotifications = 20;
    private const string DefaultDemoPassword = "GmDemo123!";

    private static readonly string[] Makes =
    {
        "Toyota", "Honda", "Ford", "Chevrolet", "BMW", "Nissan", "Hyundai", "Mazda", "Subaru", "Volkswagen"
    };

    private static readonly string[] Models =
    {
        "Camry", "Civic", "F-150", "Silverado", "3 Series", "Altima", "Elantra", "Mazda3", "Outback", "Jetta"
    };

    private static readonly string[] Conditions = { "Excellent", "Good", "Like New" };
    private static readonly string[] Transmissions = { "Automatic", "Manual", "CVT" };
    private static readonly string[] Fuels = { "Gasoline", "Electric", "Hybrid" };
    private static readonly string[] Colors = { "Black", "White", "Silver", "Blue", "Red", "Gray" };

    private readonly AppDbContext _db;
    private readonly IAuctionService _auctionService;
    private readonly IAuthService _authService;
    private readonly IWalletService _walletService;
    private readonly IAlertService _alertService;
    private readonly IQuestionsService _questionsService;
    private readonly ILogger<GmToolsService> _logger;
    private readonly IHostEnvironment _hostEnvironment;
    private readonly IConfiguration _configuration;
    private IReadOnlyList<Gt7ManifestAsset>? _manifestCache;

    public GmToolsService(
        AppDbContext db,
        IAuctionService auctionService,
        IAuthService authService,
        IWalletService walletService,
        IAlertService alertService,
        IQuestionsService questionsService,
        ILogger<GmToolsService> logger,
        IHostEnvironment hostEnvironment,
        IConfiguration configuration)
    {
        _db = db;
        _auctionService = auctionService;
        _authService = authService;
        _walletService = walletService;
        _alertService = alertService;
        _questionsService = questionsService;
        _logger = logger;
        _hostEnvironment = hostEnvironment;
        _configuration = configuration;
    }

    public async Task<(string? Error, IReadOnlyList<GmManifestCarRowDto>? Data)> SearchManifestCarsAsync(
        int adminUserId,
        string? query,
        int limit)
    {
        if (limit < 1 || limit > MaxManifestSearchLimit)
            return ($"Limit must be between 1 and {MaxManifestSearchLimit}.", null);

        var (manifestError, assets) = await LoadManifestAssetsAsync();
        if (manifestError != null)
            return (manifestError, null);

        var normalizedQuery = query?.Trim().ToLowerInvariant() ?? string.Empty;
        var candidates = assets!
            .Where(a => !string.IsNullOrWhiteSpace(a.Make) || !string.IsNullOrWhiteSpace(a.Model) || !string.IsNullOrWhiteSpace(a.Title))
            .Where(a => normalizedQuery.Length == 0 || BuildManifestSearchText(a).Contains(normalizedQuery, StringComparison.Ordinal))
            .Select(a => new
            {
                Asset = a,
                Score = ScoreManifestAsset(a, normalizedQuery)
            })
            .OrderByDescending(x => x.Score)
            .ThenBy(x => x.Asset.Make ?? string.Empty)
            .ThenBy(x => x.Asset.Model ?? string.Empty)
            .ThenBy(x => x.Asset.Title ?? string.Empty)
            .Take(limit)
            .ToList();

        var rows = new List<GmManifestCarRowDto>(candidates.Count);
        foreach (var candidate in candidates)
        {
            var categories = await ResolveCategoriesForManifestAsync("auto", candidate.Asset);
            var categoryIds = categories.Select(c => c.Id).Distinct().ToArray();
            var categoryNames = categories.Select(c => c.Name).Distinct().ToArray();
            var categoryStringKeys = categories
                .Select(c => c.StringKey)
                .Where(k => !string.IsNullOrWhiteSpace(k))
                .Cast<string>()
                .Distinct()
                .ToArray();

            rows.Add(new GmManifestCarRowDto
            {
                ExternalId = string.IsNullOrWhiteSpace(candidate.Asset.ExternalId) ? null : candidate.Asset.ExternalId.Trim(),
                Title = string.IsNullOrWhiteSpace(candidate.Asset.Title) ? null : candidate.Asset.Title.Trim(),
                Make = string.IsNullOrWhiteSpace(candidate.Asset.Make) ? null : candidate.Asset.Make.Trim(),
                Model = string.IsNullOrWhiteSpace(candidate.Asset.Model) ? null : candidate.Asset.Model.Trim(),
                Year = candidate.Asset.Year,
                Color = string.IsNullOrWhiteSpace(candidate.Asset.Color) ? null : candidate.Asset.Color.Trim(),
                SourceUrl = string.IsNullOrWhiteSpace(candidate.Asset.SourceUrl) ? null : candidate.Asset.SourceUrl.Trim(),
                DetailSourceUrl = string.IsNullOrWhiteSpace(candidate.Asset.DetailSourceUrl) ? null : candidate.Asset.DetailSourceUrl.Trim(),
                CategoryIds = categoryIds,
                CategoryNames = categoryNames,
                CategoryStringKeys = categoryStringKeys
            });
        }

        _logger.LogInformation(
            "GM tools: admin {AdminId} searched manifest cars (query='{Query}', limit={Limit}, returned={Count})",
            adminUserId,
            query ?? string.Empty,
            limit,
            rows.Count);

        return (null, rows);
    }

    public async Task<(string? Error, GmSeedAuctionsResultDto? Data)> SeedAuctionsAsync(int adminUserId, GmSeedAuctionsDto dto)
    {
        if (dto.Count < 1 || dto.Count > MaxAuctionsBatch)
            return ($"Count must be between 1 and {MaxAuctionsBatch}.", null);

        if (dto.CloseHoursMin < 1 || dto.CloseHoursMax > 8760 || dto.CloseHoursMin > dto.CloseHoursMax)
            return ("CloseHoursMin and CloseHoursMax must satisfy 1 ≤ min ≤ max ≤ 8760.", null);

        if (dto.BidCountMin < 0 || dto.BidCountMin > dto.BidCountMax)
            return ("Bid counts must satisfy 0 ≤ min ≤ max.", null);

        var seller = await ResolveSellerAsync(dto.SellerUserId);
        if (seller == null)
            return ("Seller not found or inactive.", null);

        var category = await ResolveLeafCategoryAsync(dto.CategoryId);
        if (category == null)
            return ("Category not found or has no fields. Use a leaf category (e.g. Sedans).", null);

        var bidders = await GetBidderPoolAsync(seller.Id);
        if (dto.BidCountMax > 0 && bidders.Count == 0)
            return ("No eligible bidders. Create other end-user accounts or set bid counts to 0.", null);

        foreach (var bidder in bidders)
            await _walletService.DepositAsync(bidder.Id, 10_000_000m);

        var auctionIds = new List<int>();
        var totalBids = 0;

        for (var i = 0; i < dto.Count; i++)
        {
            var createDto = BuildRandomAuctionDto(category, dto.CloseHoursMin, dto.CloseHoursMax);
            var detail = await _auctionService.CreateAuctionAsync(createDto, seller.Id);
            if (detail == null)
                continue;

            auctionIds.Add(detail.Id);
            var bidTarget = Random.Shared.Next(dto.BidCountMin, dto.BidCountMax + 1);

            for (var b = 0; b < bidTarget; b++)
            {
                var bidder = bidders[b % bidders.Count];
                var item = await _db.Items.AsNoTracking().FirstAsync(x => x.Id == detail.Id);
                var amount = item.CurrentPrice + item.BidIncrement;
                try
                {
                    await _auctionService.PlaceBidAsync(detail.Id, bidder.Id, amount);
                    totalBids++;
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "GM seed bid failed for item {ItemId} bidder {BidderId}", detail.Id, bidder.Id);
                }
            }
        }

        _logger.LogWarning(
            "GM tools: admin {AdminId} seeded {AuctionCount} auctions, {BidCount} bids",
            adminUserId,
            auctionIds.Count,
            totalBids);

        return (null, new GmSeedAuctionsResultDto
        {
            CreatedCount = auctionIds.Count,
            AuctionIds = auctionIds,
            TotalBidsPlaced = totalBids
        });
    }

    public async Task<(string? Error, GmSeedAuctionsResultDto? Data)> SeedAuctionsFromManifestAsync(
        int adminUserId,
        GmSeedManifestAuctionsDto dto)
    {
        if (dto.Count < 1 || dto.Count > MaxManifestAuctionsBatch)
            return ($"Count must be between 1 and {MaxManifestAuctionsBatch}.", null);

        if (dto.CloseHoursMin < 1 || dto.CloseHoursMax > 8760 || dto.CloseHoursMin > dto.CloseHoursMax)
            return ("CloseHoursMin and CloseHoursMax must satisfy 1 ≤ min ≤ max ≤ 8760.", null);

        if (dto.BidCountMin < 0 || dto.BidCountMin > dto.BidCountMax)
            return ("Bid counts must satisfy 0 ≤ min ≤ max.", null);

        var manifestPath = ResolveGt7ManifestPath();
        if (manifestPath == null || !File.Exists(manifestPath))
        {
            return (
                "GT7 manifest file not found. Add plzbuyme-cdn beside the repo or set Gt7CarManifest:Path to gt7-car-thumbnails.manifest.json." + (manifestPath == null ? "manifest null" : $" (found: {manifestPath})"),
                null);
        }

        await using var stream = File.OpenRead(manifestPath);
        var manifest = await JsonSerializer.DeserializeAsync<Gt7ManifestFile>(
            stream,
            new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
        if (manifest?.Assets == null || manifest.Assets.Count == 0)
            return ("Manifest has no assets.", null);

        var selected = Gt7ManifestAuctionBuilder.SelectAssets(manifest.Assets, dto.Count, dto.TitleKeyword);
        if (selected.Count == 0)
            return ("No manifest cars match the filters.", null);

        var seller = await ResolveSellerAsync(dto.SellerUserId);
        if (seller == null)
            return ("Seller not found or inactive.", null);

        var bidders = await GetBidderPoolAsync(seller.Id);
        if (dto.BidCountMax > 0 && bidders.Count == 0)
            return ("No eligible bidders. Create other end-user accounts or set bid counts to 0.", null);

        foreach (var bidder in bidders)
            await _walletService.DepositAsync(bidder.Id, 10_000_000m);

        var mode = dto.CategoryMode?.Trim() ?? "auto";
        var auctionIds = new List<int>();
        var totalBids = 0;

        foreach (var asset in selected)
        {
            var categories = await ResolveCategoriesForManifestAsync(mode, asset);
            if (categories.Count == 0)
            {
                return (
                    $"Category not found for mode \"{mode}\". Use auto or a leaf name (e.g. Sedans).",
                    null);
            }

            var createDto = Gt7ManifestAuctionBuilder.BuildCreateDto(
                asset,
                categories,
                dto.CloseHoursMin,
                dto.CloseHoursMax);
            var detail = await _auctionService.CreateAuctionAsync(createDto, seller.Id);
            if (detail == null)
                continue;

            auctionIds.Add(detail.Id);
            var bidTarget = Random.Shared.Next(dto.BidCountMin, dto.BidCountMax + 1);

            for (var b = 0; b < bidTarget; b++)
            {
                var bidder = bidders[b % bidders.Count];
                var item = await _db.Items.AsNoTracking().FirstAsync(x => x.Id == detail.Id);
                var amount = item.CurrentPrice + item.BidIncrement;
                try
                {
                    await _auctionService.PlaceBidAsync(detail.Id, bidder.Id, amount);
                    totalBids++;
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "GM manifest seed bid failed for item {ItemId}", detail.Id);
                }
            }
        }

        _logger.LogWarning(
            "GM tools: admin {AdminId} manifest-seeded {AuctionCount} auctions from {Path}",
            adminUserId,
            auctionIds.Count,
            manifestPath);

        return (null, new GmSeedAuctionsResultDto
        {
            CreatedCount = auctionIds.Count,
            AuctionIds = auctionIds,
            TotalBidsPlaced = totalBids
        });
    }

    private string? ResolveGt7ManifestPath()
    {
        var configured = _configuration["Gt7CarManifest:Path"];
        if (!string.IsNullOrWhiteSpace(configured))
        {
            var full = Path.IsPathRooted(configured)
                ? configured
                : Path.GetFullPath(Path.Combine(_hostEnvironment.ContentRootPath, configured));
            if (File.Exists(full))
                return full;
        }

        var candidates = new[]
        {
            Path.GetFullPath(Path.Combine(_hostEnvironment.ContentRootPath, "..", "..", "plzbuyme-cdn", "tools", "car-assets", "manifests", "gt7-car-thumbnails.manifest.json")),
            Path.GetFullPath(Path.Combine(_hostEnvironment.ContentRootPath, "..", "plzbuyme-cdn", "tools", "car-assets", "manifests", "gt7-car-thumbnails.manifest.json")),
        };
        return candidates.FirstOrDefault(File.Exists);
    }

    private async Task<(string? Error, IReadOnlyList<Gt7ManifestAsset>? Data)> LoadManifestAssetsAsync()
    {
        if (_manifestCache != null)
            return (null, _manifestCache);

        var manifestPath = ResolveGt7ManifestPath();
        if (manifestPath == null || !File.Exists(manifestPath))
        {
            return (
                "GT7 manifest file not found. Add plzbuyme-cdn beside the repo or set Gt7CarManifest:Path to gt7-car-thumbnails.manifest.json.",
                null);
        }

        await using var stream = File.OpenRead(manifestPath);
        var manifest = await JsonSerializer.DeserializeAsync<Gt7ManifestFile>(
            stream,
            new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
        if (manifest?.Assets == null || manifest.Assets.Count == 0)
            return ("Manifest has no assets.", null);

        _manifestCache = manifest.Assets;
        return (null, _manifestCache);
    }

    private static string BuildManifestSearchText(Gt7ManifestAsset asset)
    {
        var year = asset.Year?.ToString() ?? string.Empty;
        return string.Join(
            ' ',
            new[]
            {
                asset.Make ?? string.Empty,
                asset.Model ?? string.Empty,
                year,
                asset.Title ?? string.Empty
            })
            .Trim()
            .ToLowerInvariant();
    }

    private static int ScoreManifestAsset(Gt7ManifestAsset asset, string normalizedQuery)
    {
        if (string.IsNullOrEmpty(normalizedQuery))
            return 0;

        var score = 0;
        var make = asset.Make?.Trim().ToLowerInvariant() ?? string.Empty;
        var model = asset.Model?.Trim().ToLowerInvariant() ?? string.Empty;
        var title = asset.Title?.Trim().ToLowerInvariant() ?? string.Empty;
        var year = asset.Year?.ToString() ?? string.Empty;

        if (make.StartsWith(normalizedQuery, StringComparison.Ordinal))
            score += 4;
        if (model.StartsWith(normalizedQuery, StringComparison.Ordinal))
            score += 4;
        if (title.StartsWith(normalizedQuery, StringComparison.Ordinal))
            score += 3;
        if (year.StartsWith(normalizedQuery, StringComparison.Ordinal))
            score += 2;
        if (title.Contains(normalizedQuery, StringComparison.Ordinal))
            score += 1;

        return score;
    }

    private async Task<List<Category>> ResolveCategoriesForManifestAsync(string categoryMode, Gt7ManifestAsset asset)
    {
        if (string.Equals(categoryMode, "auto", StringComparison.OrdinalIgnoreCase))
        {
            var categoryKeys = Gt7ManifestAuctionBuilder.ResolveCategoryStringKeys(asset);
            var results = new List<Category>();
            foreach (var stringKey in categoryKeys)
            {
                var match = await _db.Categories
                    .Include(c => c.CategoryFields)
                    .FirstOrDefaultAsync(c => c.StringKey == stringKey);
                if (match != null)
                    results.Add(match);
            }

            return results;
        }

        var single = await _db.Categories
            .Include(c => c.CategoryFields)
            .FirstOrDefaultAsync(c =>
                (c.StringKey == categoryMode || c.Name == categoryMode) &&
                c.CategoryFields.Any());
        return single != null ? [single] : [];
    }

    public async Task<(string? Error, GmBulkUsersResultDto? Data)> BulkCreateUsersAsync(int adminUserId, GmBulkUsersDto dto)
    {
        var prefix = dto.UsernamePrefix?.Trim() ?? string.Empty;
        if (prefix.Length is < 1 or > 20 || !char.IsAsciiLetter(prefix[0]) || !prefix.Skip(1).All(c => char.IsAsciiLetterOrDigit(c) || c == '_'))
            return ("UsernamePrefix must start with a letter and be 1–20 chars (letters, digits, underscore).", null);

        if (dto.Count < 1 || dto.Count > MaxUsersBatch)
            return ($"Count must be between 1 and {MaxUsersBatch}.", null);

        if (dto.StartIndex < 0)
            return ("StartIndex must be non-negative.", null);

        var password = string.IsNullOrWhiteSpace(dto.Password) ? DefaultDemoPassword : dto.Password!.Trim();
        if (password.Length < 6)
            return ("Password must be at least 6 characters.", null);

        if (dto.WalletBalanceEach is < 0 or > MaxWalletAmountEach)
            return ($"WalletBalanceEach must be between 0 and {MaxWalletAmountEach}.", null);

        var usernames = new List<string>();

        for (var i = 0; i < dto.Count; i++)
        {
            var idx = dto.StartIndex + i;
            var username = $"{prefix}{idx}";
            var email = $"{prefix.ToLowerInvariant()}{idx}@gm.plzbuy.test";
            var reg = await _authService.RegisterAsync(new RegisterDto
            {
                Username = username,
                Email = email,
                Password = password
            });

            if (!reg.Success || reg.Data == null)
                continue;

            usernames.Add(username);

            if (dto.WalletBalanceEach is > 0)
                await _walletService.DepositAsync(reg.Data.UserId, dto.WalletBalanceEach.Value);
        }

        _logger.LogWarning("GM tools: admin {AdminId} bulk-created {Count} users (prefix {Prefix})", adminUserId, usernames.Count, prefix);

        return (null, new GmBulkUsersResultDto { CreatedCount = usernames.Count, Usernames = usernames });
    }

    public async Task<(string? Error, GmSeedQuestionsResultDto? Data)> SeedQuestionsAsync(int adminUserId, GmSeedQuestionsDto dto)
    {
        if (dto.Count < 1 || dto.Count > MaxQuestionsBatch)
            return ($"Count must be between 1 and {MaxQuestionsBatch}.", null);

        var authors = await _db.Users
            .AsNoTracking()
            .Where(u => u.IsActive && (u.Role == UserRole.EndUser || u.Role == UserRole.Vip))
            .OrderBy(u => u.Id)
            .Take(50)
            .ToListAsync();

        if (authors.Count == 0)
            return ("No end-user accounts available to author questions.", null);

        var questionIds = new List<int>();
        for (var i = 0; i < dto.Count; i++)
        {
            var author = authors[i % authors.Count];
            var created = await _questionsService.CreateQuestionAsync(author.Id, new CreateQuestionDto
            {
                Subject = $"GM seed Q&A #{i + 1} ({DateTime.UtcNow:yyyyMMdd-HHmm})",
                Body = "Auto-generated question for demos and QA. Safe to delete."
            });
            questionIds.Add(created.Id);
        }

        var replies = 0;
        if (dto.IncludeRepReplies)
        {
            var replier = await _db.Users
                .AsNoTracking()
                .Where(u => u.IsActive && (u.Role == UserRole.CustomerRep || u.Role == UserRole.Admin))
                .OrderBy(u => u.Id)
                .FirstOrDefaultAsync();

            if (replier != null)
            {
                for (var q = 0; q < questionIds.Count; q++)
                {
                    if (Random.Shared.NextDouble() >= 0.5)
                        continue;

                    var reply = await _questionsService.ReplyAsync(questionIds[q], replier.Id, new ReplyDto
                    {
                        Body = "Thanks for your question — this is a GM-seeded rep reply for demos."
                    });
                    if (reply != null)
                        replies++;
                }
            }
        }

        _logger.LogWarning(
            "GM tools: admin {AdminId} seeded {QCount} questions, {RCount} replies",
            adminUserId,
            questionIds.Count,
            replies);

        return (null, new GmSeedQuestionsResultDto { CreatedCount = questionIds.Count, RepliesCreated = replies });
    }

    public async Task<(string? Error, GmWalletTopUpResultDto? Data)> WalletTopUpAsync(int adminUserId, GmWalletTopUpDto dto)
    {
        if (dto.UserIds == null || dto.UserIds.Count == 0)
            return ("UserIds is required.", null);

        if (dto.UserIds.Count > MaxWalletRecipients)
            return ($"At most {MaxWalletRecipients} users per request.", null);

        if (dto.AmountEach <= 0m || dto.AmountEach > MaxWalletAmountEach)
            return ($"AmountEach must be positive and at most {MaxWalletAmountEach}.", null);

        var distinct = dto.UserIds.Distinct().ToList();

        var affected = 0;
        foreach (var uid in distinct)
        {
            var exists = await _db.Users.AnyAsync(u => u.Id == uid && u.IsActive);
            if (!exists)
                continue;

            await _walletService.DepositAsync(uid, dto.AmountEach);
            affected++;
        }

        _logger.LogWarning("GM tools: admin {AdminId} wallet top-up {Count} users × {Amount}", adminUserId, affected, dto.AmountEach);

        return (null, new GmWalletTopUpResultDto { UsersAffected = affected });
    }

    public async Task<(string? Error, GmSampleAlertsResultDto? Data)> SeedSampleAlertsAsync(int adminUserId, GmSampleAlertsDto dto)
    {
        if (dto.Count < 1 || dto.Count > MaxSampleAlerts)
            return ($"Count must be between 1 and {MaxSampleAlerts}.", null);

        var userExists = await _db.Users.AnyAsync(u => u.Id == dto.UserId && u.IsActive);
        if (!userExists)
            return ("User not found.", null);

        var created = 0;
        for (var i = 0; i < dto.Count; i++)
        {
            var result = await _alertService.CreateAlertAsync(dto.UserId, new CreateAlertDto
            {
                Keyword = $"gmseed-{adminUserId}-{i}-{Random.Shared.Next(1_000_000):D6}"
            });
            if (result.ErrorMessage == null)
                created++;
        }

        _logger.LogWarning("GM tools: admin {AdminId} created {Count} sample alerts for user {UserId}", adminUserId, created, dto.UserId);

        return (null, new GmSampleAlertsResultDto { AlertsCreated = created });
    }

    public async Task<(string? Error, GmSampleNotificationsResultDto? Data)> SeedSampleNotificationsAsync(int adminUserId, GmSampleNotificationsDto dto)
    {
        if (dto.Count < 1 || dto.Count > MaxSampleNotifications)
            return ($"Count must be between 1 and {MaxSampleNotifications}.", null);

        var userExists = await _db.Users.AnyAsync(u => u.Id == dto.UserId && u.IsActive);
        if (!userExists)
            return ("User not found.", null);

        var types = new[]
        {
            NotificationType.AlertMatch,
            NotificationType.Outbid,
            NotificationType.AuctionWon
        };

        for (var i = 0; i < dto.Count; i++)
        {
            _db.Notifications.Add(new Notification
            {
                UserId = dto.UserId,
                ItemId = null,
                Message = $"GM sample notification #{i + 1} (not tied to a live auction).",
                Type = types[i % types.Length],
                IsRead = false,
                CreatedAt = DateTime.UtcNow
            });
        }

        await _db.SaveChangesAsync();

        _logger.LogWarning(
            "GM tools: admin {AdminId} inserted {Count} sample notifications for user {UserId}",
            adminUserId,
            dto.Count,
            dto.UserId);

        return (null, new GmSampleNotificationsResultDto { NotificationsCreated = dto.Count });
    }

    public Task<(string? Error, GmSoldHistoryFixtureResultDto? Data)> SeedSoldHistoryFixtureAsync(int adminUserId)
    {
        SeedData.SeedSoldItemsForReports(_db);
        var sold = _db.Items.Count(i => i.Status == ItemStatus.Sold);
        _logger.LogWarning("GM tools: admin {AdminId} ran sold-history fixture; sold count = {Count}", adminUserId, sold);
        return Task.FromResult<(string? Error, GmSoldHistoryFixtureResultDto? Data)>(
            (null, new GmSoldHistoryFixtureResultDto { SoldAuctionCount = sold }));
    }

    public async Task<(string? Error, GmSeedSoldAuctionsResultDto? Data)> SeedSoldAuctionsAsync(
        int adminUserId,
        GmSeedSoldAuctionsDto dto)
    {
        if (dto.Count < 1 || dto.Count > MaxSoldAuctionsBatch)
            return ($"Count must be between 1 and {MaxSoldAuctionsBatch}.", null);

        if (dto.DaysAgoMin < 1 || dto.DaysAgoMax > 3650 || dto.DaysAgoMin > dto.DaysAgoMax)
            return ("DaysAgoMin and DaysAgoMax must satisfy 1 <= min <= max <= 3650.", null);

        if (dto.PriceMin <= 0m || dto.PriceMax <= 0m || dto.PriceMin > dto.PriceMax)
            return ("PriceMin and PriceMax must be positive, and PriceMin must be <= PriceMax.", null);

        if (dto.BidCountMin < 0 || dto.BidCountMin > dto.BidCountMax)
            return ("Bid counts must satisfy 0 <= min <= max.", null);

        if (dto.ClosedWithoutSaleRatio < 0m || dto.ClosedWithoutSaleRatio > 1m)
            return ("ClosedWithoutSaleRatio must be between 0 and 1.", null);

        var category = await ResolveLeafCategoryForModeAsync(dto.CategoryId, dto.CategoryMode);
        if (category == null)
            return ("Category not found or has no fields. Use a leaf category with field definitions.", null);

        var sellersQuery = _db.Users
            .AsNoTracking()
            .Where(u => u.IsActive && (u.Role == UserRole.EndUser || u.Role == UserRole.Vip));
        if (dto.SellerUserId.HasValue)
            sellersQuery = sellersQuery.Where(u => u.Id == dto.SellerUserId.Value);
        var sellers = await sellersQuery.OrderBy(u => u.Id).ToListAsync();
        if (sellers.Count == 0)
            return ("Seller not found or is not an active end-user account.", null);

        var endUsers = await _db.Users
            .AsNoTracking()
            .Where(u => u.IsActive && (u.Role == UserRole.EndUser || u.Role == UserRole.Vip))
            .OrderBy(u => u.Id)
            .Take(200)
            .ToListAsync();

        var fields = category.CategoryFields.OrderBy(f => f.Id).ToList();
        var createdSoldCount = 0;
        var createdClosedCount = 0;
        var totalBids = 0;

        for (var i = 0; i < dto.Count; i++)
        {
            var seller = sellers[i % sellers.Count];
            var availableBidders = endUsers.Where(u => u.Id != seller.Id).ToList();
            var shouldCloseWithoutSale = Random.Shared.NextDouble() < (double)dto.ClosedWithoutSaleRatio;
            if (!shouldCloseWithoutSale && availableBidders.Count == 0)
                return ("Need at least one active end-user besides the seller to create sold auctions.", null);

            var randomFieldValues = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            var itemFieldValues = new List<ItemFieldValue>(fields.Count);
            var daysAgo = Random.Shared.Next(dto.DaysAgoMin, dto.DaysAgoMax + 1);
            var closeAt = DateTime.UtcNow
                .AddDays(-daysAgo)
                .AddMinutes(-Random.Shared.Next(0, 1440));
            var createdAt = closeAt.AddDays(-Random.Shared.Next(1, 15));
            var currentPrice = RandomMoney(dto.PriceMin, dto.PriceMax);
            var initialPrice = Math.Max(1m, decimal.Round(currentPrice * 0.7m, 2, MidpointRounding.AwayFromZero));
            var bidIncrement = decimal.Round(Math.Max(1m, currentPrice * 0.02m), 2, MidpointRounding.AwayFromZero);
            var reservePrice = shouldCloseWithoutSale
                ? decimal.Round(currentPrice + Math.Max(1m, currentPrice * 0.15m), 2, MidpointRounding.AwayFromZero)
                : decimal.Round(Math.Max(initialPrice, currentPrice * 0.9m), 2, MidpointRounding.AwayFromZero);
            if (shouldCloseWithoutSale && reservePrice <= currentPrice)
                reservePrice = currentPrice + 1m;

            foreach (var field in fields)
            {
                var value = RandomFieldValue(field);
                randomFieldValues[field.FieldName] = value;
                itemFieldValues.Add(new ItemFieldValue { FieldId = field.Id, Value = value });
            }

            var title = TryBuildGmSeedTitle(randomFieldValues)
                ?? $"{category.Name} historical seed #{Random.Shared.Next(1000, 10000)}";
            var item = new Item
            {
                SellerId = seller.Id,
                CategoryIds = new List<int> { category.Id },
                Title = title,
                Description = "GM-seeded historical listing for report and QA testing.",
                InitialPrice = initialPrice,
                BidIncrement = bidIncrement,
                ReservePrice = reservePrice,
                CurrentPrice = currentPrice,
                CloseDateTime = closeAt,
                Status = shouldCloseWithoutSale ? ItemStatus.Closed : ItemStatus.Sold,
                WinnerId = null,
                CreatedAt = createdAt
            };

            if (!shouldCloseWithoutSale)
            {
                var winner = availableBidders[Random.Shared.Next(availableBidders.Count)];
                item.WinnerId = winner.Id;
            }

            _db.Items.Add(item);
            await _db.SaveChangesAsync();

            foreach (var row in itemFieldValues)
                row.ItemId = item.Id;
            _db.ItemFieldValues.AddRange(itemFieldValues);

            var bidCount = Random.Shared.Next(dto.BidCountMin, dto.BidCountMax + 1);
            if (!shouldCloseWithoutSale && bidCount == 0)
                bidCount = 1;
            if (bidCount > 0 && availableBidders.Count > 0)
            {
                var startAmount = Math.Max(initialPrice, currentPrice - bidIncrement * bidCount);
                for (var b = 0; b < bidCount; b++)
                {
                    var amount = b == bidCount - 1
                        ? currentPrice
                        : decimal.Round(startAmount + bidIncrement * (b + 1), 2, MidpointRounding.AwayFromZero);
                    var bidder = availableBidders[(i + b) % availableBidders.Count];
                    if (!shouldCloseWithoutSale && b == bidCount - 1 && item.WinnerId.HasValue)
                    {
                        bidder = availableBidders.FirstOrDefault(x => x.Id == item.WinnerId.Value) ?? bidder;
                    }

                    _db.Bids.Add(new Bid
                    {
                        ItemId = item.Id,
                        BidderId = bidder.Id,
                        Amount = amount,
                        IsAuto = false,
                        CreatedAt = closeAt.AddMinutes(-bidCount + b)
                    });
                    totalBids++;
                }
            }

            await _db.SaveChangesAsync();
            if (shouldCloseWithoutSale)
                createdClosedCount++;
            else
                createdSoldCount++;
        }

        _logger.LogWarning(
            "GM tools: admin {AdminId} seeded historical auctions sold={SoldCount} closed={ClosedCount} bids={BidCount}",
            adminUserId,
            createdSoldCount,
            createdClosedCount,
            totalBids);

        return (null, new GmSeedSoldAuctionsResultDto
        {
            CreatedSoldCount = createdSoldCount,
            CreatedClosedCount = createdClosedCount,
            TotalBids = totalBids
        });
    }

    public async Task<(string? Error, GmBulkCloseAuctionsResultDto? Data)> BulkCloseActiveAuctionsAsync(
        int adminUserId,
        GmBulkCloseAuctionsDto dto)
    {
        var (error, result) = await _auctionService.GmBulkCloseActiveAuctionsAsync(dto.Mode);
        if (error == null && result != null)
        {
            _logger.LogWarning(
                "GM tools: admin {AdminId} bulk-closed active auctions (processed={Processed}, sold={Sold}, closedNoSale={Closed})",
                adminUserId,
                result.ProcessedCount,
                result.SoldCount,
                result.ClosedWithoutSaleCount);
        }

        return (error, result);
    }

    public async Task<(string? Error, GmRunCloseSweepResultDto? Data)> RunCloseSweepAsync(int adminUserId)
    {
        await _auctionService.CloseExpiredAsync();
        _logger.LogWarning("GM tools: admin {AdminId} ran CloseExpired sweep", adminUserId);
        return (null, new GmRunCloseSweepResultDto());
    }

    public async Task<(string? Error, GmDeleteAllAuctionsResultDto? Data)> DeleteAllAuctionsAsync(int adminUserId)
    {
        var (error, result) = await _auctionService.GmDeleteAllAuctionsAsync();
        if (error != null || result == null)
            return (error, null);

        _logger.LogWarning(
            "GM tools: admin {AdminId} deleted all auctions ({Items} items, {Bids} bids)",
            adminUserId,
            result.ItemsDeleted,
            result.BidsDeleted);
        return (null, result);
    }

    private async Task<User?> ResolveSellerAsync(int? sellerUserId)
    {
        if (sellerUserId.HasValue)
        {
            return await _db.Users.FirstOrDefaultAsync(u =>
                u.Id == sellerUserId.Value && u.IsActive);
        }

        return await _db.Users
            .Where(u => u.IsActive && (u.Role == UserRole.EndUser || u.Role == UserRole.Vip))
            .OrderBy(u => u.Id)
            .FirstOrDefaultAsync();
    }

    private async Task<Category?> ResolveLeafCategoryAsync(int? categoryId)
    {
        if (categoryId.HasValue)
        {
            return await _db.Categories
                .Include(c => c.CategoryFields)
                .FirstOrDefaultAsync(c => c.Id == categoryId.Value && c.CategoryFields.Any());
        }

        var candidates = await _db.Categories
            .Include(c => c.CategoryFields)
            .Where(c => c.CategoryFields.Any())
            .ToListAsync();

        if (candidates.Count == 0)
            return null;

        return candidates[Random.Shared.Next(candidates.Count)];
    }

    private async Task<Category?> ResolveLeafCategoryForModeAsync(int? categoryId, string? categoryMode)
    {
        if (categoryId.HasValue)
            return await ResolveLeafCategoryAsync(categoryId);

        if (!string.IsNullOrWhiteSpace(categoryMode) &&
            !string.Equals(categoryMode.Trim(), "auto", StringComparison.OrdinalIgnoreCase))
        {
            var normalized = categoryMode.Trim();
            return await _db.Categories
                .Include(c => c.CategoryFields)
                .FirstOrDefaultAsync(c =>
                    c.CategoryFields.Any() &&
                    (c.StringKey == normalized || c.Name == normalized));
        }

        return await ResolveLeafCategoryAsync(null);
    }

    private async Task<List<User>> GetBidderPoolAsync(int sellerId)
    {
        return await _db.Users
            .AsNoTracking()
            .Where(u =>
                u.IsActive &&
                u.Id != sellerId &&
                (u.Role == UserRole.EndUser || u.Role == UserRole.Vip))
            .OrderBy(u => u.Id)
            .Take(20)
            .ToListAsync();
    }

    private static CreateAuctionDto BuildRandomAuctionDto(Category category, int closeHoursMin, int closeHoursMax)
    {
        var fields = category.CategoryFields.OrderBy(f => f.Id).ToList();
        var byName = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        var fv = new List<FieldValueDto>(fields.Count);

        foreach (var f in fields)
        {
            var value = RandomFieldValue(f);
            byName[f.FieldName] = value;
            fv.Add(new FieldValueDto(f.Id, value));
        }

        var title = TryBuildGmSeedTitle(byName) ?? $"{category.Name} (GM seed)";
        var hours = Random.Shared.Next(closeHoursMin, closeHoursMax + 1);
        var closeAt = DateTime.UtcNow.AddHours(hours);
        var initial = 5000m + Random.Shared.Next(0, 80_000);
        var increment = 50m + Random.Shared.Next(0, 450);
        var reserve = initial + increment * Random.Shared.Next(2, 20);

        return new CreateAuctionDto
        {
            Title = title,
            Description = "Bulk-seeded listing for demos, load tests, or QA.",
            CategoryIds = new List<int> { category.Id },
            InitialPrice = initial,
            BidIncrement = increment,
            ReservePrice = reserve,
            CloseDateTime = closeAt,
            FieldValues = fv
        };
    }

    private static string? TryBuildGmSeedTitle(Dictionary<string, string> byName)
    {
        if (!byName.TryGetValue("Make", out var make) || !byName.TryGetValue("Model", out var model))
            return null;

        return byName.TryGetValue("Year", out var year) && !string.IsNullOrWhiteSpace(year)
            ? $"{year} {make} {model} (GM seed)"
            : $"{make} {model} (GM seed)";
    }

    private static string RandomFieldValue(CategoryField f)
    {
        switch (f.FieldType)
        {
            case FieldType.Number:
                if (f.FieldName.Equals("Year", StringComparison.OrdinalIgnoreCase))
                    return (2018 + Random.Shared.Next(8)).ToString();
                return Random.Shared.Next(500, 200_000).ToString();
            case FieldType.Select:
                var fromJson = PickSelectOption(f.Options);
                if (!string.IsNullOrEmpty(fromJson))
                    return fromJson;
                if (f.FieldName.Equals("Condition", StringComparison.OrdinalIgnoreCase))
                    return Conditions[Random.Shared.Next(Conditions.Length)];
                if (f.FieldName.Equals("Transmission", StringComparison.OrdinalIgnoreCase))
                    return Transmissions[Random.Shared.Next(Transmissions.Length)];
                if (f.FieldName.Contains("Fuel", StringComparison.OrdinalIgnoreCase))
                    return Fuels[Random.Shared.Next(Fuels.Length)];
                return "—";
            default:
                if (f.FieldName.Equals("Make", StringComparison.OrdinalIgnoreCase))
                    return Makes[Random.Shared.Next(Makes.Length)];
                if (f.FieldName.Equals("Model", StringComparison.OrdinalIgnoreCase))
                    return Models[Random.Shared.Next(Models.Length)];
                if (f.FieldName.Contains("Color", StringComparison.OrdinalIgnoreCase))
                    return Colors[Random.Shared.Next(Colors.Length)];
                var shortName = f.FieldName.Length > 12 ? f.FieldName[..12] : f.FieldName;
                return $"{shortName}-{Random.Shared.Next(100, 999)}";
        }
    }

    private static string? PickSelectOption(string? optionsJson)
    {
        if (string.IsNullOrWhiteSpace(optionsJson))
            return null;
        try
        {
            var list = JsonSerializer.Deserialize<List<string>>(optionsJson);
            if (list == null || list.Count == 0)
                return null;
            return list[Random.Shared.Next(list.Count)];
        }
        catch (JsonException)
        {
            return null;
        }
    }

    private static decimal RandomMoney(decimal min, decimal max)
    {
        if (min == max)
            return decimal.Round(min, 2, MidpointRounding.AwayFromZero);
        var ratio = (decimal)Random.Shared.NextDouble();
        var raw = min + ((max - min) * ratio);
        return decimal.Round(raw, 2, MidpointRounding.AwayFromZero);
    }

    public async Task<(string? Error, GmCategoryMutationResultDto? Data)> CreateCategoryAsync(
        int adminUserId,
        GmCreateCategoryDto dto)
    {
        var name = dto.Name.Trim();
        if (name.Length is < 1 or > 64)
            return ("Name is required and must be at most 64 characters.", null);

        if (dto.ParentId is { } pid)
        {
            var parentExists = await _db.Categories.AnyAsync(c => c.Id == pid);
            if (!parentExists)
                return ("Parent category not found.", null);
        }

        var stringKey = string.IsNullOrWhiteSpace(dto.StringKey) ? null : dto.StringKey.Trim();
        if (stringKey?.Length > 64)
            return ("String key must be at most 64 characters.", null);
        if (!string.IsNullOrEmpty(stringKey))
        {
            var dupKey = await _db.Categories.AnyAsync(c => c.StringKey == stringKey);
            if (dupKey)
                return ("String key is already in use.", null);
        }

        var rawIcon = dto.LucideIconKey?.Trim();
        var iconKey = string.IsNullOrEmpty(rawIcon) ? CategoryLucideIconKeys.Default : rawIcon;
        if (!CategoryLucideIconKeys.IsValidIconKeyFormat(iconKey))
            return ("Lucide icon key must be PascalCase (e.g. Car, Bike), 1–64 characters.", null);

        var cat = new Category
        {
            Name = name,
            ParentId = dto.ParentId,
            StringKey = stringKey,
            LucideIconKey = iconKey,
        };
        _db.Categories.Add(cat);
        await _db.SaveChangesAsync();

        _logger.LogWarning(
            "GM tools: admin {AdminId} created category {CategoryId} ({Name})",
            adminUserId,
            cat.Id,
            cat.Name);
        return (null, new GmCategoryMutationResultDto { Id = cat.Id, Name = cat.Name });
    }

    public async Task<(string? Error, GmCategoryMutationResultDto? Data)> UpdateCategoryAsync(
        int adminUserId,
        int categoryId,
        GmUpdateCategoryDto dto)
    {
        var cat = await _db.Categories.FirstOrDefaultAsync(c => c.Id == categoryId);
        if (cat == null)
            return ("Category not found.", null);

        if (dto.Name != null)
        {
            var name = dto.Name.Trim();
            if (name.Length is < 1 or > 64)
                return ("Name must be 1–64 characters.", null);
            cat.Name = name;
        }

        if (dto.StringKey != null)
        {
            var newKey = string.IsNullOrWhiteSpace(dto.StringKey) ? null : dto.StringKey.Trim();
            if (newKey?.Length > 64)
                return ("String key must be at most 64 characters.", null);
            if (!string.IsNullOrEmpty(newKey))
            {
                var dup = await _db.Categories.AnyAsync(c => c.StringKey == newKey && c.Id != categoryId);
                if (dup)
                    return ("String key is already in use.", null);
            }

            cat.StringKey = newKey;
        }

        if (dto.LucideIconKey is not null)
        {
            var trimmedIcon = dto.LucideIconKey.Trim();
            if (trimmedIcon.Length == 0)
            {
                cat.LucideIconKey = null;
            }
            else if (!CategoryLucideIconKeys.IsValidIconKeyFormat(trimmedIcon))
            {
                return ("Lucide icon key must be PascalCase (e.g. Car, Bike), 1–64 characters.", null);
            }
            else
            {
                cat.LucideIconKey = trimmedIcon;
            }
        }

        await _db.SaveChangesAsync();
        _logger.LogWarning("GM tools: admin {AdminId} updated category {CategoryId}", adminUserId, categoryId);
        return (null, new GmCategoryMutationResultDto { Id = cat.Id, Name = cat.Name });
    }

    public async Task<(string? Error, GmDeleteCategoryResultDto? Data)> DeleteCategoryAsync(
        int adminUserId,
        int categoryId)
    {
        var cat = await _db.Categories.FirstOrDefaultAsync(c => c.Id == categoryId);
        if (cat == null)
            return ("Category not found.", null);

        if (await _db.Categories.AnyAsync(c => c.ParentId == categoryId))
            return ("Cannot delete a category that has child categories.", null);

        if (await _db.AnyItemWithCategoryAsync(categoryId))
            return ("Cannot delete a category that has listings.", null);

        if (await _db.CategoryFields.AnyAsync(f => f.CategoryId == categoryId))
            return ("Cannot delete a category that still has field definitions. Remove fields first.", null);

        if (await _db.Alerts.AnyAsync(a => a.CategoryId == categoryId))
            return ("Cannot delete a category referenced by user alerts.", null);

        _db.Categories.Remove(cat);
        await _db.SaveChangesAsync();

        _logger.LogWarning("GM tools: admin {AdminId} deleted category {CategoryId}", adminUserId, categoryId);
        return (null, new GmDeleteCategoryResultDto { Id = categoryId, Deleted = true });
    }
}
