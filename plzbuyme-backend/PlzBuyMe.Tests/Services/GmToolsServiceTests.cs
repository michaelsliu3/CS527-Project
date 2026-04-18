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

    private static GmToolsService CreateService(
        AppDbContext db,
        Mock<IAuctionService>? auctionMock = null,
        Dictionary<string, string?>? configValues = null,
        string? contentRootPath = null)
    {
        auctionMock ??= new Mock<IAuctionService>();
        var hostEnv = new Mock<IHostEnvironment>();
        hostEnv.Setup(e => e.ContentRootPath).Returns(contentRootPath ?? Path.GetTempPath());
        var config = new ConfigurationBuilder().AddInMemoryCollection(configValues).Build();
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
    public async Task SearchManifestCars_ReturnsShapedRowsWithResolvedCategories()
    {
        await using var db = CreateDb();
        var root = new Category { Name = "Cars", StringKey = "cars" };
        db.Categories.Add(root);
        await db.SaveChangesAsync();
        var sedans = new Category { Name = "Sedans", ParentId = root.Id, StringKey = "sedans" };
        db.Categories.Add(sedans);
        await db.SaveChangesAsync();
        db.CategoryFields.Add(new CategoryField
        {
            CategoryId = sedans.Id,
            FieldName = "Make",
            FieldType = FieldType.Text
        });
        await db.SaveChangesAsync();

        var tempManifestPath = Path.Combine(Path.GetTempPath(), $"gm-manifest-{Guid.NewGuid():N}.json");
        await File.WriteAllTextAsync(
            tempManifestPath,
            """
            {
              "assets": [
                {
                  "externalId": "12345",
                  "sourceUrl": "https://example.com/car.png",
                  "title": "Honda Civic Type R '22",
                  "make": "Honda",
                  "model": "Civic Type R",
                  "year": 2022,
                  "color": "Championship White",
                  "categories": ["sedans"]
                }
              ]
            }
            """);

        try
        {
            var svc = CreateService(
                db,
                configValues: new Dictionary<string, string?> { ["Gt7CarManifest:Path"] = tempManifestPath });

            var (error, data) = await svc.SearchManifestCarsAsync(1, "civic", 5);

            error.Should().BeNull();
            data.Should().NotBeNull();
            var rows = data ?? throw new InvalidOperationException("Expected manifest search rows.");
            rows.Should().HaveCount(1);
            var row = rows[0];
            row.Make.Should().Be("Honda");
            row.Model.Should().Be("Civic Type R");
            row.Year.Should().Be(2022);
            row.SourceUrl.Should().Be("https://example.com/car.png");
            row.CategoryIds.Should().Contain(sedans.Id);
            row.CategoryNames.Should().Contain("Sedans");
            row.CategoryStringKeys.Should().Contain("sedans");
        }
        finally
        {
            if (File.Exists(tempManifestPath))
                File.Delete(tempManifestPath);
        }
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
    public async Task SeedSoldAuctions_AboveMax_ReturnsError()
    {
        await using var db = CreateDb();
        var svc = CreateService(db);

        var (error, data) = await svc.SeedSoldAuctionsAsync(1, new GmSeedSoldAuctionsDto
        {
            Count = 201
        });

        error.Should().NotBeNullOrEmpty();
        data.Should().BeNull();
    }

    [Fact]
    public async Task SeedSoldAuctions_CreatesSoldAndClosedWithHistoricalCloseDates()
    {
        await using var db = CreateDb();
        var cars = new Category { Name = "Cars", StringKey = "cars" };
        db.Categories.Add(cars);
        await db.SaveChangesAsync();
        var sedans = new Category { Name = "Sedans", ParentId = cars.Id, StringKey = "sedans" };
        db.Categories.Add(sedans);
        await db.SaveChangesAsync();
        db.CategoryFields.AddRange(
            new CategoryField { CategoryId = sedans.Id, FieldName = "Make", FieldType = FieldType.Text },
            new CategoryField { CategoryId = sedans.Id, FieldName = "Model", FieldType = FieldType.Text });

        db.Users.AddRange(
            new User { Username = "seller-a", Email = "seller-a@test.com", PasswordHash = "h", Role = UserRole.EndUser, IsActive = true },
            new User { Username = "seller-b", Email = "seller-b@test.com", PasswordHash = "h", Role = UserRole.EndUser, IsActive = true },
            new User { Username = "bidder-a", Email = "bidder-a@test.com", PasswordHash = "h", Role = UserRole.EndUser, IsActive = true });
        await db.SaveChangesAsync();

        var svc = CreateService(db);
        var (error, data) = await svc.SeedSoldAuctionsAsync(1, new GmSeedSoldAuctionsDto
        {
            Count = 6,
            CategoryId = sedans.Id,
            DaysAgoMin = 3,
            DaysAgoMax = 7,
            BidCountMin = 1,
            BidCountMax = 2,
            ClosedWithoutSaleRatio = 0.5m
        });

        error.Should().BeNull();
        data.Should().NotBeNull();
        var result = data!;
        (result.CreatedSoldCount + result.CreatedClosedCount).Should().Be(6);
        result.TotalBids.Should().BeGreaterThan(0);

        var items = await db.Items.AsNoTracking().ToListAsync();
        items.Should().HaveCount(6);
        items.Count(i => i.Status == ItemStatus.Sold).Should().Be(result.CreatedSoldCount);
        items.Count(i => i.Status == ItemStatus.Closed).Should().Be(result.CreatedClosedCount);
        items.All(i => i.CloseDateTime <= DateTime.UtcNow.AddDays(-3)).Should().BeTrue();
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
        row.LucideIconKey.Should().Be("Car");
    }

    [Fact]
    public async Task CreateCategory_CustomPascalCaseLucideIcon_Persists()
    {
        await using var db = CreateDb();
        var svc = CreateService(db);

        var (error, data) = await svc.CreateCategoryAsync(
            1,
            new GmCreateCategoryDto { Name = "Bicycles", LucideIconKey = "Bike" });

        error.Should().BeNull();
        data.Should().NotBeNull();
        (await db.Categories.SingleAsync()).LucideIconKey.Should().Be("Bike");
    }

    [Fact]
    public async Task CreateCategory_InvalidLucideIcon_ReturnsError()
    {
        await using var db = CreateDb();
        var svc = CreateService(db);

        var (error, data) = await svc.CreateCategoryAsync(
            1,
            new GmCreateCategoryDto { Name = "X", LucideIconKey = "notPascalCase" });

        error.Should().NotBeNullOrEmpty();
        data.Should().BeNull();
        (await db.Categories.CountAsync()).Should().Be(0);
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

    [Fact]
    public async Task CreateCategoryField_SelectWithoutOptions_ReturnsError()
    {
        await using var db = CreateDb();
        var category = new Category { Name = "Boats", StringKey = "boats" };
        db.Categories.Add(category);
        await db.SaveChangesAsync();
        var svc = CreateService(db);

        var (error, data) = await svc.CreateCategoryFieldAsync(
            1,
            category.Id,
            new GmCreateCategoryFieldDto
            {
                FieldName = "Hull Type",
                FieldType = "select",
                Options = new List<string>()
            });

        error.Should().Be("Select fields require at least one option.");
        data.Should().BeNull();
    }

    [Fact]
    public async Task CreateCategoryField_DuplicateNameWithinCategory_ReturnsError()
    {
        await using var db = CreateDb();
        var category = new Category { Name = "Boats", StringKey = "boats" };
        db.Categories.Add(category);
        await db.SaveChangesAsync();
        db.CategoryFields.Add(new CategoryField
        {
            CategoryId = category.Id,
            FieldName = "Length",
            FieldType = FieldType.Number
        });
        await db.SaveChangesAsync();
        var svc = CreateService(db);

        var (error, data) = await svc.CreateCategoryFieldAsync(
            1,
            category.Id,
            new GmCreateCategoryFieldDto
            {
                FieldName = "length",
                FieldType = "number"
            });

        error.Should().Be("A field with this name already exists in this category.");
        data.Should().BeNull();
    }

    [Fact]
    public async Task CreateCategoryField_ForSubcategory_PersistsOnSelectedCategory()
    {
        await using var db = CreateDb();
        var root = new Category { Name = "Cars", StringKey = "cars" };
        db.Categories.Add(root);
        await db.SaveChangesAsync();
        var child = new Category { Name = "Sedans", ParentId = root.Id, StringKey = "sedans" };
        db.Categories.Add(child);
        await db.SaveChangesAsync();
        var svc = CreateService(db);

        var (error, data) = await svc.CreateCategoryFieldAsync(
            1,
            child.Id,
            new GmCreateCategoryFieldDto
            {
                FieldName = "Make",
                FieldType = "text",
                IsRequired = true
            });

        error.Should().BeNull();
        data.Should().NotBeNull();
        data!.CategoryId.Should().Be(child.Id);
        var persisted = await db.CategoryFields.SingleAsync();
        persisted.CategoryId.Should().Be(child.Id);
    }

    [Fact]
    public async Task UpdateCategoryField_ReturnsImmutableError()
    {
        await using var db = CreateDb();
        var category = new Category { Name = "Boats", StringKey = "boats" };
        db.Categories.Add(category);
        await db.SaveChangesAsync();
        var field = new CategoryField
        {
            CategoryId = category.Id,
            FieldName = "Hull Type",
            FieldType = FieldType.Select,
            IsRequired = true,
            Options = "[\"V-Hull\",\"Pontoon\"]"
        };
        db.CategoryFields.Add(field);
        await db.SaveChangesAsync();

        var svc = CreateService(db);
        var (error, data) = await svc.UpdateCategoryFieldAsync(
            1,
            field.Id,
            new GmUpdateCategoryFieldDto
            {
                FieldName = "Hull Style",
                IsRequired = false,
                Options = new List<string> { "Catamaran", "Tritoon" }
            });

        error.Should().Be("Category fields are immutable after creation. Create a new field for customizations.");
        data.Should().BeNull();
    }

    [Fact]
    public async Task DeleteCategoryField_WhenUsedByItems_ReturnsError()
    {
        await using var db = CreateDb();
        var category = new Category { Name = "Boats", StringKey = "boats" };
        var user = new User
        {
            Username = "seller",
            Email = "seller@boats.test",
            PasswordHash = "h",
            Role = UserRole.EndUser,
            IsActive = true
        };
        db.Categories.Add(category);
        db.Users.Add(user);
        await db.SaveChangesAsync();
        var field = new CategoryField
        {
            CategoryId = category.Id,
            FieldName = "Horsepower",
            FieldType = FieldType.Number
        };
        db.CategoryFields.Add(field);
        await db.SaveChangesAsync();

        var item = new Item
        {
            SellerId = user.Id,
            CategoryIds = new List<int> { category.Id },
            Title = "Boat",
            Description = "desc",
            CurrentPrice = 10m,
            InitialPrice = 10m,
            BidIncrement = 1m,
            ReservePrice = 5m,
            Status = ItemStatus.Active,
            CloseDateTime = DateTime.UtcNow.AddHours(1)
        };
        db.Items.Add(item);
        await db.SaveChangesAsync();

        db.ItemFieldValues.Add(new ItemFieldValue
        {
            ItemId = item.Id,
            FieldId = field.Id,
            Value = "180"
        });
        await db.SaveChangesAsync();

        var svc = CreateService(db);
        var (error, data) = await svc.DeleteCategoryFieldAsync(1, field.Id);

        error.Should().Be("Cannot delete a category field that has item values.");
        data.Should().BeNull();
    }
}
