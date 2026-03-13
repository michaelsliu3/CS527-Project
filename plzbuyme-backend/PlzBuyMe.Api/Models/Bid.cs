namespace PlzBuyMe.Api.Models;

public class Bid
{
    public int Id { get; set; }
    public int ItemId { get; set; }
    public int BidderId { get; set; }
    public decimal Amount { get; set; }
    public bool IsAuto { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public Item Item { get; set; } = null!;
    public User Bidder { get; set; } = null!;
}
