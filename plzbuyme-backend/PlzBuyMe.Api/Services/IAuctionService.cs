using PlzBuyMe.Api.Dtos;
using PlzBuyMe.Api.Dtos.Admin;
using PlzBuyMe.Api.Dtos.Admin.Gm;
using PlzBuyMe.Api.Dtos.Auctions;
using PlzBuyMe.Api.Models;

namespace PlzBuyMe.Api.Services;

public interface IAuctionService
{
    Task<AuctionDetailDto?> CreateAuctionAsync(CreateAuctionDto dto, int sellerId);
    Task PlaceBidAsync(int itemId, int bidderId, decimal amount);
    Task SetAutoBidAsync(int itemId, int bidderId, decimal upperLimit);
    Task CloseExpiredAsync();
    Task<PaginatedResultDto<AuctionListDto>> SearchAsync(SearchQueryDto query);
    Task<PaginatedResultDto<AuctionListDto>> SearchAsync(SearchQueryDto query, int? requesterUserId, UserRole? requesterRole);
    Task<AuctionDetailDto?> GetByIdAsync(int id);
    Task<AuctionDetailDto?> GetByIdAsync(int id, int? requesterUserId, UserRole? requesterRole);
    Task<List<AuctionListDto>> GetMineAsync(int userId, string? status = null);
    Task<List<AuctionListDto>> GetSimilarAsync(int itemId, int limit = 10);
    Task<List<AuctionListDto>> GetSimilarAsync(int itemId, int limit, int? requesterUserId, UserRole? requesterRole);
    Task<List<AuctionListDto>> GetHistoryAsync(int userId);
    Task<List<AuctionListDto>> GetHistoryAsync(int userId, int? requesterUserId, UserRole? requesterRole);
    Task<IReadOnlyList<string>> GetFieldValuesAsync(string fieldName, int? categoryId, string? prefix, int maxCount = 50);

    /// <summary>Admin GM / moderation: patch listing or end auction early.</summary>
    Task<(string? Error, AuctionDetailDto? Detail)> AdminPatchAuctionAsync(int itemId, AdminPatchAuctionDto dto, int adminUserId);

    /// <summary>GM: close every active listing in one batch (natural reserve rules vs no-sale).</summary>
    Task<(string? Error, GmBulkCloseAuctionsResultDto? Result)> GmBulkCloseActiveAuctionsAsync(string mode);

    /// <summary>GM: permanently delete every auction (items) and dependent rows (bids, auto-bids, holds, item-linked notifications).</summary>
    Task<(string? Error, GmDeleteAllAuctionsResultDto? Result)> GmDeleteAllAuctionsAsync();
}
