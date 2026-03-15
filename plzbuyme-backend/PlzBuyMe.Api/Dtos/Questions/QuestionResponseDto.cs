namespace PlzBuyMe.Api.Dtos.Questions;

public record QuestionResponseDto
{
    public int Id { get; init; }
    public int UserId { get; init; }
    public string Username { get; init; } = string.Empty;
    public string Subject { get; init; } = string.Empty;
    public string Body { get; init; } = string.Empty;
    public string? Reply { get; init; }
    public int? RepliedBy { get; init; }
    public string? RepliedByUsername { get; init; }
    public DateTime CreatedAt { get; init; }
    public DateTime? RepliedAt { get; init; }
}

