using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace PlzBuyMe.Api.Services;

public class AuctionCloseService : BackgroundService
{
    // Change this value to control how often expired auctions are processed.
    private static readonly TimeSpan CloseSweepInterval = TimeSpan.FromSeconds(10);

    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<AuctionCloseService> _logger;

    public AuctionCloseService(IServiceProvider serviceProvider, ILogger<AuctionCloseService> logger)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
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
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error running auction close job; will retry in {RetrySeconds} seconds.", CloseSweepInterval.TotalSeconds);
            }

            await Task.Delay(CloseSweepInterval, stoppingToken);
        }
    }
}
