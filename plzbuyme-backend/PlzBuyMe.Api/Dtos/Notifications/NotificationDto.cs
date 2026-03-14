namespace PlzBuyMe.Api.Dtos.Notifications;

public record NotificationDto
{
    public int Id { get; init; }
    public int UserId { get; init; }
    public int? ItemId { get; init; }
    public string Message { get; init; } = string.Empty;
    public string Type { get; init; } = string.Empty;
    public bool IsRead { get; init; }
    public DateTime CreatedAt { get; init; }
}
