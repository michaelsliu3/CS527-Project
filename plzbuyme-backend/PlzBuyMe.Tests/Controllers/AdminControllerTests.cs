using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using PlzBuyMe.Api.Controllers;
using PlzBuyMe.Api.Data;
using PlzBuyMe.Api.Dtos.Admin;
using PlzBuyMe.Api.Models;
using PlzBuyMe.Api.Services;
using PlzBuyMe.Tests.E2E;
using PlzBuyMe.Tests.Helpers;
using Xunit;

namespace PlzBuyMe.Tests.Controllers;

public class AdminControllerTests
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
    public async Task CreateRep_WithAdmin_CreatesRepWithCorrectRole()
    {
        await using var db = CreateDbContext();
        var admin = new User
        {
            Username = "admin",
            Email = "admin@example.com",
            PasswordHash = "hash",
            Role = UserRole.Admin,
            IsActive = true
        };
        db.Users.Add(admin);
        await db.SaveChangesAsync();

        var authService = CreateAuthService(db);
        var reportService = new ReportService(db);
        var controller = new AdminController(authService, reportService);
        ControllerTestHelpers.SetUser(controller, admin.Id, "admin");

        var dto = new CreateRepDto
        {
            Username = "newrep",
            Email = "newrep@example.com",
            Password = "securepass123"
        };

        var result = await controller.CreateRep(dto);

        result.Should().BeOfType<ObjectResult>();
        var objectResult = (ObjectResult)result;
        objectResult.StatusCode.Should().Be(201);
        var body = objectResult.Value.Should().BeOfType<CreateRepResponseDto>().Subject;
        body.Username.Should().Be("newrep");
        body.Email.Should().Be("newrep@example.com");
        body.Id.Should().BeGreaterThan(0);

        var created = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Username == "newrep");
        created.Should().NotBeNull();
        created!.Role.Should().Be(UserRole.CustomerRep);
        created.IsActive.Should().BeTrue();
    }

    [Fact]
    public async Task CreateRep_WithNonAdmin_ReturnsForbidden()
    {
        var factory = new PlzBuyMeWebApplicationFactory();
        var client = factory.CreateClient();
        // Seed runs on app start in factory; seller1 exists with password "password"

        var loginResponse = await client.PostAsJsonAsync("api/auth/login", new { username = "seller1", password = "password" });
        loginResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var auth = await loginResponse.Content.ReadFromJsonAsync<PlzBuyMe.Api.Dtos.Auth.AuthResponseDto>();
        auth.Should().NotBeNull();
        auth!.Token.Should().NotBeNullOrEmpty();

        var request = new HttpRequestMessage(HttpMethod.Post, "api/admin/reps");
        request.Headers.Add("Authorization", "Bearer " + auth.Token);
        request.Content = JsonContent.Create(new { username = "newrep", email = "newrep@example.com", password = "pass123" });
        var response = await client.SendAsync(request);

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }
}
