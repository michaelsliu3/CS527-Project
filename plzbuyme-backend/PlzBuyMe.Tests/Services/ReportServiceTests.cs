using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using PlzBuyMe.Api.Data;
using PlzBuyMe.Api.Models;
using PlzBuyMe.Api.Services;
using Xunit;

namespace PlzBuyMe.Tests.Services;

public class ReportServiceTests
{
    private static AppDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new AppDbContext(options);
    }

    [Fact]
    public async Task GetTotalEarnings_SumSoldItemsOnly()
    {
        await using var db = CreateDbContext();
        var cat = new Category { Name = "Cars", ParentId = null, StringKey = "rpt-cars-1" };
        db.Categories.Add(cat);
        var seller = new User { Username = "s", Email = "s@x.com", PasswordHash = "h", Role = UserRole.EndUser };
        db.Users.Add(seller);
        await db.SaveChangesAsync();

        db.Items.Add(new Item
        {
            SellerId = seller.Id,
            CategoryIds = new List<int> { cat.Id },
            Title = "Sold Car",
            InitialPrice = 100m,
            BidIncrement = 10m,
            ReservePrice = 100m,
            CurrentPrice = 150m,
            CloseDateTime = DateTime.UtcNow,
            Status = ItemStatus.Sold
        });
        db.Items.Add(new Item
        {
            SellerId = seller.Id,
            CategoryIds = new List<int> { cat.Id },
            Title = "Active Car",
            InitialPrice = 200m,
            BidIncrement = 10m,
            ReservePrice = 200m,
            CurrentPrice = 200m,
            CloseDateTime = DateTime.UtcNow.AddDays(1),
            Status = ItemStatus.Active
        });
        await db.SaveChangesAsync();

        var service = new ReportService(db);
        var total = await service.GetTotalEarningsAsync();
        total.Should().Be(150m);
    }

    [Fact]
    public async Task GetTotalEarnings_WithDateWindow_FiltersByCloseDate()
    {
        await using var db = CreateDbContext();
        var cat = new Category { Name = "Cars", ParentId = null, StringKey = "rpt-cars-window" };
        var seller = new User { Username = "s", Email = "s-window@x.com", PasswordHash = "h", Role = UserRole.EndUser };
        db.Categories.Add(cat);
        db.Users.Add(seller);
        await db.SaveChangesAsync();

        var now = DateTime.UtcNow;
        db.Items.AddRange(
            new Item
            {
                SellerId = seller.Id,
                CategoryIds = new List<int> { cat.Id },
                Title = "Inside Window",
                InitialPrice = 100m,
                BidIncrement = 10m,
                ReservePrice = 100m,
                CurrentPrice = 400m,
                CloseDateTime = now.AddDays(-2),
                Status = ItemStatus.Sold
            },
            new Item
            {
                SellerId = seller.Id,
                CategoryIds = new List<int> { cat.Id },
                Title = "Outside Window",
                InitialPrice = 100m,
                BidIncrement = 10m,
                ReservePrice = 100m,
                CurrentPrice = 600m,
                CloseDateTime = now.AddDays(-20),
                Status = ItemStatus.Sold
            });
        await db.SaveChangesAsync();

        var service = new ReportService(db);
        var total = await service.GetTotalEarningsAsync(now.AddDays(-5), now.AddDays(-1));
        total.Should().Be(400m);
    }

    [Fact]
    public async Task GetEarningsByType_GroupsByCategory()
    {
        await using var db = CreateDbContext();
        var cars = new Category { Name = "Cars", ParentId = null, StringKey = "rpt-cars-2" };
        var bikes = new Category { Name = "Bikes", ParentId = null, StringKey = "rpt-bikes" };
        db.Categories.AddRange(cars, bikes);
        var seller = new User { Username = "s", Email = "s@x.com", PasswordHash = "h", Role = UserRole.EndUser };
        db.Users.Add(seller);
        await db.SaveChangesAsync();

        db.Items.AddRange(
            new Item { SellerId = seller.Id, CategoryIds = new List<int> { cars.Id }, Title = "C1", InitialPrice = 100m, BidIncrement = 10m, ReservePrice = 100m, CurrentPrice = 100m, CloseDateTime = DateTime.UtcNow, Status = ItemStatus.Sold },
            new Item { SellerId = seller.Id, CategoryIds = new List<int> { cars.Id }, Title = "C2", InitialPrice = 200m, BidIncrement = 10m, ReservePrice = 200m, CurrentPrice = 200m, CloseDateTime = DateTime.UtcNow, Status = ItemStatus.Sold },
            new Item { SellerId = seller.Id, CategoryIds = new List<int> { bikes.Id }, Title = "B1", InitialPrice = 50m, BidIncrement = 5m, ReservePrice = 50m, CurrentPrice = 50m, CloseDateTime = DateTime.UtcNow, Status = ItemStatus.Sold }
        );
        await db.SaveChangesAsync();

        var service = new ReportService(db);
        var byType = await service.GetEarningsByTypeAsync();
        byType.Should().HaveCount(2);
        byType.First(d => d.CategoryName == "Cars").Earnings.Should().Be(300m);
        byType.First(d => d.CategoryName == "Bikes").Earnings.Should().Be(50m);
    }

    [Fact]
    public async Task GetBestSellingItems_ReturnsTopNByPriceWithBidCount()
    {
        await using var db = CreateDbContext();
        var cat = new Category { Name = "Cars", ParentId = null, StringKey = "rpt-cars-3" };
        db.Categories.Add(cat);
        var seller = new User { Username = "s", Email = "s@x.com", PasswordHash = "h", Role = UserRole.EndUser };
        db.Users.Add(seller);
        await db.SaveChangesAsync();

        var item1 = new Item { SellerId = seller.Id, CategoryIds = new List<int> { cat.Id }, Title = "Low", InitialPrice = 100m, BidIncrement = 10m, ReservePrice = 100m, CurrentPrice = 100m, CloseDateTime = DateTime.UtcNow, Status = ItemStatus.Sold };
        var item2 = new Item { SellerId = seller.Id, CategoryIds = new List<int> { cat.Id }, Title = "High", InitialPrice = 500m, BidIncrement = 50m, ReservePrice = 500m, CurrentPrice = 600m, CloseDateTime = DateTime.UtcNow, Status = ItemStatus.Sold };
        db.Items.AddRange(item1, item2);
        await db.SaveChangesAsync();
        db.Bids.AddRange(
            new Bid { ItemId = item1.Id, BidderId = seller.Id, Amount = 100m },
            new Bid { ItemId = item2.Id, BidderId = seller.Id, Amount = 600m },
            new Bid { ItemId = item2.Id, BidderId = seller.Id, Amount = 550m }
        );
        await db.SaveChangesAsync();

        var service = new ReportService(db);
        var top = await service.GetBestSellingItemsAsync(2);
        top.Should().HaveCount(2);
        top[0].Title.Should().Be("High");
        top[0].Price.Should().Be(600m);
        top[0].BidCount.Should().Be(2);
        top[1].Title.Should().Be("Low");
        top[1].Price.Should().Be(100m);
        top[1].BidCount.Should().Be(1);
    }

    [Fact]
    public async Task GetEarningsByItem_PaginatesAndUsesDeterministicTieBreak()
    {
        await using var db = CreateDbContext();
        var cat = new Category { Name = "Cars", ParentId = null, StringKey = "rpt-cars-page" };
        var seller = new User { Username = "page-seller", Email = "page-seller@x.com", PasswordHash = "h", Role = UserRole.EndUser };
        db.Categories.Add(cat);
        db.Users.Add(seller);
        await db.SaveChangesAsync();

        db.Items.AddRange(
            new Item { SellerId = seller.Id, CategoryIds = new List<int> { cat.Id }, Title = "A", InitialPrice = 100m, BidIncrement = 10m, ReservePrice = 100m, CurrentPrice = 500m, CloseDateTime = DateTime.UtcNow, Status = ItemStatus.Sold },
            new Item { SellerId = seller.Id, CategoryIds = new List<int> { cat.Id }, Title = "B", InitialPrice = 100m, BidIncrement = 10m, ReservePrice = 100m, CurrentPrice = 500m, CloseDateTime = DateTime.UtcNow, Status = ItemStatus.Sold },
            new Item { SellerId = seller.Id, CategoryIds = new List<int> { cat.Id }, Title = "C", InitialPrice = 100m, BidIncrement = 10m, ReservePrice = 100m, CurrentPrice = 300m, CloseDateTime = DateTime.UtcNow, Status = ItemStatus.Sold });
        await db.SaveChangesAsync();

        var orderedIds = await db.Items.Where(i => i.CurrentPrice == 500m).OrderBy(i => i.Id).Select(i => i.Id).ToListAsync();
        var service = new ReportService(db);
        var page1 = await service.GetEarningsByItemAsync(page: 1, pageSize: 1);
        var page2 = await service.GetEarningsByItemAsync(page: 2, pageSize: 1);

        page1.TotalCount.Should().Be(3);
        page1.Items.Should().HaveCount(1);
        page1.Items[0].ItemId.Should().Be(orderedIds[0]);
        page2.Items[0].ItemId.Should().Be(orderedIds[1]);
    }

    [Fact]
    public async Task GetBestBuyers_ReturnsTopNSpendersWithWinCount()
    {
        await using var db = CreateDbContext();
        var cat = new Category { Name = "Cars", ParentId = null, StringKey = "rpt-cars-4" };
        db.Categories.Add(cat);
        var seller = new User { Username = "seller", Email = "s@x.com", PasswordHash = "h", Role = UserRole.EndUser };
        var buyer1 = new User { Username = "buyer1", Email = "b1@x.com", PasswordHash = "h", Role = UserRole.EndUser };
        var buyer2 = new User { Username = "buyer2", Email = "b2@x.com", PasswordHash = "h", Role = UserRole.EndUser };
        db.Users.AddRange(seller, buyer1, buyer2);
        await db.SaveChangesAsync();

        db.Items.AddRange(
            new Item { SellerId = seller.Id, CategoryIds = new List<int> { cat.Id }, Title = "A", InitialPrice = 100m, BidIncrement = 10m, ReservePrice = 100m, CurrentPrice = 200m, CloseDateTime = DateTime.UtcNow, Status = ItemStatus.Sold, WinnerId = buyer1.Id },
            new Item { SellerId = seller.Id, CategoryIds = new List<int> { cat.Id }, Title = "B", InitialPrice = 200m, BidIncrement = 20m, ReservePrice = 200m, CurrentPrice = 500m, CloseDateTime = DateTime.UtcNow, Status = ItemStatus.Sold, WinnerId = buyer2.Id },
            new Item { SellerId = seller.Id, CategoryIds = new List<int> { cat.Id }, Title = "C", InitialPrice = 50m, BidIncrement = 5m, ReservePrice = 50m, CurrentPrice = 50m, CloseDateTime = DateTime.UtcNow, Status = ItemStatus.Sold, WinnerId = buyer1.Id }
        );
        await db.SaveChangesAsync();

        var service = new ReportService(db);
        var top = await service.GetBestBuyersAsync(3);
        top.Should().HaveCount(2);
        var b2 = top.First(b => b.Username == "buyer2");
        b2.TotalSpent.Should().Be(500m);
        b2.WinCount.Should().Be(1);
        var b1 = top.First(b => b.Username == "buyer1");
        b1.TotalSpent.Should().Be(250m);
        b1.WinCount.Should().Be(2);
    }

    [Fact]
    public async Task GetEarningsSummary_ReturnsAggregateMetrics()
    {
        await using var db = CreateDbContext();
        var cat = new Category { Name = "Cars", ParentId = null, StringKey = "rpt-cars-summary" };
        var seller1 = new User { Username = "seller1", Email = "summary-seller1@x.com", PasswordHash = "h", Role = UserRole.EndUser };
        var seller2 = new User { Username = "seller2", Email = "summary-seller2@x.com", PasswordHash = "h", Role = UserRole.EndUser };
        var buyer1 = new User { Username = "buyer1", Email = "summary-buyer1@x.com", PasswordHash = "h", Role = UserRole.EndUser };
        var buyer2 = new User { Username = "buyer2", Email = "summary-buyer2@x.com", PasswordHash = "h", Role = UserRole.EndUser };
        db.Categories.Add(cat);
        db.Users.AddRange(seller1, seller2, buyer1, buyer2);
        await db.SaveChangesAsync();

        db.Items.AddRange(
            new Item { SellerId = seller1.Id, CategoryIds = new List<int> { cat.Id }, Title = "S1", InitialPrice = 100m, BidIncrement = 10m, ReservePrice = 100m, CurrentPrice = 200m, CloseDateTime = DateTime.UtcNow.AddDays(-1), Status = ItemStatus.Sold, WinnerId = buyer1.Id },
            new Item { SellerId = seller2.Id, CategoryIds = new List<int> { cat.Id }, Title = "S2", InitialPrice = 100m, BidIncrement = 10m, ReservePrice = 100m, CurrentPrice = 400m, CloseDateTime = DateTime.UtcNow.AddDays(-2), Status = ItemStatus.Sold, WinnerId = buyer2.Id });
        await db.SaveChangesAsync();

        var service = new ReportService(db);
        var summary = await service.GetEarningsSummaryAsync();

        summary.Total.Should().Be(600m);
        summary.SoldCount.Should().Be(2);
        summary.AverageSale.Should().Be(300m);
        summary.DistinctSellers.Should().Be(2);
        summary.DistinctBuyers.Should().Be(2);
    }
}
