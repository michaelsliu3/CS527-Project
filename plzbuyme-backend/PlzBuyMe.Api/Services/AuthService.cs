using System.IdentityModel.Tokens.Jwt;
using System.Text.RegularExpressions;
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Hosting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;
using PlzBuyMe.Api.Data;
using PlzBuyMe.Api.Dtos.Admin;
using PlzBuyMe.Api.Dtos.Auth;
using PlzBuyMe.Api.Models;

namespace PlzBuyMe.Api.Services;

public class AuthService : IAuthService
{
    private static readonly Regex HexColorRegex = new("^#[0-9a-fA-F]{6}$", RegexOptions.Compiled);
    private const long MaxAvatarSizeBytes = 2 * 1024 * 1024;
    private static readonly HashSet<string> AllowedAvatarExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".jpg", ".jpeg", ".png", ".gif", ".webp"
    };
    private static readonly HashSet<string> AllowedAvatarContentTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "image/jpeg", "image/png", "image/gif", "image/webp", "image/jpg"
    };
    private static readonly HashSet<string> AnimatedPresets = new(StringComparer.Ordinal)
    {
        "RAINBOW",
        "PURPBLU",
        "RGBFLOW",
        "SUNGLOW",
        "AURORAX",
        "FIREICE"
    };
    private readonly AppDbContext _db;
    private readonly IConfiguration _config;
    private readonly IWebHostEnvironment _environment;

    public AuthService(AppDbContext db, IConfiguration config, IWebHostEnvironment environment)
    {
        _db = db;
        _config = config;
        _environment = environment;
    }

    public string HashPassword(string password)
    {
        return BCrypt.Net.BCrypt.HashPassword(password);
    }

    public bool VerifyPassword(string password, string hash)
    {
        return BCrypt.Net.BCrypt.Verify(password, hash);
    }

    public string GenerateJwt(User user)
    {
        var jwtSection = _config.GetSection("Jwt");
        var key = Encoding.UTF8.GetBytes(jwtSection["Key"]!);
        var expiresMinutes = int.Parse(jwtSection["ExpiresInMinutes"] ?? "60");
        var credentials = new SigningCredentials(new SymmetricSecurityKey(key), SecurityAlgorithms.HmacSha256);

        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new("sub", user.Id.ToString()),
            new(ClaimTypes.Name, user.Username),
            new(ClaimTypes.Email, user.Email),
            new(ClaimTypes.Role, RoleToClaimValue(user.Role))
        };
        if (!string.IsNullOrWhiteSpace(user.DisplayNameColor))
            claims.Add(new Claim("display_name_color", user.DisplayNameColor));
        if (!string.IsNullOrWhiteSpace(user.AvatarUrl))
            claims.Add(new Claim("avatar_url", user.AvatarUrl));

        var token = new JwtSecurityToken(
            issuer: jwtSection["Issuer"],
            audience: jwtSection["Audience"],
            claims: claims,
            expires: DateTime.UtcNow.AddMinutes(expiresMinutes),
            signingCredentials: credentials);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    public async Task<RegisterResult> RegisterAsync(RegisterDto dto)
    {
        var username = dto.Username.Trim();
        var email = dto.Email.Trim();
        if (await _db.Users.AnyAsync(u => u.Username == username))
            return new RegisterResult { FailureReason = RegisterFailureReason.UsernameTaken };
        if (await _db.Users.AnyAsync(u => u.Email == email))
            return new RegisterResult { FailureReason = RegisterFailureReason.EmailTaken };

        var user = new User
        {
            Username = username,
            Email = email,
            PasswordHash = HashPassword(dto.Password),
            Role = UserRole.EndUser,
            IsActive = true
        };
        _db.Users.Add(user);
        await _db.SaveChangesAsync();

        var token = GenerateJwt(user);
        return new RegisterResult
        {
            Data = new AuthResponseDto
            {
                Token = token,
                Username = user.Username,
                AvatarUrl = user.AvatarUrl,
                DisplayNameColor = user.DisplayNameColor,
                Email = user.Email,
                Role = RoleToClaimValue(user.Role),
                UserId = user.Id
            }
        };
    }

    public async Task<LoginResult> LoginAsync(LoginDto dto)
    {
        var login = dto.Username.Trim();
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Username == login || u.Email == login);
        if (user == null)
            return new LoginResult { FailureReason = LoginFailureReason.UserNotFound };
        if (!VerifyPassword(dto.Password, user.PasswordHash))
            return new LoginResult { FailureReason = LoginFailureReason.InvalidPassword };
        if (!user.IsActive)
            return new LoginResult { FailureReason = LoginFailureReason.AccountInactive };

        var token = GenerateJwt(user);
        return new LoginResult
        {
            Data = new AuthResponseDto
            {
                Token = token,
                Username = user.Username,
                AvatarUrl = user.AvatarUrl,
                DisplayNameColor = user.DisplayNameColor,
                Email = user.Email,
                Role = RoleToClaimValue(user.Role),
                UserId = user.Id
            }
        };
    }

    public async Task<ProfileDto?> GetProfileAsync(int userId)
    {
        var user = await _db.Users.AsNoTracking()
            .FirstOrDefaultAsync(u => u.Id == userId);
        if (user == null)
            return null;
        return new ProfileDto
        {
            Id = user.Id,
            Username = user.Username,
            AvatarUrl = user.AvatarUrl,
            DisplayNameColor = user.DisplayNameColor,
            Email = user.Email,
            Role = RoleToClaimValue(user.Role)
        };
    }

    public async Task<(bool NotFound, bool Forbidden, string? ValidationError, string? DisplayNameColor)> UpdateDisplayNameColorAsync(int userId, string? displayNameColor)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId);
        if (user == null)
            return (true, false, null, null);
        if (!CanCustomizeDisplayNameColor(user.Role))
            return (false, true, null, user.DisplayNameColor);

        var normalized = NormalizeColor(displayNameColor);
        if (displayNameColor != null && normalized == null)
            return (false, false, "Display name color must be a valid hex code like #A1B2C3 or one of: RAINBOW, PURPBLU, RGBFLOW, SUNGLOW, AURORAX, FIREICE.", user.DisplayNameColor);

        user.DisplayNameColor = normalized;
        await _db.SaveChangesAsync();
        return (false, false, null, user.DisplayNameColor);
    }

    public async Task<(bool NotFound, string? ValidationError, string? AvatarUrl)> UploadAvatarAsync(int userId, IFormFile? avatarFile)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId);
        if (user == null)
            return (true, null, null);

        if (avatarFile == null || avatarFile.Length == 0)
            return (false, "Avatar file is required.", user.AvatarUrl);
        if (avatarFile.Length > MaxAvatarSizeBytes)
            return (false, "Avatar file must be 2MB or smaller.", user.AvatarUrl);

        var extension = Path.GetExtension(avatarFile.FileName);
        if (string.IsNullOrWhiteSpace(extension) || !AllowedAvatarExtensions.Contains(extension))
            return (false, "Avatar file must be one of: .jpg, .jpeg, .png, .gif, .webp.", user.AvatarUrl);
        var contentType = avatarFile.ContentType?.Trim();
        if (!string.IsNullOrWhiteSpace(contentType))
        {
            var normalizedContentType = contentType.ToLowerInvariant();
            var isKnownImageContentType = AllowedAvatarContentTypes.Contains(normalizedContentType)
                || normalizedContentType.StartsWith("image/", StringComparison.Ordinal);
            var isGenericBinaryContentType = normalizedContentType == "application/octet-stream";

            if (!isKnownImageContentType && !isGenericBinaryContentType)
                return (false, "Avatar content type is not supported.", user.AvatarUrl);
        }

        var avatarDirectory = ResolveAvatarDirectoryPath();
        Directory.CreateDirectory(avatarDirectory);

        var sanitizedExtension = extension.ToLowerInvariant();
        var fileName = $"user-{userId}-{Guid.NewGuid():N}{sanitizedExtension}";
        var filePath = Path.Combine(avatarDirectory, fileName);
        await using (var stream = File.Create(filePath))
        {
            await avatarFile.CopyToAsync(stream);
        }

        var previousAvatarUrl = user.AvatarUrl;
        user.AvatarUrl = CreateLocalAvatarUrl(fileName);
        await _db.SaveChangesAsync();

        await DeleteAvatarIfLocalAsync(previousAvatarUrl);
        return (false, null, user.AvatarUrl);
    }

    public async Task<(bool NotFound, string? AvatarUrl)> RemoveAvatarAsync(int userId)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId);
        if (user == null)
            return (true, null);

        var previousAvatarUrl = user.AvatarUrl;
        user.AvatarUrl = null;
        await _db.SaveChangesAsync();
        await DeleteAvatarIfLocalAsync(previousAvatarUrl);

        return (false, null);
    }

    public async Task<bool> DeleteProfileAsync(int userId)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId);
        if (user == null)
            return false;
        user.IsActive = false;
        await _db.SaveChangesAsync();
        return true;
    }

    public async Task<CreateRepResult> CreateRepAsync(CreateRepDto dto)
    {
        var username = dto.Username.Trim();
        var email = dto.Email.Trim();
        if (await _db.Users.AnyAsync(u => u.Username == username))
            return new CreateRepResult { ErrorMessage = "Username is already taken." };
        if (await _db.Users.AnyAsync(u => u.Email == email))
            return new CreateRepResult { ErrorMessage = "Email is already taken." };

        var user = new User
        {
            Username = username,
            Email = email,
            PasswordHash = HashPassword(dto.Password),
            Role = UserRole.CustomerRep,
            IsActive = true
        };
        _db.Users.Add(user);
        await _db.SaveChangesAsync();

        return new CreateRepResult
        {
            Data = new CreateRepResponseDto
            {
                Id = user.Id,
                Username = user.Username,
                Email = user.Email
            }
        };
    }

    private static string RoleToClaimValue(UserRole role)
    {
        return role switch
        {
            UserRole.Admin => "admin",
            UserRole.CustomerRep => "customer_rep",
            UserRole.Vip => "vip",
            UserRole.EndUser => "end_user",
            _ => throw new ArgumentOutOfRangeException(nameof(role), role, "Unknown user role.")
        };
    }

    private static bool CanCustomizeDisplayNameColor(UserRole role)
    {
        return role is UserRole.Vip or UserRole.CustomerRep or UserRole.Admin;
    }

    private static string? NormalizeColor(string? color)
    {
        if (color == null)
            return null;

        var trimmed = color.Trim();
        if (trimmed.Length == 0)
            return null;
        var upper = trimmed.ToUpperInvariant();
        if (AnimatedPresets.Contains(upper))
            return upper;
        if (!HexColorRegex.IsMatch(trimmed))
            return null;
        return upper;
    }

    private string ResolveAvatarDirectoryPath()
    {
        var webRoot = _environment.WebRootPath;
        if (string.IsNullOrWhiteSpace(webRoot))
            webRoot = Path.Combine(_environment.ContentRootPath, "wwwroot");
        return Path.Combine(webRoot, "uploads", "avatars");
    }

    private static string CreateLocalAvatarUrl(string fileName)
    {
        return $"/uploads/avatars/{fileName}";
    }

    private async Task DeleteAvatarIfLocalAsync(string? avatarUrl)
    {
        if (string.IsNullOrWhiteSpace(avatarUrl))
            return;
        if (!avatarUrl.StartsWith("/uploads/avatars/", StringComparison.OrdinalIgnoreCase))
            return;

        var fileName = Path.GetFileName(avatarUrl);
        if (string.IsNullOrWhiteSpace(fileName))
            return;

        var filePath = Path.Combine(ResolveAvatarDirectoryPath(), fileName);
        if (!File.Exists(filePath))
            return;

        await Task.Run(() => File.Delete(filePath));
    }
}
