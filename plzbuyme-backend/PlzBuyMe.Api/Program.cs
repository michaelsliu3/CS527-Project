using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Builder;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using PlzBuyMe.Api.Data;
using PlzBuyMe.Api.Services;
using Serilog;

namespace PlzBuyMe.Api;

public class Program
{
    public static void Main(string[] args)
    {
        Log.Logger = new LoggerConfiguration()
            .ReadFrom.Configuration(new ConfigurationBuilder()
                .AddJsonFile("appsettings.json")
                .AddJsonFile($"appsettings.{Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") ?? "Production"}.json", optional: true)
                .Build())
            .CreateLogger();

        try
        {
            var builder = WebApplication.CreateBuilder(new WebApplicationOptions
            {
                Args = args,
                WebRootPath = "wwwroot"
            });
            builder.Host.UseSerilog();
            EnsureStaticFileDirectories(builder);

            ConfigureServices(builder);

            var app = builder.Build();

            // Ensure MySQL database exists, then run migrations and seed (skipped when e.g. dotnet ef runs with no MySQL).
            using (var scope = app.Services.CreateScope())
            {
                var config = scope.ServiceProvider.GetRequiredService<IConfiguration>();
                var connectionString = config.GetConnectionString("DefaultConnection");
                var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                try
                {
                    if (db.Database.IsRelational())
                    {
                        if (!string.IsNullOrEmpty(connectionString))
                            DatabaseEnsure.EnsureDatabaseExists(connectionString);
                        if (db.Database.CanConnect())
                            db.Database.Migrate();
                    }
                    if (db.Database.CanConnect())
                    {
                        SeedData.Initialize(db);
                        // SeedData.SeedSoldItemsForReports(db);
                    }
                }
                catch (Exception ex)
                {
                    Log.Warning(ex, "Migration or seed skipped (e.g. no DB or design-time).");
                }
            }

            ConfigurePipeline(app);

            app.Run();
        }
        catch (Exception ex)
        {
            Log.Fatal(ex, "Application terminated unexpectedly");
        }
        finally
        {
            Log.CloseAndFlush();
        }
    }

    private static void EnsureStaticFileDirectories(WebApplicationBuilder builder)
    {
        var webRootPath = builder.Environment.WebRootPath;
        if (string.IsNullOrEmpty(webRootPath))
            return;
        var avatarDirectoryPath = Path.Combine(webRootPath, "uploads", "avatars");
        Directory.CreateDirectory(avatarDirectoryPath);
    }

    private static void ConfigureServices(WebApplicationBuilder builder)
    {
        // ── Database: InMemory for Testing, MySQL otherwise ─────────
        if (builder.Environment.IsEnvironment("Testing"))
        {
            builder.Services.AddDbContext<AppDbContext>(options =>
                options.UseInMemoryDatabase("PlzBuyMeE2E"));
        }
        else
        {
            var connectionString = builder.Configuration.GetConnectionString("DefaultConnection")
                ?? throw new InvalidOperationException("Missing DefaultConnection");
            var serverVersion = new MySqlServerVersion(new Version(8, 0));
            builder.Services.AddDbContext<AppDbContext>(options =>
                options.UseMySql(connectionString, serverVersion));
        }

        // ── JWT Authentication ──────────────────────────────────────
        var jwtSection = builder.Configuration.GetSection("Jwt");
        var jwtKey = jwtSection["Key"];
        if (string.IsNullOrWhiteSpace(jwtKey) || jwtKey.Length < 32)
            throw new InvalidOperationException("Jwt:Key must be set and at least 32 characters.");
        if (string.IsNullOrWhiteSpace(jwtSection["Issuer"]))
            throw new InvalidOperationException("Jwt:Issuer must be set.");
        if (string.IsNullOrWhiteSpace(jwtSection["Audience"]))
            throw new InvalidOperationException("Jwt:Audience must be set.");
        if (!int.TryParse(jwtSection["ExpiresInMinutes"], out var expiresMinutes) || expiresMinutes < 1)
            throw new InvalidOperationException("Jwt:ExpiresInMinutes must be a positive integer.");
        var key = Encoding.UTF8.GetBytes(jwtKey);

        builder.Services.AddAuthentication(options =>
        {
            options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
            options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
        })
        .AddJwtBearer(options =>
        {
            options.TokenValidationParameters = new TokenValidationParameters
            {
                ValidateIssuer = true,
                ValidateAudience = true,
                ValidateLifetime = true,
                ValidateIssuerSigningKey = true,
                ValidIssuer = jwtSection["Issuer"],
                ValidAudience = jwtSection["Audience"],
                IssuerSigningKey = new SymmetricSecurityKey(key)
            };
        });

        // ── Authorization Policies ──────────────────────────────────
        builder.Services.AddAuthorization(options =>
        {
            options.AddPolicy("AdminOnly", p => p.RequireRole("admin"));
            options.AddPolicy("RepOnly", p => p.RequireRole("customer_rep", "admin"));
            options.AddPolicy("EndUser", p => p.RequireRole("end_user", "vip", "customer_rep", "admin"));
        });

        // ── Services ─────────────────────────────────────────────────
        builder.Services.AddScoped<IAuthService, AuthService>();
        builder.Services.AddScoped<IAlertService, AlertService>();
        builder.Services.AddScoped<INotificationService, NotificationService>();
        builder.Services.AddScoped<IAuctionService, AuctionService>();
        builder.Services.AddScoped<IQuestionsService, QuestionsService>();
        builder.Services.AddScoped<IRepService, RepService>();
        builder.Services.AddScoped<IReportService, ReportService>();
        builder.Services.AddHostedService<AuctionCloseService>();

        // ── CORS ────────────────────────────────────────────────────
        builder.Services.AddCors(options =>
        {
            options.AddPolicy("AllowFrontend", policy =>
                policy.WithOrigins("http://localhost:5173")
                      .AllowAnyHeader()
                      .AllowAnyMethod());
        });

        // ── Controllers + Swagger ───────────────────────────────────
        builder.Services.AddControllers()
            .AddJsonOptions(opts =>
            {
                opts.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
            });

        builder.Services.AddEndpointsApiExplorer();
        builder.Services.AddSwaggerGen(options =>
        {
            options.SwaggerDoc("v1", new OpenApiInfo { Title = "PlzBuyMe API", Version = "v1" });
            options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
            {
                Description = "JWT Authorization header using the Bearer scheme. Enter 'Bearer {token}'",
                Name = "Authorization",
                In = ParameterLocation.Header,
                Type = SecuritySchemeType.ApiKey,
                Scheme = "Bearer"
            });
            options.AddSecurityRequirement(new OpenApiSecurityRequirement
            {
                {
                    new OpenApiSecurityScheme
                    {
                        Reference = new OpenApiReference
                        {
                            Type = ReferenceType.SecurityScheme,
                            Id = "Bearer"
                        }
                    },
                    Array.Empty<string>()
                }
            });
        });
    }

    private static void ConfigurePipeline(WebApplication app)
    {
        if (app.Environment.IsDevelopment())
        {
            app.UseSwagger();
            app.UseSwaggerUI(c => c.SwaggerEndpoint("/swagger/v1/swagger.json", "PlzBuyMe API v1"));
            // Skip HTTPS redirect in dev so http://localhost:5081/swagger works
        }
        else
        {
            app.UseHttpsRedirection();
        }

        app.UseSerilogRequestLogging();
        app.UseCors("AllowFrontend");
        app.UseStaticFiles();
        app.UseAuthentication();
        app.UseAuthorization();

        // Simple endpoint to verify server is up (no DB, no Swagger required)
        app.MapGet("/health", () => Results.Ok(new { status = "ok" })).AllowAnonymous();

        app.MapControllers();
    }
}
