using PlzBuyMe.Api.Dtos.Admin;
using PlzBuyMe.Api.Dtos;

namespace PlzBuyMe.Api.Services;

public interface IReportService
{
    Task<decimal> GetTotalEarningsAsync(DateTime? from = null, DateTime? to = null);
    Task<EarningsSummaryDto> GetEarningsSummaryAsync(DateTime? from = null, DateTime? to = null);
    Task<PaginatedResultDto<EarningsByItemDto>> GetEarningsByItemAsync(DateTime? from = null, DateTime? to = null, int page = 1, int pageSize = 25);
    Task<IReadOnlyList<EarningsByTypeDto>> GetEarningsByTypeAsync(DateTime? from = null, DateTime? to = null);
    Task<PaginatedResultDto<EarningsByUserDto>> GetEarningsByUserAsync(DateTime? from = null, DateTime? to = null, int page = 1, int pageSize = 25);
    Task<IReadOnlyList<BestSellingItemDto>> GetBestSellingItemsAsync(int top, DateTime? from = null, DateTime? to = null);
    Task<IReadOnlyList<BestBuyerDto>> GetBestBuyersAsync(int top, DateTime? from = null, DateTime? to = null);
}
