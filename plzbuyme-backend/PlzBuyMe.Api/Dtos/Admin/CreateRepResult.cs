namespace PlzBuyMe.Api.Dtos.Admin;

public record CreateRepResult
{
    public CreateRepResponseDto? Data { get; init; }
    public string? ErrorMessage { get; init; }

    public bool Success => Data != null && ErrorMessage == null;
}
