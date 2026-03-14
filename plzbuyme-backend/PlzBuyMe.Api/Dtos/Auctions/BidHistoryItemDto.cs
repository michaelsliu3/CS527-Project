namespace PlzBuyMe.Api.Dtos.Auctions;

public record BidHistoryItemDto
{
    public string BidderUsername { get; init; } = string.Empty;
    public decimal Amount { get; init; }
    public bool IsAuto { get; init; }
    public DateTime CreatedAt { get; init; }
}
