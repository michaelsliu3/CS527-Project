using PlzBuyMe.Api.Dtos.Admin.Gm;

namespace PlzBuyMe.Api.Services;

public interface IGmToolsService
{
    Task<(string? Error, GmSeedAuctionsResultDto? Data)> SeedAuctionsAsync(int adminUserId, GmSeedAuctionsDto dto);

    Task<(string? Error, GmSeedAuctionsResultDto? Data)> SeedAuctionsFromManifestAsync(int adminUserId, GmSeedManifestAuctionsDto dto);

    Task<(string? Error, GmBulkUsersResultDto? Data)> BulkCreateUsersAsync(int adminUserId, GmBulkUsersDto dto);

    Task<(string? Error, GmSeedQuestionsResultDto? Data)> SeedQuestionsAsync(int adminUserId, GmSeedQuestionsDto dto);

    Task<(string? Error, GmWalletTopUpResultDto? Data)> WalletTopUpAsync(int adminUserId, GmWalletTopUpDto dto);

    Task<(string? Error, GmSampleAlertsResultDto? Data)> SeedSampleAlertsAsync(int adminUserId, GmSampleAlertsDto dto);

    Task<(string? Error, GmSampleNotificationsResultDto? Data)> SeedSampleNotificationsAsync(int adminUserId, GmSampleNotificationsDto dto);

    Task<(string? Error, GmSoldHistoryFixtureResultDto? Data)> SeedSoldHistoryFixtureAsync(int adminUserId);
}
