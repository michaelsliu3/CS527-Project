namespace PlzBuyMe.Api.Dtos.Admin.Gm;

public record GmSeedAuctionsResultDto
{
    public int CreatedCount { get; init; }
    public IReadOnlyList<int> AuctionIds { get; init; } = Array.Empty<int>();
    public int TotalBidsPlaced { get; init; }
}

public record GmBulkUsersResultDto
{
    public int CreatedCount { get; init; }
    public IReadOnlyList<string> Usernames { get; init; } = Array.Empty<string>();
}

public record GmSeedQuestionsResultDto
{
    public int CreatedCount { get; init; }
    public int RepliesCreated { get; init; }
}

public record GmWalletTopUpResultDto
{
    public int UsersAffected { get; init; }
}

public record GmSampleAlertsResultDto
{
    public int AlertsCreated { get; init; }
}

public record GmSampleNotificationsResultDto
{
    public int NotificationsCreated { get; init; }
}

public record GmSoldHistoryFixtureResultDto
{
    public int SoldAuctionCount { get; init; }
}

public record GmSeedSoldAuctionsResultDto
{
    public int CreatedSoldCount { get; init; }
    public int CreatedClosedCount { get; init; }
    public int TotalBids { get; init; }
}

public record GmBulkCloseAuctionsResultDto
{
    public int ProcessedCount { get; init; }
    public int SoldCount { get; init; }
    public int ClosedWithoutSaleCount { get; init; }
}

public record GmRunCloseSweepResultDto
{
    public bool Ran { get; init; } = true;
}

public record GmDeleteAllAuctionsResultDto
{
    public int ItemsDeleted { get; init; }
    public int BidsDeleted { get; init; }
    public int AutoBidsDeleted { get; init; }
    public int BidHoldsDeleted { get; init; }
    public int NotificationsDeleted { get; init; }
}
