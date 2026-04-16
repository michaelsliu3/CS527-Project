using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PlzBuyMe.Api.Dtos.Auctions;
using PlzBuyMe.Api.Services;

namespace PlzBuyMe.Api.Controllers;

[ApiController]
[Route("api/auctions")]
public class AuctionsController : ControllerBase
{
    private readonly IAuctionService _auctionService;

    public AuctionsController(IAuctionService auctionService)
    {
        _auctionService = auctionService;
    }

    [HttpGet("browse")]
    public async Task<IActionResult> Search([FromQuery] SearchQueryDto query)
    {
        var result = await _auctionService.SearchAsync(query);
        return Ok(result);
    }

    [HttpGet("view/{id:int}")]
    public async Task<IActionResult> GetById(int id)
    {
        var item = await _auctionService.GetByIdAsync(id);
        if (item == null)
            return NotFound();
        return Ok(item);
    }

    [Authorize(Policy = "EndUser")]
    [HttpPost("create")]
    public async Task<IActionResult> Create([FromBody] CreateAuctionDto dto)
    {
        var userId = GetCurrentUserId();
        if (userId == null)
            return Forbid();
        if (string.IsNullOrWhiteSpace(dto.Title))
            return BadRequest("Title is required.");
        if (dto.CategoryIds.Count == 0 || dto.CategoryIds.Any(id => id <= 0))
            return BadRequest("Valid category IDs are required.");
        if (dto.InitialPrice < 0 || dto.BidIncrement <= 0 || dto.ReservePrice < 0)
            return BadRequest("Invalid prices.");
        if (dto.CloseDateTime <= DateTime.UtcNow)
            return BadRequest("Close date must be in the future.");
        try
        {
            var created = await _auctionService.CreateAuctionAsync(dto, userId.Value);
            if (created == null)
                return BadRequest("Category not found.");
            return CreatedAtAction(nameof(GetById), new { id = created.Id }, created);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ex.Message);
        }
    }

    [Authorize(Policy = "EndUser")]
    [HttpPost("{id:int}/bids/place")]
    public async Task<IActionResult> PlaceBid(int id, [FromBody] PlaceBidDto dto)
    {
        var userId = GetCurrentUserId();
        if (userId == null)
            return Forbid();
        try
        {
            await _auctionService.PlaceBidAsync(id, userId.Value, dto.Amount);
            return Ok();
        }
        catch (InvalidOperationException ex) when (ex.Message.Contains("not found"))
        {
            return NotFound();
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ex.Message);
        }
    }

    [Authorize(Policy = "EndUser")]
    [HttpPost("{id:int}/autobids/set")]
    public async Task<IActionResult> SetAutoBid(int id, [FromBody] SetAutoBidDto dto)
    {
        var userId = GetCurrentUserId();
        if (userId == null)
            return Forbid();
        try
        {
            await _auctionService.SetAutoBidAsync(id, userId.Value, dto.UpperLimit);
            return Ok();
        }
        catch (InvalidOperationException ex) when (ex.Message.Contains("not found"))
        {
            return NotFound();
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ex.Message);
        }
    }

    [Authorize(Policy = "EndUser")]
    [HttpGet("mine")]
    public async Task<IActionResult> GetMine([FromQuery] string? status)
    {
        var userId = GetCurrentUserId();
        if (userId == null)
            return Forbid();
        var items = await _auctionService.GetMineAsync(userId.Value, status);
        return Ok(items);
    }

    [HttpGet("view/{id:int}/similar")]
    public async Task<IActionResult> GetSimilar(int id, [FromQuery] int limit = 10)
    {
        var items = await _auctionService.GetSimilarAsync(id, Math.Clamp(limit, 1, 50));
        return Ok(items);
    }

    [Authorize]
    [HttpGet("history/{userId:int}")]
    public async Task<IActionResult> GetHistory(int userId)
    {
        if (!CanViewUserHistory(userId))
            return Forbid();

        var items = await _auctionService.GetHistoryAsync(userId);
        return Ok(items);
    }

    [Authorize]
    [HttpGet("history/users/{userId:int}")]
    public async Task<IActionResult> GetHistoryForUser(int userId)
    {
        if (!CanViewUserHistory(userId))
            return Forbid();

        var items = await _auctionService.GetHistoryAsync(userId);
        return Ok(items);
    }

    [HttpGet("field-values")]
    public async Task<IActionResult> GetFieldValues(
        [FromQuery] string fieldName,
        [FromQuery] int? categoryId,
        [FromQuery] string? prefix,
        [FromQuery] int maxCount = 50)
    {
        if (string.IsNullOrWhiteSpace(fieldName))
            return BadRequest("fieldName is required.");
        var values = await _auctionService.GetFieldValuesAsync(
            fieldName.Trim(),
            categoryId,
            string.IsNullOrWhiteSpace(prefix) ? null : prefix?.Trim(),
            Math.Clamp(maxCount, 1, 100));
        return Ok(values);
    }

    private int? GetCurrentUserId()
    {
        var claim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return int.TryParse(claim, out var id) ? id : null;
    }

    private bool CanViewUserHistory(int targetUserId)
    {
        var currentUserId = GetCurrentUserId();
        if (currentUserId == null)
            return false;

        if (currentUserId.Value == targetUserId)
            return true;

        return User.IsInRole("admin") || User.IsInRole("customer_rep");
    }
}
