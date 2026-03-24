namespace PlzBuyMe.Api.Models;

public class QuestionReply
{
    public int Id { get; set; }
    public int QuestionId { get; set; }
    public int? ParentReplyId { get; set; }
    public int? RepliedByUserId { get; set; }
    public string Body { get; set; } = string.Empty;
    public string ReplierDisplayName { get; set; } = string.Empty;
    public string? ReplierDisplayNameColor { get; set; }
    public string? ReplierRole { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public Question Question { get; set; } = null!;
    public QuestionReply? ParentReply { get; set; }
    public ICollection<QuestionReply> ChildReplies { get; set; } = new List<QuestionReply>();
    public ICollection<QuestionVote> Votes { get; set; } = new List<QuestionVote>();
    public User? RepliedByUser { get; set; }
}
