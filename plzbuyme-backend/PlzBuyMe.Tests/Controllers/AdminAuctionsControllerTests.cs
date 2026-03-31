using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using FluentAssertions;
using PlzBuyMe.Api.Dtos.Auth;
using PlzBuyMe.Tests.E2E;
using Xunit;

namespace PlzBuyMe.Tests.Controllers;

public class AdminAuctionsControllerTests
{
    [Fact]
    public async Task Patch_AsEndUser_ReturnsForbidden()
    {
        var factory = new PlzBuyMeWebApplicationFactory();
        var client = factory.CreateClient();

        var loginResponse = await client.PostAsJsonAsync("api/auth/login", new { username = "seller1", password = "password" });
        var auth = await loginResponse.Content.ReadFromJsonAsync<AuthResponseDto>();
        auth.Should().NotBeNull();

        var request = new HttpRequestMessage(HttpMethod.Patch, "api/admin/auctions/1");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", auth!.Token);
        request.Content = JsonContent.Create(new { title = "x" });
        var response = await client.SendAsync(request);

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task Patch_AsAdmin_UpdatesTitle_ReturnsOk()
    {
        var factory = new PlzBuyMeWebApplicationFactory();
        var client = factory.CreateClient();

        var loginResponse = await client.PostAsJsonAsync("api/auth/login", new { username = "admin", password = "admin123" });
        var auth = await loginResponse.Content.ReadFromJsonAsync<AuthResponseDto>();
        auth.Should().NotBeNull();

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth!.Token);
        var response = await client.PatchAsJsonAsync("api/admin/auctions/1", new { title = "Admin renamed listing" });

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<TitleStub>();
        body.Should().NotBeNull();
        body!.Title.Should().Be("Admin renamed listing");
    }

    [Fact]
    public async Task Patch_AsAdmin_EndAuctionClosed_ReturnsOkAndClosedStatus()
    {
        var factory = new PlzBuyMeWebApplicationFactory();
        var client = factory.CreateClient();

        var loginResponse = await client.PostAsJsonAsync("api/auth/login", new { username = "admin", password = "admin123" });
        var auth = await loginResponse.Content.ReadFromJsonAsync<AuthResponseDto>();
        auth.Should().NotBeNull();

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth!.Token);
        var response = await client.PatchAsJsonAsync("api/admin/auctions/1", new { endAuction = "closed" });

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<StatusStub>();
        body.Should().NotBeNull();
        body!.Status.Should().Be("closed");
    }

    private sealed class TitleStub
    {
        public string Title { get; set; } = string.Empty;
    }

    private sealed class StatusStub
    {
        public string Status { get; set; } = string.Empty;
    }
}
