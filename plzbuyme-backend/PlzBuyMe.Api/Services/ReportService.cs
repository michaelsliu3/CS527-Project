using Microsoft.EntityFrameworkCore;
using PlzBuyMe.Api.Data;
using PlzBuyMe.Api.Dtos.Admin;
using PlzBuyMe.Api.Models;

namespace PlzBuyMe.Api.Services;

public class ReportService : IReportService
{
    private readonly AppDbContext _db;

    public ReportService(AppDbContext db)
    {
        _db = db;
    }

    public async Task<decimal> GetTotalEarningsAsync()
    {
        return await _db.Items
            .Where(i => i.Status == ItemStatus.Sold)
            .SumAsync(i => i.CurrentPrice);
    }

    public async Task<IReadOnlyList<EarningsByItemDto>> GetEarningsByItemAsync()
    {
        return await _db.Items
            .AsNoTracking()
            .Where(i => i.Status == ItemStatus.Sold)
            .OrderByDescending(i => i.CurrentPrice)
            .Select(i => new EarningsByItemDto
            {
                ItemId = i.Id,
                Title = i.Title,
                Price = i.CurrentPrice
            })
            .ToListAsync();
    }

    public async Task<IReadOnlyList<EarningsByTypeDto>> GetEarningsByTypeAsync()
    {
        return await _db.Items
            .AsNoTracking()
            .Where(i => i.Status == ItemStatus.Sold)
            .GroupBy(i => new { i.CategoryId, i.Category.Name })
            .Select(g => new EarningsByTypeDto
            {
                CategoryId = g.Key.CategoryId,
                CategoryName = g.Key.Name,
                Earnings = g.Sum(i => i.CurrentPrice)
            })
            .OrderByDescending(d => d.Earnings)
            .ToListAsync();
    }

    public async Task<IReadOnlyList<EarningsByUserDto>> GetEarningsByUserAsync()
    {
        var asSeller = await _db.Items
            .AsNoTracking()
            .Where(i => i.Status == ItemStatus.Sold)
            .GroupBy(i => new { i.SellerId, i.Seller.Username })
            .Select(g => new { g.Key.SellerId, g.Key.Username, Total = g.Sum(i => i.CurrentPrice) })
            .ToListAsync();

        var asWinner = await _db.Items
            .AsNoTracking()
            .Where(i => i.Status == ItemStatus.Sold && i.WinnerId != null)
            .GroupBy(i => new { i.WinnerId!.Value, i.Winner!.Username })
            .Select(g => new { UserId = g.Key.Value, g.Key.Username, Total = g.Sum(i => i.CurrentPrice) })
            .ToListAsync();

        var userIds = asSeller.Select(x => x.SellerId)
            .Union(asWinner.Select(x => x.UserId))
            .Distinct()
            .ToList();

        var usernames = await _db.Users
            .AsNoTracking()
            .Where(u => userIds.Contains(u.Id))
            .ToDictionaryAsync(u => u.Id, u => u.Username);

        return userIds.Select(uid =>
        {
            var sellerRow = asSeller.FirstOrDefault(s => s.SellerId == uid);
            var winnerRow = asWinner.FirstOrDefault(w => w.UserId == uid);
            return new EarningsByUserDto
            {
                UserId = uid,
                Username = usernames.GetValueOrDefault(uid, "?"),
                TotalAsSeller = sellerRow?.Total ?? 0,
                TotalAsWinner = winnerRow?.Total ?? 0
            };
        }).OrderByDescending(u => u.TotalAsSeller + u.TotalAsWinner).ToList();
    }

    public async Task<IReadOnlyList<BestSellingItemDto>> GetBestSellingItemsAsync(int top)
    {
        return await _db.Items
            .AsNoTracking()
            .Where(i => i.Status == ItemStatus.Sold)
            .Select(i => new BestSellingItemDto
            {
                ItemId = i.Id,
                Title = i.Title,
                Price = i.CurrentPrice,
                BidCount = i.Bids.Count
            })
            .OrderByDescending(i => i.Price)
            .ThenByDescending(i => i.BidCount)
            .Take(top)
            .ToListAsync();
    }

    public async Task<IReadOnlyList<BestBuyerDto>> GetBestBuyersAsync(int top)
    {
        return await _db.Items
            .AsNoTracking()
            .Where(i => i.Status == ItemStatus.Sold && i.WinnerId != null)
            .GroupBy(i => new { i.WinnerId!.Value, i.Winner!.Username })
            .Select(g => new BestBuyerDto
            {
                UserId = g.Key.Value,
                Username = g.Key.Username,
                TotalSpent = g.Sum(i => i.CurrentPrice),
                WinCount = g.Count()
            })
            .OrderByDescending(b => b.TotalSpent)
            .Take(top)
            .ToListAsync();
    }
}
