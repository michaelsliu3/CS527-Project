namespace PlzBuyMe.Api.Dtos.Wallet;

public record WalletDepositRequestDto
{
    public decimal? Amount { get; init; }

    public string? Preset { get; init; }
}
