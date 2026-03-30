using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;
using PlzBuyMe.Api.Dtos.Auth;
using Xunit;

namespace PlzBuyMe.Tests.E2E;

public class WalletE2ETests : IClassFixture<PlzBuyMeWebApplicationFactory>
{
    private readonly HttpClient _client;
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    public WalletE2ETests(PlzBuyMeWebApplicationFactory factory)
    {
        _client = factory.CreateClient();
    }

    private async Task<string> LoginAsync(string username, string password)
    {
        var loginDto = new { username, password };
        var response = await _client.PostAsJsonAsync("api/auth/login", loginDto);
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var auth = await response.Content.ReadFromJsonAsync<AuthResponseDto>(JsonOptions);
        auth.Should().NotBeNull();
        auth!.Token.Should().NotBeNullOrEmpty();
        return auth.Token;
    }

    [Fact]
    public async Task Wallet_Withdraw_WithinAvailable_ReturnsOk()
    {
        var token = await LoginAsync("seller1", "password");

        var req = new HttpRequestMessage(HttpMethod.Post, "api/wallet/withdraw");
        req.Headers.Add("Authorization", "Bearer " + token);
        req.Content = JsonContent.Create(new { amount = 100m });

        var res = await _client.SendAsync(req);
        var body = await res.Content.ReadAsStringAsync();
        res.StatusCode.Should().Be(HttpStatusCode.OK, because: $"response body: {body}");
    }

    [Fact]
    public async Task Wallet_Deposit_ReturnsOk()
    {
        var token = await LoginAsync("seller1", "password");

        var req = new HttpRequestMessage(HttpMethod.Post, "api/wallet/deposit");
        req.Headers.Add("Authorization", "Bearer " + token);
        req.Content = JsonContent.Create(new { amount = 25m });

        var res = await _client.SendAsync(req);
        var body = await res.Content.ReadAsStringAsync();
        res.StatusCode.Should().Be(HttpStatusCode.OK, because: $"response body: {body}");
    }

    [Fact]
    public async Task Wallet_Withdraw_ExceedingAvailable_ReturnsBadRequest()
    {
        // bidder2 has 500k balance and ~23k held on Camry — spendable is below 500k
        var token = await LoginAsync("bidder2", "password");

        var req = new HttpRequestMessage(HttpMethod.Post, "api/wallet/withdraw");
        req.Headers.Add("Authorization", "Bearer " + token);
        req.Content = JsonContent.Create(new { amount = 500_000m });

        var res = await _client.SendAsync(req);
        res.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var body = await res.Content.ReadAsStringAsync();
        body.Should().Contain("available", because: body);
    }

    [Fact]
    public async Task Wallet_Withdraw_MissingAmount_ReturnsBadRequest()
    {
        var token = await LoginAsync("seller1", "password");

        var req = new HttpRequestMessage(HttpMethod.Post, "api/wallet/withdraw");
        req.Headers.Add("Authorization", "Bearer " + token);
        req.Content = JsonContent.Create(new { });

        var res = await _client.SendAsync(req);
        res.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }
}
