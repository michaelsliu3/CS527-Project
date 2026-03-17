namespace PlzBuyMe.Api.Dtos.Questions;

public record QuestionResponseDto
{
    public int Id { get; init; }
    public int UserId { get; init; }
    public string Username { get; init; } = string.Empty;
    public string Subject { get; init; } = string.Empty;
    public string Body { get; init; } = string.Empty;
    public IReadOnlyList<QuestionReplyDto> Replies { get; init; } = [];
    public DateTime CreatedAt { get; init; }
}

