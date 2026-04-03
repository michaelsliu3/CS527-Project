namespace PlzBuyMe.Api.Dtos.Admin;

/// <summary>Admin-only partial update. <see cref="EndAuction"/> is mutually exclusive with price/time fields in one request.</summary>
public record AdminPatchAuctionDto
{
    public string? Title { get; init; }
    public string? Description { get; init; }
    /// <summary>
    /// Replacement category IDs. Null leaves categories unchanged; empty clears all categories.
    /// </summary>
    public List<int>? CategoryIds { get; init; }

    public DateTime? CloseDateTime { get; init; }
    public decimal? BidIncrement { get; init; }
    public decimal? ReservePrice { get; init; }

    /// <summary>Only when the listing has no bids.</summary>
    public decimal? InitialPrice { get; init; }

    /// <summary>Only when the listing has no bids.</summary>
    public decimal? CurrentPrice { get; init; }

    /// <summary>
    /// End an <b>active</b> auction: <c>natural</c> (reserve rules), <c>closed</c> (no sale, release holds),
    /// <c>sold</c> (finalize with top bid; fails if none or below reserve).
    /// </summary>
    public string? EndAuction { get; init; }
}
