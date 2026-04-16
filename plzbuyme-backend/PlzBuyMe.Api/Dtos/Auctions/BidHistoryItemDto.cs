namespace PlzBuyMe.Api.Dtos.Auctions;

public record BidHistoryItemDto
{
    public int Id { get; init; }
    public int BidderId { get; init; }
    public string BidderUsername { get; init; } = string.Empty;
    public string? BidderAvatarUrl { get; init; }
    public string? BidderDisplayNameColor { get; init; }
    public decimal Amount { get; init; }
    public bool IsAuto { get; init; }
    public DateTime CreatedAt { get; init; }
}
