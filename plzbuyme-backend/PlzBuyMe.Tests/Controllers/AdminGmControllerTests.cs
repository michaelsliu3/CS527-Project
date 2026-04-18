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

    [Fact]
    public async Task CategoryFieldCrud_AsAdmin_CreateAndDelete_ReturnsOk()
    {
        var factory = new PlzBuyMeWebApplicationFactory();
        var client = factory.CreateClient();

        var loginResponse = await client.PostAsJsonAsync("api/auth/login", new { username = "admin", password = "admin123" });
        loginResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var auth = await loginResponse.Content.ReadFromJsonAsync<AuthResponseDto>();
        auth.Should().NotBeNull();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth!.Token);

        var categories = await client.GetFromJsonAsync<List<CategoryResponseStub>>("api/categories");
        categories.Should().NotBeNull();
        var categoryId = FindFirstLeafCategoryId(categories!);
        categoryId.Should().BeGreaterThan(0);
        var createResponse = await client.PostAsJsonAsync(
            $"api/admin/gm/categories/{categoryId}/fields",
            new
            {
                fieldName = "Length",
                fieldType = "number",
                isRequired = false
            });

        createResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var created = await createResponse.Content.ReadFromJsonAsync<CategoryFieldMutationResponseStub>();
        created.Should().NotBeNull();
        created!.Id.Should().BeGreaterThan(0);
        created.FieldType.Should().Be("number");
        created.CategoryId.Should().Be(categoryId);

        var rootFields = await client.GetFromJsonAsync<List<CategoryFieldResponseStub>>($"api/categories/{categoryId}/fields");
        rootFields.Should().NotBeNull();
        rootFields!.Any(f => f.Id == created.Id).Should().BeTrue();

        var deleteResponse = await client.DeleteAsync($"api/admin/gm/fields/{created.Id}");
        deleteResponse.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task CategoryFieldDelete_WhenCalled_ReturnsBadRequest()
    {
        var factory = new PlzBuyMeWebApplicationFactory();
        var client = factory.CreateClient();

        var loginResponse = await client.PostAsJsonAsync("api/auth/login", new { username = "admin", password = "admin123" });
        loginResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var auth = await loginResponse.Content.ReadFromJsonAsync<AuthResponseDto>();
        auth.Should().NotBeNull();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth!.Token);

        var categories = await client.GetFromJsonAsync<List<CategoryResponseStub>>("api/categories");
        categories.Should().NotBeNull();
        var categoryId = FindFirstLeafCategoryId(categories!);
        categoryId.Should().BeGreaterThan(0);

        var fields = await client.GetFromJsonAsync<List<CategoryFieldResponseStub>>($"api/categories/{categoryId}/fields");
        if (fields == null || fields.Count == 0)
        {
            var allIds = FlattenCategoryIds(categories!);
            foreach (var id in allIds)
            {
                var candidate = await client.GetFromJsonAsync<List<CategoryFieldResponseStub>>($"api/categories/{id}/fields");
                if (candidate is { Count: > 0 })
                {
                    fields = candidate;
                    break;
                }
            }
        }
        fields.Should().NotBeNull();
        var existingFieldId = fields!.Select(f => f.Id).FirstOrDefault(id => id > 0);
        existingFieldId.Should().BeGreaterThan(0);

        var deleteResponse = await client.DeleteAsync($"api/admin/gm/fields/{existingFieldId}");
        deleteResponse.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    private static int FindFirstLeafCategoryId(List<CategoryResponseStub> roots)
    {
        foreach (var category in roots)
        {
            if (category.Children == null || category.Children.Count == 0)
                return category.Id;

            var nested = FindFirstLeafCategoryId(category.Children);
            if (nested > 0)
                return nested;
        }

        return 0;
    }

    private static List<int> FlattenCategoryIds(List<CategoryResponseStub> nodes)
    {
        var ids = new List<int>();
        foreach (var node in nodes)
        {
            ids.Add(node.Id);
            if (node.Children.Count > 0)
                ids.AddRange(FlattenCategoryIds(node.Children));
        }
        return ids;
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

    private sealed class CategoryResponseStub
    {
        public int Id { get; set; }
        public List<CategoryResponseStub> Children { get; set; } = new();
    }

    private sealed class CategoryFieldResponseStub
    {
        public int Id { get; set; }
    }

    private sealed class CategoryFieldMutationResponseStub
    {
        public int Id { get; set; }
        public string FieldType { get; set; } = string.Empty;
        public int CategoryId { get; set; }
    }
}
