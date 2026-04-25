using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using PlzBuyMe.Models;
using PlzBuyMe.Data;

namespace PlzBuyMe.Services
{
    /// <summary>
    /// Returns similar auctions from the past 30 days.
    /// Similarity score: same subcategory (+40), same category (+20),
    /// price within 30% (+20), keyword overlap in title (+20 max).
    /// </summary>
    public class SimilarItemsService
    {
        private readonly AppDbContext _db;

        public SimilarItemsService(AppDbContext db) { _db = db; }

        public async Task<List<SimilarAuctionDto>> GetSimilarAuctionsAsync(int auctionId, int topN = 6)
        {
            var target = await _db.Auctions.Include(a => a.Item).Include(a => a.Bids).FirstOrDefaultAsync(a => a.Id == auctionId);
            if (target == null) return new List<SimilarAuctionDto>();
            var cutoff = DateTime.UtcNow.AddDays(-30);
            var candidates = await _db.Auctions.Include(a => a.Item).Include(a => a.Bids).Where(a => a.Id != auctionId && a.CreatedAt >= cutoff).ToListAsync();
            var targetWords = Tokenize(target.Item.Title);
            decimal targetPrice = target.Bids.Any() ? target.Bids.Max(b => b.Amount) : target.StartingPrice;
            var scored = candidates.Select(a => {
                int score = 0;
                if (a.Item.Subcategory == target.Item.Subcategory) score += 40;
                else if (a.Item.Category == target.Item.Category) score += 20;
                decimal p = a.Bids.Any() ? a.Bids.Max(b => b.Amount) : a.StartingPrice;
                if (targetPrice > 0 && Math.Abs((double)(p - targetPrice)) / (double)targetPrice <= 0.30) score += 20;
                score += Math.Min(targetWords.Intersect(Tokenize(a.Item.Title)).Count(), 4) * 5;
                return new { Auction = a, Score = score, Price = p };
            }).Where(x => x.Score > 0).OrderByDescending(x => x.Score).Take(topN).ToList();
            return scored.Select(x => new SimilarAuctionDto
            {
                AuctionId = x.Auction.Id, Title = x.Auction.Item.Title,
                Category = x.Auction.Item.Category, Subcategory = x.Auction.Item.Subcategory,
                CurrentPrice = x.Price, ClosingTime = x.Auction.ClosingDateTime,
                ThumbnailUrl = x.Auction.Item.ThumbnailUrl, SimilarityScore = x.Score
            }).ToList();
        }

        private HashSet<string> Tokenize(string text)
        {
            if (string.IsNullOrWhiteSpace(text)) return new HashSet<string>();
            var stop = new HashSet<string> { "the", "a", "an", "for", "of", "in", "on", "and", "or" };
            return text.ToLower().Split(new[] { ' ', '-', '_', ',' }, StringSplitOptions.RemoveEmptyEntries)
                .Where(w => w.Length > 2 && !stop.Contains(w)).ToHashSet();
        }
    }

    public class SimilarAuctionDto
    {
        public int AuctionId { get; set; }
        public string Title { get; set; } = "";
        public string Category { get; set; } = "";
        public string Subcategory { get; set; } = "";
        public decimal CurrentPrice { get; set; }
        public DateTime ClosingTime { get; set; }
        public string? ThumbnailUrl { get; set; }
        public int SimilarityScore { get; set; }
    }
}
