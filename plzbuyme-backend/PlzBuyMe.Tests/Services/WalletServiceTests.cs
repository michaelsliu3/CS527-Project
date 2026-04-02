using FluentAssertions;
using PlzBuyMe.Api.Models;
using PlzBuyMe.Api.Services;
using PlzBuyMe.Tests.Helpers;
using Xunit;

namespace PlzBuyMe.Tests.Services;

public class WalletServiceTests
{
    [Fact]
    public async Task DepositAsync_IncreasesBalanceAndAvailable()
    {
        await using var db = TestDbContextFactory.Create();
        var user = new User
        {
            Username = "u1",
            Email = "u1@example.com",
            PasswordHash = "h",
            Role = UserRole.EndUser,
            WalletBalance = 100m
        };
        db.Users.Add(user);
        await db.SaveChangesAsync();

        var wallet = new WalletService(db);
        var (balance, available) = await wallet.DepositAsync(user.Id, 50m);

        balance.Should().Be(150m);
        available.Should().Be(150m);
    }

    [Fact]
    public async Task WithdrawAsync_WithinAvailable_ReducesBalance()
    {
        await using var db = TestDbContextFactory.Create();
        var user = new User
        {
            Username = "u1",
            Email = "u1@example.com",
            PasswordHash = "h",
            Role = UserRole.EndUser,
            WalletBalance = 200m
        };
        db.Users.Add(user);
        await db.SaveChangesAsync();

        var wallet = new WalletService(db);
        var (balance, available) = await wallet.WithdrawAsync(user.Id, 75m);

        balance.Should().Be(125m);
        available.Should().Be(125m);
    }

    [Fact]
    public async Task WithdrawAsync_ExceedsAvailable_Throws()
    {
        await using var db = TestDbContextFactory.Create();
        var user = new User
        {
            Username = "u1",
            Email = "u1@example.com",
            PasswordHash = "h",
            Role = UserRole.EndUser,
            WalletBalance = 100m
        };
        db.Users.Add(user);
        var cat = new Category { Name = "Cars", ParentId = null, StringKey = "wlt-cars" };
        db.Categories.Add(cat);
        await db.SaveChangesAsync();
        var item = new Item
        {
            SellerId = user.Id,
            CategoryId = cat.Id,
            Title = "X",
            InitialPrice = 10m,
            BidIncrement = 1m,
            ReservePrice = 10m,
            CurrentPrice = 10m,
            CloseDateTime = DateTime.UtcNow.AddDays(1),
            Status = ItemStatus.Active
        };
        db.Items.Add(item);
        await db.SaveChangesAsync();
        db.BidHolds.Add(new BidHold { ItemId = item.Id, UserId = user.Id, Amount = 60m });
        await db.SaveChangesAsync();

        var wallet = new WalletService(db);
        var act = () => wallet.WithdrawAsync(user.Id, 50m);
        await act.Should().ThrowAsync<InvalidOperationException>().WithMessage("*exceeds available*");
    }
}
