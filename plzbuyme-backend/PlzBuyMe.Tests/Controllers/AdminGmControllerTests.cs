using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using FluentAssertions;
using PlzBuyMe.Api.Dtos.Auth;
using PlzBuyMe.Tests.E2E;
using Xunit;

namespace PlzBuyMe.Tests.Controllers;

public class AdminGmControllerTests
{
    [Fact]
    public async Task SeedAuctions_AsEndUser_ReturnsForbidden()
    {
        var factory = new PlzBuyMeWebApplicationFactory();
        var client = factory.CreateClient();

        var loginResponse = await client.PostAsJsonAsync("api/auth/login", new { username = "seller1", password = "password" });
        loginResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var auth = await loginResponse.Content.ReadFromJsonAsync<AuthResponseDto>();
        auth.Should().NotBeNull();

        var request = new HttpRequestMessage(HttpMethod.Post, "api/admin/gm/auctions/seed");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", auth!.Token);
        request.Content = JsonContent.Create(new { count = 1, bidCountMin = 0, bidCountMax = 0 });
        var response = await client.SendAsync(request);

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task SeedAuctions_AsAdmin_InvalidCount_ReturnsBadRequest()
    {
        var factory = new PlzBuyMeWebApplicationFactory();
        var client = factory.CreateClient();

        var loginResponse = await client.PostAsJsonAsync("api/auth/login", new { username = "admin", password = "admin123" });
        loginResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var auth = await loginResponse.Content.ReadFromJsonAsync<AuthResponseDto>();
        auth.Should().NotBeNull();

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth!.Token);
        var response = await client.PostAsJsonAsync(
            "api/admin/gm/auctions/seed",
            new { count = 999, bidCountMin = 0, bidCountMax = 0 });

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task SeedAuctions_AsAdmin_Valid_ReturnsOkWithBoundedBatch()
    {
        var factory = new PlzBuyMeWebApplicationFactory();
        var client = factory.CreateClient();

        var loginResponse = await client.PostAsJsonAsync("api/auth/login", new { username = "admin", password = "admin123" });
        loginResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var auth = await loginResponse.Content.ReadFromJsonAsync<AuthResponseDto>();
        auth.Should().NotBeNull();

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth!.Token);
        var response = await client.PostAsJsonAsync(
            "api/admin/gm/auctions/seed",
            new { count = 1, bidCountMin = 0, bidCountMax = 0 });

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<SeedAuctionsResponseStub>();
        body.Should().NotBeNull();
        body!.CreatedCount.Should().Be(1);
    }

    [Fact]
    public async Task SeedSoldAuctions_AsEndUser_ReturnsForbidden()
    {
        var factory = new PlzBuyMeWebApplicationFactory();
        var client = factory.CreateClient();

        var loginResponse = await client.PostAsJsonAsync("api/auth/login", new { username = "seller1", password = "password" });
        loginResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var auth = await loginResponse.Content.ReadFromJsonAsync<AuthResponseDto>();
        auth.Should().NotBeNull();

        var request = new HttpRequestMessage(HttpMethod.Post, "api/admin/gm/auctions/seed-sold");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", auth!.Token);
        request.Content = JsonContent.Create(new { count = 1 });
        var response = await client.SendAsync(request);

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task SeedSoldAuctions_AsAdmin_ReturnsOk()
    {
        var factory = new PlzBuyMeWebApplicationFactory();
        var client = factory.CreateClient();

        var loginResponse = await client.PostAsJsonAsync("api/auth/login", new { username = "admin", password = "admin123" });
        loginResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var auth = await loginResponse.Content.ReadFromJsonAsync<AuthResponseDto>();
        auth.Should().NotBeNull();

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth!.Token);
        var response = await client.PostAsJsonAsync(
            "api/admin/gm/auctions/seed-sold",
            new { count = 2, bidCountMin = 0, bidCountMax = 1, closedWithoutSaleRatio = 0.5 });

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<SeedSoldAuctionsResponseStub>();
        body.Should().NotBeNull();
        (body!.CreatedSoldCount + body.CreatedClosedCount).Should().Be(2);
    }

