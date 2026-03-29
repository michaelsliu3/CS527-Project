namespace PlzBuyMe.Api.Dtos.Wallet;

public record WalletDepositResponseDto
{
    public decimal WalletBalance { get; init; }
    public decimal WalletAvailableBalance { get; init; }
}
