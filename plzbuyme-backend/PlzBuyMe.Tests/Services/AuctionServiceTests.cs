using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Moq;
using PlzBuyMe.Api.Data;
using PlzBuyMe.Api.Dtos.Admin;
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
            CategoryIds = new List<int> { categoryId },
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
    public async Task CreateAuction_WithAdditionalSubcategories_PersistsTags_AndCategorySearchMatches()
    {
        var (db, categoryId, makeFieldId, sellerId) = CreateSeededContext();
        var additionalCategoryId = db.Categories.Single(c => c.Name == "Electric").Id;
        var service = CreateService(db);
        var dto = new CreateAuctionDto
        {
            Title = "Multi-tag car",
            Description = "Tagged for multiple subcategories",
            CategoryIds = new List<int> { categoryId, additionalCategoryId },
            InitialPrice = 1000m,
            BidIncrement = 100m,
            ReservePrice = 1500m,
            CloseDateTime = DateTime.UtcNow.AddDays(1),
            FieldValues = new List<FieldValueDto> { new(makeFieldId, "Tesla") }
        };

        var created = await service.CreateAuctionAsync(dto, sellerId);

        created.Should().NotBeNull();
        created!.CategoryNames.Should().Contain("Sedans");
        created.CategoryNames.Should().Contain("Electric");

        var item = db.Items.Single(i => i.Title == "Multi-tag car");

        var search = await service.SearchAsync(new SearchQueryDto
        {
            CategoryId = additionalCategoryId,
            Page = 1,
            PageSize = 20
        });
        search.Items.Should().Contain(i => i.Id == item.Id);
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
            CategoryIds = new List<int> { categoryId },
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
    public async Task GmDeleteAllAuctionsAsync_RemovesAllItemsBidsAndRelatedRows()
    {
        var (db, _, _, _) = CreateSeededContext();
        var service = CreateService(db);
        var itemsBefore = await db.Items.CountAsync();
        var bidsBefore = await db.Bids.CountAsync();
        itemsBefore.Should().BeGreaterThan(0);
        bidsBefore.Should().BeGreaterThan(0);

        var (error, result) = await service.GmDeleteAllAuctionsAsync();

        error.Should().BeNull();
        result.Should().NotBeNull();
        result!.ItemsDeleted.Should().Be(itemsBefore);
        result.BidsDeleted.Should().Be(bidsBefore);
        (await db.Items.CountAsync()).Should().Be(0);
        (await db.Bids.CountAsync()).Should().Be(0);
        (await db.AutoBids.CountAsync()).Should().Be(0);
        (await db.BidHolds.CountAsync()).Should().Be(0);
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
            CategoryIds = new List<int> { categoryId },
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
            CategoryIds = new List<int> { categoryId },
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
            CategoryIds = new List<int> { categoryId },
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
            CategoryIds = new List<int> { categoryId },
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
        var item1 = db.Items.First(i => i.CategoryIds.Contains(sedan.Id));
        var item2 = new Item
        {
            SellerId = sellerId,
            CategoryIds = new List<int> { sedan.Id },
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

    [Fact]
    public async Task GetHistoryAsync_IncludesBidderOnlySellerOnlyAndBothRoles()
    {
        var (db, categoryId, _, _) = CreateSeededContext();
        var service = CreateService(db);
        var target = new User
        {
            Username = "history-target",
            Email = "history-target@example.com",
            PasswordHash = "hash",
            Role = UserRole.EndUser,
            WalletBalance = 50_000m
        };
        var otherSeller = new User
        {
            Username = "history-other",
            Email = "history-other@example.com",
            PasswordHash = "hash",
            Role = UserRole.EndUser,
            WalletBalance = 50_000m
        };
        db.Users.AddRange(target, otherSeller);
        await db.SaveChangesAsync();

        var now = DateTime.UtcNow;
        var bidderOnlyItem = new Item
        {
            SellerId = otherSeller.Id,
            CategoryIds = new List<int> { categoryId },
            Title = "Bidder only item",
            InitialPrice = 100m,
            BidIncrement = 10m,
            ReservePrice = 150m,
            CurrentPrice = 100m,
            CloseDateTime = now.AddDays(1),
            CreatedAt = now.AddMinutes(-3),
            Status = ItemStatus.Active
        };
        var sellerOnlyItem = new Item
        {
            SellerId = target.Id,
            CategoryIds = new List<int> { categoryId },
            Title = "Seller only item",
            InitialPrice = 200m,
            BidIncrement = 10m,
            ReservePrice = 250m,
            CurrentPrice = 200m,
            CloseDateTime = now.AddDays(1),
            CreatedAt = now.AddMinutes(-2),
            Status = ItemStatus.Active
        };
        var bothItem = new Item
        {
            SellerId = target.Id,
            CategoryIds = new List<int> { categoryId },
            Title = "Both roles item",
            InitialPrice = 300m,
            BidIncrement = 10m,
            ReservePrice = 350m,
            CurrentPrice = 300m,
            CloseDateTime = now.AddDays(1),
            CreatedAt = now.AddMinutes(-1),
            Status = ItemStatus.Active
        };
        var neitherItem = new Item
        {
            SellerId = otherSeller.Id,
            CategoryIds = new List<int> { categoryId },
            Title = "Neither role item",
            InitialPrice = 400m,
            BidIncrement = 10m,
            ReservePrice = 450m,
            CurrentPrice = 400m,
            CloseDateTime = now.AddDays(1),
            CreatedAt = now,
            Status = ItemStatus.Active
        };
        db.Items.AddRange(bidderOnlyItem, sellerOnlyItem, bothItem, neitherItem);
        await db.SaveChangesAsync();

        db.Bids.AddRange(
            new Bid { ItemId = bidderOnlyItem.Id, BidderId = target.Id, Amount = 110m, IsAuto = false, CreatedAt = now.AddMinutes(-2) },
            new Bid { ItemId = bothItem.Id, BidderId = target.Id, Amount = 310m, IsAuto = false, CreatedAt = now.AddMinutes(-1) }
        );
        await db.SaveChangesAsync();

        var history = await service.GetHistoryAsync(target.Id);
        var historyIds = history.Select(i => i.Id).ToHashSet();

        historyIds.Should().Contain(bidderOnlyItem.Id);
        historyIds.Should().Contain(sellerOnlyItem.Id);
        historyIds.Should().Contain(bothItem.Id);
        historyIds.Should().NotContain(neitherItem.Id);
    }

    [Fact]
    public async Task GetHistoryAsync_ReturnsEmptyWhenUserHasNoParticipation()
    {
        var (db, _, _, _) = CreateSeededContext();
        var service = CreateService(db);
        var user = new User
        {
            Username = "no-history-user",
            Email = "no-history-user@example.com",
            PasswordHash = "hash",
            Role = UserRole.EndUser,
            WalletBalance = 10m
        };
        db.Users.Add(user);
        await db.SaveChangesAsync();

        var history = await service.GetHistoryAsync(user.Id);

        history.Should().BeEmpty();
    }

    [Fact]
    public async Task AdminPatchAuction_WithAdditionalSubcategories_ReplacesItemTags()
    {
        var (db, _, _, _) = CreateSeededContext();
        var service = CreateService(db);
        var item = db.Items.First(i => i.Status == ItemStatus.Active);
        var primaryCategoryId = item.CategoryIds[0];
        var primaryCategory = db.Categories.Single(c => c.Id == primaryCategoryId);
        primaryCategory.ParentId.Should().NotBeNull();
        var rootCategoryId = primaryCategory.ParentId!.Value;
        var additionalCategoryId = db.Categories
            .Where(c => c.ParentId == rootCategoryId && !item.CategoryIds.Contains(c.Id))
            .Select(c => c.Id)
            .First();

        var (error, detail) = await service.AdminPatchAuctionAsync(
            item.Id,
            new AdminPatchAuctionDto
            {
                CategoryIds = new List<int> { primaryCategoryId, additionalCategoryId }
            },
            adminUserId: 1);

        error.Should().BeNull();
        detail.Should().NotBeNull();
        detail!.CategoryIds.Should().Contain(additionalCategoryId);
    }

    [Fact]
    public async Task SearchAsync_GenericSortModes_AreAppliedDeterministically()
    {
        var (db, categoryId, _, _) = CreateSeededContext();
        var service = CreateService(db);
        var seller = new User
        {
            Username = "sortseller-generic",
            Email = "sortseller-generic@example.com",
            PasswordHash = "hash",
            Role = UserRole.EndUser,
            WalletBalance = 100000m
        };
        db.Users.Add(seller);
        await db.SaveChangesAsync();

        var now = DateTime.UtcNow;
        var itemA = new Item
        {
            SellerId = seller.Id,
            CategoryIds = new List<int> { categoryId },
            Title = "Sort Generic A",
            InitialPrice = 100m,
            BidIncrement = 10m,
            ReservePrice = 120m,
            CurrentPrice = 100m,
            CloseDateTime = now.AddDays(3),
            CreatedAt = now.AddDays(-1),
            Status = ItemStatus.Active
        };
        var itemB = new Item
        {
            SellerId = seller.Id,
            CategoryIds = new List<int> { categoryId },
            Title = "Sort Generic B",
            InitialPrice = 200m,
            BidIncrement = 10m,
            ReservePrice = 220m,
            CurrentPrice = 200m,
            CloseDateTime = now.AddDays(1),
            CreatedAt = now.AddDays(-2),
            Status = ItemStatus.Active
        };
        var itemC = new Item
        {
            SellerId = seller.Id,
            CategoryIds = new List<int> { categoryId },
            Title = "Sort Generic C",
            InitialPrice = 200m,
            BidIncrement = 10m,
            ReservePrice = 220m,
            CurrentPrice = 200m,
            CloseDateTime = now.AddDays(2),
            CreatedAt = now.AddDays(-3),
            Status = ItemStatus.Active
        };

        db.Items.AddRange(itemA, itemB, itemC);
        await db.SaveChangesAsync();

        db.Bids.AddRange(
            new Bid { ItemId = itemA.Id, BidderId = seller.Id, Amount = 105m, IsAuto = false, CreatedAt = now.AddMinutes(-30) },
            new Bid { ItemId = itemA.Id, BidderId = seller.Id, Amount = 110m, IsAuto = false, CreatedAt = now.AddMinutes(-20) },
            new Bid { ItemId = itemB.Id, BidderId = seller.Id, Amount = 205m, IsAuto = false, CreatedAt = now.AddMinutes(-10) },
            new Bid { ItemId = itemC.Id, BidderId = seller.Id, Amount = 205m, IsAuto = false, CreatedAt = now.AddMinutes(-5) }
        );
        await db.SaveChangesAsync();

        var priceDesc = await service.SearchAsync(new SearchQueryDto { Seller = seller.Username, Sort = "price_desc", Page = 1, PageSize = 10 });
        priceDesc.Items.Select(i => i.Title).Should().ContainInOrder("Sort Generic B", "Sort Generic C", "Sort Generic A");

        var priceAsc = await service.SearchAsync(new SearchQueryDto { Seller = seller.Username, Sort = "price_asc", Page = 1, PageSize = 10 });
        priceAsc.Items.Select(i => i.Title).Should().ContainInOrder("Sort Generic A", "Sort Generic B", "Sort Generic C");

        var closingSoon = await service.SearchAsync(new SearchQueryDto { Seller = seller.Username, Sort = "closing_soon", Page = 1, PageSize = 10 });
        closingSoon.Items.Select(i => i.Title).Should().ContainInOrder("Sort Generic B", "Sort Generic C", "Sort Generic A");

        var newest = await service.SearchAsync(new SearchQueryDto { Seller = seller.Username, Sort = "newest", Page = 1, PageSize = 10 });
        newest.Items.Select(i => i.Title).Should().ContainInOrder("Sort Generic A", "Sort Generic B", "Sort Generic C");

        var mostBids = await service.SearchAsync(new SearchQueryDto { Seller = seller.Username, Sort = "most_bids", Page = 1, PageSize = 10 });
        mostBids.Items.Select(i => i.Title).Should().ContainInOrder("Sort Generic A", "Sort Generic B", "Sort Generic C");

        var defaultSort = await service.SearchAsync(new SearchQueryDto { Seller = seller.Username, Page = 1, PageSize = 10 });
        defaultSort.Items.Select(i => i.Title).Should().ContainInOrder("Sort Generic B", "Sort Generic C", "Sort Generic A");
    }

    [Fact]
    public async Task SearchAsync_CarFieldSortModes_OrderByNumericValue_WithDeterministicTieBreak()
    {
        var (db, categoryId, _, _) = CreateSeededContext();
        var service = CreateService(db);
        var yearFieldId = db.CategoryFields.Single(f => f.CategoryId == categoryId && f.FieldName == "Year").Id;
        var mileageFieldId = db.CategoryFields.Single(f => f.CategoryId == categoryId && f.FieldName == "Mileage").Id;

        var seller = new User
        {
            Username = "sortseller-car",
            Email = "sortseller-car@example.com",
            PasswordHash = "hash",
            Role = UserRole.EndUser,
            WalletBalance = 100000m
        };
        db.Users.Add(seller);
        await db.SaveChangesAsync();

        var now = DateTime.UtcNow;
        var itemD = new Item
        {
            SellerId = seller.Id,
            CategoryIds = new List<int> { categoryId },
            Title = "Sort Car D",
            InitialPrice = 100m,
            BidIncrement = 10m,
            ReservePrice = 150m,
            CurrentPrice = 100m,
            CloseDateTime = now.AddDays(2),
            CreatedAt = now.AddDays(-1),
            Status = ItemStatus.Active
        };
        var itemE = new Item
        {
            SellerId = seller.Id,
            CategoryIds = new List<int> { categoryId },
            Title = "Sort Car E",
            InitialPrice = 100m,
            BidIncrement = 10m,
            ReservePrice = 150m,
            CurrentPrice = 100m,
            CloseDateTime = now.AddDays(3),
            CreatedAt = now.AddDays(-2),
            Status = ItemStatus.Active
        };
        var itemF = new Item
        {
            SellerId = seller.Id,
            CategoryIds = new List<int> { categoryId },
            Title = "Sort Car F",
            InitialPrice = 100m,
            BidIncrement = 10m,
            ReservePrice = 150m,
            CurrentPrice = 100m,
            CloseDateTime = now.AddDays(1),
            CreatedAt = now.AddDays(-3),
            Status = ItemStatus.Active
        };
        db.Items.AddRange(itemD, itemE, itemF);
        await db.SaveChangesAsync();

        db.ItemFieldValues.AddRange(
            new ItemFieldValue { ItemId = itemD.Id, FieldId = yearFieldId, Value = "2020" },
            new ItemFieldValue { ItemId = itemE.Id, FieldId = yearFieldId, Value = "2022" },
            new ItemFieldValue { ItemId = itemF.Id, FieldId = yearFieldId, Value = "2022" },
            new ItemFieldValue { ItemId = itemD.Id, FieldId = mileageFieldId, Value = "50000" },
            new ItemFieldValue { ItemId = itemE.Id, FieldId = mileageFieldId, Value = "70000" },
            new ItemFieldValue { ItemId = itemF.Id, FieldId = mileageFieldId, Value = "20000" }
        );
        await db.SaveChangesAsync();

        var yearNewest = await service.SearchAsync(new SearchQueryDto
        {
            CategoryId = categoryId,
            Seller = seller.Username,
            Sort = "year_newest",
            Page = 1,
            PageSize = 10
        });
        yearNewest.Items.Select(i => i.Title).Should().ContainInOrder("Sort Car F", "Sort Car E", "Sort Car D");

        var yearOldest = await service.SearchAsync(new SearchQueryDto
        {
            CategoryId = categoryId,
            Seller = seller.Username,
            Sort = "year_oldest",
            Page = 1,
            PageSize = 10
        });
        yearOldest.Items.Select(i => i.Title).Should().ContainInOrder("Sort Car D", "Sort Car F", "Sort Car E");

        var mileageLow = await service.SearchAsync(new SearchQueryDto
        {
            CategoryId = categoryId,
            Seller = seller.Username,
            Sort = "mileage_low",
            Page = 1,
            PageSize = 10
        });
        mileageLow.Items.Select(i => i.Title).Should().ContainInOrder("Sort Car F", "Sort Car D", "Sort Car E");

        var mileageHigh = await service.SearchAsync(new SearchQueryDto
        {
            CategoryId = categoryId,
            Seller = seller.Username,
            Sort = "mileage_high",
            Page = 1,
            PageSize = 10
        });
        mileageHigh.Items.Select(i => i.Title).Should().ContainInOrder("Sort Car E", "Sort Car D", "Sort Car F");
    }

    [Fact]
    public async Task SearchAsync_MakeFilterWithoutCategoryId_MatchesAcrossCarSubcategories()
    {
        var (db, sedanId, _, _) = CreateSeededContext();
        var suvId = db.Categories.Single(c => c.Name == "SUVs").Id;
        var sedanMakeFieldId = db.CategoryFields.Single(f => f.CategoryId == sedanId && f.FieldName == "Make").Id;
        var suvMakeFieldId = db.CategoryFields.Single(f => f.CategoryId == suvId && f.FieldName == "Make").Id;

        var seller = new User
        {
            Username = "filter-seller",
            Email = "filter-seller@example.com",
            PasswordHash = "hash",
            Role = UserRole.EndUser,
            WalletBalance = 100000m
        };
        db.Users.Add(seller);
        await db.SaveChangesAsync();

        var now = DateTime.UtcNow;
        var sedanMercedes = new Item
        {
            SellerId = seller.Id,
            CategoryIds = new List<int> { sedanId },
            Title = "Mercedes Sedan",
            InitialPrice = 100m,
            BidIncrement = 10m,
            ReservePrice = 120m,
            CurrentPrice = 100m,
            CloseDateTime = now.AddDays(3),
            CreatedAt = now.AddMinutes(-2),
            Status = ItemStatus.Active
        };
        var suvMercedes = new Item
        {
            SellerId = seller.Id,
            CategoryIds = new List<int> { suvId },
            Title = "Mercedes SUV",
            InitialPrice = 200m,
            BidIncrement = 10m,
            ReservePrice = 220m,
            CurrentPrice = 200m,
            CloseDateTime = now.AddDays(2),
            CreatedAt = now.AddMinutes(-1),
            Status = ItemStatus.Active
        };
        var toyotaSedan = new Item
        {
            SellerId = seller.Id,
            CategoryIds = new List<int> { sedanId },
            Title = "Toyota Sedan",
            InitialPrice = 300m,
            BidIncrement = 10m,
            ReservePrice = 320m,
            CurrentPrice = 300m,
            CloseDateTime = now.AddDays(1),
            CreatedAt = now,
            Status = ItemStatus.Active
        };
        db.Items.AddRange(sedanMercedes, suvMercedes, toyotaSedan);
        await db.SaveChangesAsync();

        db.ItemFieldValues.AddRange(
            new ItemFieldValue { ItemId = sedanMercedes.Id, FieldId = sedanMakeFieldId, Value = "Mercedes-Benz" },
            new ItemFieldValue { ItemId = suvMercedes.Id, FieldId = suvMakeFieldId, Value = "Mercedes" },
            new ItemFieldValue { ItemId = toyotaSedan.Id, FieldId = sedanMakeFieldId, Value = "Toyota" }
        );
        await db.SaveChangesAsync();

        var service = CreateService(db);
        var result = await service.SearchAsync(new SearchQueryDto
        {
            Make = "mer",
            Seller = seller.Username,
            Page = 1,
            PageSize = 20
        });

        var ids = result.Items.Select(i => i.Id).ToList();
        ids.Should().Contain(sedanMercedes.Id);
        ids.Should().Contain(suvMercedes.Id);
        ids.Should().NotContain(toyotaSedan.Id);
    }

    [Fact]
    public async Task SearchAsync_TransmissionAndFuelTypeFilters_AreCaseAndWhitespaceInsensitive()
    {
        var (db, sedanId, _, _) = CreateSeededContext();
        var transmissionFieldId = db.CategoryFields.Single(f => f.CategoryId == sedanId && f.FieldName == "Transmission").Id;
        var fuelTypeFieldId = db.CategoryFields.Single(f => f.CategoryId == sedanId && f.FieldName == "Fuel Type").Id;
        var target = db.Items.First(i => i.Status == ItemStatus.Active && i.CategoryIds.Contains(sedanId));

        var transmissionValue = db.ItemFieldValues.Single(iv => iv.ItemId == target.Id && iv.FieldId == transmissionFieldId);
        transmissionValue.Value = "  mAnUaL  ";
        var fuelTypeValue = db.ItemFieldValues.Single(iv => iv.ItemId == target.Id && iv.FieldId == fuelTypeFieldId);
        fuelTypeValue.Value = "  dIeSeL  ";
        await db.SaveChangesAsync();

        var service = CreateService(db);
        var result = await service.SearchAsync(new SearchQueryDto
        {
            Transmission = new List<string> { "Manual" },
            FuelType = new List<string> { "Diesel" },
            Page = 1,
            PageSize = 20
        });

        result.Items.Select(i => i.Id).Should().Contain(target.Id);
    }

    [Fact]
    public async Task AuctionIdentityAnonymity_EndUserView_HidesSellerAndBidderIdentityAcrossSearchDetailAndHistory()
    {
        var (db, categoryId, _, _) = CreateSeededContext();
        var service = CreateService(db);
        var seller = db.Users.Single(u => u.Username == "seller1");
        var bidder = db.Users.Single(u => u.Username == "bidder1");
        var viewer = db.Users.Single(u => u.Username == "bidder2");
        seller.IsAuctionIdentityAnonymous = true;
        seller.DisplayNameColor = "#A78BFA";
        bidder.IsAuctionIdentityAnonymous = true;
        bidder.DisplayNameColor = "RAINBOW";

        var item = new Item
        {
            SellerId = seller.Id,
            CategoryIds = new List<int> { categoryId },
            Title = "Privacy test listing",
            InitialPrice = 1000m,
            BidIncrement = 100m,
            ReservePrice = 1300m,
            CurrentPrice = 1100m,
            CloseDateTime = DateTime.UtcNow.AddDays(2),
            Status = ItemStatus.Active,
            CreatedAt = DateTime.UtcNow
        };
        db.Items.Add(item);
        await db.SaveChangesAsync();
        db.Bids.Add(new Bid
        {
            ItemId = item.Id,
            BidderId = bidder.Id,
            Amount = 1100m,
            IsAuto = false,
            CreatedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync();

        var search = await service.SearchAsync(
            new SearchQueryDto { Q = "Privacy test listing", Page = 1, PageSize = 20 },
            requesterUserId: viewer.Id,
            requesterRole: UserRole.EndUser);
        search.Items.Should().ContainSingle(i => i.Id == item.Id);
        var listIdentity = search.Items.Single(i => i.Id == item.Id);
        listIdentity.SellerUsername.Should().StartWith("anonymous ");
        listIdentity.SellerAvatarUrl.Should().BeNull();
        listIdentity.SellerDisplayNameColor.Should().Be("#A78BFA");

        var detail = await service.GetByIdAsync(item.Id, requesterUserId: viewer.Id, requesterRole: UserRole.EndUser);
        detail.Should().NotBeNull();
        detail!.SellerUsername.Should().StartWith("anonymous ");
        detail.SellerAvatarUrl.Should().BeNull();
        detail.SellerDisplayNameColor.Should().Be("#A78BFA");
        detail.BidHistory.Should().ContainSingle();
        detail.BidHistory[0].BidderUsername.Should().StartWith("anonymous ");
        detail.BidHistory[0].BidderAvatarUrl.Should().BeNull();
        detail.BidHistory[0].BidderDisplayNameColor.Should().Be("RAINBOW");

        var history = await service.GetHistoryAsync(seller.Id, requesterUserId: viewer.Id, requesterRole: UserRole.EndUser);
        history.Should().Contain(i => i.Id == item.Id);
        history.Single(i => i.Id == item.Id).SellerUsername.Should().StartWith("anonymous ");
        history.Single(i => i.Id == item.Id).SellerDisplayNameColor.Should().Be("#A78BFA");
    }

    [Fact]
    public async Task SearchAsync_SellerFilter_NonPrivilegedView_DoesNotMatchAnonymousSellerRealName()
    {
        var (db, categoryId, _, _) = CreateSeededContext();
        var service = CreateService(db);
        var seller = db.Users.Single(u => u.Username == "seller1");
        var viewer = db.Users.Single(u => u.Username == "bidder2");
        seller.IsAuctionIdentityAnonymous = true;

        var item = new Item
        {
            SellerId = seller.Id,
            CategoryIds = new List<int> { categoryId },
            Title = "Seller filter privacy listing",
            InitialPrice = 1250m,
            BidIncrement = 100m,
            ReservePrice = 1500m,
            CurrentPrice = 1250m,
            CloseDateTime = DateTime.UtcNow.AddDays(2),
            Status = ItemStatus.Active,
            CreatedAt = DateTime.UtcNow
        };
        db.Items.Add(item);
        await db.SaveChangesAsync();

        var endUserSearch = await service.SearchAsync(
            new SearchQueryDto { Seller = seller.Username, Page = 1, PageSize = 20 },
            requesterUserId: viewer.Id,
            requesterRole: UserRole.EndUser);
        endUserSearch.Items.Should().NotContain(i => i.Id == item.Id);

        var selfSearch = await service.SearchAsync(
            new SearchQueryDto { Seller = seller.Username, Page = 1, PageSize = 20 },
            requesterUserId: seller.Id,
            requesterRole: UserRole.EndUser);
        selfSearch.Items.Should().Contain(i => i.Id == item.Id);

        var adminSearch = await service.SearchAsync(
            new SearchQueryDto { Seller = seller.Username, Page = 1, PageSize = 20 },
            requesterUserId: 999,
            requesterRole: UserRole.Admin);
        adminSearch.Items.Should().Contain(i => i.Id == item.Id);
    }

    [Fact]
    public async Task AuctionIdentityAnonymity_AdminView_CanSeeTrueIdentity()
    {
        var (db, categoryId, _, _) = CreateSeededContext();
        var service = CreateService(db);
        var seller = db.Users.Single(u => u.Username == "seller1");
        seller.IsAuctionIdentityAnonymous = true;

        var item = new Item
        {
            SellerId = seller.Id,
            CategoryIds = new List<int> { categoryId },
            Title = "Admin visibility listing",
            InitialPrice = 2000m,
            BidIncrement = 100m,
            ReservePrice = 2300m,
            CurrentPrice = 2000m,
            CloseDateTime = DateTime.UtcNow.AddDays(2),
            Status = ItemStatus.Active,
            CreatedAt = DateTime.UtcNow
        };
        db.Items.Add(item);
        await db.SaveChangesAsync();

        var search = await service.SearchAsync(
            new SearchQueryDto { Q = "Admin visibility listing", Page = 1, PageSize = 20 },
            requesterUserId: 999,
            requesterRole: UserRole.Admin);
        var listIdentity = search.Items.Single(i => i.Id == item.Id);
        listIdentity.SellerUsername.Should().StartWith("anonymous ");
        listIdentity.SellerRevealUsername.Should().Be("seller1");
    }

    [Fact]
    public async Task AuctionIdentityAnonymity_SellerSelfView_ShowsRealNameWithAnonymousAlias()
    {
        var (db, categoryId, _, _) = CreateSeededContext();
        var service = CreateService(db);
        var seller = db.Users.Single(u => u.Username == "seller1");
        seller.IsAuctionIdentityAnonymous = true;

        var item = new Item
        {
            SellerId = seller.Id,
            CategoryIds = new List<int> { categoryId },
            Title = "Self visibility listing",
            InitialPrice = 1500m,
            BidIncrement = 100m,
            ReservePrice = 1700m,
            CurrentPrice = 1500m,
            CloseDateTime = DateTime.UtcNow.AddDays(2),
            Status = ItemStatus.Active,
            CreatedAt = DateTime.UtcNow
        };
        db.Items.Add(item);
        await db.SaveChangesAsync();

        var search = await service.SearchAsync(
            new SearchQueryDto { Q = "Self visibility listing", Page = 1, PageSize = 20 },
            requesterUserId: seller.Id,
            requesterRole: UserRole.EndUser);
        var listIdentity = search.Items.Single(i => i.Id == item.Id);
        listIdentity.SellerUsername.Should().StartWith("seller1 [anonymous ");
        listIdentity.SellerRevealUsername.Should().BeNull();

        var detail = await service.GetByIdAsync(item.Id, requesterUserId: seller.Id, requesterRole: UserRole.EndUser);
        detail.Should().NotBeNull();
        detail!.SellerUsername.Should().StartWith("seller1 [anonymous ");
        detail.SellerRevealUsername.Should().BeNull();
    }
}
