namespace PlzBuyMe.Api.Dtos.Alerts;

public record AlertResponseDto
{
    public int Id { get; init; }
    public int UserId { get; init; }
    public int? CategoryId { get; init; }
    public string? Keyword { get; init; }
    public string? Criteria { get; init; }
    public bool IsActive { get; init; }
    public DateTime CreatedAt { get; init; }
}
