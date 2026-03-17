namespace PlzBuyMe.Api.Models;

public class Question
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public string Subject { get; set; } = string.Empty;
    public string Body { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public User User { get; set; } = null!;
    public ICollection<QuestionReply> Replies { get; set; } = new List<QuestionReply>();
}
