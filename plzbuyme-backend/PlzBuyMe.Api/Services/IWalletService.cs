namespace PlzBuyMe.Api.Services;

public interface IWalletService
{
    Task<(decimal WalletBalance, decimal AvailableBalance)> GetWalletSnapshotAsync(int userId);

    /// <summary>Reserve funds for the new winning bid; releases the previous high bidder's hold on this item.</summary>
    Task ApplyBidHoldAsync(int itemId, int bidderId, decimal bidAmount);

    /// <summary>Clear winning hold and move final price from winner to seller.</summary>
    Task FinalizeSoldAuctionAsync(int itemId, int winnerId, decimal finalPrice, int sellerId);

    /// <summary>Release hold when the auction ends without a payable sale.</summary>
    Task ReleaseItemHoldAsync(int itemId);

    /// <summary>Rebuild the hold row from the current top bid (e.g. after rep removes a bid).</summary>
    Task SyncBidHoldForItemAsync(int itemId);

    /// <summary>Add funds to the user's wallet balance.</summary>
    Task<(decimal WalletBalance, decimal AvailableBalance)> DepositAsync(int userId, decimal amount);

    /// <summary>Withdraw spendable balance (cannot exceed available after bid holds).</summary>
    Task<(decimal WalletBalance, decimal AvailableBalance)> WithdrawAsync(int userId, decimal amount);
}
