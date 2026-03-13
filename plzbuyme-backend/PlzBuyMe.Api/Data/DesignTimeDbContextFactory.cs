using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Microsoft.Extensions.Configuration;

namespace PlzBuyMe.Api.Data;

/// <summary>
/// Used by EF Core design-time tools (e.g. dotnet ef migrations add) so migrations can be generated without a running MySQL server.
/// </summary>
public class DesignTimeDbContextFactory : IDesignTimeDbContextFactory<AppDbContext>
{
    public AppDbContext CreateDbContext(string[] args)
    {
        var config = new ConfigurationBuilder()
            .SetBasePath(Directory.GetCurrentDirectory())
            .AddJsonFile("appsettings.json", optional: true)
            .AddJsonFile("appsettings.Development.json", optional: true)
            .AddEnvironmentVariables()
            .Build();

        var connectionString = config.GetConnectionString("DefaultConnection")
            ?? "Server=localhost;Database=plzbuyme;User=root;Password=password;";

        var optionsBuilder = new DbContextOptionsBuilder<AppDbContext>();
        // Fixed version avoids connection at design time; migration is generated from the model only.
        optionsBuilder.UseMySql(
            connectionString,
            new MySqlServerVersion(new Version(8, 0)),
            b => b.MigrationsAssembly(typeof(DesignTimeDbContextFactory).Assembly.GetName().Name));

        return new AppDbContext(optionsBuilder.Options);
    }
}
