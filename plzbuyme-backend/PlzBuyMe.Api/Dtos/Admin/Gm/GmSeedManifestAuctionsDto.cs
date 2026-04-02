namespace PlzBuyMe.Api.Dtos.Admin.Gm;

public record GmSeedManifestAuctionsDto
{
    /// <summary>1–100. Uses GT7 car manifest (same source as create-auctions-temp.mjs).</summary>
    public int Count { get; init; }

    /// <summary>Filter assets whose title contains this (case-insensitive).</summary>
    public string? TitleKeyword { get; init; }

    /// <summary>"auto" to infer Sedans/SUVs/etc. from car metadata; or exact leaf name e.g. "Sedans".</summary>
    public string CategoryMode { get; init; } = "auto";

    public int CloseHoursMin { get; init; } = 6;
    public int CloseHoursMax { get; init; } = 120;

    public int BidCountMin { get; init; }
    public int BidCountMax { get; init; }

    public int? SellerUserId { get; init; }

}
