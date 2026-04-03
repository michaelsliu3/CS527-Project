using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using PlzBuyMe.Api.Data;
using PlzBuyMe.Api.Dtos.Alerts;
using PlzBuyMe.Api.Models;
using PlzBuyMe.Api.Services;
using PlzBuyMe.Tests.Helpers;

namespace PlzBuyMe.Tests.Services;

public class AlertServiceTests
{
    private static (AppDbContext Db, int SedanId, int MakeFieldId, int YearFieldId, int SellerId, int AlertUserId) CreateSeededContext()
    {
        var db = TestDbContextFactory.Create();
        SeedData.Initialize(db);
        var sedan = db.Categories.Single(c => c.Name == "Sedans");
        var makeField = db.CategoryFields.First(f => f.CategoryId == sedan.Id && f.FieldName == "Make");
        var yearField = db.CategoryFields.First(f => f.CategoryId == sedan.Id && f.FieldName == "Year");
        var seller = db.Users.Single(u => u.Username == "seller1");
        var alertUser = db.Users.Single(u => u.Username == "bidder1");
        return (db, sedan.Id, makeField.Id, yearField.Id, seller.Id, alertUser.Id);
    }

    [Fact]
    public async Task NewItem_TriggersMatchingAlerts()
    {
        var (db, sedanId, makeFieldId, _, sellerId, alertUserId) = CreateSeededContext();
        db.Alerts.Add(new Alert
        {
            UserId = alertUserId,
            CategoryId = sedanId,
            Keyword = null,
            Criteria = null,
            IsActive = true
        });
        await db.SaveChangesAsync();

        var item = new Item
        {
            SellerId = sellerId,
            CategoryIds = new List<int> { sedanId },
            Title = "Honda Accord",
            Description = "Clean sedan",
            InitialPrice = 15000m,
            BidIncrement = 500m,
            ReservePrice = 16000m,
            CurrentPrice = 15000m,
            CloseDateTime = DateTime.UtcNow.AddDays(1),
            Status = ItemStatus.Active
        };
        db.Items.Add(item);
        await db.SaveChangesAsync();
        db.ItemFieldValues.Add(new ItemFieldValue { ItemId = item.Id, FieldId = makeFieldId, Value = "Honda" });
        await db.SaveChangesAsync();

        var service = new AlertService(db);
        await service.CheckAlertsForNewItemAsync(item);

        var notifications = await db.Notifications.Where(n => n.ItemId == item.Id && n.UserId == alertUserId).ToListAsync();
        notifications.Should().ContainSingle();
        notifications[0].Type.Should().Be(NotificationType.AlertMatch);
        notifications[0].Message.Should().Contain("Honda Accord");
    }

    [Fact]
    public async Task KeywordFilter_MatchesCorrectly()
    {
        var (db, sedanId, makeFieldId, _, sellerId, alertUserId) = CreateSeededContext();
        db.Alerts.Add(new Alert
        {
            UserId = alertUserId,
            CategoryId = null,
            Keyword = "Tesla",
            Criteria = null,
            IsActive = true
        });
        await db.SaveChangesAsync();

        var item = new Item
        {
            SellerId = sellerId,
            CategoryIds = new List<int> { sedanId },
            Title = "Tesla Model 3",
            Description = "Electric car",
            InitialPrice = 35000m,
            BidIncrement = 500m,
            ReservePrice = 36000m,
            CurrentPrice = 35000m,
            CloseDateTime = DateTime.UtcNow.AddDays(1),
            Status = ItemStatus.Active
        };
        db.Items.Add(item);
        await db.SaveChangesAsync();
        db.ItemFieldValues.Add(new ItemFieldValue { ItemId = item.Id, FieldId = makeFieldId, Value = "Tesla" });
        await db.SaveChangesAsync();

        var service = new AlertService(db);
        await service.CheckAlertsForNewItemAsync(item);

        var notifications = await db.Notifications.Where(n => n.ItemId == item.Id && n.UserId == alertUserId).ToListAsync();
        notifications.Should().ContainSingle();
    }

