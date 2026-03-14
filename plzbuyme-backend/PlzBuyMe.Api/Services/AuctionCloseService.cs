using Microsoft.Extensions.Hosting;

namespace PlzBuyMe.Api.Services;

public class AuctionCloseService : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;

    public AuctionCloseService(IServiceProvider serviceProvider)
    {
        _serviceProvider = serviceProvider;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = _serviceProvider.CreateScope();
                var auctionService = scope.ServiceProvider.GetRequiredService<IAuctionService>();
                await auctionService.CloseExpiredAsync();
            }
            catch (Exception)
            {
                // Log and continue; do not bring down the host
            }

            await Task.Delay(TimeSpan.FromSeconds(30), stoppingToken);
        }
    }
}
