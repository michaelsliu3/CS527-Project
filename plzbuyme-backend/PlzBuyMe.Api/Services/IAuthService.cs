using PlzBuyMe.Api.Dtos.Admin;
using PlzBuyMe.Api.Dtos.Auth;
using PlzBuyMe.Api.Models;

namespace PlzBuyMe.Api.Services;

public interface IAuthService
{
    string HashPassword(string password);
    bool VerifyPassword(string password, string hash);
    string GenerateJwt(User user);
    Task<RegisterResult> RegisterAsync(RegisterDto dto);
    Task<LoginResult> LoginAsync(LoginDto dto);
    Task<ProfileDto?> GetProfileAsync(int userId);
    Task<bool> DeleteProfileAsync(int userId);
    Task<CreateRepResult> CreateRepAsync(CreateRepDto dto);
}
