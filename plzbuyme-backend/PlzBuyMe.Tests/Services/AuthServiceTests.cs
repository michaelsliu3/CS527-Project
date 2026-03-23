using System.IdentityModel.Tokens.Jwt;
using FluentAssertions;
using Microsoft.Extensions.Configuration;
using PlzBuyMe.Api.Dtos.Auth;
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

    private static AuthService CreateAuthService(
        AppDbContext db,
        IConfiguration? config = null)
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

    [Fact]
    public void GenerateJwt_EmitsVipRole_And_DisplayNameColor_Claims()
    {
        using var context = TestDbContextFactory.Create();
        var user = new User
        {
            Id = 7,
            Username = "vip-user",
            Email = "vip@test.com",
            PasswordHash = "x",
            Role = UserRole.Vip,
            DisplayNameColor = "#AABBCC",
            IsActive = true
        };
        context.Users.Add(user);
        context.SaveChanges();

        var authService = CreateAuthService(context);
        var token = authService.GenerateJwt(user);
        var jwt = new JwtSecurityTokenHandler().ReadJwtToken(token);
        jwt.Claims.Should().Contain(c => c.Value == "vip");
        jwt.Claims.Should().Contain(c => c.Type == "display_name_color" && c.Value == "#AABBCC");
    }

    [Fact]
    public async Task UpdateDisplayNameColor_WhenVipAndValidHex_PersistsNormalizedColor()
    {
        using var context = TestDbContextFactory.Create();
        var user = new User
        {
            Username = "vip1",
            Email = "vip1@example.com",
            PasswordHash = "hash",
            Role = UserRole.Vip,
            IsActive = true
        };
        context.Users.Add(user);
        await context.SaveChangesAsync();

        var authService = CreateAuthService(context);
        var result = await authService.UpdateDisplayNameColorAsync(user.Id, "  #ab12cd ");

        result.NotFound.Should().BeFalse();
        result.Forbidden.Should().BeFalse();
        result.ValidationError.Should().BeNull();
        result.DisplayNameColor.Should().Be("#AB12CD");
        var persisted = await context.Users.FindAsync(user.Id);
        persisted!.DisplayNameColor.Should().Be("#AB12CD");
    }

    [Fact]
    public async Task UpdateDisplayNameColor_WhenVipAndAnimatedPreset_PersistsPreset()
    {
        using var context = TestDbContextFactory.Create();
        var user = new User
        {
            Username = "vip-preset",
            Email = "vip-preset@example.com",
            PasswordHash = "hash",
            Role = UserRole.Vip,
            IsActive = true
        };
        context.Users.Add(user);
        await context.SaveChangesAsync();

        var authService = CreateAuthService(context);
        var result = await authService.UpdateDisplayNameColorAsync(user.Id, "purpblu");

        result.NotFound.Should().BeFalse();
        result.Forbidden.Should().BeFalse();
        result.ValidationError.Should().BeNull();
        result.DisplayNameColor.Should().Be("PURPBLU");
        var persisted = await context.Users.FindAsync(user.Id);
        persisted!.DisplayNameColor.Should().Be("PURPBLU");
    }

    [Fact]
    public async Task UpdateDisplayNameColor_WhenVipAndNewAnimatedPreset_PersistsPreset()
    {
        using var context = TestDbContextFactory.Create();
        var user = new User
        {
            Username = "vip-new-preset",
            Email = "vip-new-preset@example.com",
            PasswordHash = "hash",
            Role = UserRole.Vip,
            IsActive = true
        };
        context.Users.Add(user);
        await context.SaveChangesAsync();

        var authService = CreateAuthService(context);
        var result = await authService.UpdateDisplayNameColorAsync(user.Id, "aurorax");

        result.NotFound.Should().BeFalse();
        result.Forbidden.Should().BeFalse();
        result.ValidationError.Should().BeNull();
        result.DisplayNameColor.Should().Be("AURORAX");
        var persisted = await context.Users.FindAsync(user.Id);
        persisted!.DisplayNameColor.Should().Be("AURORAX");
    }

    [Fact]
    public async Task UpdateDisplayNameColor_WhenEndUser_ReturnsForbidden()
    {
        using var context = TestDbContextFactory.Create();
        var user = new User
        {
            Username = "regular-user",
            Email = "regular@example.com",
            PasswordHash = "hash",
            Role = UserRole.EndUser,
            IsActive = true
        };
        context.Users.Add(user);
        await context.SaveChangesAsync();

        var authService = CreateAuthService(context);
        var result = await authService.UpdateDisplayNameColorAsync(user.Id, "#123456");

        result.Forbidden.Should().BeTrue();
        result.ValidationError.Should().BeNull();
        var persisted = await context.Users.FindAsync(user.Id);
        persisted!.DisplayNameColor.Should().BeNull();
    }

    [Fact]
    public async Task UpdateDisplayNameColor_WhenInvalidHex_ReturnsValidationError()
    {
        using var context = TestDbContextFactory.Create();
        var user = new User
        {
            Username = "vip2",
            Email = "vip2@example.com",
            PasswordHash = "hash",
            Role = UserRole.Vip,
            IsActive = true
        };
        context.Users.Add(user);
        await context.SaveChangesAsync();

        var authService = CreateAuthService(context);
        var result = await authService.UpdateDisplayNameColorAsync(user.Id, "blue");

        result.Forbidden.Should().BeFalse();
        result.ValidationError.Should().NotBeNullOrWhiteSpace();
        var persisted = await context.Users.FindAsync(user.Id);
        persisted!.DisplayNameColor.Should().BeNull();
    }

    [Fact]
    public async Task Login_ByEmail_ReturnsSameUserAsLoginByUsername()
    {
        using var context = TestDbContextFactory.Create();
        var password = "secret123";
        var user = new User
        {
            Username = "alice",
            Email = "alice@example.com",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(password),
            Role = UserRole.EndUser,
            IsActive = true
        };
        context.Users.Add(user);
        await context.SaveChangesAsync();

        var authService = CreateAuthService(context);
        var byUsername = await authService.LoginAsync(new LoginDto { Username = "alice", Password = password });
        var byEmail = await authService.LoginAsync(new LoginDto { Username = "alice@example.com", Password = password });

        byUsername.Success.Should().BeTrue();
        byEmail.Success.Should().BeTrue();
        byUsername.Data.Should().NotBeNull();
        byEmail.Data.Should().NotBeNull();
        byUsername.Data!.UserId.Should().Be(byEmail.Data!.UserId);
        byUsername.Data.Username.Should().Be("alice");
        byEmail.Data!.Username.Should().Be("alice");
    }

    [Fact]
    public async Task Login_ByEmail_WithWrongPassword_ReturnsInvalidPassword()
    {
        using var context = TestDbContextFactory.Create();
        var user = new User
        {
            Username = "bob",
            Email = "bob@example.com",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("correct"),
            Role = UserRole.EndUser,
            IsActive = true
        };
        context.Users.Add(user);
        await context.SaveChangesAsync();

        var authService = CreateAuthService(context);
        var result = await authService.LoginAsync(new LoginDto { Username = "bob@example.com", Password = "wrong" });

        result.Success.Should().BeFalse();
        result.FailureReason.Should().Be(LoginFailureReason.InvalidPassword);
    }

    [Fact]
    public async Task Login_ByEmail_WhenUserNotFound_ReturnsUserNotFound()
    {
        using var context = TestDbContextFactory.Create();
        var authService = CreateAuthService(context);

        var result = await authService.LoginAsync(new LoginDto { Username = "nobody@example.com", Password = "any" });

        result.Success.Should().BeFalse();
        result.FailureReason.Should().Be(LoginFailureReason.UserNotFound);
    }

    [Fact]
    public async Task UploadAvatar_WhenValidKey_SavesAndUpdatesAvatarUrl()
    {
        using var context = TestDbContextFactory.Create();
        var user = new User
        {
            Username = "avatar-user",
            Email = "avatar-user@example.com",
            PasswordHash = "hash",
            Role = UserRole.EndUser,
            IsActive = true
        };
        context.Users.Add(user);
        await context.SaveChangesAsync();

        var authService = CreateAuthService(context);
        user.AvatarUrl = "avatars/old-avatar.png";
        user.AvatarStorageKey = "avatars/old-avatar.png";
        await context.SaveChangesAsync();

        var result = await authService.UploadAvatarAsync(user.Id, "avatars/user-1-new.png");

        result.NotFound.Should().BeFalse();
        result.ValidationError.Should().BeNull();
        result.AvatarUrl.Should().Be("avatars/user-1-new.png");
        var persisted = await context.Users.FindAsync(user.Id);
        persisted!.AvatarUrl.Should().Be(result.AvatarUrl);
        persisted.AvatarStorageKey.Should().Be("avatars/user-1-new.png");
    }

    [Fact]
    public async Task UploadAvatar_WhenKeyInvalid_ReturnsValidationError()
    {
        using var context = TestDbContextFactory.Create();
        var user = new User
        {
            Username = "avatar-invalid",
            Email = "avatar-invalid@example.com",
            PasswordHash = "hash",
            Role = UserRole.EndUser,
            IsActive = true
        };
        context.Users.Add(user);
        await context.SaveChangesAsync();

        var authService = CreateAuthService(context);
        var result = await authService.UploadAvatarAsync(user.Id, "bad key");

        result.NotFound.Should().BeFalse();
        result.ValidationError.Should().Contain("invalid");
        result.AvatarUrl.Should().BeNull();
    }

    [Fact]
    public async Task UploadAvatar_WhenKeyMissing_ReturnsValidationError()
    {
        using var context = TestDbContextFactory.Create();
        var user = new User
        {
            Username = "avatar-large",
            Email = "avatar-large@example.com",
            PasswordHash = "hash",
            Role = UserRole.EndUser,
            IsActive = true
        };
        context.Users.Add(user);
        await context.SaveChangesAsync();

        var authService = CreateAuthService(context);
        var result = await authService.UploadAvatarAsync(user.Id, null);

        result.NotFound.Should().BeFalse();
        result.ValidationError.Should().Contain("required");
        result.AvatarUrl.Should().BeNull();
    }

    [Fact]
    public async Task DeleteProfile_WhenUserHasAvatar_ClearsAvatarAndSoftDeletesUser()
    {
        using var context = TestDbContextFactory.Create();
        var user = new User
        {
            Username = "avatar-delete",
            Email = "avatar-delete@example.com",
            PasswordHash = "hash",
            Role = UserRole.EndUser,
            IsActive = true
        };
        context.Users.Add(user);
        await context.SaveChangesAsync();

        user.AvatarUrl = "avatars/to-delete.png";
        user.AvatarStorageKey = "avatars/to-delete.png";
        await context.SaveChangesAsync();

        var authService = CreateAuthService(context);
        var deleted = await authService.DeleteProfileAsync(user.Id);

        deleted.Should().BeTrue();
        var persisted = await context.Users.FindAsync(user.Id);
        persisted.Should().NotBeNull();
        persisted!.IsActive.Should().BeFalse();
        persisted.AvatarUrl.Should().BeNull();
    }
}
