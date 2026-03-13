namespace PlzBuyMe.Api.Dtos.Auth;

public record AuthErrorDto
{
    public string Code { get; init; } = string.Empty;
    public string Message { get; init; } = string.Empty;
}
