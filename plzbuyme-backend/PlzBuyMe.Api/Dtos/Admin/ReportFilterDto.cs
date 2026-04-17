namespace PlzBuyMe.Api.Dtos.Admin;

public record ReportFilterDto
{
    public DateTime? From { get; init; }
    public DateTime? To { get; init; }
    public int? Top { get; init; }
}
