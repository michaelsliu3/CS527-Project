using PlzBuyMe.Api.Dtos.Auth;
using PlzBuyMe.Api.Models;

namespace PlzBuyMe.Api.Services;

public interface IAuthService
{
    string HashPassword(string password);
    bool VerifyPassword(string password, string hash);
    string GenerateJwt(User user);
    Task<AuthResponseDto?> RegisterAsync(RegisterDto dto);
    Task<AuthResponseDto?> LoginAsync(LoginDto dto);
    Task<ProfileDto?> GetProfileAsync(int userId);
    Task<bool> DeleteProfileAsync(int userId);
}
