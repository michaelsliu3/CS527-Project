namespace PlzBuyMe.Api.Dtos.Admin.Gm;

public record GmSeedAuctionsDto
{
    /// <summary>Number of auctions to create (max 50).</summary>
    public int Count { get; init; }

    /// <summary>Optional leaf category id (e.g. Sedans). Must have category fields.</summary>
    public int? CategoryId { get; init; }

    /// <summary>Optional seller user id; defaults to first active end-user.</summary>
    public int? SellerUserId { get; init; }

    public int CloseHoursMin { get; init; } = 6;
    public int CloseHoursMax { get; init; } = 120;

    /// <summary>Minimum synthetic bids per auction (inclusive).</summary>
    public int BidCountMin { get; init; }

    /// <summary>Maximum synthetic bids per auction (inclusive, capped at 12).</summary>
    public int BidCountMax { get; init; }

    /// <summary>Required when Count &gt; 20; must equal CONFIRM_GM.</summary>
    public string? Confirmation { get; init; }
}
