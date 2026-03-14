using PlzBuyMe.Api.Models;

namespace PlzBuyMe.Api.Services;

public interface IAlertService
{
    Task CheckAlertsForNewItemAsync(Item item);
}
