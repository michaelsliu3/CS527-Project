using PlzBuyMe.Api.Dtos.Admin;

namespace PlzBuyMe.Api.Services;

public interface IReportService
{
    Task<decimal> GetTotalEarningsAsync();
    Task<IReadOnlyList<EarningsByItemDto>> GetEarningsByItemAsync();
    Task<IReadOnlyList<EarningsByTypeDto>> GetEarningsByTypeAsync();
    Task<IReadOnlyList<EarningsByUserDto>> GetEarningsByUserAsync();
    Task<IReadOnlyList<BestSellingItemDto>> GetBestSellingItemsAsync(int top);
    Task<IReadOnlyList<BestBuyerDto>> GetBestBuyersAsync(int top);
}
