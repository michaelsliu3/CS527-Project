using System.Security.Claims;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc;
using Moq;
using PlzBuyMe.Api.Controllers;
using PlzBuyMe.Api.Dtos.Auth;
using PlzBuyMe.Api.Services;
using Xunit;

namespace PlzBuyMe.Tests.Controllers;

public class AuthControllerTests
{
    private static AuthController CreateController(Mock<IAuthService> authServiceMock)
    {
        var controller = new AuthController(authServiceMock.Object);
        return controller;
    }

    private static void SetUser(ControllerBase controller, int userId)
    {
        var httpContext = new Microsoft.AspNetCore.Http.DefaultHttpContext();
        httpContext.User = new ClaimsPrincipal(new ClaimsIdentity(new[]
        {
            new Claim(ClaimTypes.NameIdentifier, userId.ToString())
        }, "Test"));
        controller.ControllerContext = new Microsoft.AspNetCore.Mvc.ControllerContext
        {
            HttpContext = httpContext,
            RouteData = new Microsoft.AspNetCore.Routing.RouteData(),
            ActionDescriptor = new Microsoft.AspNetCore.Mvc.Controllers.ControllerActionDescriptor()
        };
    }

    [Fact]
    public async Task Register_WhenValid_CreatesUser_AndReturnsOkWithJwt()
    {
        var response = new AuthResponseDto
        {
            Token = "jwt-token-123",
            Username = "newuser",
            Email = "new@example.com",
            Role = "end_user",
            UserId = 10
        };
        var mock = new Mock<IAuthService>();
        mock.Setup(s => s.RegisterAsync(It.IsAny<RegisterDto>())).ReturnsAsync(new RegisterResult { Data = response });
        var controller = CreateController(mock);

        var dto = new RegisterDto { Username = "newuser", Email = "new@example.com", Password = "pass123" };
        var result = await controller.Register(dto);

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        var body = ok.Value.Should().BeOfType<AuthResponseDto>().Subject;
        body.Token.Should().Be("jwt-token-123");
        body.Username.Should().Be("newuser");
        body.UserId.Should().Be(10);
        mock.Verify(s => s.RegisterAsync(It.Is<RegisterDto>(r => r.Username == "newuser" && r.Email == "new@example.com")), Times.Once);
    }

    [Fact]
    public async Task Register_WhenDuplicateUsername_ReturnsBadRequest_WithUsernameTakenCode()
    {
        var mock = new Mock<IAuthService>();
        mock.Setup(s => s.RegisterAsync(It.IsAny<RegisterDto>())).ReturnsAsync(new RegisterResult { FailureReason = RegisterFailureReason.UsernameTaken });
        var controller = CreateController(mock);

        var dto = new RegisterDto { Username = "admin", Email = "other@example.com", Password = "pass12" };
        var result = await controller.Register(dto);

        var badRequest = result.Should().BeOfType<BadRequestObjectResult>().Subject;
        var body = badRequest.Value.Should().BeOfType<AuthErrorDto>().Subject;
        body.Code.Should().Be(nameof(RegisterFailureReason.UsernameTaken));
        body.Message.Should().NotBeNullOrEmpty();
        mock.Verify(s => s.RegisterAsync(It.IsAny<RegisterDto>()), Times.Once);
    }

    [Fact]
    public async Task Register_WhenDuplicateEmail_ReturnsBadRequest_WithEmailTakenCode()
    {
        var mock = new Mock<IAuthService>();
        mock.Setup(s => s.RegisterAsync(It.IsAny<RegisterDto>())).ReturnsAsync(new RegisterResult { FailureReason = RegisterFailureReason.EmailTaken });
        var controller = CreateController(mock);

        var dto = new RegisterDto { Username = "newuser", Email = "admin@plzbuy.me", Password = "pass12" };
        var result = await controller.Register(dto);

        var badRequest = result.Should().BeOfType<BadRequestObjectResult>().Subject;
        var body = badRequest.Value.Should().BeOfType<AuthErrorDto>().Subject;
        body.Code.Should().Be(nameof(RegisterFailureReason.EmailTaken));
        body.Message.Should().NotBeNullOrEmpty();
    }

