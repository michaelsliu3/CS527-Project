using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;

namespace PlzBuyMe.Tests.Helpers;

public static class ControllerTestHelpers
{
    /// <summary>Sets the controller's User to an authenticated user with the given id and optional role.</summary>
    public static void SetUser(ControllerBase controller, int userId, string? role = null)
    {
        var identity = new ClaimsIdentity("Test");
        identity.AddClaim(new Claim(ClaimTypes.NameIdentifier, userId.ToString()));
        if (role != null)
            identity.AddClaim(new Claim(ClaimTypes.Role, role));
        var principal = new ClaimsPrincipal(identity);
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new Microsoft.AspNetCore.Http.DefaultHttpContext { User = principal },
            RouteData = new Microsoft.AspNetCore.Routing.RouteData(),
            ActionDescriptor = new Microsoft.AspNetCore.Mvc.Controllers.ControllerActionDescriptor()
        };
    }
}
