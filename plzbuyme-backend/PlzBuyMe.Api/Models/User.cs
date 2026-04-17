namespace PlzBuyMe.Api.Models;

public class User
{
    public int Id { get; set; }
    public string Username { get; set; } = string.Empty;
    public bool IsAuctionIdentityAnonymous { get; set; }
    public string? AvatarUrl { get; set; }
    public string? AvatarStorageKey { get; set; }
    public string? DisplayNameColor { get; set; }
    public string Email { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public UserRole Role { get; set; } = UserRole.EndUser;
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    /// <summary>Total wallet funds (held bids reduce spendable available balance).</summary>
    public decimal WalletBalance { get; set; }

    public ICollection<Item> ItemsSold { get; set; } = new List<Item>();
    public ICollection<Item> ItemsWon { get; set; } = new List<Item>();
    public ICollection<Bid> Bids { get; set; } = new List<Bid>();
    public ICollection<AutoBid> AutoBids { get; set; } = new List<AutoBid>();
    public ICollection<Alert> Alerts { get; set; } = new List<Alert>();
    public ICollection<Notification> Notifications { get; set; } = new List<Notification>();
    public ICollection<Question> QuestionsAsked { get; set; } = new List<Question>();
    public ICollection<QuestionReply> QuestionReplies { get; set; } = new List<QuestionReply>();
    public ICollection<QuestionVote> QuestionVotes { get; set; } = new List<QuestionVote>();
}
