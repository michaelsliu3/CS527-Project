namespace PlzBuyMe.Api.Dtos.Wallet;

public record WalletWithdrawRequestDto
{
    /// <summary>Withdrawal amount; must be positive and not exceed spendable balance.</summary>
    public decimal? Amount { get; init; }
}
