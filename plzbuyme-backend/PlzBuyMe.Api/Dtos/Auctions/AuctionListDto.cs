namespace PlzBuyMe.Api.Dtos.Auctions;

public record AuctionListDto
{
    public int Id { get; init; }
    public string Title { get; init; } = string.Empty;
    public string? ImageUrl { get; init; }
    public string? ImageSource { get; init; }
    public string? ImageMatchLevel { get; init; }
    public decimal CurrentPrice { get; init; }
    public DateTime CloseDateTime { get; init; }
    public string Status { get; init; } = string.Empty;
    public string CategoryName { get; init; } = string.Empty;
    public List<string> CategoryNames { get; init; } = new();
    public int SellerId { get; init; }
    public string SellerUsername { get; init; } = string.Empty;
    public string? SellerAvatarUrl { get; init; }
    public string? SellerDisplayNameColor { get; init; }
    public int BidCount { get; init; }
}
