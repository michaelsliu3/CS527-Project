using System.Security.Claims;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc;
using Moq;
using PlzBuyMe.Api.Controllers;
using PlzBuyMe.Api.Dtos.Alerts;
using PlzBuyMe.Api.Services;
using Xunit;

namespace PlzBuyMe.Tests.Controllers;

public class AlertsControllerTests
{
    private static AlertsController CreateController(IAlertService alertService)
    {
        return new AlertsController(alertService);
    }

    private static void SetEndUser(ControllerBase controller, int userId)
    {
        var identity = new ClaimsIdentity("Test");
        identity.AddClaim(new Claim(ClaimTypes.NameIdentifier, userId.ToString()));
        identity.AddClaim(new Claim(ClaimTypes.Role, "end_user"));
        var principal = new ClaimsPrincipal(identity);
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new Microsoft.AspNetCore.Http.DefaultHttpContext { User = principal },
            RouteData = new Microsoft.AspNetCore.Routing.RouteData(),
            ActionDescriptor = new Microsoft.AspNetCore.Mvc.Controllers.ControllerActionDescriptor()
        };
    }

    [Fact]
    public async Task CreateAlert_ReturnsCorrectResponse()
    {
        var mock = new Mock<IAlertService>();
        var response = new AlertResponseDto
        {
            Id = 1,
            UserId = 10,
            CategoryId = 5,
            Keyword = "Tesla",
            Criteria = null,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };
        mock.Setup(s => s.CreateAlertAsync(10, It.IsAny<CreateAlertDto>())).ReturnsAsync(response);
        var controller = CreateController(mock.Object);
        SetEndUser(controller, 10);

        var dto = new CreateAlertDto { CategoryId = 5, Keyword = "Tesla", Criteria = null };
        var result = await controller.Create(dto);

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        var body = ok.Value.Should().BeOfType<AlertResponseDto>().Subject;
        body.Id.Should().Be(1);
        body.Keyword.Should().Be("Tesla");
        body.UserId.Should().Be(10);
        mock.Verify(s => s.CreateAlertAsync(10, It.Is<CreateAlertDto>(d => d.Keyword == "Tesla" && d.CategoryId == 5)), Times.Once);
    }

    [Fact]
    public async Task Delete_UserCanOnlyDeleteOwnAlerts_ReturnsNotFoundForOtherUser()
    {
        var mock = new Mock<IAlertService>();
        mock.Setup(s => s.DeleteAlertAsync(1, 99)).ReturnsAsync(false);
        var controller = CreateController(mock.Object);
        SetEndUser(controller, 99);

        var result = await controller.Delete(1);

        result.Should().BeOfType<NotFoundResult>();
        mock.Verify(s => s.DeleteAlertAsync(1, 99), Times.Once);
    }

    [Fact]
    public async Task Delete_OwnAlert_ReturnsNoContent()
    {
        var mock = new Mock<IAlertService>();
        mock.Setup(s => s.DeleteAlertAsync(1, 10)).ReturnsAsync(true);
        var controller = CreateController(mock.Object);
        SetEndUser(controller, 10);

        var result = await controller.Delete(1);

        result.Should().BeOfType<NoContentResult>();
        mock.Verify(s => s.DeleteAlertAsync(1, 10), Times.Once);
    }
}
