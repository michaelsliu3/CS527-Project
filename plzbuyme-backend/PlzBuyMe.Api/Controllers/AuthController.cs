using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PlzBuyMe.Api.Dtos.Auth;
using PlzBuyMe.Api.Services;

namespace PlzBuyMe.Api.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private const long MaxAvatarUploadBytes = 2 * 1024 * 1024;
    private readonly IAuthService _authService;

    public AuthController(IAuthService authService)
    {
        _authService = authService;
    }

    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] RegisterDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Username) || string.IsNullOrWhiteSpace(dto.Email) || string.IsNullOrWhiteSpace(dto.Password))
            return BadRequest(new AuthErrorDto { Code = "ValidationError", Message = "Username, email, and password are required." });
        if (dto.Password.Length < 6)
            return BadRequest(new AuthErrorDto { Code = "ValidationError", Message = "Password must be at least 6 characters." });
        var atIndex = dto.Email.Trim().IndexOf('@');
        if (atIndex <= 0 || atIndex == dto.Email.Trim().Length - 1)
            return BadRequest(new AuthErrorDto { Code = "ValidationError", Message = "Email must be a valid email address." });
        var result = await _authService.RegisterAsync(dto);
        if (!result.Success && result.FailureReason.HasValue)
            return BadRequest(AuthControllerHelper.ToErrorDto(result.FailureReason.Value));
        return Ok(result.Data);
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Username) || string.IsNullOrWhiteSpace(dto.Password))
            return BadRequest(new AuthErrorDto { Code = "ValidationError", Message = "Username or email, and password, are required." });
        var result = await _authService.LoginAsync(dto);
        if (!result.Success && result.FailureReason.HasValue)
            return Unauthorized(AuthControllerHelper.ToErrorDto(result.FailureReason.Value));
        return Ok(result.Data);
    }

    [Authorize]
    [HttpGet("profile")]
    public async Task<IActionResult> GetProfile()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out var userId))
            return Forbid();
        var profile = await _authService.GetProfileAsync(userId);
        if (profile == null)
            return NotFound();
        return Ok(profile);
    }

    [Authorize]
    [HttpPost("profile/avatar")]
    [RequestSizeLimit(MaxAvatarUploadBytes)]
    [RequestFormLimits(MultipartBodyLengthLimit = MaxAvatarUploadBytes)]
    public async Task<IActionResult> UploadAvatar([FromForm] IFormFile? avatar)
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out var userId))
            return Forbid();

        var result = await _authService.UploadAvatarAsync(userId, avatar);
        if (result.NotFound)
            return NotFound();
        if (result.ValidationError != null)
            return BadRequest(new AuthErrorDto { Code = "ValidationError", Message = result.ValidationError });

        return Ok(new UpdateAvatarDto { AvatarUrl = result.AvatarUrl });
    }

    [Authorize]
    [HttpDelete("profile/avatar")]
    public async Task<IActionResult> RemoveAvatar()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out var userId))
            return Forbid();

        var result = await _authService.RemoveAvatarAsync(userId);
        if (result.NotFound)
            return NotFound();

        return Ok(new UpdateAvatarDto { AvatarUrl = result.AvatarUrl });
    }

    [Authorize]
    [HttpPatch("profile/display-name-color")]
    public async Task<IActionResult> UpdateDisplayNameColor([FromBody] UpdateDisplayNameColorDto? dto)
    {
        if (dto == null)
            return BadRequest(new AuthErrorDto { Code = "ValidationError", Message = "Request body is required." });

        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out var userId))
            return Forbid();

        var result = await _authService.UpdateDisplayNameColorAsync(userId, dto.DisplayNameColor);
        if (result.NotFound)
            return NotFound();
        if (result.Forbidden)
            return Forbid();
        if (result.ValidationError != null)
            return BadRequest(new AuthErrorDto { Code = "ValidationError", Message = result.ValidationError });

        return Ok(new UpdateDisplayNameColorDto
        {
            DisplayNameColor = result.DisplayNameColor
        });
    }

    [Authorize]
    [HttpDelete("profile")]
    public async Task<IActionResult> DeleteProfile()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out var userId))
            return Forbid();
        var deleted = await _authService.DeleteProfileAsync(userId);
        if (!deleted)
            return NotFound();
        return NoContent();
    }
}
