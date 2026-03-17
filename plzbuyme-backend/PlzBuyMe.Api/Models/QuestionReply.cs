namespace PlzBuyMe.Api.Models;

public class QuestionReply
{
    public int Id { get; set; }
    public int QuestionId { get; set; }
    public int? RepliedByUserId { get; set; }
    public string Body { get; set; } = string.Empty;
    public string ReplierDisplayName { get; set; } = string.Empty;
    public string? ReplierRole { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public Question Question { get; set; } = null!;
    public User? RepliedByUser { get; set; }
}
