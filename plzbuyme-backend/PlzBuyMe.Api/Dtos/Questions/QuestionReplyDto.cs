namespace PlzBuyMe.Api.Dtos.Questions;

public record QuestionReplyDto
{
    public int Id { get; init; }
    public string Body { get; init; } = string.Empty;
    public string ReplierDisplayName { get; init; } = string.Empty;
    public string? ReplierRole { get; init; }
    public DateTime CreatedAt { get; init; }
}
