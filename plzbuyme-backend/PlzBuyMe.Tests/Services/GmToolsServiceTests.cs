using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Moq;
using PlzBuyMe.Api.Data;
using PlzBuyMe.Api.Dtos.Admin.Gm;
using PlzBuyMe.Api.Dtos.Auctions;
using PlzBuyMe.Api.Services;
using Xunit;

namespace PlzBuyMe.Tests.Services;

public class GmToolsServiceTests
{
    private static AppDbContext CreateDb()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new AppDbContext(options);
    }

    private static GmToolsService CreateService(AppDbContext db, Mock<IAuctionService>? auctionMock = null)
    {
        auctionMock ??= new Mock<IAuctionService>();
        var hostEnv = new Mock<IHostEnvironment>();
        hostEnv.Setup(e => e.ContentRootPath).Returns(Path.GetTempPath());
        var config = new ConfigurationBuilder().AddInMemoryCollection().Build();
        return new GmToolsService(
            db,
            auctionMock.Object,
            Mock.Of<IAuthService>(),
            new WalletService(db),
            Mock.Of<IAlertService>(),
            Mock.Of<IQuestionsService>(),
            Mock.Of<ILogger<GmToolsService>>(),
            hostEnv.Object,
            config);
    }

    [Fact]
    public async Task SeedAuctions_CountAboveMax_ReturnsErrorWithoutCreatingAuctions()
    {
        await using var db = CreateDb();
        var auctionMock = new Mock<IAuctionService>();
        var svc = CreateService(db, auctionMock);

        var (error, data) = await svc.SeedAuctionsAsync(1, new GmSeedAuctionsDto
        {
            Count = 51,
            BidCountMin = 0,
            BidCountMax = 0
        });

        error.Should().NotBeNullOrEmpty();
        data.Should().BeNull();
        auctionMock.Verify(
            a => a.CreateAuctionAsync(It.IsAny<CreateAuctionDto>(), It.IsAny<int>()),
            Times.Never);
    }

    [Fact]
    public async Task BulkCreateUsers_InvalidPrefix_ReturnsError()
    {
        await using var db = CreateDb();
        var svc = CreateService(db);

        var (error, data) = await svc.BulkCreateUsersAsync(1, new GmBulkUsersDto
        {
            UsernamePrefix = "9bad",
            Count = 1
        });

        error.Should().NotBeNullOrEmpty();
        data.Should().BeNull();
    }

    [Fact]
    public async Task WalletTopUp_EmptyUserIds_ReturnsError()
    {
        await using var db = CreateDb();
        var svc = CreateService(db);

        var (error, data) = await svc.WalletTopUpAsync(1, new GmWalletTopUpDto
        {
            UserIds = new List<int>(),
            AmountEach = 10m
        });

        error.Should().Be("UserIds is required.");
        data.Should().BeNull();
    }
}