    [Fact]
    public async Task Register_WhenPasswordTooShort_ReturnsBadRequest()
    {
        var controller = CreateController(new Mock<IAuthService>());
        var dto = new RegisterDto { Username = "u", Email = "u@example.com", Password = "12345" };
        var result = await controller.Register(dto);
        result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task Register_WhenEmailInvalid_ReturnsBadRequest()
    {
        var controller = CreateController(new Mock<IAuthService>());
        var dto = new RegisterDto { Username = "user", Email = "notanemail", Password = "password" };
        var result = await controller.Register(dto);
        result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task Login_WhenValid_ReturnsOkWithJwt()
    {
        var response = new AuthResponseDto
        {
            Token = "valid-jwt",
            Username = "admin",
            Email = "admin@plzbuy.me",
            Role = "admin",
            UserId = 1
        };
        var mock = new Mock<IAuthService>();
        mock.Setup(s => s.LoginAsync(It.IsAny<LoginDto>())).ReturnsAsync(new LoginResult { Data = response });
        var controller = CreateController(mock);

        var dto = new LoginDto { Username = "admin", Password = "admin123" };
        var result = await controller.Login(dto);

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        var body = ok.Value.Should().BeOfType<AuthResponseDto>().Subject;
        body.Token.Should().Be("valid-jwt");
        body.Username.Should().Be("admin");
    }

    [Fact]
    public async Task Login_WithEmailInUsernameField_ReturnsOkWithJwt()
    {
        var response = new AuthResponseDto
        {
            Token = "jwt-from-email-login",
            Username = "seller1",
            Email = "seller1@example.com",
            Role = "end_user",
            UserId = 2
        };
        var mock = new Mock<IAuthService>();
        mock.Setup(s => s.LoginAsync(It.IsAny<LoginDto>())).ReturnsAsync(new LoginResult { Data = response });
        var controller = CreateController(mock);

        var dto = new LoginDto { Username = "seller1@example.com", Password = "password" };
        var result = await controller.Login(dto);

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        var body = ok.Value.Should().BeOfType<AuthResponseDto>().Subject;
        body.Token.Should().Be("jwt-from-email-login");
        body.Username.Should().Be("seller1");
        body.Email.Should().Be("seller1@example.com");
        mock.Verify(s => s.LoginAsync(It.Is<LoginDto>(l => l.Username == "seller1@example.com" && l.Password == "password")), Times.Once);
    }

    [Fact]
    public async Task Login_WhenWrongPassword_ReturnsUnauthorized_WithInvalidPasswordCode()
    {
        var mock = new Mock<IAuthService>();
        mock.Setup(s => s.LoginAsync(It.IsAny<LoginDto>())).ReturnsAsync(new LoginResult { FailureReason = LoginFailureReason.InvalidPassword });
        var controller = CreateController(mock);

        var dto = new LoginDto { Username = "admin", Password = "wrong" };
        var result = await controller.Login(dto);

        var unauthorized = result.Should().BeOfType<UnauthorizedObjectResult>().Subject;
        var body = unauthorized.Value.Should().BeOfType<AuthErrorDto>().Subject;
        body.Code.Should().Be(nameof(LoginFailureReason.InvalidPassword));
        body.Message.Should().NotBeNullOrEmpty();
    }

    [Fact]
    public async Task Login_WhenInactiveUser_ReturnsUnauthorized_WithAccountInactiveCode()
    {
        var mock = new Mock<IAuthService>();
        mock.Setup(s => s.LoginAsync(It.IsAny<LoginDto>())).ReturnsAsync(new LoginResult { FailureReason = LoginFailureReason.AccountInactive });
        var controller = CreateController(mock);

        var dto = new LoginDto { Username = "inactiveuser", Password = "pass" };
        var result = await controller.Login(dto);

        var unauthorized = result.Should().BeOfType<UnauthorizedObjectResult>().Subject;
        var body = unauthorized.Value.Should().BeOfType<AuthErrorDto>().Subject;
        body.Code.Should().Be(nameof(LoginFailureReason.AccountInactive));
        body.Message.Should().NotBeNullOrEmpty();
    }

    [Fact]
    public async Task GetProfile_WhenAuthorized_ReturnsProfile()
    {
        var profile = new ProfileDto { Id = 5, Username = "joe", Email = "joe@example.com", Role = "end_user" };
        var mock = new Mock<IAuthService>();
        mock.Setup(s => s.GetProfileAsync(5)).ReturnsAsync(profile);
        var controller = CreateController(mock);
        SetUser(controller, 5);

        var result = await controller.GetProfile();

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        var body = ok.Value.Should().BeOfType<ProfileDto>().Subject;
        body.Username.Should().Be("joe");
        body.Id.Should().Be(5);
    }

    [Fact]
    public async Task DeleteProfile_WhenAuthorized_SoftDeletes_AndReturnsNoContent()
    {
        var mock = new Mock<IAuthService>();
        mock.Setup(s => s.DeleteProfileAsync(7)).ReturnsAsync(true);
        var controller = CreateController(mock);
        SetUser(controller, 7);

        var result = await controller.DeleteProfile();

        result.Should().BeOfType<NoContentResult>();
        mock.Verify(s => s.DeleteProfileAsync(7), Times.Once);
    }

    [Fact]
    public async Task DeleteProfile_WhenUserNotFound_ReturnsNotFound()
    {
        var mock = new Mock<IAuthService>();
        mock.Setup(s => s.DeleteProfileAsync(999)).ReturnsAsync(false);
        var controller = CreateController(mock);
        SetUser(controller, 999);

        var result = await controller.DeleteProfile();

        result.Should().BeOfType<NotFoundResult>();
    }
}
