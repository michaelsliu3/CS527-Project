using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Options;
using PlzBuyMe.Cdn.Middleware;
using PlzBuyMe.Cdn.Options;
using PlzBuyMe.Cdn.Services;

namespace PlzBuyMe.Cdn;

public sealed class Program
{
    public static void Main(string[] args)
    {
        var builder = WebApplication.CreateBuilder(args);
        builder.Services.AddControllers();
        builder.Services.AddCors(options =>
        {
            options.AddPolicy("AllowFrontend", policy =>
                policy.WithOrigins(ParseCorsOrigins(builder.Configuration))
                      .AllowAnyHeader()
                      .AllowAnyMethod());
        });
        builder.Services.Configure<MediaStorageOptions>(builder.Configuration.GetSection("MediaStorage"));
        builder.Services.AddHttpClient();
        builder.Services.AddScoped<IMediaStorageService, LocalMediaStorageService>();
        builder.Services.AddSingleton<IGt7ThumbnailResolver, Gt7ThumbnailResolver>();

        var app = builder.Build();
        app.UseCors("AllowFrontend");

        var mediaStorageOptions = app.Services.GetRequiredService<IOptions<MediaStorageOptions>>().Value;
        var storageRoot = MediaStorageOptionsResolver.ResolveStorageRoot(mediaStorageOptions, app.Environment.ContentRootPath);
        Directory.CreateDirectory(storageRoot);

        app.UseMiddleware<Gt7ThumbnailMirrorMiddleware>();

        app.UseStaticFiles(new StaticFileOptions
        {
            FileProvider = new PhysicalFileProvider(storageRoot),
            RequestPath = "/media"
        });

        app.MapControllers();
        app.Run();
    }

    private static string[] ParseCorsOrigins(IConfiguration configuration)
    {
        var extra = configuration["Cors:AllowedOrigins"];
        var origins = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            "http://localhost:5173",
            "http://localhost:5174",
            "http://localhost:5175"
        };
        if (!string.IsNullOrWhiteSpace(extra))
        {
            foreach (var o in extra.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
                origins.Add(o);
        }
        return origins.ToArray();
    }
}
