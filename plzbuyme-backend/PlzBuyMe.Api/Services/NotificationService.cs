using Microsoft.EntityFrameworkCore;
using PlzBuyMe.Api.Data;
using PlzBuyMe.Api.Dtos.Notifications;
using PlzBuyMe.Api.Models;
using PlzBuyMe.Api.Utils;

namespace PlzBuyMe.Api.Services;

public class NotificationService : INotificationService
{
    private readonly AppDbContext _db;

    public NotificationService(AppDbContext db)
    {
        _db = db;
    }

    private const int MaxNotificationsPerUser = 100;

    public async Task<NotificationListResponseDto> GetNotificationsForUserAsync(int userId)
    {
        var unreadCount = await _db.Notifications
            .CountAsync(n => n.UserId == userId && !n.IsRead);

        var notifications = await _db.Notifications
            .Where(n => n.UserId == userId)
            .OrderByDescending(n => n.CreatedAt)
            .Take(MaxNotificationsPerUser)
            .ToListAsync();

        var items = notifications.Select(n => new NotificationDto
        {
            Id = n.Id,
            UserId = n.UserId,
            ItemId = n.ItemId,
            Message = n.Message,
            Type = StringUtils.ToSnakeCase(n.Type.ToString()),
            IsRead = n.IsRead,
            CreatedAt = DateTime.SpecifyKind(n.CreatedAt, DateTimeKind.Utc)
        }).ToList();

        return new NotificationListResponseDto { Items = items, UnreadCount = unreadCount };
    }

    public async Task<bool> MarkAsReadAsync(int notificationId, int userId)
    {
        var notification = await _db.Notifications
            .FirstOrDefaultAsync(n => n.Id == notificationId && n.UserId == userId);
        if (notification == null)
            return false;
        notification.IsRead = true;
        await _db.SaveChangesAsync();
        return true;
    }

    public async Task MarkAllAsReadAsync(int userId)
    {
        var unread = await _db.Notifications
            .Where(n => n.UserId == userId && !n.IsRead)
            .ToListAsync();
        foreach (var n in unread)
            n.IsRead = true;
        await _db.SaveChangesAsync();
    }
}
