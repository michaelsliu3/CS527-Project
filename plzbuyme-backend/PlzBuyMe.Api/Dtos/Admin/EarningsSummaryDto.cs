namespace PlzBuyMe.Api.Dtos.Admin;

public record EarningsSummaryDto
{
    public decimal Total { get; init; }
    public int SoldCount { get; init; }
    public decimal AverageSale { get; init; }
    public int DistinctSellers { get; init; }
    public int DistinctBuyers { get; init; }
}
