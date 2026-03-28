using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Options;
using PlzBuyMe.Cdn.Middleware;
using PlzBuyMe.Cdn.Options;
using PlzBuyMe.Cdn.Services;

namespace PlzBuyMe.Cdn;

public sealed class Program
{
    private static string[] ParseCorsOrigins(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw))
            return ["http://localhost:5173", "http://localhost:5174", "http://localhost:5175"];
        var parts = raw.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        return parts.Length > 0
            ? parts
            : ["http://localhost:5173", "http://localhost:5174", "http://localhost:5175"];
    }

    public static void Main(string[] args)
    {
        var builder = WebApplication.CreateBuilder(args);
        builder.Services.AddControllers();
        var corsOrigins = ParseCorsOrigins(builder.Configuration["Cors:AllowedOrigins"]);
        builder.Services.AddCors(options =>
        {
            options.AddPolicy("AllowFrontend", policy =>
                policy.WithOrigins(corsOrigins)
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
}
