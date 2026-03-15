namespace PlzBuyMe.Api.Dtos.Admin;

public record BestSellingItemDto
{
    public int ItemId { get; init; }
    public string Title { get; init; } = string.Empty;
    public decimal Price { get; init; }
    public int BidCount { get; init; }
}
