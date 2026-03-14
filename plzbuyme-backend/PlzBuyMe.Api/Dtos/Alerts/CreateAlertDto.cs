namespace PlzBuyMe.Api.Dtos.Alerts;

public record CreateAlertDto
{
    public int? CategoryId { get; init; }
    public string? Keyword { get; init; }
    /// <summary>Optional JSON object: field ID to value or { min, max } or array for multi-select.</summary>
    public string? Criteria { get; init; }
}
