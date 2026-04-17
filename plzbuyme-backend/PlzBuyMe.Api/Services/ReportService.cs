using Microsoft.EntityFrameworkCore;
using PlzBuyMe.Api.Data;
using PlzBuyMe.Api.Dtos;
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

    public async Task<decimal> GetTotalEarningsAsync(DateTime? from = null, DateTime? to = null)
    {
        var sum = await ApplySoldWindow(_db.Items.AsNoTracking(), from, to)
            .SumAsync(i => (decimal?)i.CurrentPrice);
        return sum ?? 0m;
    }

    public async Task<EarningsSummaryDto> GetEarningsSummaryAsync(DateTime? from = null, DateTime? to = null)
    {
        var soldQuery = ApplySoldWindow(_db.Items.AsNoTracking(), from, to);
        var total = await soldQuery.SumAsync(i => (decimal?)i.CurrentPrice) ?? 0m;
        var soldCount = await soldQuery.CountAsync();
        var distinctSellers = await soldQuery.Select(i => i.SellerId).Distinct().CountAsync();
        var distinctBuyers = await soldQuery
            .Where(i => i.WinnerId != null)
            .Select(i => i.WinnerId!.Value)
            .Distinct()
            .CountAsync();

        return new EarningsSummaryDto
        {
            Total = total,
            SoldCount = soldCount,
            AverageSale = soldCount == 0 ? 0m : decimal.Round(total / soldCount, 2, MidpointRounding.AwayFromZero),
            DistinctSellers = distinctSellers,
            DistinctBuyers = distinctBuyers
        };
    }

    public async Task<PaginatedResultDto<EarningsByItemDto>> GetEarningsByItemAsync(
        DateTime? from = null,
        DateTime? to = null,
        int page = 1,
        int pageSize = 25)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);
        var query = ApplySoldWindow(_db.Items.AsNoTracking(), from, to);
        var totalCount = await query.CountAsync();
        var items = await query
            .OrderByDescending(i => i.CurrentPrice)
            .ThenBy(i => i.Id)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(i => new EarningsByItemDto
            {
                ItemId = i.Id,
                Title = i.Title,
                Price = i.CurrentPrice
            })
            .ToListAsync();

        return new PaginatedResultDto<EarningsByItemDto>
        {
            Items = items,
            TotalCount = totalCount,
            Page = page,
            PageSize = pageSize
        };
    }

    public async Task<IReadOnlyList<EarningsByTypeDto>> GetEarningsByTypeAsync(DateTime? from = null, DateTime? to = null)
    {
        var soldItems = await ApplySoldWindow(_db.Items.AsNoTracking(), from, to)
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
            .ThenBy(d => d.CategoryId)
            .ToList();
    }

    public async Task<PaginatedResultDto<EarningsByUserDto>> GetEarningsByUserAsync(
        DateTime? from = null,
        DateTime? to = null,
        int page = 1,
        int pageSize = 25)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);
        var soldQuery = ApplySoldWindow(_db.Items.AsNoTracking(), from, to);

        var asSeller = await soldQuery
            .GroupBy(i => new { i.SellerId, i.Seller.Username })
            .Select(g => new { g.Key.SellerId, g.Key.Username, Total = g.Sum(i => i.CurrentPrice) })
            .ToListAsync();

        var asWinner = await soldQuery
            .Where(i => i.WinnerId != null)
            .GroupBy(i => new { i.WinnerId!.Value, i.Winner!.Username })
            .Select(g => new { UserId = g.Key.Value, g.Key.Username, Total = g.Sum(i => i.CurrentPrice) })
            .ToListAsync();

        var userIds = asSeller.Select(x => x.SellerId)
            .Union(asWinner.Select(x => x.UserId))
            .Distinct()
            .ToList();

        var rows = userIds.Select(uid =>
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
        }).OrderByDescending(u => u.TotalAsSeller + u.TotalAsWinner)
            .ThenBy(u => u.UserId)
            .ToList();

        var totalCount = rows.Count;
        var items = rows.Skip((page - 1) * pageSize).Take(pageSize).ToList();
        return new PaginatedResultDto<EarningsByUserDto>
        {
            Items = items,
            TotalCount = totalCount,
            Page = page,
            PageSize = pageSize
        };
    }

    public async Task<IReadOnlyList<BestSellingItemDto>> GetBestSellingItemsAsync(
        int top,
        DateTime? from = null,
        DateTime? to = null)
    {
        return await ApplySoldWindow(_db.Items.AsNoTracking(), from, to)
            .Select(i => new BestSellingItemDto
            {
                ItemId = i.Id,
                Title = i.Title,
                Price = i.CurrentPrice,
                BidCount = i.Bids.Count
            })
            .OrderByDescending(i => i.Price)
            .ThenByDescending(i => i.BidCount)
            .ThenBy(i => i.ItemId)
            .Take(top)
            .ToListAsync();
    }

    public async Task<IReadOnlyList<BestBuyerDto>> GetBestBuyersAsync(
        int top,
        DateTime? from = null,
        DateTime? to = null)
    {
        return await ApplySoldWindow(_db.Items.AsNoTracking(), from, to)
            .Where(i => i.WinnerId != null)
            .GroupBy(i => new { i.WinnerId!.Value, i.Winner!.Username })
            .Select(g => new BestBuyerDto
            {
                UserId = g.Key.Value,
                Username = g.Key.Username,
                TotalSpent = g.Sum(i => i.CurrentPrice),
                WinCount = g.Count()
            })
            .OrderByDescending(b => b.TotalSpent)
            .ThenByDescending(b => b.WinCount)
            .ThenBy(b => b.UserId)
            .Take(top)
            .ToListAsync();
    }

    private static IQueryable<Item> ApplySoldWindow(IQueryable<Item> query, DateTime? from, DateTime? to)
    {
        var sold = query.Where(i => i.Status == ItemStatus.Sold);
        if (from.HasValue)
            sold = sold.Where(i => i.CloseDateTime >= from.Value);
        if (to.HasValue)
            sold = sold.Where(i => i.CloseDateTime <= to.Value);
        return sold;
    }
}
