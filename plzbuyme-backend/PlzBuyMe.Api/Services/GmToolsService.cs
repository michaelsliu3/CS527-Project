using System.Linq;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
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
    public const string ConfirmationPhrase = "CONFIRM_GM";

    private const int MaxManifestAuctionsBatch = 100;
    private const int ManifestConfirmThreshold = 40;
    private const int MaxAuctionsBatch = 50;
    private const int MaxUsersBatch = 50;
    private const int MaxQuestionsBatch = 30;
    private const int MaxWalletRecipients = 30;
    private const decimal MaxWalletAmountEach = 10_000_000m;
    private const int MaxBidsPerAuction = 12;
    private const int MaxSampleAlerts = 10;
    private const int MaxSampleNotifications = 20;
    private const int AuctionConfirmThreshold = 20;
    private const int UsersConfirmThreshold = 25;
    private const int QuestionsConfirmThreshold = 15;
    private const int WalletRecipientsConfirmThreshold = 15;
    private const decimal WalletAmountConfirmThreshold = 100_000m;
    private const string DefaultDemoPassword = "GmDemo123!";

    private static readonly string[] LeafCategoryNames =
    {
        "Sedans", "SUVs", "Trucks", "Sports Cars", "Electric"
    };

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

    public async Task<(string? Error, GmSeedAuctionsResultDto? Data)> SeedAuctionsAsync(int adminUserId, GmSeedAuctionsDto dto)
    {
        if (dto.Count < 1 || dto.Count > MaxAuctionsBatch)
            return ($"Count must be between 1 and {MaxAuctionsBatch}.", null);

        if (dto.Count > AuctionConfirmThreshold && !string.Equals(dto.Confirmation, ConfirmationPhrase, StringComparison.Ordinal))
            return ($"When count exceeds {AuctionConfirmThreshold}, Confirmation must be \"{ConfirmationPhrase}\".", null);

        if (dto.CloseHoursMin < 1 || dto.CloseHoursMax > 8760 || dto.CloseHoursMin > dto.CloseHoursMax)
            return ("CloseHoursMin and CloseHoursMax must satisfy 1 ≤ min ≤ max ≤ 8760.", null);

        if (dto.BidCountMin < 0 || dto.BidCountMax > MaxBidsPerAuction || dto.BidCountMin > dto.BidCountMax)
            return ($"Bid counts must satisfy 0 ≤ min ≤ max ≤ {MaxBidsPerAuction}.", null);

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

        if (dto.Count > ManifestConfirmThreshold &&
            !string.Equals(dto.Confirmation, ConfirmationPhrase, StringComparison.Ordinal))
            return ($"When count exceeds {ManifestConfirmThreshold}, Confirmation must be \"{ConfirmationPhrase}\".", null);

        if (dto.CloseHoursMin < 1 || dto.CloseHoursMax > 8760 || dto.CloseHoursMin > dto.CloseHoursMax)
            return ("CloseHoursMin and CloseHoursMax must satisfy 1 ≤ min ≤ max ≤ 8760.", null);

        if (dto.BidCountMin < 0 || dto.BidCountMax > MaxBidsPerAuction || dto.BidCountMin > dto.BidCountMax)
            return ($"Bid counts must satisfy 0 ≤ min ≤ max ≤ {MaxBidsPerAuction}.", null);

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
            var category = await ResolveCategoryForManifestAsync(mode, asset);
            if (category == null)
            {
                return (
                    $"Category not found for mode \"{mode}\". Use auto or a leaf name (e.g. Sedans).",
                    null);
            }

            var createDto = Gt7ManifestAuctionBuilder.BuildCreateDto(
                asset,
                category,
                dto.CloseHoursMin,
                dto.CloseHoursMax,
                dto.UseDetailImage);
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

    private async Task<Category?> ResolveCategoryForManifestAsync(string categoryMode, Gt7ManifestAsset asset)
    {
        if (string.Equals(categoryMode, "auto", StringComparison.OrdinalIgnoreCase))
        {
            var name = Gt7ManifestAuctionBuilder.InferCategoryName(asset);
            return await _db.Categories
                .Include(c => c.CategoryFields)
                .FirstOrDefaultAsync(c => c.Name == name && c.CategoryFields.Any());
        }

        return await _db.Categories
            .Include(c => c.CategoryFields)
            .FirstOrDefaultAsync(c => c.Name == categoryMode && c.CategoryFields.Any());
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

        if (dto.Count > UsersConfirmThreshold && !string.Equals(dto.Confirmation, ConfirmationPhrase, StringComparison.Ordinal))
            return ($"When count exceeds {UsersConfirmThreshold}, Confirmation must be \"{ConfirmationPhrase}\".", null);

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

        if (dto.Count > QuestionsConfirmThreshold && !string.Equals(dto.Confirmation, ConfirmationPhrase, StringComparison.Ordinal))
            return ($"When count exceeds {QuestionsConfirmThreshold}, Confirmation must be \"{ConfirmationPhrase}\".", null);

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
        var needsConfirm = distinct.Count > WalletRecipientsConfirmThreshold || dto.AmountEach > WalletAmountConfirmThreshold;
        if (needsConfirm && !string.Equals(dto.Confirmation, ConfirmationPhrase, StringComparison.Ordinal))
            return ($"For this volume, Confirmation must be \"{ConfirmationPhrase}\".", null);

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
            .Where(c => LeafCategoryNames.Contains(c.Name) && c.CategoryFields.Any())
            .ToListAsync();

        if (candidates.Count == 0)
            return null;

        return candidates[Random.Shared.Next(candidates.Count)];
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
        var fields = category.CategoryFields.ToList();
        var idFor = new Dictionary<string, int>(StringComparer.Ordinal);
        foreach (var f in fields)
            idFor[f.FieldName] = f.Id;

        var make = Makes[Random.Shared.Next(Makes.Length)];
        var model = Models[Random.Shared.Next(Models.Length)];
        var year = 2018 + Random.Shared.Next(8);
        var mileage = Random.Shared.Next(500, 200_000);
        var hours = Random.Shared.Next(closeHoursMin, closeHoursMax + 1);
        var closeAt = DateTime.UtcNow.AddHours(hours);
        var initial = 5000m + Random.Shared.Next(0, 80_000);
        var increment = 50m + Random.Shared.Next(0, 450);
        var reserve = initial + increment * Random.Shared.Next(2, 20);

        var fv = new List<FieldValueDto>
        {
            new(idFor["Make"], make),
            new(idFor["Model"], model),
            new(idFor["Year"], year.ToString()),
            new(idFor["Mileage"], mileage.ToString()),
            new(idFor["Condition"], Conditions[Random.Shared.Next(Conditions.Length)]),
            new(idFor["Transmission"], Transmissions[Random.Shared.Next(Transmissions.Length)]),
            new(idFor["Fuel Type"], Fuels[Random.Shared.Next(Fuels.Length)]),
            new(idFor["Exterior Color"], Colors[Random.Shared.Next(Colors.Length)])
        };

        return new CreateAuctionDto
        {
            Title = $"{year} {make} {model} (GM seed)",
            Description = "Bulk-seeded listing for demos, load tests, or QA.",
            CategoryId = category.Id,
            InitialPrice = initial,
            BidIncrement = increment,
            ReservePrice = reserve,
            CloseDateTime = closeAt,
            FieldValues = fv
        };
    }
}
