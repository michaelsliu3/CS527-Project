namespace PlzBuyMe.Api.Dtos.Alerts;

/// <summary>Result of creating an alert; either the created alert or an error message.</summary>
public record CreateAlertResultDto
{
    public AlertResponseDto? Alert { get; init; }
    public string? ErrorMessage { get; init; }
}
