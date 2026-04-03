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
        var sum = await _db.Items
            .Where(i => i.Status == ItemStatus.Sold)
            .SumAsync(i => (decimal?)i.CurrentPrice);
        return sum ?? 0m;
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
        var soldItems = await _db.Items
            .AsNoTracking()
            .Where(i => i.Status == ItemStatus.Sold)
            .Select(i => new { i.CategoryIds, i.CurrentPrice })
            .ToListAsync();

        var earnings = new Dictionary<int, decimal>();
        foreach (var item in soldItems)
        {
            var primaryCatId = item.CategoryIds.FirstOrDefault();
            if (primaryCatId > 0)
                earnings[primaryCatId] = earnings.GetValueOrDefault(primaryCatId) + item.CurrentPrice;
        }

        var catIds = earnings.Keys.ToList();
        var nameMap = await _db.Categories
            .AsNoTracking()
            .Where(c => catIds.Contains(c.Id))
            .ToDictionaryAsync(c => c.Id, c => c.Name);

        return earnings
            .Select(kv => new EarningsByTypeDto
            {
                CategoryId = kv.Key,
                CategoryName = nameMap.GetValueOrDefault(kv.Key, "Unknown"),
                Earnings = kv.Value
            })
            .OrderByDescending(d => d.Earnings)
            .ToList();
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

        return userIds.Select(uid =>
        {
            var sellerRow = asSeller.FirstOrDefault(s => s.SellerId == uid);
            var winnerRow = asWinner.FirstOrDefault(w => w.UserId == uid);
            var username = sellerRow?.Username ?? winnerRow?.Username ?? "?";
            return new EarningsByUserDto
            {
                UserId = uid,
                Username = username,
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