    [Fact]
    public async Task KeywordFilter_RejectsWhenNoMatch()
    {
        var (db, sedanId, makeFieldId, _, sellerId, alertUserId) = CreateSeededContext();
        db.Alerts.Add(new Alert
        {
            UserId = alertUserId,
            CategoryId = null,
            Keyword = "Tesla",
            Criteria = null,
            IsActive = true
        });
        await db.SaveChangesAsync();

        var item = new Item
        {
            SellerId = sellerId,
            CategoryIds = new List<int> { sedanId },
            Title = "Honda Civic",
            Description = "Gas car",
            InitialPrice = 20000m,
            BidIncrement = 500m,
            ReservePrice = 21000m,
            CurrentPrice = 20000m,
            CloseDateTime = DateTime.UtcNow.AddDays(1),
            Status = ItemStatus.Active
        };
        db.Items.Add(item);
        await db.SaveChangesAsync();
        db.ItemFieldValues.Add(new ItemFieldValue { ItemId = item.Id, FieldId = makeFieldId, Value = "Honda" });
        await db.SaveChangesAsync();

        var service = new AlertService(db);
        await service.CheckAlertsForNewItemAsync(item);

        var notifications = await db.Notifications.Where(n => n.ItemId == item.Id && n.UserId == alertUserId).ToListAsync();
        notifications.Should().BeEmpty();
    }

    [Fact]
    public async Task CategoryFilter_Works()
    {
        var (db, sedanId, suvId, makeFieldId, _, sellerId, alertUserId) = CreateSeededContextWithSuv();
        db.Alerts.Add(new Alert
        {
            UserId = alertUserId,
            CategoryId = suvId,
            Keyword = null,
            Criteria = null,
            IsActive = true
        });
        await db.SaveChangesAsync();

        var item = new Item
        {
            SellerId = sellerId,
            CategoryIds = new List<int> { sedanId },
            Title = "Sedan Only",
            Description = "Not SUV",
            InitialPrice = 10000m,
            BidIncrement = 100m,
            ReservePrice = 11000m,
            CurrentPrice = 10000m,
            CloseDateTime = DateTime.UtcNow.AddDays(1),
            Status = ItemStatus.Active
        };
        db.Items.Add(item);
        await db.SaveChangesAsync();
        db.ItemFieldValues.Add(new ItemFieldValue { ItemId = item.Id, FieldId = makeFieldId, Value = "Toyota" });
        await db.SaveChangesAsync();

        var service = new AlertService(db);
        await service.CheckAlertsForNewItemAsync(item);

        var notifications = await db.Notifications.Where(n => n.ItemId == item.Id && n.UserId == alertUserId).ToListAsync();
        notifications.Should().BeEmpty();
    }

    private static (AppDbContext Db, int SedanId, int SuvId, int MakeFieldId, int YearFieldId, int SellerId, int AlertUserId) CreateSeededContextWithSuv()
    {
        var db = TestDbContextFactory.Create();
        SeedData.Initialize(db);
        var sedan = db.Categories.Single(c => c.Name == "Sedans");
        var suv = db.Categories.Single(c => c.Name == "SUVs");
        var makeField = db.CategoryFields.First(f => f.CategoryId == sedan.Id && f.FieldName == "Make");
        var yearField = db.CategoryFields.First(f => f.CategoryId == sedan.Id && f.FieldName == "Year");
        var seller = db.Users.Single(u => u.Username == "seller1");
        var alertUser = db.Users.Single(u => u.Username == "bidder1");
        return (db, sedan.Id, suv.Id, makeField.Id, yearField.Id, seller.Id, alertUser.Id);
    }

