namespace PlzBuyMe.Api.Dtos.Notifications;

public record NotificationListResponseDto
{
    public IReadOnlyList<NotificationDto> Items { get; init; } = Array.Empty<NotificationDto>();
    public int UnreadCount { get; init; }
}
