using PlzBuyMe.Api.Models;

namespace PlzBuyMe.Api.Services;

/// <summary>
/// Stub implementation for PBM-6. PBM-7 will implement full alert matching.
/// </summary>
public class AlertService : IAlertService
{
    public Task CheckAlertsForNewItemAsync(Item item)
    {
        return Task.CompletedTask;
    }
}