    [Fact]
    public async Task Notification_CreatedOnMatch()
    {
        var (db, sedanId, makeFieldId, _, sellerId, alertUserId) = CreateSeededContext();
        db.Alerts.Add(new Alert
        {
            UserId = alertUserId,
            CategoryId = sedanId,
            Keyword = "Camry",
            Criteria = null,
            IsActive = true
        });
        await db.SaveChangesAsync();

        var item = new Item
        {
            SellerId = sellerId,
            CategoryIds = new List<int> { sedanId },
            Title = "Toyota Camry 2022",
            Description = "Camry sedan",
            InitialPrice = 22000m,
            BidIncrement = 500m,
            ReservePrice = 23000m,
            CurrentPrice = 22000m,
            CloseDateTime = DateTime.UtcNow.AddDays(1),
            Status = ItemStatus.Active
        };
        db.Items.Add(item);
        await db.SaveChangesAsync();
        db.ItemFieldValues.Add(new ItemFieldValue { ItemId = item.Id, FieldId = makeFieldId, Value = "Toyota" });
        await db.SaveChangesAsync();

        var service = new AlertService(db);
        await service.CheckAlertsForNewItemAsync(item);

        var notification = await db.Notifications.FirstOrDefaultAsync(n => n.ItemId == item.Id && n.UserId == alertUserId);
        notification.Should().NotBeNull();
        notification!.Type.Should().Be(NotificationType.AlertMatch);
        notification.Message.Should().Contain("Toyota Camry 2022");
    }

    [Fact]
    public async Task GetAlertsForUser_ReturnsOnlyThatUserAlerts()
    {
        var (db, sedanId, _, _, _, alertUserId) = CreateSeededContext();
        db.Alerts.Add(new Alert { UserId = alertUserId, CategoryId = sedanId, IsActive = true });
        await db.SaveChangesAsync();

        var service = new AlertService(db);
        var list = await service.GetAlertsForUserAsync(alertUserId);
        list.Should().ContainSingle();
        list[0].CategoryId.Should().Be(sedanId);
        list[0].UserId.Should().Be(alertUserId);
    }

    [Fact]
    public async Task CreateAlert_ReturnsCorrectResponse()
    {
        var (db, sedanId, _, _, _, userId) = CreateSeededContext();
        var service = new AlertService(db);
        var dto = new CreateAlertDto { CategoryId = sedanId, Keyword = "Toyota", Criteria = null };
        var result = await service.CreateAlertAsync(userId, dto);
        result.ErrorMessage.Should().BeNull();
        result.Alert.Should().NotBeNull();
        var created = result.Alert!;
        created.UserId.Should().Be(userId);
        created.CategoryId.Should().Be(sedanId);
        created.Keyword.Should().Be("Toyota");
        created.IsActive.Should().BeTrue();
        created.Id.Should().BeGreaterThan(0);
    }

    [Fact]
    public async Task CreateAlert_WithNoFilter_ReturnsError()
    {
        var (db, _, _, _, _, userId) = CreateSeededContext();
        var service = new AlertService(db);
        var dto = new CreateAlertDto { CategoryId = null, Keyword = null, Criteria = null };
        var result = await service.CreateAlertAsync(userId, dto);
        result.Alert.Should().BeNull();
        result.ErrorMessage.Should().Contain("At least one filter");
    }

    [Fact]
    public async Task DeleteAlert_UserCanOnlyDeleteOwn()
    {
        var (db, sedanId, _, _, _, alertUserId) = CreateSeededContext();
        var otherUser = db.Users.Single(u => u.Username == "bidder2");
        db.Alerts.Add(new Alert { UserId = alertUserId, CategoryId = sedanId, IsActive = true });
        await db.SaveChangesAsync();
        var alertId = db.Alerts.Single(a => a.UserId == alertUserId).Id;

        var service = new AlertService(db);
        var deletedByOther = await service.DeleteAlertAsync(alertId, otherUser.Id);
        deletedByOther.Should().BeFalse();
        db.Alerts.Should().Contain(a => a.Id == alertId);

        var deletedByOwner = await service.DeleteAlertAsync(alertId, alertUserId);
        deletedByOwner.Should().BeTrue();
        db.Alerts.Should().NotContain(a => a.Id == alertId);
    }
}
