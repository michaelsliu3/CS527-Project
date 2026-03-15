using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PlzBuyMe.Api.Dtos.Rep;
using PlzBuyMe.Api.Services;

namespace PlzBuyMe.Api.Controllers;

[ApiController]
[Route("api/rep")]
[Authorize(Policy = "RepOnly")]
public class RepController : ControllerBase
{
    private readonly IRepService _repService;

    public RepController(IRepService repService)
    {
        _repService = repService;
    }

    [HttpGet("users")]
    public async Task<IActionResult> GetUsers(
        [FromQuery] string? search,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        var result = await _repService.GetUsersAsync(search, page, pageSize);
        return Ok(result);
    }

    [HttpPut("users/{id:int}")]
    public async Task<IActionResult> EditUser(int id, [FromBody] EditUserDto? dto)
    {
        if (dto == null)
            return BadRequest("Request body is required.");

        var (notFound, error) = await _repService.EditUserAsync(id, dto);
        if (notFound)
            return NotFound();
        if (error != null)
            return BadRequest(error);
        return NoContent();
    }

    [HttpDelete("users/{id:int}")]
    public async Task<IActionResult> DeleteUser(int id)
    {
        var (notFound, error) = await _repService.DeleteUserAsync(id);
        if (notFound)
            return NotFound();
        if (error != null)
            return BadRequest(error);
        return NoContent();
    }

    [HttpPost("users/{id:int}/reset-password")]
    public async Task<IActionResult> ResetPassword(int id, [FromBody] ResetPasswordDto? dto)
    {
        if (dto == null)
            return BadRequest("Request body is required.");

        var (notFound, error) = await _repService.ResetPasswordAsync(id, dto);
        if (notFound)
            return NotFound();
        if (error != null)
            return BadRequest(error);
        return NoContent();
    }

    [HttpDelete("bids/{id:int}")]
    public async Task<IActionResult> DeleteBid(int id)
    {
        var deleted = await _repService.DeleteBidAsync(id);
        if (!deleted)
            return NotFound();
        return NoContent();
    }

    [HttpDelete("auctions/{id:int}")]
    public async Task<IActionResult> DeleteAuction(int id)
    {
        var deleted = await _repService.DeleteAuctionAsync(id);
        if (!deleted)
            return NotFound();
        return NoContent();
    }
}

