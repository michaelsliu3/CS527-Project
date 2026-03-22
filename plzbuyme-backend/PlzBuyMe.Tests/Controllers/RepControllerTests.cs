using FluentAssertions;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Moq;
using PlzBuyMe.Api.Controllers;
using PlzBuyMe.Api.Data;
using PlzBuyMe.Api.Dtos;
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
        var mockEnvironment = new Mock<IWebHostEnvironment>();
        var contentRoot = Path.Combine(Path.GetTempPath(), "plzbuyme-tests", Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(contentRoot);
        mockEnvironment.SetupGet(e => e.ContentRootPath).Returns(contentRoot);
        mockEnvironment.SetupGet(e => e.WebRootPath).Returns(Path.Combine(contentRoot, "wwwroot"));
        return new AuthService(db, configuration, mockEnvironment.Object);
    }

    [Fact]
    public async Task Rep_GetUsers_Returns_Paginated_EndUsers()
    {
        await using var db = CreateDbContext();
        var authService = CreateAuthService(db);
        var repService = new RepService(db, authService);
        var rep = new User
        {
            Username = "rep1",
            Email = "rep1@example.com",
            PasswordHash = "hash",
            Role = UserRole.CustomerRep
        };
        var user1 = new User
        {
            Username = "alice",
            Email = "alice@example.com",
            PasswordHash = "hash",
            Role = UserRole.EndUser
        };
        var user2 = new User
        {
            Username = "bob",
            Email = "bob@example.com",
            PasswordHash = "hash",
            Role = UserRole.EndUser
        };
        db.Users.AddRange(rep, user1, user2);
        await db.SaveChangesAsync();

        var controller = new RepController(repService);
        ControllerTestHelpers.SetUser(controller, rep.Id, "customer_rep");

        var result = await controller.GetUsers(search: null, page: 1, pageSize: 20);

        result.Should().BeOfType<OkObjectResult>();
        var ok = (OkObjectResult)result;
        var body = ok.Value.Should().BeOfType<PaginatedResultDto<UserSummaryDto>>().Subject;
        body.TotalCount.Should().Be(2);
        body.Items.Should().HaveCount(2);
        body.Page.Should().Be(1);
        body.PageSize.Should().Be(20);
        body.Items.Should().Contain(u => u.Username == "alice" && u.Email == "alice@example.com");
        body.Items.Should().Contain(u => u.Username == "bob" && u.Email == "bob@example.com");
    }

    [Fact]
    public async Task Rep_GetUsers_Search_Filters_By_Username_Or_Email()
    {
        await using var db = CreateDbContext();
        var authService = CreateAuthService(db);
        var repService = new RepService(db, authService);
        var rep = new User
        {
            Username = "rep1",
            Email = "rep1@example.com",
            PasswordHash = "hash",
            Role = UserRole.CustomerRep
        };
        var user1 = new User
        {
            Username = "alice",
            Email = "alice@example.com",
            PasswordHash = "hash",
            Role = UserRole.EndUser
        };
        var user2 = new User
        {
            Username = "bob",
            Email = "bob@example.com",
            PasswordHash = "hash",
            Role = UserRole.EndUser
        };
        db.Users.AddRange(rep, user1, user2);
        await db.SaveChangesAsync();

        var controller = new RepController(repService);
        ControllerTestHelpers.SetUser(controller, rep.Id, "customer_rep");

        var result = await controller.GetUsers(search: "alice", page: 1, pageSize: 20);

        result.Should().BeOfType<OkObjectResult>();
        var ok = (OkObjectResult)result;
        var body = ok.Value.Should().BeOfType<PaginatedResultDto<UserSummaryDto>>().Subject;
        body.TotalCount.Should().Be(1);
        body.Items.Should().ContainSingle(u => u.Username == "alice");
    }

    [Fact]
    public async Task Admin_GetUsers_Returns_All_Roles()
    {
        await using var db = CreateDbContext();
        var authService = CreateAuthService(db);
        var repService = new RepService(db, authService);
        var admin = new User
        {
            Username = "admin1",
            Email = "admin1@example.com",
            PasswordHash = "hash",
            Role = UserRole.Admin
        };
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
        db.Users.AddRange(admin, rep, user);
        await db.SaveChangesAsync();

        var controller = new RepController(repService);
        ControllerTestHelpers.SetUser(controller, admin.Id, "admin");

        var result = await controller.GetUsers(search: null, page: 1, pageSize: 20);

        result.Should().BeOfType<OkObjectResult>();
        var ok = (OkObjectResult)result;
        var body = ok.Value.Should().BeOfType<PaginatedResultDto<UserSummaryDto>>().Subject;
        body.Items.Should().Contain(u => u.Username == "admin1" && u.Role == "admin");
        body.Items.Should().Contain(u => u.Username == "rep1" && u.Role == "customer_rep");
        body.Items.Should().Contain(u => u.Username == "user1" && u.Role == "end_user");
    }

    [Fact]
    public async Task Rep_Can_Edit_User()
    {
        await using var db = CreateDbContext();
        var authService = CreateAuthService(db);
        var repService = new RepService(db, authService);
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

        var controller = new RepController(repService);
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
    public async Task Rep_Cannot_Edit_User_Role()
    {
        await using var db = CreateDbContext();
        var authService = CreateAuthService(db);
        var repService = new RepService(db, authService);
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

        var controller = new RepController(repService);
        ControllerTestHelpers.SetUser(controller, rep.Id, "customer_rep");

        var dto = new EditUserDto
        {
            Username = "updated",
            Email = "updated@example.com",
            Role = "Admin"
        };

        var result = await controller.EditUser(user.Id, dto);

        result.Should().BeOfType<ForbidResult>();
        var updated = await db.Users.FindAsync(user.Id);
        updated!.Role.Should().Be(UserRole.EndUser);
    }

    [Fact]
    public async Task Admin_Edit_User_With_Invalid_Role_Returns_BadRequest()
    {
        await using var db = CreateDbContext();
        var authService = CreateAuthService(db);
        var repService = new RepService(db, authService);
        var admin = new User
        {
            Username = "admin",
            Email = "admin@example.com",
            PasswordHash = "hash",
            Role = UserRole.Admin
        };
        var user = new User
        {
            Username = "user1",
            Email = "user1@example.com",
            PasswordHash = "hash",
            Role = UserRole.EndUser
        };
        db.Users.AddRange(admin, user);
        await db.SaveChangesAsync();

        var controller = new RepController(repService);
        ControllerTestHelpers.SetUser(controller, admin.Id, "admin");

        var dto = new EditUserDto
        {
            Username = "updated",
            Email = "updated@example.com",
            Role = "SuperUser"
        };

        var result = await controller.EditUser(user.Id, dto);

        result.Should().BeOfType<BadRequestObjectResult>();
        ((BadRequestObjectResult)result).Value.Should().Be("Invalid role. Allowed values: User, VIP, Rep, Admin.");
    }

    [Fact]
    public async Task Admin_Can_Edit_User_And_Change_Role()
    {
        await using var db = CreateDbContext();
        var authService = CreateAuthService(db);
        var repService = new RepService(db, authService);
        var admin = new User
        {
            Username = "admin",
            Email = "admin@example.com",
            PasswordHash = "hash",
            Role = UserRole.Admin
        };
        var user = new User
        {
            Username = "user1",
            Email = "user1@example.com",
            PasswordHash = "hash",
            Role = UserRole.EndUser
        };
        db.Users.AddRange(admin, user);
        await db.SaveChangesAsync();

        var controller = new RepController(repService);
        ControllerTestHelpers.SetUser(controller, admin.Id, "admin");

        var dto = new EditUserDto
        {
            Username = "updated",
            Email = "updated@example.com",
            Role = "Rep"
        };

        var result = await controller.EditUser(user.Id, dto);

        result.Should().BeOfType<NoContentResult>();
        var updated = await db.Users.FindAsync(user.Id);
        updated!.Username.Should().Be("updated");
        updated.Email.Should().Be("updated@example.com");
        updated.Role.Should().Be(UserRole.CustomerRep);
    }

    [Fact]
    public async Task Admin_Can_Edit_User_And_Change_Role_ToVip()
    {
        await using var db = CreateDbContext();
        var authService = CreateAuthService(db);
        var repService = new RepService(db, authService);
        var admin = new User
        {
            Username = "admin",
            Email = "admin@example.com",
            PasswordHash = "hash",
            Role = UserRole.Admin
        };
        var user = new User
        {
            Username = "user1",
            Email = "user1@example.com",
            PasswordHash = "hash",
            Role = UserRole.EndUser
        };
        db.Users.AddRange(admin, user);
        await db.SaveChangesAsync();

        var controller = new RepController(repService);
        ControllerTestHelpers.SetUser(controller, admin.Id, "admin");

        var dto = new EditUserDto
        {
            Username = "updated",
            Email = "updated@example.com",
            Role = "VIP"
        };

        var result = await controller.EditUser(user.Id, dto);

        result.Should().BeOfType<NoContentResult>();
        var updated = await db.Users.FindAsync(user.Id);
        updated!.Role.Should().Be(UserRole.Vip);
    }

    [Fact]
    public async Task Rep_Can_Soft_Delete_User()
    {
        await using var db = CreateDbContext();
        var authService = CreateAuthService(db);
        var repService = new RepService(db, authService);
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

        var controller = new RepController(repService);
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
        var authService = CreateAuthService(db);
        var repService = new RepService(db, authService);
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

        var controller = new RepController(repService);
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
        var authService = CreateAuthService(db);
        var repService = new RepService(db, authService);
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

        var controller = new RepController(repService);
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
        var authService = CreateAuthService(db);
        var repService = new RepService(db, authService);
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

        var controller = new RepController(repService);
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
        var authService = CreateAuthService(db);
        var repService = new RepService(db, authService);
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

        var controller = new RepController(repService);
        ControllerTestHelpers.SetUser(controller, rep.Id, "customer_rep");

        var result = await controller.DeleteAuction(item.Id);

        result.Should().BeOfType<NoContentResult>();
        var updatedItem = await db.Items.FindAsync(item.Id);
        updatedItem!.Status.Should().Be(ItemStatus.Removed);
    }
}

