namespace PlzBuyMe.Api.Dtos.Auctions;

public record SearchQueryDto
{
    public string? Q { get; init; }
    public int? CategoryId { get; init; }
    public decimal? MinPrice { get; init; }
    public decimal? MaxPrice { get; init; }
    public string? Status { get; init; }
    public DateTime? ClosingBefore { get; init; }
    public DateTime? ClosingAfter { get; init; }
    public string? Seller { get; init; }
    /// <summary>JSON object mapping field IDs to filter values (string, { min, max }, or string[]).</summary>
    public string? FieldFilters { get; init; }
    public string? Sort { get; init; }
    public int Page { get; init; } = 1;
    public int PageSize { get; init; } = 20;

    // Car shortcut params (map to field_filters)
    public string? Make { get; init; }
    public string? Model { get; init; }
    public int? YearMin { get; init; }
    public int? YearMax { get; init; }
    public int? MileageMax { get; init; }
    public string? ExteriorColor { get; init; }
    public List<string>? Condition { get; init; }
    public List<string>? Transmission { get; init; }
    public List<string>? FuelType { get; init; }
}
