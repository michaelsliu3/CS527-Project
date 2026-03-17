using PlzBuyMe.Api.Dtos;
using PlzBuyMe.Api.Dtos.Rep;

namespace PlzBuyMe.Api.Services;

public interface IRepService
{
    Task<PaginatedResultDto<UserSummaryDto>> GetUsersAsync(string? search, int page, int pageSize, bool isAdmin);
    Task<(bool NotFound, bool Forbidden, string? ErrorMessage)> EditUserAsync(int id, EditUserDto dto, bool isAdmin);
    Task<(bool NotFound, string? ErrorMessage)> DeleteUserAsync(int id);
    Task<(bool NotFound, string? ErrorMessage)> ResetPasswordAsync(int id, ResetPasswordDto dto);
    Task<bool> DeleteBidAsync(int bidId);
    Task<bool> DeleteAuctionAsync(int auctionId);
}

