namespace PlzBuyMe.Api.Dtos.Auctions;

public record CreateAuctionDto
{
    public string Title { get; init; } = string.Empty;
    public string? Description { get; init; }
    public string? ImageUrl { get; init; }
    public string? ImageStorageKey { get; init; }
    public int CategoryId { get; init; }
    public decimal InitialPrice { get; init; }
    public decimal BidIncrement { get; init; }
    public decimal ReservePrice { get; init; }
    public DateTime CloseDateTime { get; init; }
    public List<FieldValueDto> FieldValues { get; init; } = new();
}
