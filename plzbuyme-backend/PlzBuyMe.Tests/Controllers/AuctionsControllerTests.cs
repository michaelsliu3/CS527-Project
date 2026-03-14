using System.Security.Claims;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Moq;
using PlzBuyMe.Api.Controllers;
using PlzBuyMe.Api.Dtos.Auctions;
using PlzBuyMe.Api.Services;
using Xunit;

namespace PlzBuyMe.Tests.Controllers;

public class AuctionsControllerTests
{
    private static AuctionsController CreateController(Mock<IAuctionService> auctionServiceMock)
    {
        return new AuctionsController(auctionServiceMock.Object);
    }

    private static void SetUser(ControllerBase controller, int userId)
    {
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext
            {
                User = new ClaimsPrincipal(new ClaimsIdentity(new[]
                {
                    new Claim(ClaimTypes.NameIdentifier, userId.ToString())
                }, "Test"))
            },
            RouteData = new Microsoft.AspNetCore.Routing.RouteData(),
            ActionDescriptor = new Microsoft.AspNetCore.Mvc.Controllers.ControllerActionDescriptor()
        };
    }

    [Fact]
    public async Task Search_ReturnsPaginatedResults()
    {
        var expected = new PaginatedResultDto<AuctionListDto>
        {
            Items = new List<AuctionListDto> { new() { Id = 1, Title = "A", CurrentPrice = 100m, CloseDateTime = DateTime.UtcNow, Status = "active", CategoryName = "Cars", SellerUsername = "s", BidCount = 0 } },
            TotalCount = 1,
            Page = 1,
            PageSize = 20
        };
        var mock = new Mock<IAuctionService>();
        mock.Setup(s => s.SearchAsync(It.IsAny<SearchQueryDto>())).ReturnsAsync(expected);
        var controller = CreateController(mock);

        var result = await controller.Search(new SearchQueryDto());

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        var body = ok.Value.Should().BeOfType<PaginatedResultDto<AuctionListDto>>().Subject;
        body.TotalCount.Should().Be(1);
        body.Items.Should().HaveCount(1);
        body.Page.Should().Be(1);
        mock.Verify(s => s.SearchAsync(It.IsAny<SearchQueryDto>()), Times.Once);
    }

    [Fact]
    public async Task Search_FiltersByCategoryPriceStatus()
    {
        SearchQueryDto? captured = null;
        var mock = new Mock<IAuctionService>();
        mock.Setup(s => s.SearchAsync(It.IsAny<SearchQueryDto>()))
            .Callback<SearchQueryDto>(q => captured = q)
            .ReturnsAsync(new PaginatedResultDto<AuctionListDto> { Items = new List<AuctionListDto>(), TotalCount = 0, Page = 1, PageSize = 20 });
        var controller = CreateController(mock);

        await controller.Search(new SearchQueryDto { CategoryId = 5, MinPrice = 100m, MaxPrice = 500m, Status = "active" });

        captured.Should().NotBeNull();
        captured!.CategoryId.Should().Be(5);
        captured.MinPrice.Should().Be(100m);
        captured.MaxPrice.Should().Be(500m);
        captured.Status.Should().Be("active");
    }

    [Fact]
    public async Task Search_FiltersByClosingDateRange()
    {
        SearchQueryDto? captured = null;
        var mock = new Mock<IAuctionService>();
        mock.Setup(s => s.SearchAsync(It.IsAny<SearchQueryDto>()))
            .Callback<SearchQueryDto>(q => captured = q)
            .ReturnsAsync(new PaginatedResultDto<AuctionListDto> { Items = new List<AuctionListDto>(), TotalCount = 0, Page = 1, PageSize = 20 });
        var controller = CreateController(mock);
        var before = DateTime.UtcNow.AddDays(7);
        var after = DateTime.UtcNow.AddDays(1);

        await controller.Search(new SearchQueryDto { ClosingBefore = before, ClosingAfter = after });

        captured.Should().NotBeNull();
        captured!.ClosingBefore.Should().Be(before);
        captured.ClosingAfter.Should().Be(after);
    }

    [Fact]
    public async Task Search_FiltersBySellerUsername()
    {
        SearchQueryDto? captured = null;
        var mock = new Mock<IAuctionService>();
        mock.Setup(s => s.SearchAsync(It.IsAny<SearchQueryDto>()))
            .Callback<SearchQueryDto>(q => captured = q)
            .ReturnsAsync(new PaginatedResultDto<AuctionListDto> { Items = new List<AuctionListDto>(), TotalCount = 0, Page = 1, PageSize = 20 });
        var controller = CreateController(mock);

        await controller.Search(new SearchQueryDto { Seller = "seller1" });

        captured.Should().NotBeNull();
        captured!.Seller.Should().Be("seller1");
    }

    [Fact]
    public async Task Search_WithCategoryFieldFilters_TextPartialMatch_NumberRange_SelectExactMatch()
    {
        SearchQueryDto? captured = null;
        var mock = new Mock<IAuctionService>();
        mock.Setup(s => s.SearchAsync(It.IsAny<SearchQueryDto>()))
            .Callback<SearchQueryDto>(q => captured = q)
            .ReturnsAsync(new PaginatedResultDto<AuctionListDto> { Items = new List<AuctionListDto>(), TotalCount = 0, Page = 1, PageSize = 20 });
        var controller = CreateController(mock);

        await controller.Search(new SearchQueryDto
        {
            CategoryId = 2,
            FieldFilters = "{\"1\":\"Toyota\",\"3\":{\"min\":2020,\"max\":2025},\"5\":\"Automatic\"}"
        });

        captured.Should().NotBeNull();
        captured!.CategoryId.Should().Be(2);
        captured.FieldFilters.Should().Contain("Toyota");
        captured.FieldFilters.Should().Contain("2020");
        captured.FieldFilters.Should().Contain("Automatic");
    }

    [Fact]
    public async Task Search_SortByMostBids_Works()
    {
        SearchQueryDto? captured = null;
        var mock = new Mock<IAuctionService>();
        mock.Setup(s => s.SearchAsync(It.IsAny<SearchQueryDto>()))
            .Callback<SearchQueryDto>(q => captured = q)
            .ReturnsAsync(new PaginatedResultDto<AuctionListDto> { Items = new List<AuctionListDto>(), TotalCount = 0, Page = 1, PageSize = 20 });
        var controller = CreateController(mock);

        await controller.Search(new SearchQueryDto { Sort = "most_bids" });

        captured.Should().NotBeNull();
        captured!.Sort.Should().Be("most_bids");
    }

    [Fact]
    public async Task Search_CarShortcutParams_TranslateToFieldFilters()
    {
        SearchQueryDto? captured = null;
        var mock = new Mock<IAuctionService>();
        mock.Setup(s => s.SearchAsync(It.IsAny<SearchQueryDto>()))
            .Callback<SearchQueryDto>(q => captured = q)
            .ReturnsAsync(new PaginatedResultDto<AuctionListDto> { Items = new List<AuctionListDto>(), TotalCount = 0, Page = 1, PageSize = 20 });
        var controller = CreateController(mock);

        await controller.Search(new SearchQueryDto
        {
            CategoryId = 2,
            Make = "Toyota",
            YearMin = 2018,
            YearMax = 2024,
            MileageMax = 50000,
            Condition = new List<string> { "Good", "Excellent" },
            Transmission = new List<string> { "Automatic" },
            FuelType = new List<string> { "Gasoline" }
        });

        captured.Should().NotBeNull();
        captured!.CategoryId.Should().Be(2);
        captured.Make.Should().Be("Toyota");
        captured.YearMin.Should().Be(2018);
        captured.YearMax.Should().Be(2024);
        captured.MileageMax.Should().Be(50000);
        captured.Condition.Should().BeEquivalentTo(new List<string> { "Good", "Excellent" });
        captured.Transmission.Should().BeEquivalentTo(new List<string> { "Automatic" });
        captured.FuelType.Should().BeEquivalentTo(new List<string> { "Gasoline" });
    }

    [Fact]
    public async Task GetFieldValues_ReturnsDistinctValuesWithPrefixFiltering()
    {
        var expected = new List<string> { "Toyota", "Honda" };
        var mock = new Mock<IAuctionService>();
        mock.Setup(s => s.GetFieldValuesAsync("Make", 2, "To", 50)).ReturnsAsync(expected);
        var controller = CreateController(mock);

        var result = await controller.GetFieldValues("Make", 2, "To", 50);

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        var body = ok.Value.Should().BeAssignableTo<IReadOnlyList<string>>().Subject;
        body.Should().BeEquivalentTo(expected);
        mock.Verify(s => s.GetFieldValuesAsync("Make", 2, "To", 50), Times.Once);
    }

    [Fact]
    public async Task Search_SortByYearNewest_OrdersCorrectly()
    {
        SearchQueryDto? captured = null;
        var mock = new Mock<IAuctionService>();
        mock.Setup(s => s.SearchAsync(It.IsAny<SearchQueryDto>()))
            .Callback<SearchQueryDto>(q => captured = q)
            .ReturnsAsync(new PaginatedResultDto<AuctionListDto> { Items = new List<AuctionListDto>(), TotalCount = 0, Page = 1, PageSize = 20 });
        var controller = CreateController(mock);

        await controller.Search(new SearchQueryDto { CategoryId = 2, Sort = "year_newest" });

        captured.Should().NotBeNull();
        captured!.Sort.Should().Be("year_newest");
    }

    [Fact]
    public async Task Search_SortByMileageLow_OrdersCorrectly()
    {
        SearchQueryDto? captured = null;
        var mock = new Mock<IAuctionService>();
        mock.Setup(s => s.SearchAsync(It.IsAny<SearchQueryDto>()))
            .Callback<SearchQueryDto>(q => captured = q)
            .ReturnsAsync(new PaginatedResultDto<AuctionListDto> { Items = new List<AuctionListDto>(), TotalCount = 0, Page = 1, PageSize = 20 });
        var controller = CreateController(mock);

        await controller.Search(new SearchQueryDto { CategoryId = 2, Sort = "mileage_low" });

        captured.Should().NotBeNull();
        captured!.Sort.Should().Be("mileage_low");
    }
}
