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

    public async Task<NotificationListResponseDto> GetNotificationsForUserAsync(int userId)
    {
        var notifications = await _db.Notifications
            .Where(n => n.UserId == userId && !n.IsRead)
            .OrderByDescending(n => n.CreatedAt)
            .ToListAsync();
        var items = notifications.Select(n => new NotificationDto
        {
            Id = n.Id,
            UserId = n.UserId,
            ItemId = n.ItemId,
            Message = n.Message,
            Type = StringUtils.ToSnakeCase(n.Type.ToString()),
            IsRead = n.IsRead,
            CreatedAt = n.CreatedAt
        }).ToList();
        return new NotificationListResponseDto { Items = items, UnreadCount = items.Count };
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
