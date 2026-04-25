using System;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PlzBuyMe.Data;
using PlzBuyMe.Models;
using PlzBuyMe.Services;

namespace PlzBuyMe.Controllers
{
    [ApiController]
    [Route("api/auctions")]
    [Authorize]
    public class BiddingController : ControllerBase
    {
        private readonly AppDbContext _db;
        private readonly AutoBidService _autoBidService;
        private readonly AlertService _alertService;
        private readonly SimilarItemsService _similarService;

        public BiddingController(AppDbContext db, AutoBidService autoBidService, AlertService alertService, SimilarItemsService similarService)
{ _db = db; _autoBidService = autoBidService; _alertService = alertService; _similarService = similarService; }

        private int CurrentUserId => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

        [HttpPost("{id}/bids")]
        public async Task<IActionResult> PlaceBid(int id, [FromBody] PlaceBidRequest req)
        {
            var auction = await _db.Auctions.Include(a => a.Bids).FirstOrDefaultAsync(a => a.Id == id);
            if (auction == null) return NotFound("Auction not found.");
            if (auction.ClosingTime <= DateTime.UtcNow) return BadRequest("Auction has closed.");
            if (auction.SellerId == CurrentUserId) return BadRequest("Seller cannot bid on own auction.");
            decimal currentHigh = auction.Bids.Any() ? auction.Bids.Max(b => b.Amount) : auction.StartingPrice - auction.BidIncrement;
            decimal minAllowed = currentHigh + auction.BidIncrement;
            if (req.Amount < minAllowed) return BadRequest($"Bid must be at least ${minAllowed:F2}.");
            var bid = new Bid { AuctionId = id, BidderId = CurrentUserId, Amount = req.Amount, PlacedAt = DateTime.UtcNow, ISAutoBid = false };
            _db.Bids.Add(bid);
            await _db.SaveChangesAsync();
            decimal finalHigh = await _autoBidService.RunAutoBidCascadeAsync(id, CurrentUserId);
            return Ok(new { CurrentHighBid = finalHigh });
        }

        [HttpPost("{id}/autobid")]
        public async Task<IActionResult> SetAutoBid(int id, [FromBody] SetAutoBidRequest req)
        { try { var a = await _autoBidService.SetAutoBidAsync(id, CurrentUserId, req.UpperLimit); return Ok(new { AutoBidId = a.Id, UpperLimit = a.UpperLimit }); } catch (InvalidOperationException ex) { return BadRequest(ex.Message); } }

        [HttpGet("{id}/bids")][AllowAnonymous]
        public async Task<IActionResult> GetBidHistory(int id)
        { var bids = await _db.Bids.Where(b => b.AuctionId == id).OrderByDescending(b => b.PlacedAt).Select(b => new { b.Id, Bidder = "****" + b.Bidder.Username.Substring(Math.Max(0, b.Bidder.Username.Length - 3)), b.Amount, b.PlacedAt, b.IsAutoBid }).ToListAsync(); return Ok(bids); }

        [HttpGet("/api/users/{userId}/auction-history")]
        public async Task<IActionResult> GetUserAuctionHistory(int userId)
        {
            var boughtIn = await _db.Bids.Where(b => b.BidderId == userId).Select(b => b.AuctionId).Distinct().ToListAsync();
            var asBuyer = await _db.Auctions.Include(a => a.Item).Include(a => a.Bids).Where(a => boughtIn.Contains(a.Id)).Select(a => new AuctionHistoryDto { AuctionId = a.Id, Title = a.Item.Title, Role = "Buyer", HighestBidByUser = a.Bids.Where(b => b.BidderId == userId).Max(b => (decimal?)b.Amount), FinalPrice = a.Bids.Any() ? a.Bids.Max(b => b.Amount) : (decimal?)null, ClosingTime = a.ClosingTime, Won = a.WinnerId == userId }).ToListAsync();
            var asSeller = await _db.Auctions.Include(a => a.Item).Include(a => a.Bids).Where(a => a.SellerId == userId).Select(a => new AuctionHistoryDto { AuctionId = a.Id, Title = a.Item.Title, Role = "Seller", HighestBidByUser = null, FinalPrice = a.Bids.Any() ? a.Bids.Max(b => b.Amount) : (decimal?)null, ClosingTime = a.ClosingTime, Won = false }).ToListAsync();
            return Ok(new { AsBuyer = asBuyer, AsSeller = asSeller });
        }

        [HttpGet("{id}/similar")][AllowAnonymous]
        public async Task<IActionResult> GetSimilarItems(int id)
{ var s = await _similarService.GetSimilarAuctionsAsync(id); return Ok(s); }
    }
    public record PlaceBidRequest(decimal Amount);
    public record SetAutoBidRequest(decimal UpperLimit);
    public class AuctionHistoryDto { public int AuctionId { get; set; } public string Title { get; set; } = ""; public string Role { get; set; } = ""; public decimal? HighestBidByUser { get; set; } public decimal? FinalPrice { get; set; } public DateTime ClosingTime { get; set; } public bool Won { get; set; } }
}
