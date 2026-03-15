using PlzBuyMe.Api.Dtos;
using PlzBuyMe.Api.Dtos.Auctions;

namespace PlzBuyMe.Api.Services;

public interface IAuctionService
{
    Task<AuctionDetailDto?> CreateAuctionAsync(CreateAuctionDto dto, int sellerId);
    Task PlaceBidAsync(int itemId, int bidderId, decimal amount);
    Task SetAutoBidAsync(int itemId, int bidderId, decimal upperLimit);
    Task CloseExpiredAsync();
    Task<PaginatedResultDto<AuctionListDto>> SearchAsync(SearchQueryDto query);
    Task<AuctionDetailDto?> GetByIdAsync(int id);
    Task<List<AuctionListDto>> GetMineAsync(int userId, string? status = null);
    Task<List<AuctionListDto>> GetSimilarAsync(int itemId, int limit = 10);
    Task<List<AuctionListDto>> GetHistoryAsync(int userId);
    Task<IReadOnlyList<string>> GetFieldValuesAsync(string fieldName, int? categoryId, string? prefix, int maxCount = 50);
}
