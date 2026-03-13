namespace PlzBuyMe.Api.Dtos.Auth;

public record LoginResult
{
    public AuthResponseDto? Data { get; init; }
    public LoginFailureReason? FailureReason { get; init; }

    public bool Success => Data != null && FailureReason == null;
}
