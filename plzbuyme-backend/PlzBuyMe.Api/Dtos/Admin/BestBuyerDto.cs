namespace PlzBuyMe.Api.Dtos.Admin;

public record BestBuyerDto
{
    public int UserId { get; init; }
    public string Username { get; init; } = string.Empty;
    public decimal TotalSpent { get; init; }
    public int WinCount { get; init; }
}
