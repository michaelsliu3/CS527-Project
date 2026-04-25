using System;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using PlzBuyMe.Models;
using PlzBuyMe.Data;

namespace PlzBuyMe.Services
{
    /// <summary>
    /// Automatic bidding engine. When a manual bid is placed, cascades
    /// through all active auto-bidders until the highest one wins.
    /// </summary>
    public class AutoBidService
    {
        private readonly AppDbContext _db;
        private readonly IAlertService _alertService;

        public AutoBidService(AppDbContext db, IAlertService alertService)
        { _db = db; _alertService = alertService; }

        /// <summary>Runs the auto-bid cascade after a new bid.</summary>
        public async Task<decimal> RunAutoBidCascadeAsync(int auctionId, int triggerBidderId)
        {
            var auction = await _db.Auctions
                .Include(a => a.Bids)
                .FirstOrDefaultAsync(a => a.Id == auctionId);
            if (auction == null || auction.ClosingDateTime <= DateTime.UtcNow) return 0;
            decimal currentHigh = auction.Bids.Any() ? auction.Bids.Max(b => b.Amount) : 0;
            var autoBidders = await _db.AutoBids
                .Where(ab => ab.AuctionId == auctionId && ab.IsActive && ab.UserId != triggerBidderId)
                .OrderByDescending(ab => ab.MaxBidAmount).ToListAsync();
            if (!autoBidders.Any()) return currentHigh;
            var top = autoBidders.First();
            if (top.MaxBidAmount <= currentHigh)
            {
                await _alertService.SendOutbidAlertAsync(top.UserId, auctionId, currentHigh);
                top.IsActive = false;
                await _db.SaveChangesAsync();
                return currentHigh;
            }
            decimal increment = auction.BidIncrement > 0 ? auction.BidIncrement : 1.00m;
            decimal newBid = Math.Min(currentHigh + increment, top.MaxBidAmount);
            _db.Bids.Add(new Bid
            {
                AuctionId = auctionId, BidderId = top.UserId,
                Amount = newBid, PlacedAt = DateTime.UtcNow, IsAutoBid = true
            });
            await _alertService.SendOutbidAlertAsync(triggerBidderId, auctionId, newBid);
            await _db.SaveChangesAsync();
            return newBid;
        }

        /// <summary>Set or update an auto-bid upper limit.</summary>
        public async Task<AutoBid> SetAutoBidAsync(int auctionId, int userId, decimal maxAmount)
        {
            var auction = await _db.Auctions.FindAsync(auctionId);
            if (auction == null) throw new ArgumentException("Auction not found.");
            if (auction.ClosingDateTime <= DateTime.UtcNow) throw new InvalidOperationException("Auction already closed.");
            var existing = await _db.AutoBids.FirstOrDefaultAsync(
                ab => ab.AuctionId == auctionId && ab.UserId == userId);
            if (existing != null) { existing.MaxBidAmount = maxAmount; existing.IsActive = true; }
            else { existing = new AutoBid { AuctionId = auctionId, UserId = userId, MaxBidAmount = maxAmount, IsActive = true }; _db.AutoBids.Add(existing); }
            await _db.SaveChangesAsync();
            await RunAutoBidCascadeAsync(auctionId, userId);
            return existing;
        }
    }
}
