using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Hosting;
using PlzBuyMe.Api.Data;

namespace PlzBuyMe.Tests.E2E;

/// <summary>
/// WebApplicationFactory for backend E2E tests. Uses Testing environment so the API runs with InMemory database.
/// </summary>
public class PlzBuyMeWebApplicationFactory : WebApplicationFactory<PlzBuyMe.Api.Program>
{
    private readonly string _databaseName = $"PlzBuyMeE2E-{Guid.NewGuid():N}";

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.ConfigureServices(services =>
        {
            services.RemoveAll(typeof(DbContextOptions<AppDbContext>));
            services.AddDbContext<AppDbContext>(options =>
                options.UseInMemoryDatabase(_databaseName));
        });
    }

    protected override IHost CreateHost(IHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        return base.CreateHost(builder);
    }
}
