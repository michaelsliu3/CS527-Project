using FluentAssertions;
using PlzBuyMe.Api.Data;
using PlzBuyMe.Api.Models;
using PlzBuyMe.Tests.Helpers;

namespace PlzBuyMe.Tests;

public class SeedDataTests
{
    [Fact]
    public void Seed_CreatesAdminAccount()
    {
        using var context = TestDbContextFactory.Create();
        SeedData.Initialize(context);

        var admin = context.Users.SingleOrDefault(u => u.Username == "admin");
        admin.Should().NotBeNull();
        admin!.Email.Should().Be("admin@plzbuy.me");
        admin.Role.Should().Be(UserRole.Admin);
        admin.IsActive.Should().BeTrue();
        admin.PasswordHash.Should().NotBeNullOrEmpty();
        BCrypt.Net.BCrypt.Verify("admin123", admin.PasswordHash).Should().BeTrue();
    }

    [Fact]
    public void Seed_CreatesCategoryHierarchyWith3PlusLevels()
    {
        using var context = TestDbContextFactory.Create();
        SeedData.Initialize(context);

        var root = context.Categories.SingleOrDefault(c => c.Name == "Cars" && c.ParentId == null);
        root.Should().NotBeNull("root Cars category should exist");

        var sedans = context.Categories.SingleOrDefault(c => c.Name == "Sedans" && c.ParentId == root!.Id);
        sedans.Should().NotBeNull("Sedans subcategory should exist");

        var thirdLevel = context.Categories.FirstOrDefault(c => c.ParentId == sedans!.Id);
        thirdLevel.Should().NotBeNull("there should be at least one category at level 3 (e.g. under Sedans)");

        var levelCount = 1;
        var current = thirdLevel;
        while (current?.ParentId != null)
        {
            levelCount++;
            current = context.Categories.Find(current.ParentId);
        }
        levelCount.Should().BeGreaterOrEqualTo(3, "hierarchy should have at least 3 levels");
    }

    [Fact]
    public void Seed_CreatesCategoryFieldsForEachSubcategory()
    {
        using var context = TestDbContextFactory.Create();
        SeedData.Initialize(context);

        var cars = context.Categories.Single(c => c.Name == "Cars" && c.ParentId == null);
        var subcategoryIds = context.Categories.Where(c => c.ParentId == cars.Id).Select(c => c.Id).ToList();
        subcategoryIds.Should().NotBeEmpty("there should be subcategories under Cars");

        foreach (var subId in subcategoryIds)
        {
            var fields = context.CategoryFields.Where(f => f.CategoryId == subId).ToList();
            fields.Should().NotBeEmpty($"subcategory {subId} should have category fields");
            fields.Should().Contain(f => f.FieldName == "Make");
            fields.Should().Contain(f => f.FieldName == "Model");
            fields.Should().Contain(f => f.FieldName == "Year");
            fields.Should().Contain(f => f.FieldName == "Mileage");
            fields.Should().Contain(f => f.FieldName == "Condition");
            fields.Should().Contain(f => f.FieldName == "Transmission");
            fields.Should().Contain(f => f.FieldName == "Fuel Type");
            fields.Should().Contain(f => f.FieldName == "Exterior Color");
        }
    }

    [Fact]
    public void Seed_IsIdempotent_CallingTwiceDoesNotDuplicate()
    {
        using var context = TestDbContextFactory.Create();
        SeedData.Initialize(context);
        SeedData.Initialize(context);

        context.Users.Count().Should().Be(4, "seed guard should prevent duplicate seeding");
        context.Categories.Count().Should().Be(8);
        context.Items.Count().Should().Be(2);
    }

    [Fact]
    public void Seed_CreatesSampleItemsWithFieldValuesAndBids()
    {
        using var context = TestDbContextFactory.Create();
        SeedData.Initialize(context);

        var items = context.Items.ToList();
        items.Should().HaveCount(2);
        items.Should().Contain(i => i.Title == "2022 Toyota Camry SE");
        items.Should().Contain(i => i.Title == "2020 Honda Civic LX");

        var camry = items.Single(i => i.Title.Contains("Camry"));
        camry.Status.Should().Be(ItemStatus.Active);
        camry.InitialPrice.Should().Be(22000.00m);
        camry.CurrentPrice.Should().Be(23000.00m);

        var camryFields = context.ItemFieldValues.Where(f => f.ItemId == camry.Id).ToList();
        camryFields.Should().HaveCount(8, "each item should have 8 field values");

        var bids = context.Bids.Where(b => b.ItemId == camry.Id).ToList();
        bids.Should().HaveCount(2);
    }

    [Fact]
    public void Seed_NoBidsByAdminRole()
    {
        using var context = TestDbContextFactory.Create();
        SeedData.Initialize(context);

        var adminIds = context.Users
            .Where(u => u.Role == UserRole.Admin)
            .Select(u => u.Id)
            .ToList();

        var adminBids = context.Bids.Where(b => adminIds.Contains(b.BidderId)).ToList();
        adminBids.Should().BeEmpty("admin users should not have any bids in seed data");
    }
}
