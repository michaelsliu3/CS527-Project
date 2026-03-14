using FluentAssertions;
using PlzBuyMe.Api.Data;
using PlzBuyMe.Api.Dtos.Auctions;
using PlzBuyMe.Api.Models;
using PlzBuyMe.Api.Services;
using PlzBuyMe.Tests.Helpers;

namespace PlzBuyMe.Tests.Services;

public class AuctionServiceTests
{
    private static (AppDbContext Db, int SedanId, int MakeFieldId, int SellerId) CreateSeededContext()
    {
        var db = TestDbContextFactory.Create();
        SeedData.Initialize(db);
        var sedan = db.Categories.Single(c => c.Name == "Sedans");
        var makeField = db.CategoryFields.First(f => f.CategoryId == sedan.Id && f.FieldName == "Make");
        var seller = db.Users.Single(u => u.Username == "seller1");
        return (db, sedan.Id, makeField.Id, seller.Id);
    }

    [Fact]
    public async Task CreateAuction_PersistsItemAndFieldValues()
    {
        var (db, categoryId, makeFieldId, sellerId) = CreateSeededContext();
        var alertService = new AlertService();
        var service = new AuctionService(db, alertService);
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
    public async Task PlaceBid_BelowIncrement_Rejected()
    {
        var (db, _, _, sellerId) = CreateSeededContext();
        var item = db.Items.First(i => i.Status == ItemStatus.Active);
        var bidder = db.Users.Single(u => u.Username == "bidder1");
        var service = new AuctionService(db, new AlertService());
        var act = () => service.PlaceBidAsync(item.Id, bidder.Id, item.CurrentPrice + item.BidIncrement - 0.01m);
        await act.Should().ThrowAsync<InvalidOperationException>().WithMessage("*Bid too low*");
    }

    [Fact]
    public async Task PlaceBid_BySeller_Rejected()
    {
        var (db, _, _, sellerId) = CreateSeededContext();
        var item = db.Items.First(i => i.SellerId == sellerId);
        var service = new AuctionService(db, new AlertService());
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
        var service = new AuctionService(db, new AlertService());
        var act = () => service.PlaceBidAsync(item.Id, bidder.Id, item.CurrentPrice + item.BidIncrement);
        await act.Should().ThrowAsync<InvalidOperationException>().WithMessage("*not active*");
    }

    [Fact]
    public async Task PlaceBid_ValidBid_UpdatesCurrentPrice()
    {
        var (db, _, _, _) = CreateSeededContext();
        var item = db.Items.First(i => i.Status == ItemStatus.Active);
        var bidder = db.Users.Single(u => u.Username == "bidder1");
        var newAmount = item.CurrentPrice + item.BidIncrement;
        var service = new AuctionService(db, new AlertService());
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
        var service = new AuctionService(db, new AlertService());
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
        var service = new AuctionService(db, new AlertService());
        await service.SetAutoBidAsync(item.Id, bidder.Id, 18800m);
        var other = db.Users.Single(u => u.Username == "bidder2");
        await service.PlaceBidAsync(item.Id, other.Id, 19000m);
        var autoBid = db.AutoBids.Single(ab => ab.ItemId == item.Id && ab.BidderId == bidder.Id);
        autoBid.IsActive.Should().BeFalse();
        db.Notifications.Should().Contain(n => n.UserId == bidder.Id && n.Type == NotificationType.AutoLimitReached);
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
        var service = new AuctionService(db, new AlertService());
        await service.CloseExpiredAsync();
        db.Entry(item).Reload();
        item.Status.Should().Be(ItemStatus.Sold);
        item.WinnerId.Should().Be(bidder.Id);
        db.Notifications.Should().Contain(n => n.UserId == bidder.Id && n.Type == NotificationType.AuctionWon);
    }

    [Fact]
    public async Task CloseExpired_MarksClosedWhenReserveNotMet()
    {
        var (db, _, _, _) = CreateSeededContext();
        var item = db.Items.First(i => i.Status == ItemStatus.Active);
        item.CloseDateTime = DateTime.UtcNow.AddSeconds(-1);
        item.CurrentPrice = item.InitialPrice;
        db.SaveChanges();
        var service = new AuctionService(db, new AlertService());
        await service.CloseExpiredAsync();
        db.Entry(item).Reload();
        item.Status.Should().Be(ItemStatus.Closed);
        item.WinnerId.Should().BeNull();
        db.Notifications.Should().Contain(n => n.UserId == item.SellerId && n.Type == NotificationType.ReserveNotMet);
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
        var service = new AuctionService(db, new AlertService());
        var similar = await service.GetSimilarAsync(item1.Id, 5);
        similar.Should().Contain(s => s.Id == item2.Id);
        similar.Should().NotContain(s => s.Id == item1.Id);
    }
}
