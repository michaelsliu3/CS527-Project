namespace PlzBuyMe.Api.Dtos.Admin.Gm;

/// <summary>GM bulk-close: <c>natural</c> applies reserve rules per listing; <c>closed</c> ends all without sale.</summary>
public record GmBulkCloseAuctionsDto
{
    /// <summary><c>natural</c> or <c>closed</c>.</summary>
    public string Mode { get; init; } = "natural";
}
