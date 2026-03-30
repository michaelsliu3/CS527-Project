namespace PlzBuyMe.Api.Dtos.Admin.Gm;

public record GmWalletTopUpDto
{
    /// <summary>Up to 30 user ids.</summary>
    public List<int> UserIds { get; init; } = new();

    /// <summary>Amount to deposit per user (positive, max 10_000_000).</summary>
    public decimal AmountEach { get; init; }

    /// <summary>Required when UserIds.Count &gt; 15 or AmountEach &gt; 100_000; must equal CONFIRM_GM.</summary>
    public string? Confirmation { get; init; }
}
