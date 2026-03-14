using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace PlzBuyMe.Api.Services;

public class AuctionCloseService : BackgroundService
{
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
                _logger.LogError(ex, "Error running auction close job; will retry in 30 seconds.");
            }

            await Task.Delay(TimeSpan.FromSeconds(30), stoppingToken);
        }
    }
}
