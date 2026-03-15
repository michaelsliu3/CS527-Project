using FluentAssertions;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PlzBuyMe.Api.Controllers;
using PlzBuyMe.Api.Data;
using PlzBuyMe.Api.Dtos.Rep;
using PlzBuyMe.Api.Models;
using PlzBuyMe.Api.Services;
using PlzBuyMe.Tests.Helpers;
using Xunit;

namespace PlzBuyMe.Tests.Controllers;

public class RepControllerTests
{
    private static AppDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new AppDbContext(options);
    }

    private static IAuthService CreateAuthService(AppDbContext db)
    {
        var inMemorySettings = new Dictionary<string, string?>
        {
            ["Jwt:Key"] = new string('x', 32),
            ["Jwt:Issuer"] = "issuer",
            ["Jwt:Audience"] = "audience",
            ["Jwt:ExpiresInMinutes"] = "60"
        };
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(inMemorySettings)
            .Build();
        return new AuthService(db, configuration);
    }

    [Fact]
    public async Task Rep_Can_Edit_User()
    {
        await using var db = CreateDbContext();
        var rep = new User
        {
            Username = "rep1",
            Email = "rep1@example.com",
            PasswordHash = "hash",
            Role = UserRole.CustomerRep
        };
        var user = new User
        {
            Username = "user1",
            Email = "user1@example.com",
            PasswordHash = "hash",
            Role = UserRole.EndUser
        };
        db.Users.AddRange(rep, user);
        await db.SaveChangesAsync();

        var authService = CreateAuthService(db);
        var controller = new RepController(db, authService);
        ControllerTestHelpers.SetUser(controller, rep.Id, "customer_rep");

        var dto = new EditUserDto
        {
            Username = "updated",
            Email = "updated@example.com"
        };

        var result = await controller.EditUser(user.Id, dto);

        result.Should().BeOfType<NoContentResult>();
        var updated = await db.Users.FindAsync(user.Id);
        updated!.Username.Should().Be("updated");
        updated.Email.Should().Be("updated@example.com");
    }

    [Fact]
    public async Task Rep_Can_Soft_Delete_User()
    {
        await using var db = CreateDbContext();
        var rep = new User
        {
            Username = "rep1",
            Email = "rep1@example.com",
            PasswordHash = "hash",
            Role = UserRole.CustomerRep
        };
        var user = new User
        {
            Username = "user1",
            Email = "user1@example.com",
            PasswordHash = "hash",
            Role = UserRole.EndUser
        };
        db.Users.AddRange(rep, user);
        await db.SaveChangesAsync();

        var authService = CreateAuthService(db);
        var controller = new RepController(db, authService);
        ControllerTestHelpers.SetUser(controller, rep.Id, "customer_rep");

        var result = await controller.DeleteUser(user.Id);

        result.Should().BeOfType<NoContentResult>();
        var updated = await db.Users.FindAsync(user.Id);
        updated!.IsActive.Should().BeFalse();
    }

    [Fact]
    public async Task Rep_Can_Reset_Password()
    {
        await using var db = CreateDbContext();
        var rep = new User
        {
            Username = "rep1",
            Email = "rep1@example.com",
            PasswordHash = "hash",
            Role = UserRole.CustomerRep
        };
        var user = new User
        {
            Username = "user1",
            Email = "user1@example.com",
            PasswordHash = "old-hash",
            Role = UserRole.EndUser
        };
        db.Users.AddRange(rep, user);
        await db.SaveChangesAsync();

        var authService = CreateAuthService(db);
        var controller = new RepController(db, authService);
        ControllerTestHelpers.SetUser(controller, rep.Id, "customer_rep");

        var dto = new ResetPasswordDto { NewPassword = "newpassword123" };

        var result = await controller.ResetPassword(user.Id, dto);

        result.Should().BeOfType<NoContentResult>();
        var updated = await db.Users.FindAsync(user.Id);
        updated!.PasswordHash.Should().NotBe("old-hash");
    }

    [Fact]
    public async Task Rep_Removing_Bid_Recalculates_CurrentPrice()
    {
        await using var db = CreateDbContext();
        var rep = new User
        {
            Username = "rep1",
            Email = "rep1@example.com",
            PasswordHash = "hash",
            Role = UserRole.CustomerRep
        };
        var seller = new User
        {
            Username = "seller",
            Email = "seller@example.com",
            PasswordHash = "hash",
            Role = UserRole.EndUser
        };
        var bidder1 = new User
        {
            Username = "bidder1",
            Email = "bidder1@example.com",
            PasswordHash = "hash",
            Role = UserRole.EndUser
        };
        var bidder2 = new User
        {
            Username = "bidder2",
            Email = "bidder2@example.com",
            PasswordHash = "hash",
            Role = UserRole.EndUser
        };
        db.Users.AddRange(rep, seller, bidder1, bidder2);
        await db.SaveChangesAsync();

        var item = new Item
        {
            SellerId = seller.Id,
            CategoryId = 1,
            Title = "Car",
            InitialPrice = 100m,
            BidIncrement = 10m,
            ReservePrice = 100m,
            CurrentPrice = 150m,
            CloseDateTime = DateTime.UtcNow.AddDays(1),
            Status = ItemStatus.Active
        };
        db.Items.Add(item);
        await db.SaveChangesAsync();

        var lowerBid = new Bid
        {
            ItemId = item.Id,
            BidderId = bidder1.Id,
            Amount = 120m,
            IsAuto = false
        };
        var higherBid = new Bid
        {
            ItemId = item.Id,
            BidderId = bidder2.Id,
            Amount = 150m,
            IsAuto = false
        };
        db.Bids.AddRange(lowerBid, higherBid);
        await db.SaveChangesAsync();

        var authService = CreateAuthService(db);
        var controller = new RepController(db, authService);
        ControllerTestHelpers.SetUser(controller, rep.Id, "customer_rep");

        var result = await controller.DeleteBid(higherBid.Id);

        result.Should().BeOfType<NoContentResult>();
        var updatedItem = await db.Items.FindAsync(item.Id);
        updatedItem!.CurrentPrice.Should().Be(120m);
    }

    [Fact]
    public async Task Rep_Removing_Last_Bid_Reverts_To_InitialPrice()
    {
        await using var db = CreateDbContext();
        var rep = new User
        {
            Username = "rep1",
            Email = "rep1@example.com",
            PasswordHash = "hash",
            Role = UserRole.CustomerRep
        };
        var seller = new User
        {
            Username = "seller",
            Email = "seller@example.com",
            PasswordHash = "hash",
            Role = UserRole.EndUser
        };
        var bidder = new User
        {
            Username = "bidder",
            Email = "bidder@example.com",
            PasswordHash = "hash",
            Role = UserRole.EndUser
        };
        db.Users.AddRange(rep, seller, bidder);
        await db.SaveChangesAsync();

        var item = new Item
        {
            SellerId = seller.Id,
            CategoryId = 1,
            Title = "Car",
            InitialPrice = 100m,
            BidIncrement = 10m,
            ReservePrice = 100m,
            CurrentPrice = 120m,
            CloseDateTime = DateTime.UtcNow.AddDays(1),
            Status = ItemStatus.Active
        };
        db.Items.Add(item);
        await db.SaveChangesAsync();

        var bid = new Bid
        {
            ItemId = item.Id,
            BidderId = bidder.Id,
            Amount = 120m,
            IsAuto = false
        };
        db.Bids.Add(bid);
        await db.SaveChangesAsync();

        var authService = CreateAuthService(db);
        var controller = new RepController(db, authService);
        ControllerTestHelpers.SetUser(controller, rep.Id, "customer_rep");

        var result = await controller.DeleteBid(bid.Id);

        result.Should().BeOfType<NoContentResult>();
        var updatedItem = await db.Items.FindAsync(item.Id);
        updatedItem!.CurrentPrice.Should().Be(100m);
    }

    [Fact]
    public async Task Rep_Removing_Auction_Sets_Status_Removed()
    {
        await using var db = CreateDbContext();
        var rep = new User
        {
            Username = "rep1",
            Email = "rep1@example.com",
            PasswordHash = "hash",
            Role = UserRole.CustomerRep
        };
        var seller = new User
        {
            Username = "seller",
            Email = "seller@example.com",
            PasswordHash = "hash",
            Role = UserRole.EndUser
        };
        db.Users.AddRange(rep, seller);
        await db.SaveChangesAsync();

        var item = new Item
        {
            SellerId = seller.Id,
            CategoryId = 1,
            Title = "Car",
            InitialPrice = 100m,
            BidIncrement = 10m,
            ReservePrice = 100m,
            CurrentPrice = 100m,
            CloseDateTime = DateTime.UtcNow.AddDays(1),
            Status = ItemStatus.Active
        };
        db.Items.Add(item);
        await db.SaveChangesAsync();

        var authService = CreateAuthService(db);
        var controller = new RepController(db, authService);
        ControllerTestHelpers.SetUser(controller, rep.Id, "customer_rep");

        var result = await controller.DeleteAuction(item.Id);

        result.Should().BeOfType<NoContentResult>();
        var updatedItem = await db.Items.FindAsync(item.Id);
        updatedItem!.Status.Should().Be(ItemStatus.Removed);
    }
}

