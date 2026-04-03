namespace PlzBuyMe.Api.Dtos.Auctions;

public record AuctionDetailDto
{
    public int Id { get; init; }
    public string Title { get; init; } = string.Empty;
    public string? Description { get; init; }
    public string? ImageUrl { get; init; }
    public string? DetailImageUrl { get; init; }
    public string? ImageSource { get; init; }
    public string? ImageMatchLevel { get; init; }
    public int CategoryId { get; init; }
    public string CategoryName { get; init; } = string.Empty;
    public List<string> CategoryNames { get; init; } = new();
    public List<int> AdditionalCategoryIds { get; init; } = new();
    public int SellerId { get; init; }
    public string SellerUsername { get; init; } = string.Empty;
    public string? SellerAvatarUrl { get; init; }
    public string? SellerDisplayNameColor { get; init; }
    public decimal InitialPrice { get; init; }
    public decimal BidIncrement { get; init; }
    public decimal ReservePrice { get; init; }
    public decimal CurrentPrice { get; init; }
    public DateTime CloseDateTime { get; init; }
    public string Status { get; init; } = string.Empty;
    public int? WinnerId { get; init; }
    public DateTime CreatedAt { get; init; }
    public List<CategoryFieldValueDto> FieldValues { get; init; } = new();
    public List<BidHistoryItemDto> BidHistory { get; init; } = new();
}

public record CategoryFieldValueDto(string FieldName, string Value);
