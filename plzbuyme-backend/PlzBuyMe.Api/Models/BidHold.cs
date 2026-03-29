namespace PlzBuyMe.Api.Models;

/// <summary>
/// One row per active auction: funds reserved for the current high bidder's winning bid amount.
/// </summary>
public class BidHold
{
    public int Id { get; set; }
    public int ItemId { get; set; }
    public Item? Item { get; set; }
    public int UserId { get; set; }
    public User? User { get; set; }
    public decimal Amount { get; set; }
}
