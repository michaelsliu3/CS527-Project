namespace PlzBuyMe.Api.Dtos.Auctions;

public record AuctionListDto
{
    public int Id { get; init; }
    public string Title { get; init; } = string.Empty;
    public decimal CurrentPrice { get; init; }
    public DateTime CloseDateTime { get; init; }
    public string Status { get; init; } = string.Empty;
    public string CategoryName { get; init; } = string.Empty;
    public string SellerUsername { get; init; } = string.Empty;
    public string? SellerDisplayNameColor { get; init; }
    public int BidCount { get; init; }
}
