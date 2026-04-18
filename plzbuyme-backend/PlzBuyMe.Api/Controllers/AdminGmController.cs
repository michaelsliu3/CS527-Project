using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PlzBuyMe.Api.Dtos.Admin.Gm;
using PlzBuyMe.Api.Services;

namespace PlzBuyMe.Api.Controllers;

[ApiController]
[Route("api/admin/gm")]
[Authorize(Policy = "AdminOnly")]
public class AdminGmController : ControllerBase
{
    private const int DefaultManifestSearchLimit = 12;
    private readonly IGmToolsService _gmToolsService;

    public AdminGmController(IGmToolsService gmToolsService)
    {
        _gmToolsService = gmToolsService;
    }

    [HttpGet("manifest/cars")]
    public async Task<IActionResult> SearchManifestCars([FromQuery] string? q, [FromQuery] int? limit)
    {
        var (error, data) = await _gmToolsService.SearchManifestCarsAsync(
            GetAdminUserId(),
            q,
            limit ?? DefaultManifestSearchLimit);
        if (error != null)
            return BadRequest(error);
        return Ok(data);
    }

    [HttpPost("auctions/seed")]
    public async Task<IActionResult> SeedAuctions([FromBody] GmSeedAuctionsDto? dto)
    {
        if (dto == null)
            return BadRequest("Request body is required.");

        var (error, data) = await _gmToolsService.SeedAuctionsAsync(GetAdminUserId(), dto);
        if (error != null)
            return BadRequest(error);
        return Ok(data);
    }

    [HttpPost("auctions/seed-from-manifest")]
    public async Task<IActionResult> SeedAuctionsFromManifest([FromBody] GmSeedManifestAuctionsDto? dto)
    {
        if (dto == null)
            return BadRequest("Request body is required.");

        var (error, data) = await _gmToolsService.SeedAuctionsFromManifestAsync(GetAdminUserId(), dto);
        if (error != null)
            return BadRequest(error);
        return Ok(data);
    }

    [HttpPost("users/bulk")]
    public async Task<IActionResult> BulkUsers([FromBody] GmBulkUsersDto? dto)
    {
        if (dto == null)
            return BadRequest("Request body is required.");

        var (error, data) = await _gmToolsService.BulkCreateUsersAsync(GetAdminUserId(), dto);
        if (error != null)
            return BadRequest(error);
        return Ok(data);
    }

    [HttpPost("questions/seed")]
    public async Task<IActionResult> SeedQuestions([FromBody] GmSeedQuestionsDto? dto)
    {
        if (dto == null)
            return BadRequest("Request body is required.");

        var (error, data) = await _gmToolsService.SeedQuestionsAsync(GetAdminUserId(), dto);
        if (error != null)
            return BadRequest(error);
        return Ok(data);
    }

    [HttpPost("wallets/top-up")]
    public async Task<IActionResult> WalletTopUp([FromBody] GmWalletTopUpDto? dto)
    {
        if (dto == null)
            return BadRequest("Request body is required.");

        var (error, data) = await _gmToolsService.WalletTopUpAsync(GetAdminUserId(), dto);
        if (error != null)
            return BadRequest(error);
        return Ok(data);
    }

    [HttpPost("alerts/sample")]
    public async Task<IActionResult> SampleAlerts([FromBody] GmSampleAlertsDto? dto)
    {
        if (dto == null)
            return BadRequest("Request body is required.");

        var (error, data) = await _gmToolsService.SeedSampleAlertsAsync(GetAdminUserId(), dto);
        if (error != null)
            return BadRequest(error);
        return Ok(data);
    }

    [HttpPost("notifications/sample")]
    public async Task<IActionResult> SampleNotifications([FromBody] GmSampleNotificationsDto? dto)
    {
        if (dto == null)
            return BadRequest("Request body is required.");

        var (error, data) = await _gmToolsService.SeedSampleNotificationsAsync(GetAdminUserId(), dto);
        if (error != null)
            return BadRequest(error);
        return Ok(data);
    }

    [HttpPost("fixtures/sold-history")]
    public async Task<IActionResult> SeedSoldHistoryFixture()
    {
        var (error, data) = await _gmToolsService.SeedSoldHistoryFixtureAsync(GetAdminUserId());
        if (error != null)
            return BadRequest(error);
        return Ok(data);
    }

    [HttpPost("auctions/seed-sold")]
    public async Task<IActionResult> SeedSoldAuctions([FromBody] GmSeedSoldAuctionsDto? dto)
    {
        if (dto == null)
            return BadRequest("Request body is required.");

        var (error, data) = await _gmToolsService.SeedSoldAuctionsAsync(GetAdminUserId(), dto);
        if (error != null)
            return BadRequest(error);
        return Ok(data);
    }

    [HttpPost("auctions/close-active")]
    public async Task<IActionResult> BulkCloseActiveAuctions([FromBody] GmBulkCloseAuctionsDto? dto)
    {
        if (dto == null)
            return BadRequest("Request body is required.");

        var (error, data) = await _gmToolsService.BulkCloseActiveAuctionsAsync(GetAdminUserId(), dto);
        if (error != null)
            return BadRequest(error);
        return Ok(data);
    }

    [HttpPost("auctions/run-close-sweep")]
    public async Task<IActionResult> RunCloseSweep()
    {
        var (error, data) = await _gmToolsService.RunCloseSweepAsync(GetAdminUserId());
        if (error != null)
            return BadRequest(error);
        return Ok(data);
    }

    [HttpPost("auctions/delete-all")]
    public async Task<IActionResult> DeleteAllAuctions()
    {
        var (error, data) = await _gmToolsService.DeleteAllAuctionsAsync(GetAdminUserId());
        if (error != null)
            return BadRequest(error);
        return Ok(data);
    }

    [HttpPost("categories")]
    public async Task<IActionResult> CreateCategory([FromBody] GmCreateCategoryDto? dto)
    {
        if (dto == null)
            return BadRequest("Request body is required.");

        var (error, data) = await _gmToolsService.CreateCategoryAsync(GetAdminUserId(), dto);
        if (error != null)
            return BadRequest(error);
        return Ok(data);
    }

    [HttpPatch("categories/{id:int}")]
    public async Task<IActionResult> UpdateCategory(int id, [FromBody] GmUpdateCategoryDto? dto)
    {
        if (dto == null)
            return BadRequest("Request body is required.");

        var (error, data) = await _gmToolsService.UpdateCategoryAsync(GetAdminUserId(), id, dto);
        if (error != null)
            return BadRequest(error);
        return Ok(data);
    }

    [HttpDelete("categories/{id:int}")]
    public async Task<IActionResult> DeleteCategory(int id)
    {
        var (error, data) = await _gmToolsService.DeleteCategoryAsync(GetAdminUserId(), id);
        if (error != null)
            return BadRequest(error);
        return Ok(data);
    }

    private int GetAdminUserId()
    {
        return int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
    }
}
