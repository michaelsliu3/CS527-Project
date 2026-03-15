using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Hosting;

namespace PlzBuyMe.Tests.E2E;

/// <summary>
/// WebApplicationFactory for backend E2E tests. Uses Testing environment so the API runs with InMemory database.
/// </summary>
public class PlzBuyMeWebApplicationFactory : WebApplicationFactory<PlzBuyMe.Api.Program>
{
    protected override IHost CreateHost(IHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        return base.CreateHost(builder);
    }
}
