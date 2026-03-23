namespace PlzBuyMe.Cdn.Dtos.Common;

public sealed record ErrorResponseDto
{
    public required string Message { get; init; }
}
