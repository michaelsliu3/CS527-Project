namespace PlzBuyMe.Api.Models;

public class QuestionVote
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public int? QuestionId { get; set; }
    public int? QuestionReplyId { get; set; }
    public int Value { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public User User { get; set; } = null!;
    public Question? Question { get; set; }
    public QuestionReply? QuestionReply { get; set; }
}
