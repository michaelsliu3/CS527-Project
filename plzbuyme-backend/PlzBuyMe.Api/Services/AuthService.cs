using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;
using PlzBuyMe.Api.Data;
using PlzBuyMe.Api.Dtos.Auth;
using PlzBuyMe.Api.Models;

namespace PlzBuyMe.Api.Services;

public class AuthService : IAuthService
{
    private readonly AppDbContext _db;
    private readonly IConfiguration _config;

    public AuthService(AppDbContext db, IConfiguration config)
    {
        _db = db;
        _config = config;
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
            new(ClaimTypes.Name, user.Username),
            new(ClaimTypes.Email, user.Email),
            new(ClaimTypes.Role, RoleToClaimValue(user.Role))
        };

        var token = new JwtSecurityToken(
            issuer: jwtSection["Issuer"],
            audience: jwtSection["Audience"],
            claims: claims,
            expires: DateTime.UtcNow.AddMinutes(expiresMinutes),
            signingCredentials: credentials);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    public async Task<AuthResponseDto?> RegisterAsync(RegisterDto dto)
    {
        var username = dto.Username.Trim();
        var email = dto.Email.Trim();
        if (await _db.Users.AnyAsync(u => u.Username == username))
            return null;
        if (await _db.Users.AnyAsync(u => u.Email == email))
            return null;

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
        return new AuthResponseDto
        {
            Token = token,
            Username = user.Username,
            Email = user.Email,
            Role = RoleToClaimValue(user.Role),
            UserId = user.Id
        };
    }

    public async Task<AuthResponseDto?> LoginAsync(LoginDto dto)
    {
        var login = dto.Username.Trim();
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Username == login || u.Email == login);
        if (user == null)
            return null;
        if (!VerifyPassword(dto.Password, user.PasswordHash))
            return null;
        if (!user.IsActive)
            return null;

        var token = GenerateJwt(user);
        return new AuthResponseDto
        {
            Token = token,
            Username = user.Username,
            Email = user.Email,
            Role = RoleToClaimValue(user.Role),
            UserId = user.Id
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
            Email = user.Email,
            Role = RoleToClaimValue(user.Role)
        };
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

    private static string RoleToClaimValue(UserRole role)
    {
        return role switch
        {
            UserRole.Admin => "admin",
            UserRole.CustomerRep => "customer_rep",
            UserRole.EndUser => "end_user",
            _ => throw new ArgumentOutOfRangeException(nameof(role), role, "Unknown user role.")
        };
    }
}