    [Fact]
    public async Task BulkCloseActive_AsAdmin_ReturnsOk()
    {
        var factory = new PlzBuyMeWebApplicationFactory();
        var client = factory.CreateClient();

        var loginResponse = await client.PostAsJsonAsync("api/auth/login", new { username = "admin", password = "admin123" });
        loginResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var auth = await loginResponse.Content.ReadFromJsonAsync<AuthResponseDto>();
        auth.Should().NotBeNull();

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth!.Token);
        var response = await client.PostAsJsonAsync("api/admin/gm/auctions/close-active", new { mode = "closed" });

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<BulkCloseResponseStub>();
        body.Should().NotBeNull();
        body!.ProcessedCount.Should().BeGreaterThan(0);
    }

    [Fact]
    public async Task RunCloseSweep_AsAdmin_ReturnsOk()
    {
        var factory = new PlzBuyMeWebApplicationFactory();
        var client = factory.CreateClient();

        var loginResponse = await client.PostAsJsonAsync("api/auth/login", new { username = "admin", password = "admin123" });
        loginResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var auth = await loginResponse.Content.ReadFromJsonAsync<AuthResponseDto>();
        auth.Should().NotBeNull();

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth!.Token);
        var response = await client.PostAsync("api/admin/gm/auctions/run-close-sweep", null);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task DeleteAllAuctions_AsEndUser_ReturnsForbidden()
    {
        var factory = new PlzBuyMeWebApplicationFactory();
        var client = factory.CreateClient();

        var loginResponse = await client.PostAsJsonAsync("api/auth/login", new { username = "seller1", password = "password" });
        loginResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var auth = await loginResponse.Content.ReadFromJsonAsync<AuthResponseDto>();
        auth.Should().NotBeNull();

        var request = new HttpRequestMessage(HttpMethod.Post, "api/admin/gm/auctions/delete-all");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", auth!.Token);
        var response = await client.SendAsync(request);

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task DeleteAllAuctions_AsAdmin_ReturnsOk()
    {
        var factory = new PlzBuyMeWebApplicationFactory();
        var client = factory.CreateClient();

        var loginResponse = await client.PostAsJsonAsync("api/auth/login", new { username = "admin", password = "admin123" });
        loginResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var auth = await loginResponse.Content.ReadFromJsonAsync<AuthResponseDto>();
        auth.Should().NotBeNull();

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth!.Token);
        var response = await client.PostAsync("api/admin/gm/auctions/delete-all", null);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<DeleteAllAuctionsResponseStub>();
        body.Should().NotBeNull();
        body!.ItemsDeleted.Should().BeGreaterThan(0);
    }

    [Fact]
    public async Task SearchManifestCars_AsEndUser_ReturnsForbidden()
    {
        var factory = new PlzBuyMeWebApplicationFactory();
        var client = factory.CreateClient();

        var loginResponse = await client.PostAsJsonAsync("api/auth/login", new { username = "seller1", password = "password" });
        loginResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var auth = await loginResponse.Content.ReadFromJsonAsync<AuthResponseDto>();
        auth.Should().NotBeNull();

        var request = new HttpRequestMessage(HttpMethod.Get, "api/admin/gm/manifest/cars?q=toyota&limit=5");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", auth!.Token);
        var response = await client.SendAsync(request);

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task SearchManifestCars_AsAdmin_ReturnsOk()
    {
        var factory = new PlzBuyMeWebApplicationFactory();
        var client = factory.CreateClient();

        var loginResponse = await client.PostAsJsonAsync("api/auth/login", new { username = "admin", password = "admin123" });
        loginResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var auth = await loginResponse.Content.ReadFromJsonAsync<AuthResponseDto>();
        auth.Should().NotBeNull();

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth!.Token);
        var response = await client.GetAsync("api/admin/gm/manifest/cars?q=honda&limit=3");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<List<ManifestCarResponseStub>>();
        body.Should().NotBeNull();
        body!.Count.Should().BeLessOrEqualTo(3);
    }

    private sealed class SeedAuctionsResponseStub
    {
        public int CreatedCount { get; set; }
    }

    private sealed class BulkCloseResponseStub
    {
        public int ProcessedCount { get; set; }
    }

    private sealed class DeleteAllAuctionsResponseStub
    {
        public int ItemsDeleted { get; set; }
        public int BidsDeleted { get; set; }
    }

    private sealed class ManifestCarResponseStub
    {
        public string? Title { get; set; }
        public string? Make { get; set; }
        public string? Model { get; set; }
    }

    private sealed class SeedSoldAuctionsResponseStub
    {
        public int CreatedSoldCount { get; set; }
        public int CreatedClosedCount { get; set; }
        public int TotalBids { get; set; }
    }
}
