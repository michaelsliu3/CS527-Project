using Microsoft.EntityFrameworkCore;
using PlzBuyMe.Api.Data;
using PlzBuyMe.Api.Dtos;
using PlzBuyMe.Api.Dtos.Rep;
using PlzBuyMe.Api.Models;
using PlzBuyMe.Api.Services;

namespace PlzBuyMe.Api.Services;

public class RepService : IRepService
{
    private readonly AppDbContext _db;
    private readonly IAuthService _authService;

    public RepService(AppDbContext db, IAuthService authService)
    {
        _db = db;
        _authService = authService;
    }

    public async Task<PaginatedResultDto<UserSummaryDto>> GetUsersAsync(string? search, int page, int pageSize, bool isAdmin)
    {
        page = Math.Max(page, 1);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var query = _db.Users
            .AsNoTracking();

        if (!isAdmin)
        {
            query = query.Where(u => u.Role == UserRole.EndUser);
        }

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
            .Select(u => new UserSummaryDto
            {
                Id = u.Id,
                Username = u.Username,
                Email = u.Email,
                Role = ToRoleValue(u.Role),
                IsActive = u.IsActive,
                CreatedAt = u.CreatedAt
            })
            .ToListAsync();

        return new PaginatedResultDto<UserSummaryDto>
        {
            Items = items,
            TotalCount = totalCount,
            Page = page,
            PageSize = pageSize
        };
    }

    public async Task<(bool NotFound, bool Forbidden, string? ErrorMessage)> EditUserAsync(int id, EditUserDto dto, bool isAdmin)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == id);
        if (user == null)
            return (true, false, null);
        if (!isAdmin && user.Role != UserRole.EndUser)
            return (false, false, "Only end-users can be edited.");

        var username = dto.Username.Trim();
        var email = dto.Email.Trim();

        if (string.IsNullOrWhiteSpace(username))
            return (false, false, "Username is required.");
        if (string.IsNullOrWhiteSpace(email))
            return (false, false, "Email is required.");

        var usernameTaken = await _db.Users.AnyAsync(u => u.Id != id && u.Username == username);
        if (usernameTaken)
            return (false, false, "Username is already taken.");

        var emailTaken = await _db.Users.AnyAsync(u => u.Id != id && u.Email == email);
        if (emailTaken)
            return (false, false, "Email is already taken.");

        var roleText = dto.Role?.Trim();
        if (!string.IsNullOrEmpty(roleText))
        {
            if (!isAdmin)
                return (false, true, null);

            if (!TryParseRole(roleText, out var parsedRole))
                return (false, false, "Invalid role. Allowed values: User, Rep, Admin.");

            user.Role = parsedRole;
        }

        user.Username = username;
        user.Email = email;
        await _db.SaveChangesAsync();

        return (false, false, null);
    }

    public async Task<(bool NotFound, string? ErrorMessage)> DeleteUserAsync(int id)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == id);
        if (user == null)
            return (true, null);
        if (user.Role != UserRole.EndUser)
            return (false, "Only end-users can be deleted.");

        user.IsActive = false;
        await _db.SaveChangesAsync();
        return (false, null);
    }

    public async Task<(bool NotFound, string? ErrorMessage)> ResetPasswordAsync(int id, ResetPasswordDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.NewPassword))
            return (false, "New password is required.");

        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == id);
        if (user == null)
            return (true, null);
        if (user.Role != UserRole.EndUser)
            return (false, "Only end-users can have their password reset via this endpoint.");

        user.PasswordHash = _authService.HashPassword(dto.NewPassword);
        await _db.SaveChangesAsync();
        return (false, null);
    }

    public async Task<bool> DeleteBidAsync(int bidId)
    {
        var bid = await _db.Bids
            .Include(b => b.Item)
            .FirstOrDefaultAsync(b => b.Id == bidId);

        if (bid == null)
            return false;

        var item = bid.Item;

        _db.Bids.Remove(bid);
        await _db.SaveChangesAsync();

        var highestRemaining = await _db.Bids
            .Where(b => b.ItemId == item.Id)
            .OrderByDescending(b => b.Amount)
            .FirstOrDefaultAsync();

        item.CurrentPrice = highestRemaining?.Amount ?? item.InitialPrice;
        await _db.SaveChangesAsync();

        return true;
    }

    public async Task<bool> DeleteAuctionAsync(int auctionId)
    {
        var item = await _db.Items.FirstOrDefaultAsync(i => i.Id == auctionId);
        if (item == null)
            return false;

        item.Status = ItemStatus.Removed;
        await _db.SaveChangesAsync();
        return true;
    }

    private static string ToRoleValue(UserRole role)
    {
        return role switch
        {
            UserRole.Admin => "admin",
            UserRole.CustomerRep => "customer_rep",
            UserRole.EndUser => "end_user",
            _ => "end_user"
        };
    }

    private static bool TryParseRole(string roleText, out UserRole role)
    {
        role = roleText.ToLowerInvariant() switch
        {
            "user" => UserRole.EndUser,
            "end_user" => UserRole.EndUser,
            "rep" => UserRole.CustomerRep,
            "customer_rep" => UserRole.CustomerRep,
            "admin" => UserRole.Admin,
            _ => default
        };

        return roleText.Equals("user", StringComparison.OrdinalIgnoreCase)
            || roleText.Equals("end_user", StringComparison.OrdinalIgnoreCase)
            || roleText.Equals("rep", StringComparison.OrdinalIgnoreCase)
            || roleText.Equals("customer_rep", StringComparison.OrdinalIgnoreCase)
            || roleText.Equals("admin", StringComparison.OrdinalIgnoreCase);
    }
}

