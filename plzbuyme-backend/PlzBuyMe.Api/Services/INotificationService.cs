using PlzBuyMe.Api.Dtos.Notifications;

namespace PlzBuyMe.Api.Services;

public interface INotificationService
{
    Task<NotificationListResponseDto> GetNotificationsForUserAsync(int userId);
    Task<bool> MarkAsReadAsync(int notificationId, int userId);
    Task MarkAllAsReadAsync(int userId);
}
