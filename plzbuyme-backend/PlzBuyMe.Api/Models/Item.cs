namespace PlzBuyMe.Api.Models;

public class Item
{
    public int Id { get; set; }
    public int SellerId { get; set; }
    public int CategoryId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? ImageUrl { get; set; }
    public string? ImageStorageKey { get; set; }
    public string? ImageSource { get; set; }
    public string? ImageMatchLevel { get; set; }
    public decimal InitialPrice { get; set; }
    public decimal BidIncrement { get; set; }
    public decimal ReservePrice { get; set; }
    public decimal CurrentPrice { get; set; }
    public DateTime CloseDateTime { get; set; }
    public ItemStatus Status { get; set; } = ItemStatus.Active;
    public int? WinnerId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public User Seller { get; set; } = null!;
    public Category Category { get; set; } = null!;
    public User? Winner { get; set; }
    public ICollection<ItemFieldValue> ItemFieldValues { get; set; } = new List<ItemFieldValue>();
    public ICollection<Bid> Bids { get; set; } = new List<Bid>();
    public ICollection<AutoBid> AutoBids { get; set; } = new List<AutoBid>();
    public ICollection<Notification> Notifications { get; set; } = new List<Notification>();
}
