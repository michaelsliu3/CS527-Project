using PlzBuyMe.Api.Dtos.Admin.Gm;

namespace PlzBuyMe.Api.Services;

public interface IGmToolsService
{
    Task<(string? Error, IReadOnlyList<GmManifestCarRowDto>? Data)> SearchManifestCarsAsync(
        int adminUserId,
        string? query,
        int limit);

    Task<(string? Error, GmSeedAuctionsResultDto? Data)> SeedAuctionsAsync(int adminUserId, GmSeedAuctionsDto dto);

    Task<(string? Error, GmSeedAuctionsResultDto? Data)> SeedAuctionsFromManifestAsync(int adminUserId, GmSeedManifestAuctionsDto dto);

    Task<(string? Error, GmBulkUsersResultDto? Data)> BulkCreateUsersAsync(int adminUserId, GmBulkUsersDto dto);

    Task<(string? Error, GmSeedQuestionsResultDto? Data)> SeedQuestionsAsync(int adminUserId, GmSeedQuestionsDto dto);

    Task<(string? Error, GmWalletTopUpResultDto? Data)> WalletTopUpAsync(int adminUserId, GmWalletTopUpDto dto);

    Task<(string? Error, GmSampleAlertsResultDto? Data)> SeedSampleAlertsAsync(int adminUserId, GmSampleAlertsDto dto);

    Task<(string? Error, GmSampleNotificationsResultDto? Data)> SeedSampleNotificationsAsync(int adminUserId, GmSampleNotificationsDto dto);

    Task<(string? Error, GmSoldHistoryFixtureResultDto? Data)> SeedSoldHistoryFixtureAsync(int adminUserId);

    Task<(string? Error, GmSeedSoldAuctionsResultDto? Data)> SeedSoldAuctionsAsync(int adminUserId, GmSeedSoldAuctionsDto dto);

    Task<(string? Error, GmBulkCloseAuctionsResultDto? Data)> BulkCloseActiveAuctionsAsync(int adminUserId, GmBulkCloseAuctionsDto dto);

    Task<(string? Error, GmRunCloseSweepResultDto? Data)> RunCloseSweepAsync(int adminUserId);

    Task<(string? Error, GmDeleteAllAuctionsResultDto? Data)> DeleteAllAuctionsAsync(int adminUserId);

    Task<(string? Error, GmCategoryMutationResultDto? Data)> CreateCategoryAsync(int adminUserId, GmCreateCategoryDto dto);

    Task<(string? Error, GmCategoryMutationResultDto? Data)> UpdateCategoryAsync(
        int adminUserId,
        int categoryId,
        GmUpdateCategoryDto dto);

    Task<(string? Error, GmDeleteCategoryResultDto? Data)> DeleteCategoryAsync(int adminUserId, int categoryId);
}
