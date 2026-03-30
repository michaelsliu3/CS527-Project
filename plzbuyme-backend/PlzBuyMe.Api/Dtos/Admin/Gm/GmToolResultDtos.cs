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
