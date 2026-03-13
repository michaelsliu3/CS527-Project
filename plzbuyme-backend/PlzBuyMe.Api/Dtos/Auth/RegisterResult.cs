namespace PlzBuyMe.Api.Dtos.Auth;

public record RegisterResult
{
    public AuthResponseDto? Data { get; init; }
    public RegisterFailureReason? FailureReason { get; init; }

    public bool Success => Data != null && FailureReason == null;
}
