using PlzBuyMe.Api.Dtos.Alerts;
using PlzBuyMe.Api.Models;

namespace PlzBuyMe.Api.Services;

public interface IAlertService
{
    Task CheckAlertsForNewItemAsync(Item item);
    Task<IReadOnlyList<AlertResponseDto>> GetAlertsForUserAsync(int userId);
    Task<AlertResponseDto?> CreateAlertAsync(int userId, CreateAlertDto dto);
    Task<bool> DeleteAlertAsync(int alertId, int userId);
}
