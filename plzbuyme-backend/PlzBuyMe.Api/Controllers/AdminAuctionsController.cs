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

        var adminId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
        var (error, detail) = await _auctionService.AdminPatchAuctionAsync(id, dto, adminId);
        if (error != null)
            return BadRequest(error);
        return Ok(detail);
    }
}
