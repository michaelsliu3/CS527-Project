namespace PlzBuyMe.Api.Models;

public class Notification
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public int? ItemId { get; set; }
    public string Message { get; set; } = string.Empty;
    public NotificationType Type { get; set; }
    public bool IsRead { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public User User { get; set; } = null!;
    public Item? Item { get; set; }
}
