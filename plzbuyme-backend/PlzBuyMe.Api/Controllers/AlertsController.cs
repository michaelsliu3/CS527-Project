using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PlzBuyMe.Api.Dtos.Alerts;
using PlzBuyMe.Api.Services;

namespace PlzBuyMe.Api.Controllers;

[ApiController]
[Route("api/alerts")]
[Authorize(Policy = "EndUser")]
public class AlertsController : ControllerBase
{
    private readonly IAlertService _alertService;

    public AlertsController(IAlertService alertService)
    {
        _alertService = alertService;
    }

    [HttpGet]
    public async Task<IActionResult> List()
    {
        var userId = GetCurrentUserId();
        if (userId == null)
            return Forbid();
        var alerts = await _alertService.GetAlertsForUserAsync(userId.Value);
        return Ok(alerts);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateAlertDto dto)
    {
        var userId = GetCurrentUserId();
        if (userId == null)
            return Forbid();
        var result = await _alertService.CreateAlertAsync(userId.Value, dto);
        if (result.ErrorMessage != null)
            return BadRequest(result.ErrorMessage);
        return Ok(result.Alert);
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var userId = GetCurrentUserId();
        if (userId == null)
            return Forbid();
        var deleted = await _alertService.DeleteAlertAsync(id, userId.Value);
        if (!deleted)
            return NotFound();
        return NoContent();
    }

    private int? GetCurrentUserId()
    {
        var claim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return int.TryParse(claim, out var id) ? id : null;
    }
}
