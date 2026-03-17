namespace PlzBuyMe.Api.Dtos.Rep;

public record UserSummaryDto
{
    public int Id { get; init; }
    public string Username { get; init; } = string.Empty;
    public string Email { get; init; } = string.Empty;
    public string Role { get; init; } = "end_user";
    public bool IsActive { get; init; }
    public DateTime CreatedAt { get; init; }
}

