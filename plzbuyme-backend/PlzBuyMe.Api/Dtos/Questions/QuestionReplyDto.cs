namespace PlzBuyMe.Api.Dtos.Questions;

public record QuestionReplyDto
{
    public int Id { get; init; }
    public int? ParentReplyId { get; init; }
    public string Body { get; init; } = string.Empty;
    public string ReplierDisplayName { get; init; } = string.Empty;
    public string? ReplierAvatarUrl { get; init; }
    public string? ReplierDisplayNameColor { get; init; }
    public string? ReplierRole { get; init; }
    public int Score { get; init; }
    public int CurrentUserVote { get; init; }
    public IReadOnlyList<QuestionReplyDto> Replies { get; init; } = [];
    public DateTime CreatedAt { get; init; }
}
