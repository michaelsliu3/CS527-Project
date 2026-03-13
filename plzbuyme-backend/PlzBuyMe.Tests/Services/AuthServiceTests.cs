using System.IdentityModel.Tokens.Jwt;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using PlzBuyMe.Api.Models;
using PlzBuyMe.Api.Services;
using PlzBuyMe.Api.Data;
using PlzBuyMe.Tests.Helpers;

namespace PlzBuyMe.Tests.Services;

public class AuthServiceTests
{
    private static IConfiguration CreateTestJwtConfig()
    {
        return new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Jwt:Key"] = "TestKeyThatIsAtLeast32CharactersLong!",
                ["Jwt:Issuer"] = "TestIssuer",
                ["Jwt:Audience"] = "TestAudience",
                ["Jwt:ExpiresInMinutes"] = "60"
            })
            .Build();
    }

    private static AuthService CreateAuthService(AppDbContext db, IConfiguration? config = null)
    {
        return new AuthService(db, config ?? CreateTestJwtConfig());
    }

    [Fact]
    public void HashPassword_And_VerifyPassword_Roundtrip_Succeeds()
    {
        using var context = TestDbContextFactory.Create();
        var authService = CreateAuthService(context);
        var password = "MySecretPassword123!";
        var hash = authService.HashPassword(password);
        hash.Should().NotBeNullOrEmpty();
        authService.VerifyPassword(password, hash).Should().BeTrue();
        authService.VerifyPassword("WrongPassword", hash).Should().BeFalse();
    }

    [Fact]
    public void GenerateJwt_ContainsCorrectClaims_And_Expiry()
    {
        using var context = TestDbContextFactory.Create();
        var user = new User
        {
            Id = 42,
            Username = "jdoe",
            Email = "jdoe@example.com",
            PasswordHash = "ignored",
            Role = UserRole.EndUser,
            IsActive = true
        };
        context.Users.Add(user);
        context.SaveChanges();

        var authService = CreateAuthService(context);
        var token = authService.GenerateJwt(user);
        token.Should().NotBeNullOrEmpty();

        var handler = new JwtSecurityTokenHandler();
        var jwt = handler.ReadJwtToken(token);
        jwt.Claims.Should().Contain(c => c.Value == "42");
        jwt.Claims.Should().Contain(c => c.Value == "jdoe");
        jwt.Claims.Should().Contain(c => c.Value == "jdoe@example.com");
        jwt.Claims.Should().Contain(c => c.Value == "end_user");
        jwt.ValidTo.Should().BeAfter(DateTime.UtcNow);
        jwt.ValidTo.Should().BeCloseTo(DateTime.UtcNow.AddMinutes(60), TimeSpan.FromMinutes(1));
    }

    [Fact]
    public void GenerateJwt_EmitsAdminRole_AsAdmin()
    {
        using var context = TestDbContextFactory.Create();
        var user = new User
        {
            Id = 1,
            Username = "admin",
            Email = "admin@test.com",
            PasswordHash = "x",
            Role = UserRole.Admin,
            IsActive = true
        };
        context.Users.Add(user);
        context.SaveChanges();
        var authService = CreateAuthService(context);
        var token = authService.GenerateJwt(user);
        var jwt = new JwtSecurityTokenHandler().ReadJwtToken(token);
        jwt.Claims.Should().Contain(c => c.Value == "admin");
    }
}
