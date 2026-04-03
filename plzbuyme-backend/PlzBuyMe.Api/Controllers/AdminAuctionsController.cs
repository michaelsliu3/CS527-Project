using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PlzBuyMe.Api.Dtos.Admin;
using PlzBuyMe.Api.Services;

namespace PlzBuyMe.Api.Controllers;

[ApiController]
[Route("api/admin/auctions")]
[Authorize(Policy = "AdminOnly")]
public class AdminAuctionsController : ControllerBase
{
    private readonly IAuctionService _auctionService;

    public AdminAuctionsController(IAuctionService auctionService)
    {
        _auctionService = auctionService;
    }

    [HttpPatch("{id:int}")]
    public async Task<IActionResult> Patch(int id, [FromBody] AdminPatchAuctionDto? dto)
    {
        if (dto == null)
            return BadRequest("Request body is required.");
        if (dto.AdditionalCategoryIds is { Count: > 0 } && dto.AdditionalCategoryIds.Any(v => v <= 0))
            return BadRequest("Additional categories must be valid IDs.");

        var adminId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
        var (error, detail) = await _auctionService.AdminPatchAuctionAsync(id, dto, adminId);
        if (error != null)
            return BadRequest(error);
        return Ok(detail);
    }
}
