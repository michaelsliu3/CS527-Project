using Microsoft.EntityFrameworkCore;
using PlzBuyMe.Api.Data;
using PlzBuyMe.Api.Models;

namespace PlzBuyMe.Api.Services;

public class WalletService : IWalletService
{
    public const string InsufficientWalletMessage = "Insufficient wallet balance.";

    private const decimal MaxDeposit = 1_000_000m;

    private readonly AppDbContext _db;

    public WalletService(AppDbContext db)
    {
        _db = db;
    }

    public async Task<(decimal WalletBalance, decimal AvailableBalance)> GetWalletSnapshotAsync(int userId)
    {
        var user = await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId);
        if (user == null)
            return (0m, 0m);
        var held = await _db.BidHolds.Where(h => h.UserId == userId).SumAsync(h => (decimal?)h.Amount) ?? 0m;
        return (user.WalletBalance, user.WalletBalance - held);
    }

    public async Task ApplyBidHoldAsync(int itemId, int bidderId, decimal bidAmount)
    {
        var row = await _db.BidHolds.FirstOrDefaultAsync(h => h.ItemId == itemId);
        if (row != null && row.UserId != bidderId)
            _db.BidHolds.Remove(row);

        row = await _db.BidHolds.FirstOrDefaultAsync(h => h.ItemId == itemId);
        var oldOnThisItem = row != null && row.UserId == bidderId ? row.Amount : 0m;

        var user = await _db.Users.FirstAsync(u => u.Id == bidderId);
        var totalHeld = await _db.BidHolds.Where(h => h.UserId == bidderId).SumAsync(h => (decimal?)h.Amount) ?? 0m;
        var available = user.WalletBalance - totalHeld;
        var extraNeeded = bidAmount - oldOnThisItem;
        if (available < extraNeeded)
            throw new InvalidOperationException(InsufficientWalletMessage);

        if (row != null && row.UserId == bidderId)
            row.Amount = bidAmount;
        else
            _db.BidHolds.Add(new BidHold { ItemId = itemId, UserId = bidderId, Amount = bidAmount });
    }

    public async Task FinalizeSoldAuctionAsync(int itemId, int winnerId, decimal finalPrice, int sellerId)
    {
        var hold = await _db.BidHolds.FirstOrDefaultAsync(h => h.ItemId == itemId);
        if (hold != null)
            _db.BidHolds.Remove(hold);

        var winner = await _db.Users.FirstAsync(u => u.Id == winnerId);
        var seller = await _db.Users.FirstAsync(u => u.Id == sellerId);

        if (winner.WalletBalance < finalPrice)
            throw new InvalidOperationException(InsufficientWalletMessage);

        winner.WalletBalance -= finalPrice;
        seller.WalletBalance += finalPrice;
    }

    public async Task ReleaseItemHoldAsync(int itemId)
    {
        var hold = await _db.BidHolds.FirstOrDefaultAsync(h => h.ItemId == itemId);
        if (hold != null)
            _db.BidHolds.Remove(hold);
    }

    public async Task SyncBidHoldForItemAsync(int itemId)
    {
        var toRemove = await _db.BidHolds.Where(h => h.ItemId == itemId).ToListAsync();
        foreach (var h in toRemove)
            _db.BidHolds.Remove(h);

        var top = await _db.Bids
            .Where(b => b.ItemId == itemId)
            .OrderByDescending(b => b.Amount)
            .FirstOrDefaultAsync();

        if (top != null)
            await ApplyBidHoldAsync(itemId, top.BidderId, top.Amount);

        await _db.SaveChangesAsync();
    }

    public async Task<(decimal WalletBalance, decimal AvailableBalance)> DepositAsync(int userId, decimal amount)
    {
        if (amount <= 0m)
            throw new InvalidOperationException("Deposit amount must be positive.");
        if (amount > MaxDeposit)
            throw new InvalidOperationException($"Deposits are capped at {MaxDeposit:N2}.");

        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId);
        if (user == null)
            throw new InvalidOperationException("User not found.");

        user.WalletBalance += amount;
        await _db.SaveChangesAsync();
        return await GetWalletSnapshotAsync(userId);
    }

    public async Task<(decimal WalletBalance, decimal AvailableBalance)> WithdrawAsync(int userId, decimal amount)
    {
        if (amount <= 0m)
            throw new InvalidOperationException("Withdrawal amount must be positive.");

        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId);
        if (user == null)
            throw new InvalidOperationException("User not found.");

        var held = await _db.BidHolds.Where(h => h.UserId == userId).SumAsync(h => (decimal?)h.Amount) ?? 0m;
        var available = user.WalletBalance - held;
        if (amount > available)
            throw new InvalidOperationException("Withdrawal exceeds available balance.");

        user.WalletBalance -= amount;
        await _db.SaveChangesAsync();
        return await GetWalletSnapshotAsync(userId);
    }
}
