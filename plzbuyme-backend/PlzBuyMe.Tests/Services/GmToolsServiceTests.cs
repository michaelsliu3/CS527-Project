using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Moq;
using PlzBuyMe.Api.Data;
using PlzBuyMe.Api.Dtos.Admin.Gm;
using PlzBuyMe.Api.Dtos.Auctions;
using PlzBuyMe.Api.Models;
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

    [Fact]
    public async Task BulkCloseActiveAuctions_DelegatesToAuctionService()
    {
        await using var db = CreateDb();
        var auctionMock = new Mock<IAuctionService>();
        auctionMock
            .Setup(a => a.GmBulkCloseActiveAuctionsAsync("natural"))
            .ReturnsAsync((null, new GmBulkCloseAuctionsResultDto
            {
                ProcessedCount = 3,
                SoldCount = 1,
                ClosedWithoutSaleCount = 2
            }));
        var svc = CreateService(db, auctionMock);

        var (error, data) = await svc.BulkCloseActiveAuctionsAsync(1, new GmBulkCloseAuctionsDto { Mode = "natural" });

        error.Should().BeNull();
        data.Should().NotBeNull();
        data!.ProcessedCount.Should().Be(3);
        auctionMock.Verify(a => a.GmBulkCloseActiveAuctionsAsync("natural"), Times.Once);
    }

    [Fact]
    public async Task RunCloseSweep_CallsCloseExpired()
    {
        await using var db = CreateDb();
        var auctionMock = new Mock<IAuctionService>();
        auctionMock.Setup(a => a.CloseExpiredAsync()).Returns(Task.CompletedTask);
        var svc = CreateService(db, auctionMock);

        var (error, data) = await svc.RunCloseSweepAsync(1);

        error.Should().BeNull();
        data.Should().NotBeNull();
        data!.Ran.Should().BeTrue();
        auctionMock.Verify(a => a.CloseExpiredAsync(), Times.Once);
    }

    [Fact]
    public async Task DeleteAllAuctions_DelegatesToAuctionService()
    {
        await using var db = CreateDb();
        var auctionMock = new Mock<IAuctionService>();
        auctionMock
            .Setup(a => a.GmDeleteAllAuctionsAsync())
            .ReturnsAsync((null, new GmDeleteAllAuctionsResultDto
            {
                ItemsDeleted = 2,
                BidsDeleted = 5,
                AutoBidsDeleted = 0,
                BidHoldsDeleted = 1,
                NotificationsDeleted = 0
            }));
        var svc = CreateService(db, auctionMock);

        var (error, data) = await svc.DeleteAllAuctionsAsync(1);

        error.Should().BeNull();
        data.Should().NotBeNull();
        data!.ItemsDeleted.Should().Be(2);
        data.BidsDeleted.Should().Be(5);
        auctionMock.Verify(a => a.GmDeleteAllAuctionsAsync(), Times.Once);
    }

    [Fact]
    public async Task CreateCategory_Valid_PersistsWithStringKey()
    {
        await using var db = CreateDb();
        var svc = CreateService(db);

        var (error, data) = await svc.CreateCategoryAsync(1, new GmCreateCategoryDto { Name = "Boats", StringKey = "boats" });

        error.Should().BeNull();
        data.Should().NotBeNull();
        data!.Name.Should().Be("Boats");
        var row = await db.Categories.SingleAsync();
        row.StringKey.Should().Be("boats");
    }

    [Fact]
    public async Task DeleteCategory_WithChild_ReturnsError()
    {
        await using var db = CreateDb();
        var root = new Category { Name = "Root", ParentId = null, StringKey = "root-cat" };
        db.Categories.Add(root);
        await db.SaveChangesAsync();
        db.Categories.Add(new Category { Name = "Child", ParentId = root.Id, StringKey = "child-cat" });
        await db.SaveChangesAsync();
        var svc = CreateService(db);

        var (error, data) = await svc.DeleteCategoryAsync(1, root.Id);

        error.Should().NotBeNullOrEmpty();
        data.Should().BeNull();
    }
}
