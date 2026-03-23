using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Options;
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
                policy.WithOrigins("http://localhost:5173", "http://localhost:5174", "http://localhost:5175")
                      .AllowAnyHeader()
                      .AllowAnyMethod());
        });
        builder.Services.Configure<MediaStorageOptions>(builder.Configuration.GetSection("MediaStorage"));
        builder.Services.AddScoped<IMediaStorageService, LocalMediaStorageService>();

        var app = builder.Build();
        app.UseCors("AllowFrontend");

        var mediaStorageOptions = app.Services.GetRequiredService<IOptions<MediaStorageOptions>>().Value;
        var storageRoot = MediaStorageOptionsResolver.ResolveStorageRoot(mediaStorageOptions, app.Environment.ContentRootPath);
        Directory.CreateDirectory(storageRoot);

        app.UseStaticFiles(new StaticFileOptions
        {
            FileProvider = new PhysicalFileProvider(storageRoot),
            RequestPath = "/media"
        });

        app.MapControllers();
        app.Run();
    }
}
