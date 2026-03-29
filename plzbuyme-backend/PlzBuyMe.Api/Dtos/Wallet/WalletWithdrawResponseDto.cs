namespace PlzBuyMe.Api.Dtos.Wallet;

public record WalletWithdrawResponseDto
{
    public decimal WalletBalance { get; init; }
    public decimal WalletAvailableBalance { get; init; }
}
