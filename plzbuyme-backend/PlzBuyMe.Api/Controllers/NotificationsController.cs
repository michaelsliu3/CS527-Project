using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PlzBuyMe.Api.Dtos.Notifications;
using PlzBuyMe.Api.Services;

namespace PlzBuyMe.Api.Controllers;

[ApiController]
[Route("api/notifications")]
[Authorize]
public class NotificationsController : ControllerBase
{
    private readonly INotificationService _notificationService;

    public NotificationsController(INotificationService notificationService)
    {
        _notificationService = notificationService;
    }

    [HttpGet]
    public async Task<IActionResult> List()
    {
        var userId = GetCurrentUserId();
        if (userId == null)
            return Forbid();
        var result = await _notificationService.GetNotificationsForUserAsync(userId.Value);
        return Ok(new { items = result.Items, unreadCount = result.UnreadCount });
    }

    [HttpPatch("{id:int}/read")]
    public async Task<IActionResult> MarkRead(int id)
    {
        var userId = GetCurrentUserId();
        if (userId == null)
            return Forbid();
        var updated = await _notificationService.MarkAsReadAsync(id, userId.Value);
        if (!updated)
            return NotFound();
        return NoContent();
    }

    private int? GetCurrentUserId()
    {
        var claim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return int.TryParse(claim, out var id) ? id : null;
    }
}
