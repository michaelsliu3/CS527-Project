using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PlzBuyMe.Api.Dtos.Admin;
using PlzBuyMe.Api.Services;

namespace PlzBuyMe.Api.Controllers;

[ApiController]
[Route("api/admin")]
[Authorize(Policy = "AdminOnly")]
public class AdminController : ControllerBase
{
    private readonly IAuthService _authService;
    private readonly IReportService _reportService;

    public AdminController(IAuthService authService, IReportService reportService)
    {
        _authService = authService;
        _reportService = reportService;
    }

    [HttpPost("reps")]
    public async Task<IActionResult> CreateRep([FromBody] CreateRepDto? dto)
    {
        if (dto == null)
            return BadRequest("Request body is required.");

        var result = await _authService.CreateRepAsync(dto);
        if (!result.Success)
            return BadRequest(result.ErrorMessage);
        return StatusCode(201, result.Data);
    }

    [HttpGet("reports/earnings")]
    public async Task<IActionResult> GetTotalEarnings()
    {
        var total = await _reportService.GetTotalEarningsAsync();
        return Ok(new EarningsReportDto { Total = total });
    }

    /// <summary>Per-item earnings (each sold item's title + price). Complements total earnings and earnings-by-type.</summary>
    [HttpGet("reports/earnings-by-item")]
    public async Task<IActionResult> GetEarningsByItem()
    {
        var items = await _reportService.GetEarningsByItemAsync();
        return Ok(items);
    }

    [HttpGet("reports/earnings-by-type")]
    public async Task<IActionResult> GetEarningsByType()
    {
        var items = await _reportService.GetEarningsByTypeAsync();
        return Ok(items);
    }

    [HttpGet("reports/earnings-by-user")]
    public async Task<IActionResult> GetEarningsByUser()
    {
        var items = await _reportService.GetEarningsByUserAsync();
        return Ok(items);
    }

    [HttpGet("reports/best-selling")]
    public async Task<IActionResult> GetBestSelling([FromQuery] int top = 10)
    {
        if (top < 1 || top > 100)
            return BadRequest("top must be between 1 and 100.");
        var items = await _reportService.GetBestSellingItemsAsync(top);
        return Ok(items);
    }

    [HttpGet("reports/best-buyers")]
    public async Task<IActionResult> GetBestBuyers([FromQuery] int top = 10)
    {
        if (top < 1 || top > 100)
            return BadRequest("top must be between 1 and 100.");
        var items = await _reportService.GetBestBuyersAsync(top);
        return Ok(items);
    }
}
