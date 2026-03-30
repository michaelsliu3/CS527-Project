namespace PlzBuyMe.Api.Dtos.Auth;

public record AuthResponseDto
{
    public string Token { get; init; } = string.Empty;
    public string Username { get; init; } = string.Empty;
    public string? AvatarUrl { get; init; }
    public string? DisplayNameColor { get; init; }
    public string Email { get; init; } = string.Empty;
    public string Role { get; init; } = string.Empty;
    public int UserId { get; init; }
    public decimal WalletBalance { get; init; }
    public decimal WalletAvailableBalance { get; init; }
}
