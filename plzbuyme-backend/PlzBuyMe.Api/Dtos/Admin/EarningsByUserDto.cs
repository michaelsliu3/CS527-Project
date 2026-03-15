namespace PlzBuyMe.Api.Dtos.Admin;

public record EarningsByUserDto
{
    public int UserId { get; init; }
    public string Username { get; init; } = string.Empty;
    public decimal TotalAsSeller { get; init; }
    public decimal TotalAsWinner { get; init; }
}
