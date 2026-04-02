using FluentAssertions;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Moq;
using PlzBuyMe.Api.Data;
using PlzBuyMe.Api.Dtos.Auctions;
using PlzBuyMe.Api.Models;
using PlzBuyMe.Api.Services;
using PlzBuyMe.Tests.Helpers;

namespace PlzBuyMe.Tests.Services;

public class AuctionServiceTests
{
    private static IConfiguration TestAppConfiguration() =>
        new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["MediaStorage:ServiceBaseUrl"] = "http://localhost:5090"
            })
            .Build();

    private static (AppDbContext Db, int SedanId, int MakeFieldId, int SellerId) CreateSeededContext()
    {
        var db = TestDbContextFactory.Create();
        SeedData.Initialize(db);
        var sedan = db.Categories.Single(c => c.Name == "Sedans");
        var makeField = db.CategoryFields.First(f => f.CategoryId == sedan.Id && f.FieldName == "Make");
        var seller = db.Users.Single(u => u.Username == "seller1");
        return (db, sedan.Id, makeField.Id, seller.Id);
    }

    private static ICdnGt7ThumbnailResolver CreateResolverMock(string? url = "http://localhost:5090/media/cars/gt7/car137.png", string matchLevel = "exact")
    {
        var mock = new Mock<ICdnGt7ThumbnailResolver>();
        mock.Setup(r => r.ResolveAsync(It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<int?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new CdnGt7ThumbnailResolveResult(!string.IsNullOrWhiteSpace(url), matchLevel, url, url, "137"));
        mock.Setup(r => r.ResolveByExternalIdAsync(It.IsAny<string?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new CdnGt7ThumbnailResolveResult(!string.IsNullOrWhiteSpace(url), "external-id", url, url, "137"));
        return mock.Object;
    }

    private static AuctionService CreateService(AppDbContext db, IAlertService? alertService = null, ICdnGt7ThumbnailResolver? resolver = null)
    {
        return new AuctionService(
            db,
            alertService ?? new AlertService(db),
            resolver ?? CreateResolverMock(),
            new WalletService(db),
            TestAppConfiguration(),
            new Mock<ILogger<AuctionService>>().Object);
    }

    [Fact]
    public async Task CreateAuction_PersistsItemAndFieldValues()
    {
        var (db, categoryId, makeFieldId, sellerId) = CreateSeededContext();
        var service = CreateService(db);
        var dto = new CreateAuctionDto
        {
            Title = "Test Car",
            Description = "Desc",
            CategoryId = categoryId,
            InitialPrice = 1000m,
            BidIncrement = 100m,
            ReservePrice = 1500m,
            CloseDateTime = DateTime.UtcNow.AddDays(1),
            FieldValues = new List<FieldValueDto> { new(makeFieldId, "Toyota") }
        };
        var result = await service.CreateAuctionAsync(dto, sellerId);
        result.Should().NotBeNull();
        result!.Title.Should().Be("Test Car");
        var item = db.Items.Single(i => i.Title == "Test Car");
        item.CurrentPrice.Should().Be(1000m);
        var fv = db.ItemFieldValues.Single(iv => iv.ItemId == item.Id && iv.FieldId == makeFieldId);
        fv.Value.Should().Be("Toyota");
    }

    [Fact]
    public async Task CreateAuction_WithoutUploadedImage_ResolvesAndPersistsGt7Default()
    {
        var (db, categoryId, _, sellerId) = CreateSeededContext();
        var sedanFields = db.CategoryFields.Where(f => f.CategoryId == categoryId).ToList();
        var makeFieldId = sedanFields.First(f => f.FieldName == "Make").Id;
        var modelFieldId = sedanFields.First(f => f.FieldName == "Model").Id;
        var yearFieldId = sedanFields.First(f => f.FieldName == "Year").Id;

        var resolverMock = new Mock<ICdnGt7ThumbnailResolver>();
        resolverMock.Setup(r => r.ResolveAsync("Honda", "Beat", 1991, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new CdnGt7ThumbnailResolveResult(
                true,
                "exact",
                "http://localhost:5090/media/cars/gt7/car137.png",
                "https://www.gran-turismo.com/common/dist/gt7/carlist/assets/car137_2_01-BjWLpWuk.jpg",
                "137"));
        var service = CreateService(db, resolver: resolverMock.Object);

        var dto = new CreateAuctionDto
        {
            Title = "1991 Honda Beat",
            CategoryId = categoryId,
            InitialPrice = 12000m,
            BidIncrement = 250m,
            ReservePrice = 15000m,
            CloseDateTime = DateTime.UtcNow.AddDays(2),
            FieldValues =
            [
                new FieldValueDto(makeFieldId, "Honda"),
                new FieldValueDto(modelFieldId, "Beat"),
                new FieldValueDto(yearFieldId, "1991")
            ]
        };

        var created = await service.CreateAuctionAsync(dto, sellerId);

        created.Should().NotBeNull();
        created!.ImageUrl.Should().Be("http://localhost:5090/media/cars/gt7/car137.png");
        created.DetailImageUrl.Should().Be("http://localhost:5090/media/cars/gt7/detail/car137.jpg");
        created.ImageSource.Should().Be("gt7-default");
        created.ImageMatchLevel.Should().Be("exact");
        var item = db.Items.Single(i => i.Id == created.Id);
        item.ImageUrl.Should().Be("http://localhost:5090/media/cars/gt7/car137.png");
        item.ImageStorageKey.Should().Be("137");
        resolverMock.Verify(r => r.ResolveAsync("Honda", "Beat", 1991, It.IsAny<CancellationToken>()), Times.Once);
        resolverMock.Verify(r => r.ResolveByExternalIdAsync(It.IsAny<string?>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task CreateAuction_ManifestCatalogHint_SkipsResolverAndPersistsCdnThumbnail()
    {
        var (db, categoryId, _, sellerId) = CreateSeededContext();
        var resolverMock = new Mock<ICdnGt7ThumbnailResolver>();
        var service = CreateService(db, resolver: resolverMock.Object);

        var dto = new CreateAuctionDto
        {
            Title = "Seeded from manifest id",
            CategoryId = categoryId,
            ImageStorageKey = "1523",
            InitialPrice = 5000m,
            BidIncrement = 100m,
            ReservePrice = 6000m,
            CloseDateTime = DateTime.UtcNow.AddDays(1),
            FieldValues = new List<FieldValueDto>()
        };

        var created = await service.CreateAuctionAsync(dto, sellerId);

        created.Should().NotBeNull();
        created!.ImageUrl.Should().Be("http://localhost:5090/media/cars/gt7/car1523.png");
        created.ImageSource.Should().Be("gt7-default");
        created.ImageMatchLevel.Should().Be("manifest");
        var item = db.Items.Single(i => i.Id == created.Id);
        item.ImageUrl.Should().Be("http://localhost:5090/media/cars/gt7/car1523.png");
        item.ImageStorageKey.Should().Be("1523");
        resolverMock.Verify(
            r => r.ResolveAsync(It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<int?>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task CreateAuction_WhenResolverReturnsThirdPartyUrlWithoutExternalId_StillPersistsCdnPaths()
    {
        var (db, categoryId, _, sellerId) = CreateSeededContext();
        var sedanFields = db.CategoryFields.Where(f => f.CategoryId == categoryId).ToList();
        var makeFieldId = sedanFields.First(f => f.FieldName == "Make").Id;
        var modelFieldId = sedanFields.First(f => f.FieldName == "Model").Id;
        var yearFieldId = sedanFields.First(f => f.FieldName == "Year").Id;

        var resolverMock = new Mock<ICdnGt7ThumbnailResolver>();
        resolverMock.Setup(r => r.ResolveAsync("Honda", "Civic", 2020, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new CdnGt7ThumbnailResolveResult(
                true,
                "exact",
                "https://www.gran-turismo.com/common/dist/gt7/carlist/assets/car3377_2_01-CJlc6klO.jpg",
                null,
                null));
        var service = CreateService(db, resolver: resolverMock.Object);

        var dto = new CreateAuctionDto
        {
            Title = "2020 Honda Civic",
            CategoryId = categoryId,
            InitialPrice = 12000m,
            BidIncrement = 250m,
            ReservePrice = 15000m,
            CloseDateTime = DateTime.UtcNow.AddDays(2),
            FieldValues =
            [
                new FieldValueDto(makeFieldId, "Honda"),
                new FieldValueDto(modelFieldId, "Civic"),
                new FieldValueDto(yearFieldId, "2020")
            ]
        };

        var created = await service.CreateAuctionAsync(dto, sellerId);

        created.Should().NotBeNull();
        created!.ImageUrl.Should().Be("http://localhost:5090/media/cars/gt7/car3377.png");
        created.DetailImageUrl.Should().Be("http://localhost:5090/media/cars/gt7/detail/car3377.jpg");
        var item = db.Items.Single(i => i.Id == created.Id);
        item.ImageUrl.Should().Be("http://localhost:5090/media/cars/gt7/car3377.png");
        item.ImageStorageKey.Should().Be("3377");
        item.ImageSource.Should().Be("gt7-default");
    }

    [Fact]
    public async Task CreateAuction_WithoutMatch_PersistsPlaceholderMetadata()
    {
        var (db, categoryId, _, sellerId) = CreateSeededContext();
        var resolver = CreateResolverMock(url: null, matchLevel: "none");
        var service = CreateService(db, resolver: resolver);
        var dto = new CreateAuctionDto
        {
            Title = "Unknown car",
            CategoryId = categoryId,
            InitialPrice = 1000m,
            BidIncrement = 100m,
            ReservePrice = 1200m,
            CloseDateTime = DateTime.UtcNow.AddDays(1)
        };

        var created = await service.CreateAuctionAsync(dto, sellerId);

        created.Should().NotBeNull();
        created!.ImageUrl.Should().BeNull();
        created.ImageSource.Should().Be("placeholder");
        created.ImageMatchLevel.Should().Be("none");
    }

    [Fact]
    public async Task CreateAuction_WithUploadedImage_DoesNotResolveAndKeepsUploadedImage()
    {
        var (db, categoryId, _, sellerId) = CreateSeededContext();
        var resolverMock = new Mock<ICdnGt7ThumbnailResolver>();
        var service = CreateService(db, resolver: resolverMock.Object);
        var dto = new CreateAuctionDto
        {
            Title = "User uploaded image car",
            CategoryId = categoryId,
            ImageStorageKey = "items/2026/03/uploaded-file.png",
            InitialPrice = 9000m,
            BidIncrement = 200m,
            ReservePrice = 11000m,
            CloseDateTime = DateTime.UtcNow.AddDays(1)
        };

        var created = await service.CreateAuctionAsync(dto, sellerId);

        created.Should().NotBeNull();
        created!.ImageUrl.Should().Be("items/2026/03/uploaded-file.png");
        created.ImageSource.Should().Be("uploaded");
        created.ImageMatchLevel.Should().BeNull();
        resolverMock.Verify(r => r.ResolveAsync(It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<int?>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task PlaceBid_BelowIncrement_Rejected()
    {
        var (db, _, _, sellerId) = CreateSeededContext();
        var item = db.Items.First(i => i.Status == ItemStatus.Active);
        var bidder = db.Users.Single(u => u.Username == "bidder1");
        var service = CreateService(db);
        var act = () => service.PlaceBidAsync(item.Id, bidder.Id, item.CurrentPrice + item.BidIncrement - 0.01m);
        await act.Should().ThrowAsync<InvalidOperationException>().WithMessage("*Bid too low*");
    }

    [Fact]
    public async Task PlaceBid_BySeller_Rejected()
    {
        var (db, _, _, sellerId) = CreateSeededContext();
        var item = db.Items.First(i => i.SellerId == sellerId);
        var service = CreateService(db);
        var act = () => service.PlaceBidAsync(item.Id, sellerId, item.CurrentPrice + item.BidIncrement);
        await act.Should().ThrowAsync<InvalidOperationException>().WithMessage("*own items*");
    }

    [Fact]
    public async Task PlaceBid_OnClosedAuction_Rejected()
    {
        var (db, _, _, _) = CreateSeededContext();
        var item = db.Items.First(i => i.Status == ItemStatus.Active);
        var bidder = db.Users.Single(u => u.Username == "bidder1");
        item.Status = ItemStatus.Closed;
        db.SaveChanges();
        var service = CreateService(db);
        var act = () => service.PlaceBidAsync(item.Id, bidder.Id, item.CurrentPrice + item.BidIncrement);
        await act.Should().ThrowAsync<InvalidOperationException>().WithMessage("*not active*");
    }

    [Fact]
    public async Task GmBulkCloseActive_InvalidMode_ReturnsError()
    {
        var (db, _, _, _) = CreateSeededContext();
        var service = CreateService(db);
        var (err, result) = await service.GmBulkCloseActiveAuctionsAsync("invalid");
        err.Should().NotBeNull();
        result.Should().BeNull();
    }

    [Fact]
    public async Task GmBulkCloseActive_ClosedMode_EndsAllActiveWithoutSale()
    {
        var (db, _, _, _) = CreateSeededContext();
        var activeBefore = db.Items.Count(i => i.Status == ItemStatus.Active);
        activeBefore.Should().BeGreaterThan(0);
        var service = CreateService(db);
        var (err, result) = await service.GmBulkCloseActiveAuctionsAsync("closed");
        err.Should().BeNull();
        result.Should().NotBeNull();
        result!.ProcessedCount.Should().Be(activeBefore);
        result.SoldCount.Should().Be(0);
        result.ClosedWithoutSaleCount.Should().Be(activeBefore);
        db.Items.Count(i => i.Status == ItemStatus.Active).Should().Be(0);
    }

    [Fact]
    public async Task PlaceBid_AfterScheduledClose_Rejected()
    {
        var (db, _, _, _) = CreateSeededContext();
        var item = db.Items.First(i => i.Status == ItemStatus.Active);
        var bidder = db.Users.Single(u => u.Username == "bidder1");
        item.CloseDateTime = DateTime.UtcNow.AddSeconds(-1);
        db.SaveChanges();
        var service = CreateService(db);
        var act = () => service.PlaceBidAsync(item.Id, bidder.Id, item.CurrentPrice + item.BidIncrement);
        await act.Should().ThrowAsync<InvalidOperationException>().WithMessage("*ended*");
    }

    [Fact]
    public async Task PlaceBid_ValidBid_UpdatesCurrentPrice()
    {
        var (db, _, _, _) = CreateSeededContext();
        var item = db.Items.First(i => i.Status == ItemStatus.Active);
        var bidder = db.Users.Single(u => u.Username == "bidder1");
        var newAmount = item.CurrentPrice + item.BidIncrement;
        var service = CreateService(db);
        await service.PlaceBidAsync(item.Id, bidder.Id, newAmount);
        db.Entry(item).Reload();
        item.CurrentPrice.Should().Be(newAmount);
        db.Bids.Should().Contain(b => b.ItemId == item.Id && b.BidderId == bidder.Id && b.Amount == newAmount);
    }

    [Fact]
    public async Task SetAutoBid_ThenHigherManualBid_TriggersAutoBidCascade()
    {
        var (db, _, _, _) = CreateSeededContext();
        var item = db.Items.First(i => i.Title.Contains("Camry"));
        var bidder1 = db.Users.Single(u => u.Username == "bidder1");
        var bidder2 = db.Users.Single(u => u.Username == "bidder2");
        var service = CreateService(db);
        await service.SetAutoBidAsync(item.Id, bidder1.Id, 26000m);
        db.Entry(item).Reload();
        var minBid = item.CurrentPrice + item.BidIncrement;
        await service.PlaceBidAsync(item.Id, bidder2.Id, minBid);
        db.Entry(item).Reload();
        item.CurrentPrice.Should().Be(24500m);
        var autoBid = db.Bids.FirstOrDefault(b => b.ItemId == item.Id && b.IsAuto && b.BidderId == bidder1.Id);
        autoBid.Should().NotBeNull();
    }

    [Fact]
    public async Task SetAutoBid_StopsAtUpperLimit_AndCreatesNotification()
    {
        var (db, _, _, _) = CreateSeededContext();
        var item = db.Items.First(i => i.Title.Contains("Civic"));
        var bidder = db.Users.Single(u => u.Username == "bidder1");
        var service = CreateService(db);
        await service.SetAutoBidAsync(item.Id, bidder.Id, 18800m);
        var other = db.Users.Single(u => u.Username == "bidder2");
        await service.PlaceBidAsync(item.Id, other.Id, 19000m);
        var autoBid = db.AutoBids.Single(ab => ab.ItemId == item.Id && ab.BidderId == bidder.Id);
        autoBid.IsActive.Should().BeFalse();
        db.Notifications.Should().Contain(n => n.UserId == bidder.Id && n.Type == NotificationType.AutoLimitReached);
    }

    [Fact]
    public async Task SetAutoBid_AcceptsUpperLimitNotOnBidIncrementMultiple_AndPlacesBidAtNextIncrement()
    {
        var (db, _, _, _) = CreateSeededContext();
        var item = db.Items.First(i => i.Title.Contains("Civic"));
        var bidder = db.Users.Single(u => u.Username == "bidder2");
        var minUpper = item.CurrentPrice + item.BidIncrement;
        var upperNotOnGrid = minUpper + 1m;
        var service = CreateService(db);
        await service.SetAutoBidAsync(item.Id, bidder.Id, upperNotOnGrid);
        db.Entry(item).Reload();
        var stored = db.AutoBids.Single(ab => ab.ItemId == item.Id && ab.BidderId == bidder.Id);
        stored.UpperLimit.Should().Be(upperNotOnGrid);
        item.CurrentPrice.Should().Be(minUpper);
        db.Bids.Should().Contain(b =>
            b.ItemId == item.Id && b.BidderId == bidder.Id && b.IsAuto && b.Amount == minUpper);
    }

    [Fact]
    public async Task SetAutoBid_RejectsUpperLimitBelowMinimumThreshold()
    {
        var (db, _, _, _) = CreateSeededContext();
        var item = db.Items.First(i => i.Title.Contains("Civic"));
        var bidder = db.Users.Single(u => u.Username == "bidder2");
        var service = CreateService(db);
        var tooLow = item.CurrentPrice + item.BidIncrement - 0.01m;
        var act = () => service.SetAutoBidAsync(item.Id, bidder.Id, tooLow);
        await act.Should().ThrowAsync<InvalidOperationException>().WithMessage("*Upper limit must be at least*");
    }

    [Fact]
    public async Task CloseExpired_SetsWinnerWhenReserveMet()
    {
        var (db, _, _, _) = CreateSeededContext();
        var item = db.Items.First(i => i.Status == ItemStatus.Active);
        item.CloseDateTime = DateTime.UtcNow.AddSeconds(-1);
        var bidder = db.Users.Single(u => u.Username == "bidder1");
        db.Bids.Add(new Bid { ItemId = item.Id, BidderId = bidder.Id, Amount = item.ReservePrice, IsAuto = false });
        item.CurrentPrice = item.ReservePrice;
        db.SaveChanges();
        var service = CreateService(db);
        await service.CloseExpiredAsync();
        db.Entry(item).Reload();
        item.Status.Should().Be(ItemStatus.Sold);
        item.WinnerId.Should().Be(bidder.Id);
        db.Notifications.Should().Contain(n => n.UserId == bidder.Id && n.Type == NotificationType.AuctionWon);
        db.Notifications.Should().Contain(n => n.UserId == item.SellerId && n.Type == NotificationType.AuctionSold);
    }

    [Fact]
    public async Task CloseExpired_MarksClosedWhenReserveNotMet()
    {
        var (db, _, _, _) = CreateSeededContext();
        var item = db.Items.First(i => i.Status == ItemStatus.Active);
        item.CloseDateTime = DateTime.UtcNow.AddSeconds(-1);
        item.CurrentPrice = item.InitialPrice;
        db.SaveChanges();
        var service = CreateService(db);
        await service.CloseExpiredAsync();
        db.Entry(item).Reload();
        item.Status.Should().Be(ItemStatus.Closed);
        item.WinnerId.Should().BeNull();
        db.Notifications.Should().Contain(n => n.UserId == item.SellerId && n.Type == NotificationType.ReserveNotMet);
    }

    [Fact]
    public async Task CloseExpired_ReserveNotMet_NotifiesAllBidders()
    {
        var (db, _, _, _) = CreateSeededContext();
        var item = db.Items.First(i => i.Status == ItemStatus.Active);
        item.CloseDateTime = DateTime.UtcNow.AddSeconds(-1);
        var bidder1 = db.Users.Single(u => u.Username == "bidder1");
        var bidder2 = db.Users.Single(u => u.Username == "bidder2");
        var belowReserve = item.ReservePrice - item.BidIncrement;
        db.Bids.Add(new Bid { ItemId = item.Id, BidderId = bidder1.Id, Amount = belowReserve - item.BidIncrement, IsAuto = false });
        db.Bids.Add(new Bid { ItemId = item.Id, BidderId = bidder2.Id, Amount = belowReserve, IsAuto = false });
        item.CurrentPrice = belowReserve;
        db.SaveChanges();
        var service = CreateService(db);
        await service.CloseExpiredAsync();
        db.Notifications.Should().Contain(n => n.UserId == item.SellerId && n.Type == NotificationType.ReserveNotMet);
        db.Notifications.Should().Contain(n => n.UserId == bidder1.Id && n.Type == NotificationType.ReserveNotMet);
        db.Notifications.Should().Contain(n => n.UserId == bidder2.Id && n.Type == NotificationType.ReserveNotMet);
    }

    [Fact]
    public async Task GetSimilar_ReturnsSameSubcategoryWithinPrecedingMonth()
    {
        var (db, categoryId, makeFieldId, sellerId) = CreateSeededContext();
        var sedan = db.Categories.Single(c => c.Name == "Sedans");
        var fields = db.CategoryFields.Where(f => f.CategoryId == sedan.Id).OrderBy(f => f.Id).ToList();
        var item1 = db.Items.First(i => i.CategoryId == sedan.Id);
        var item2 = new Item
        {
            SellerId = sellerId,
            CategoryId = sedan.Id,
            Title = "Similar Sedan",
            InitialPrice = 20000m,
            BidIncrement = 500m,
            ReservePrice = 22000m,
            CurrentPrice = 20000m,
            CloseDateTime = DateTime.UtcNow.AddDays(5),
            Status = ItemStatus.Active,
            CreatedAt = DateTime.UtcNow.AddDays(-7)
        };
        db.Items.Add(item2);
        db.SaveChanges();
        foreach (var f in fields)
            db.ItemFieldValues.Add(new ItemFieldValue { ItemId = item2.Id, FieldId = f.Id, Value = "X" });
        db.SaveChanges();
        var service = CreateService(db);
        var similar = await service.GetSimilarAsync(item1.Id, 5);
        similar.Should().Contain(s => s.Id == item2.Id);
        similar.Should().NotContain(s => s.Id == item1.Id);
    }

    [Fact]
    public async Task PlaceBid_InsufficientWallet_ThrowsDeterministicMessage()
    {
        var (db, _, _, _) = CreateSeededContext();
        var item = db.Items.First(i => i.Title.Contains("Civic"));
        var poor = new User
        {
            Username = "poor",
            Email = "poor@example.com",
            PasswordHash = "hash",
            Role = UserRole.EndUser,
            WalletBalance = 0m
        };
        db.Users.Add(poor);
        db.SaveChanges();
        var service = CreateService(db);
        var minBid = item.CurrentPrice + item.BidIncrement;
        var act = () => service.PlaceBidAsync(item.Id, poor.Id, minBid);
        await act.Should().ThrowAsync<InvalidOperationException>().WithMessage(WalletService.InsufficientWalletMessage);
    }

    [Fact]
    public async Task PlaceBid_WhenOutbid_PreviousLeaderHoldReleased()
    {
        var (db, _, _, _) = CreateSeededContext();
        var item = db.Items.First(i => i.Title.Contains("Civic"));
        var bidder1 = db.Users.Single(u => u.Username == "bidder1");
        var bidder2 = db.Users.Single(u => u.Username == "bidder2");
        db.BidHolds.Single(h => h.ItemId == item.Id).UserId.Should().Be(bidder1.Id);
        var service = CreateService(db);
        var newAmount = item.CurrentPrice + item.BidIncrement;
        await service.PlaceBidAsync(item.Id, bidder2.Id, newAmount);
        var hold = db.BidHolds.Single(h => h.ItemId == item.Id);
        hold.UserId.Should().Be(bidder2.Id);
        hold.Amount.Should().Be(newAmount);
        db.BidHolds.Should().NotContain(h => h.UserId == bidder1.Id && h.ItemId == item.Id);
    }

    [Fact]
    public async Task CloseExpired_WhenSold_DebitWinnerCreditSellerAndClearHold()
    {
        var (db, _, _, sellerId) = CreateSeededContext();
        var seller = await db.Users.FindAsync(sellerId) ?? throw new InvalidOperationException("seller missing");
        var winner = db.Users.Single(u => u.Username == "bidder2");
        var sellerStart = seller.WalletBalance;
        var winnerStart = winner.WalletBalance;
        var item = db.Items.First(i => i.Title.Contains("Camry"));
        item.CloseDateTime = DateTime.UtcNow.AddSeconds(-1);
        item.ReservePrice = 22000m;
        db.SaveChanges();
        var service = CreateService(db);
        await service.CloseExpiredAsync();
        db.Entry(seller).Reload();
        db.Entry(winner).Reload();
        db.Entry(item).Reload();
        item.Status.Should().Be(ItemStatus.Sold);
        item.WinnerId.Should().Be(winner.Id);
        winner.WalletBalance.Should().Be(winnerStart - 23000m);
        seller.WalletBalance.Should().Be(sellerStart + 23000m);
        db.BidHolds.Should().NotContain(h => h.ItemId == item.Id);
        var loser = db.Users.Single(u => u.Username == "bidder1");
        db.Notifications.Should().Contain(n => n.UserId == loser.Id && n.Type == NotificationType.AuctionLost);
        db.Notifications.Should().NotContain(n => n.UserId == winner.Id && n.Type == NotificationType.AuctionLost);
        db.Notifications.Should().Contain(n => n.UserId == sellerId && n.Type == NotificationType.AuctionSold);
    }

    [Fact]
    public async Task CloseExpired_WhenReserveNotMet_ReleasesHighBidHold()
    {
        var (db, _, _, _) = CreateSeededContext();
        var item = db.Items.First(i => i.Title.Contains("Camry"));
        item.CloseDateTime = DateTime.UtcNow.AddSeconds(-1);
        db.SaveChanges();
        db.BidHolds.Should().Contain(h => h.ItemId == item.Id);
        var service = CreateService(db);
        await service.CloseExpiredAsync();
        db.Entry(item).Reload();
        item.Status.Should().Be(ItemStatus.Closed);
        db.BidHolds.Should().NotContain(h => h.ItemId == item.Id);
    }
}
