namespace PlzBuyMe.Api.Dtos.Admin;

public record EarningsByItemDto
{
    public int ItemId { get; init; }
    public string Title { get; init; } = string.Empty;
    public decimal Price { get; init; }
}
