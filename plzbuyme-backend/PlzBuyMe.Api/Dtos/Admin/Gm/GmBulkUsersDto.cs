namespace PlzBuyMe.Api.Dtos.Admin.Gm;

public record GmBulkUsersDto
{
    /// <summary>Prefix for usernames: {Prefix}{StartIndex + i}.</summary>
    public string UsernamePrefix { get; init; } = string.Empty;

    public int Count { get; init; }
    public int StartIndex { get; init; } = 1;

    /// <summary>Password for all created users (min 6). Defaults to GmDemo123! if empty.</summary>
    public string? Password { get; init; }

    /// <summary>Optional initial wallet balance per user.</summary>
    public decimal? WalletBalanceEach { get; init; }
}
