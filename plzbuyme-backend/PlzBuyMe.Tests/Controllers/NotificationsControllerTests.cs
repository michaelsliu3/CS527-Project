using FluentAssertions;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PlzBuyMe.Api.Controllers;
using PlzBuyMe.Api.Data;
using PlzBuyMe.Api.Models;
using PlzBuyMe.Api.Services;
using PlzBuyMe.Tests.Helpers;
using Xunit;

namespace PlzBuyMe.Tests.Controllers;

public class NotificationsControllerTests
{
    private static NotificationsController CreateController(AppDbContext db)
    {
        return new NotificationsController(new NotificationService(db));
    }

    private static void SetUser(ControllerBase controller, int userId)
    {
        ControllerTestHelpers.SetUser(controller, userId);
    }

    [Fact]
    public async Task List_ReturnsUserNotifications_WithUnreadCount()
    {
        var db = TestDbContextFactory.Create();
        SeedData.Initialize(db);
        var user = db.Users.Single(u => u.Username == "bidder1");
        db.Notifications.Add(new Notification
        {
            UserId = user.Id,
            ItemId = null,
            Message = "Test notification",
            Type = NotificationType.AlertMatch,
            IsRead = false,
            CreatedAt = DateTime.UtcNow
        });
        db.Notifications.Add(new Notification
        {
            UserId = user.Id,
            ItemId = null,
            Message = "Read one",
            Type = NotificationType.AlertMatch,
            IsRead = true,
            CreatedAt = DateTime.UtcNow.AddMinutes(-1)
        });
        await db.SaveChangesAsync();

        var controller = CreateController(db);
        SetUser(controller, user.Id);

        var result = await controller.List();

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        ok.Value.Should().NotBeNull();
        var type = ok.Value!.GetType();
        var unreadCount = (int)type.GetProperty("unreadCount")!.GetValue(ok.Value)!;
        var items = (System.Collections.IEnumerable)type.GetProperty("items")!.GetValue(ok.Value)!;
        unreadCount.Should().Be(1);
        items.Cast<object>().Should().HaveCount(1, "only unread notifications are returned");
    }

    [Fact]
    public async Task MarkRead_UpdatesFlag()
    {
        var db = TestDbContextFactory.Create();
        SeedData.Initialize(db);
        var user = db.Users.Single(u => u.Username == "bidder1");
        db.Notifications.Add(new Notification
        {
            UserId = user.Id,
            ItemId = null,
            Message = "Unread",
            Type = NotificationType.AlertMatch,
            IsRead = false
        });
        await db.SaveChangesAsync();
        var notification = await db.Notifications.FirstAsync(n => n.UserId == user.Id && !n.IsRead);

        var controller = CreateController(db);
        SetUser(controller, user.Id);

        var result = await controller.MarkRead(notification.Id);

        result.Should().BeOfType<NoContentResult>();
        await db.Entry(notification).ReloadAsync();
        notification.IsRead.Should().BeTrue();
    }

    [Fact]
    public async Task MarkRead_OtherUserNotification_ReturnsNotFound()
    {
        var db = TestDbContextFactory.Create();
        SeedData.Initialize(db);
        var user1 = db.Users.Single(u => u.Username == "bidder1");
        var user2 = db.Users.Single(u => u.Username == "bidder2");
        db.Notifications.Add(new Notification
        {
            UserId = user2.Id,
            ItemId = null,
            Message = "User2 notification",
            Type = NotificationType.AlertMatch,
            IsRead = false
        });
        await db.SaveChangesAsync();
        var notification = await db.Notifications.FirstAsync(n => n.UserId == user2.Id);

        var controller = CreateController(db);
        SetUser(controller, user1.Id);

        var result = await controller.MarkRead(notification.Id);

        result.Should().BeOfType<NotFoundResult>();
        await db.Entry(notification).ReloadAsync();
        notification.IsRead.Should().BeFalse();
    }

    [Fact]
    public async Task MarkAllRead_MarksAllUserNotificationsAsRead()
    {
        var db = TestDbContextFactory.Create();
        SeedData.Initialize(db);
        var user = db.Users.Single(u => u.Username == "bidder1");
        db.Notifications.Add(new Notification
        {
            UserId = user.Id,
            ItemId = null,
            Message = "Unread 1",
            Type = NotificationType.AlertMatch,
            IsRead = false
        });
        db.Notifications.Add(new Notification
        {
            UserId = user.Id,
            ItemId = null,
            Message = "Unread 2",
            Type = NotificationType.Outbid,
            IsRead = false
        });
        await db.SaveChangesAsync();

        var controller = CreateController(db);
        SetUser(controller, user.Id);

        var result = await controller.MarkAllRead();

        result.Should().BeOfType<NoContentResult>();
        var unread = await db.Notifications.Where(n => n.UserId == user.Id && !n.IsRead).ToListAsync();
        unread.Should().BeEmpty();
    }
}
