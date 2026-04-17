namespace PlzBuyMe.Api.Dtos.Admin.Gm;

public record GmSeedSoldAuctionsDto
{
    /// <summary>Number of historical auctions to create (max 200).</summary>
    public int Count { get; init; }

    /// <summary>How many days back sold/closed auctions should be distributed.</summary>
    public int DaysAgoMin { get; init; } = 1;
    public int DaysAgoMax { get; init; } = 180;

    /// <summary>Random final-price range.</summary>
    public decimal PriceMin { get; init; } = 1000m;
    public decimal PriceMax { get; init; } = 100000m;

    /// <summary>Random bids generated per auction.</summary>
    public int BidCountMin { get; init; } = 1;
    public int BidCountMax { get; init; } = 5;

    /// <summary>Portion of rows created as closed-without-sale [0..1].</summary>
    public decimal ClosedWithoutSaleRatio { get; init; } = 0m;

    /// <summary>Optional category selection mode: auto, string key, or category display name.</summary>
    public string? CategoryMode { get; init; } = "auto";

    /// <summary>Optional explicit leaf category id; when provided it wins over category mode.</summary>
    public int? CategoryId { get; init; }

    /// <summary>Optional seller user id; defaults to active end-user/vip pool.</summary>
    public int? SellerUserId { get; init; }
}
