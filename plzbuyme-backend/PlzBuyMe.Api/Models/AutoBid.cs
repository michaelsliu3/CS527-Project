namespace PlzBuyMe.Api.Models;

public class AutoBid
{
    public int Id { get; set; }
    public int ItemId { get; set; }
    public int BidderId { get; set; }
    public decimal UpperLimit { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public Item Item { get; set; } = null!;
    public User Bidder { get; set; } = null!;
}
