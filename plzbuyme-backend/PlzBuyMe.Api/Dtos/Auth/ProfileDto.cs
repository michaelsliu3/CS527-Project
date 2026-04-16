namespace PlzBuyMe.Api.Dtos.Auth;

public record ProfileDto
{
    public int Id { get; init; }
    public string Username { get; init; } = string.Empty;
    public bool IsAuctionIdentityAnonymous { get; init; }
    public string? AvatarUrl { get; init; }
    public string? DisplayNameColor { get; init; }
    public string Email { get; init; } = string.Empty;
    public string Role { get; init; } = string.Empty;
    public decimal WalletBalance { get; init; }
    public decimal WalletAvailableBalance { get; init; }
}
