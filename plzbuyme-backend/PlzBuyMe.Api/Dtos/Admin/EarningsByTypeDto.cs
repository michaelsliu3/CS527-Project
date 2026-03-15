namespace PlzBuyMe.Api.Dtos.Admin;

public record EarningsByTypeDto
{
    public int CategoryId { get; init; }
    public string CategoryName { get; init; } = string.Empty;
    public decimal Earnings { get; init; }
}
