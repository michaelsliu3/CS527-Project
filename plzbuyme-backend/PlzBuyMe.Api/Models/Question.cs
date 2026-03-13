namespace PlzBuyMe.Api.Models;

public class Question
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public string Subject { get; set; } = string.Empty;
    public string Body { get; set; } = string.Empty;
    public string? Reply { get; set; }
    public int? RepliedBy { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? RepliedAt { get; set; }

    public User User { get; set; } = null!;
    public User? RepliedByUser { get; set; }
}
