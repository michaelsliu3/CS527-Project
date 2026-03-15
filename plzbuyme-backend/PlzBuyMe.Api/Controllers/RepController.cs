using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PlzBuyMe.Api.Data;
using PlzBuyMe.Api.Dtos.Rep;
using PlzBuyMe.Api.Models;
using PlzBuyMe.Api.Services;

namespace PlzBuyMe.Api.Controllers;

[ApiController]
[Route("api/rep")]
[Authorize(Policy = "RepOnly")]
public class RepController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IAuthService _authService;

    public RepController(AppDbContext db, IAuthService authService)
    {
        _db = db;
        _authService = authService;
    }

    [HttpGet("users")]
    public async Task<IActionResult> GetUsers(
        [FromQuery] string? search,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        page = Math.Max(page, 1);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var query = _db.Users
            .AsNoTracking()
            .Where(u => u.Role == UserRole.EndUser);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLowerInvariant();
            query = query.Where(u =>
                u.Username.ToLower().Contains(term) ||
                u.Email.ToLower().Contains(term));
        }

        var totalCount = await query.CountAsync();
        var items = await query
            .OrderBy(u => u.Id)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(u => new
            {
                u.Id,
                u.Username,
                u.Email,
                u.IsActive,
                u.CreatedAt
            })
            .ToListAsync();

        return Ok(new
        {
            items,
            totalCount,
            page,
            pageSize
        });
    }

    [HttpPut("users/{id:int}")]
    public async Task<IActionResult> EditUser(int id, [FromBody] EditUserDto dto)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == id);
        if (user == null)
            return NotFound();
        if (user.Role != UserRole.EndUser)
            return BadRequest("Only end-users can be edited.");

        var username = dto.Username.Trim();
        var email = dto.Email.Trim();

        var usernameTaken = await _db.Users.AnyAsync(u => u.Id != id && u.Username == username);
        if (usernameTaken)
            return BadRequest("Username is already taken.");

        var emailTaken = await _db.Users.AnyAsync(u => u.Id != id && u.Email == email);
        if (emailTaken)
            return BadRequest("Email is already taken.");

        user.Username = username;
        user.Email = email;
        await _db.SaveChangesAsync();

        return NoContent();
    }

    [HttpDelete("users/{id:int}")]
    public async Task<IActionResult> DeleteUser(int id)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == id);
        if (user == null)
            return NotFound();
        if (user.Role != UserRole.EndUser)
            return BadRequest("Only end-users can be deleted.");

        user.IsActive = false;
        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpPost("users/{id:int}/reset-password")]
    public async Task<IActionResult> ResetPassword(int id, [FromBody] ResetPasswordDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.NewPassword))
            return BadRequest("New password is required.");

        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == id);
        if (user == null)
            return NotFound();
        if (user.Role != UserRole.EndUser)
            return BadRequest("Only end-users can have their password reset via this endpoint.");

        user.PasswordHash = _authService.HashPassword(dto.NewPassword);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("bids/{id:int}")]
    public async Task<IActionResult> DeleteBid(int id)
    {
        var bid = await _db.Bids
            .Include(b => b.Item)
            .FirstOrDefaultAsync(b => b.Id == id);

        if (bid == null)
            return NotFound();

        var item = bid.Item;

        _db.Bids.Remove(bid);
        await _db.SaveChangesAsync();

        var highestRemaining = await _db.Bids
            .Where(b => b.ItemId == item.Id)
            .OrderByDescending(b => b.Amount)
            .FirstOrDefaultAsync();

        item.CurrentPrice = highestRemaining?.Amount ?? item.InitialPrice;
        await _db.SaveChangesAsync();

        return NoContent();
    }

    [HttpDelete("auctions/{id:int}")]
    public async Task<IActionResult> DeleteAuction(int id)
    {
        var item = await _db.Items.FirstOrDefaultAsync(i => i.Id == id);
        if (item == null)
            return NotFound();

        item.Status = ItemStatus.Removed;
        await _db.SaveChangesAsync();
        return NoContent();
    }
}

