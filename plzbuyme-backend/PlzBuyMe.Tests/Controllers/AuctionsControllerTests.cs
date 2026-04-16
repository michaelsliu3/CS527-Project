using System.Security.Claims;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Moq;
using PlzBuyMe.Api.Controllers;
using PlzBuyMe.Api.Dtos;
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

    private static void SetUser(ControllerBase controller, int userId, string role = "end_user")
    {
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext
            {
                User = new ClaimsPrincipal(new ClaimsIdentity(new[]
                {
                    new Claim(ClaimTypes.NameIdentifier, userId.ToString()),
                    new Claim(ClaimTypes.Role, role)
                }, "Test"))
            },
            RouteData = new Microsoft.AspNetCore.Routing.RouteData(),
            ActionDescriptor = new Microsoft.AspNetCore.Mvc.Controllers.ControllerActionDescriptor()
        };
    }

    private static void SetNoUser(ControllerBase controller)
    {
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext(),
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

    [Fact]
    public async Task GetById_WhenFound_ReturnsOkWithDetail()
    {
        var detail = new AuctionDetailDto
        {
            Id = 42,
            Title = "Test Item",
            CategoryIds = new List<int> { 1 },
            CategoryName = "Cars",
            SellerId = 1,
            SellerUsername = "seller1",
            InitialPrice = 100m,
            BidIncrement = 10m,
            ReservePrice = 150m,
            CurrentPrice = 100m,
            CloseDateTime = DateTime.UtcNow.AddDays(1),
            Status = "active",
            CreatedAt = DateTime.UtcNow
        };
        var mock = new Mock<IAuctionService>();
        mock.Setup(s => s.GetByIdAsync(42)).ReturnsAsync(detail);
        var controller = CreateController(mock);

        var result = await controller.GetById(42);

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        var body = ok.Value.Should().BeOfType<AuctionDetailDto>().Subject;
        body.Id.Should().Be(42);
        body.Title.Should().Be("Test Item");
        mock.Verify(s => s.GetByIdAsync(42), Times.Once);
    }

    [Fact]
    public async Task GetById_WhenNotFound_ReturnsNotFound()
    {
        var mock = new Mock<IAuctionService>();
        mock.Setup(s => s.GetByIdAsync(999)).ReturnsAsync((AuctionDetailDto?)null);
        var controller = CreateController(mock);

        var result = await controller.GetById(999);

        result.Should().BeOfType<NotFoundResult>();
        mock.Verify(s => s.GetByIdAsync(999), Times.Once);
    }

    [Fact]
    public async Task Create_WhenValid_ReturnsCreatedWithDetail()
    {
        var created = new AuctionDetailDto
        {
            Id = 10,
            Title = "New Auction",
            CategoryIds = new List<int> { 1 },
            CategoryName = "Cars",
            SellerId = 5,
            SellerUsername = "user5",
            InitialPrice = 100m,
            BidIncrement = 10m,
            ReservePrice = 150m,
            CurrentPrice = 100m,
            CloseDateTime = DateTime.UtcNow.AddDays(2),
            Status = "active",
            CreatedAt = DateTime.UtcNow
        };
        var mock = new Mock<IAuctionService>();
        mock.Setup(s => s.CreateAuctionAsync(It.IsAny<CreateAuctionDto>(), 5)).ReturnsAsync(created);
        var controller = CreateController(mock);
        SetUser(controller, 5);
        var dto = new CreateAuctionDto
        {
            Title = "New Auction",
            CategoryIds = new List<int> { 1 },
            InitialPrice = 100m,
            BidIncrement = 10m,
            ReservePrice = 150m,
            CloseDateTime = DateTime.UtcNow.AddDays(2)
        };

        var result = await controller.Create(dto);

        var createdResult = result.Should().BeOfType<CreatedAtActionResult>().Subject;
        createdResult.ActionName.Should().Be(nameof(AuctionsController.GetById));
        createdResult.Value.Should().BeOfType<AuctionDetailDto>().Subject.Title.Should().Be("New Auction");
        mock.Verify(s => s.CreateAuctionAsync(It.IsAny<CreateAuctionDto>(), 5), Times.Once);
    }

    [Fact]
    public async Task Create_WhenNotAuthenticated_ReturnsForbid()
    {
        var mock = new Mock<IAuctionService>();
        var controller = CreateController(mock);
        SetNoUser(controller);
        var dto = new CreateAuctionDto
        {
            Title = "New",
            CategoryIds = new List<int> { 1 },
            InitialPrice = 100m,
            BidIncrement = 10m,
            ReservePrice = 150m,
            CloseDateTime = DateTime.UtcNow.AddDays(1)
        };

        var result = await controller.Create(dto);

        result.Should().BeOfType<ForbidResult>();
        mock.Verify(s => s.CreateAuctionAsync(It.IsAny<CreateAuctionDto>(), It.IsAny<int>()), Times.Never);
    }

    [Fact]
    public async Task Create_WhenTitleEmpty_ReturnsBadRequest()
    {
        var mock = new Mock<IAuctionService>();
        var controller = CreateController(mock);
        SetUser(controller, 5);
        var dto = new CreateAuctionDto
        {
            Title = "   ",
            CategoryIds = new List<int> { 1 },
            InitialPrice = 100m,
            BidIncrement = 10m,
            ReservePrice = 150m,
            CloseDateTime = DateTime.UtcNow.AddDays(1)
        };

        var result = await controller.Create(dto);

        var badRequest = result.Should().BeOfType<BadRequestObjectResult>().Subject;
        badRequest.Value.Should().Be("Title is required.");
        mock.Verify(s => s.CreateAuctionAsync(It.IsAny<CreateAuctionDto>(), It.IsAny<int>()), Times.Never);
    }

    [Fact]
    public async Task Create_WhenCategoryInvalid_ReturnsBadRequest()
    {
        var mock = new Mock<IAuctionService>();
        var controller = CreateController(mock);
        SetUser(controller, 5);
        var dto = new CreateAuctionDto
        {
            Title = "Valid",
            CategoryIds = new List<int> { 0 },
            InitialPrice = 100m,
            BidIncrement = 10m,
            ReservePrice = 150m,
            CloseDateTime = DateTime.UtcNow.AddDays(1)
        };

        var result = await controller.Create(dto);

        var badRequest = result.Should().BeOfType<BadRequestObjectResult>().Subject;
        badRequest.Value.Should().Be("Valid category IDs are required.");
        mock.Verify(s => s.CreateAuctionAsync(It.IsAny<CreateAuctionDto>(), It.IsAny<int>()), Times.Never);
    }

    [Fact]
    public async Task Create_WhenPricesInvalid_ReturnsBadRequest()
    {
        var mock = new Mock<IAuctionService>();
        var controller = CreateController(mock);
        SetUser(controller, 5);
        var dto = new CreateAuctionDto
        {
            Title = "Valid",
            CategoryIds = new List<int> { 1 },
            InitialPrice = -1m,
            BidIncrement = 10m,
            ReservePrice = 150m,
            CloseDateTime = DateTime.UtcNow.AddDays(1)
        };

        var result = await controller.Create(dto);

        var badRequest = result.Should().BeOfType<BadRequestObjectResult>().Subject;
        badRequest.Value.Should().Be("Invalid prices.");
        mock.Verify(s => s.CreateAuctionAsync(It.IsAny<CreateAuctionDto>(), It.IsAny<int>()), Times.Never);
    }

    [Fact]
    public async Task Create_WhenCloseDateInPast_ReturnsBadRequest()
    {
        var mock = new Mock<IAuctionService>();
        var controller = CreateController(mock);
        SetUser(controller, 5);
        var dto = new CreateAuctionDto
        {
            Title = "Valid",
            CategoryIds = new List<int> { 1 },
            InitialPrice = 100m,
            BidIncrement = 10m,
            ReservePrice = 150m,
            CloseDateTime = DateTime.UtcNow.AddSeconds(-1)
        };

        var result = await controller.Create(dto);

        var badRequest = result.Should().BeOfType<BadRequestObjectResult>().Subject;
        badRequest.Value.Should().Be("Close date must be in the future.");
        mock.Verify(s => s.CreateAuctionAsync(It.IsAny<CreateAuctionDto>(), It.IsAny<int>()), Times.Never);
    }

    [Fact]
    public async Task Create_WhenCategoryNotFound_ReturnsBadRequest()
    {
        var mock = new Mock<IAuctionService>();
        mock.Setup(s => s.CreateAuctionAsync(It.IsAny<CreateAuctionDto>(), 5)).ReturnsAsync((AuctionDetailDto?)null);
        var controller = CreateController(mock);
        SetUser(controller, 5);
        var dto = new CreateAuctionDto
        {
            Title = "Valid",
            CategoryIds = new List<int> { 999 },
            InitialPrice = 100m,
            BidIncrement = 10m,
            ReservePrice = 150m,
            CloseDateTime = DateTime.UtcNow.AddDays(1)
        };

        var result = await controller.Create(dto);

        var badRequest = result.Should().BeOfType<BadRequestObjectResult>().Subject;
        badRequest.Value.Should().Be("Category not found.");
        mock.Verify(s => s.CreateAuctionAsync(It.IsAny<CreateAuctionDto>(), 5), Times.Once);
    }

    [Fact]
    public async Task PlaceBid_WhenValid_ReturnsOk()
    {
        var mock = new Mock<IAuctionService>();
        mock.Setup(s => s.PlaceBidAsync(1, 5, 150m)).Returns(Task.CompletedTask);
        var controller = CreateController(mock);
        SetUser(controller, 5);

        var result = await controller.PlaceBid(1, new PlaceBidDto { Amount = 150m });

        result.Should().BeOfType<OkResult>();
        mock.Verify(s => s.PlaceBidAsync(1, 5, 150m), Times.Once);
    }

    [Fact]
    public async Task PlaceBid_WhenNotAuthenticated_ReturnsForbid()
    {
        var mock = new Mock<IAuctionService>();
        var controller = CreateController(mock);
        SetNoUser(controller);

        var result = await controller.PlaceBid(1, new PlaceBidDto { Amount = 150m });

        result.Should().BeOfType<ForbidResult>();
        mock.Verify(s => s.PlaceBidAsync(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<decimal>()), Times.Never);
    }

    [Fact]
    public async Task PlaceBid_WhenItemNotFound_ReturnsNotFound()
    {
        var mock = new Mock<IAuctionService>();
        mock.Setup(s => s.PlaceBidAsync(999, 5, 150m))
            .ThrowsAsync(new InvalidOperationException("Item not found"));
        var controller = CreateController(mock);
        SetUser(controller, 5);

        var result = await controller.PlaceBid(999, new PlaceBidDto { Amount = 150m });

        result.Should().BeOfType<NotFoundResult>();
        mock.Verify(s => s.PlaceBidAsync(999, 5, 150m), Times.Once);
    }

    [Fact]
    public async Task PlaceBid_WhenInvalidOperation_ReturnsBadRequest()
    {
        var mock = new Mock<IAuctionService>();
        mock.Setup(s => s.PlaceBidAsync(1, 5, 50m))
            .ThrowsAsync(new InvalidOperationException("Bid too low"));
        var controller = CreateController(mock);
        SetUser(controller, 5);

        var result = await controller.PlaceBid(1, new PlaceBidDto { Amount = 50m });

        var badRequest = result.Should().BeOfType<BadRequestObjectResult>().Subject;
        badRequest.Value.Should().Be("Bid too low");
        mock.Verify(s => s.PlaceBidAsync(1, 5, 50m), Times.Once);
    }

    [Fact]
    public async Task SetAutoBid_WhenValid_ReturnsOk()
    {
        var mock = new Mock<IAuctionService>();
        mock.Setup(s => s.SetAutoBidAsync(1, 5, 5000m)).Returns(Task.CompletedTask);
        var controller = CreateController(mock);
        SetUser(controller, 5);

        var result = await controller.SetAutoBid(1, new SetAutoBidDto { UpperLimit = 5000m });

        result.Should().BeOfType<OkResult>();
        mock.Verify(s => s.SetAutoBidAsync(1, 5, 5000m), Times.Once);
    }

    [Fact]
    public async Task SetAutoBid_WhenNotAuthenticated_ReturnsForbid()
    {
        var mock = new Mock<IAuctionService>();
        var controller = CreateController(mock);
        SetNoUser(controller);

        var result = await controller.SetAutoBid(1, new SetAutoBidDto { UpperLimit = 5000m });

        result.Should().BeOfType<ForbidResult>();
        mock.Verify(s => s.SetAutoBidAsync(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<decimal>()), Times.Never);
    }

    [Fact]
    public async Task SetAutoBid_WhenItemNotFound_ReturnsNotFound()
    {
        var mock = new Mock<IAuctionService>();
        mock.Setup(s => s.SetAutoBidAsync(999, 5, 5000m))
            .ThrowsAsync(new InvalidOperationException("Item not found"));
        var controller = CreateController(mock);
        SetUser(controller, 5);

        var result = await controller.SetAutoBid(999, new SetAutoBidDto { UpperLimit = 5000m });

        result.Should().BeOfType<NotFoundResult>();
        mock.Verify(s => s.SetAutoBidAsync(999, 5, 5000m), Times.Once);
    }

    [Fact]
    public async Task SetAutoBid_WhenInvalidOperation_ReturnsBadRequest()
    {
        var mock = new Mock<IAuctionService>();
        mock.Setup(s => s.SetAutoBidAsync(1, 5, 100m))
            .ThrowsAsync(new InvalidOperationException("Upper limit must be above current price"));
        var controller = CreateController(mock);
        SetUser(controller, 5);

        var result = await controller.SetAutoBid(1, new SetAutoBidDto { UpperLimit = 100m });

        var badRequest = result.Should().BeOfType<BadRequestObjectResult>().Subject;
        badRequest.Value.Should().Be("Upper limit must be above current price");
        mock.Verify(s => s.SetAutoBidAsync(1, 5, 100m), Times.Once);
    }

    [Fact]
    public async Task GetMine_WhenAuthenticated_ReturnsUserAuctions()
    {
        var list = new List<AuctionListDto>
        {
            new() { Id = 1, Title = "My Auction", CurrentPrice = 100m, CloseDateTime = DateTime.UtcNow, Status = "active", CategoryName = "Cars", SellerUsername = "me", BidCount = 0 }
        };
        var mock = new Mock<IAuctionService>();
        mock.Setup(s => s.GetMineAsync(5, null)).ReturnsAsync(list);
        var controller = CreateController(mock);
        SetUser(controller, 5);

        var result = await controller.GetMine(null);

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        var body = ok.Value.Should().BeAssignableTo<IList<AuctionListDto>>().Subject;
        body.Should().HaveCount(1);
        body[0].Title.Should().Be("My Auction");
        mock.Verify(s => s.GetMineAsync(5, null), Times.Once);
    }

    [Fact]
    public async Task GetMine_WhenAuthenticated_PassesStatusFilter()
    {
        var mock = new Mock<IAuctionService>();
        mock.Setup(s => s.GetMineAsync(5, "active")).ReturnsAsync(new List<AuctionListDto>());
        var controller = CreateController(mock);
        SetUser(controller, 5);

        await controller.GetMine("active");

        mock.Verify(s => s.GetMineAsync(5, "active"), Times.Once);
    }

    [Fact]
    public async Task GetMine_WhenNotAuthenticated_ReturnsForbid()
    {
        var mock = new Mock<IAuctionService>();
        var controller = CreateController(mock);
        SetNoUser(controller);

        var result = await controller.GetMine(null);

        result.Should().BeOfType<ForbidResult>();
        mock.Verify(s => s.GetMineAsync(It.IsAny<int>(), It.IsAny<string?>()), Times.Never);
    }

    [Fact]
    public async Task GetSimilar_ReturnsOkWithList()
    {
        var list = new List<AuctionListDto>
        {
            new() { Id = 2, Title = "Similar", CurrentPrice = 200m, CloseDateTime = DateTime.UtcNow, Status = "active", CategoryName = "Cars", SellerUsername = "other", BidCount = 1 }
        };
        var mock = new Mock<IAuctionService>();
        mock.Setup(s => s.GetSimilarAsync(1, 10)).ReturnsAsync(list);
        var controller = CreateController(mock);

        var result = await controller.GetSimilar(1, 10);

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        var body = ok.Value.Should().BeAssignableTo<IList<AuctionListDto>>().Subject;
        body.Should().HaveCount(1);
        body[0].Title.Should().Be("Similar");
        mock.Verify(s => s.GetSimilarAsync(1, 10), Times.Once);
    }

    [Fact]
    public async Task GetSimilar_ClampsLimitBetween1And50()
    {
        var mock = new Mock<IAuctionService>();
        mock.Setup(s => s.GetSimilarAsync(1, 50)).ReturnsAsync(new List<AuctionListDto>());
        var controller = CreateController(mock);

        await controller.GetSimilar(1, 100);

        mock.Verify(s => s.GetSimilarAsync(1, 50), Times.Once);
    }

    [Fact]
    public async Task GetHistory_WhenSameUser_ReturnsOk()
    {
        var list = new List<AuctionListDto>
        {
            new() { Id = 3, Title = "Past", CurrentPrice = 300m, CloseDateTime = DateTime.UtcNow, Status = "sold", CategoryName = "Cars", SellerUsername = "x", BidCount = 2 }
        };
        var mock = new Mock<IAuctionService>();
        mock.Setup(s => s.GetHistoryAsync(5)).ReturnsAsync(list);
        var controller = CreateController(mock);
        SetUser(controller, 5);

        var result = await controller.GetHistory(5);

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        var body = ok.Value.Should().BeAssignableTo<IList<AuctionListDto>>().Subject;
        body.Should().HaveCount(1);
        mock.Verify(s => s.GetHistoryAsync(5), Times.Once);
    }

    [Fact]
    public async Task GetHistory_WhenDifferentUser_ReturnsOk()
    {
        var list = new List<AuctionListDto>
        {
            new() { Id = 31, Title = "Other User History", CurrentPrice = 450m, CloseDateTime = DateTime.UtcNow, Status = "active", CategoryName = "Cars", SellerUsername = "x", BidCount = 1 }
        };
        var mock = new Mock<IAuctionService>();
        mock.Setup(s => s.GetHistoryAsync(7)).ReturnsAsync(list);
        var controller = CreateController(mock);
        SetUser(controller, 5);

        var result = await controller.GetHistory(7);

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        var body = ok.Value.Should().BeAssignableTo<IList<AuctionListDto>>().Subject;
        body.Should().HaveCount(1);
        body[0].Id.Should().Be(31);
        mock.Verify(s => s.GetHistoryAsync(7), Times.Once);
    }

    [Fact]
    public async Task GetHistory_WhenNotAuthenticated_ReturnsForbid()
    {
        var mock = new Mock<IAuctionService>();
        var controller = CreateController(mock);
        SetNoUser(controller);

        var result = await controller.GetHistory(5);

        result.Should().BeOfType<ForbidResult>();
        mock.Verify(s => s.GetHistoryAsync(It.IsAny<int>()), Times.Never);
    }

    [Fact]
    public async Task GetHistoryForUser_WhenRepRequestsOtherUser_ReturnsOk()
    {
        var list = new List<AuctionListDto>
        {
            new() { Id = 11, Title = "Rep View", CurrentPrice = 800m, CloseDateTime = DateTime.UtcNow, Status = "active", CategoryName = "Cars", SellerUsername = "x", BidCount = 1 }
        };
        var mock = new Mock<IAuctionService>();
        mock.Setup(s => s.GetHistoryAsync(7)).ReturnsAsync(list);
        var controller = CreateController(mock);
        SetUser(controller, 5, "customer_rep");

        var result = await controller.GetHistoryForUser(7);

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        var body = ok.Value.Should().BeAssignableTo<IList<AuctionListDto>>().Subject;
        body.Should().HaveCount(1);
        mock.Verify(s => s.GetHistoryAsync(7), Times.Once);
    }

    [Fact]
    public async Task GetHistoryForUser_WhenAdminRequestsOtherUser_ReturnsOk()
    {
        var list = new List<AuctionListDto>
        {
            new() { Id = 12, Title = "Admin View", CurrentPrice = 900m, CloseDateTime = DateTime.UtcNow, Status = "sold", CategoryName = "Cars", SellerUsername = "x", BidCount = 2 }
        };
        var mock = new Mock<IAuctionService>();
        mock.Setup(s => s.GetHistoryAsync(8)).ReturnsAsync(list);
        var controller = CreateController(mock);
        SetUser(controller, 1, "admin");

        var result = await controller.GetHistoryForUser(8);

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        var body = ok.Value.Should().BeAssignableTo<IList<AuctionListDto>>().Subject;
        body.Should().HaveCount(1);
        mock.Verify(s => s.GetHistoryAsync(8), Times.Once);
    }

    [Fact]
    public async Task GetHistoryForUser_WhenEndUserRequestsOtherUser_ReturnsOk()
    {
        var list = new List<AuctionListDto>
        {
            new() { Id = 13, Title = "End User View", CurrentPrice = 550m, CloseDateTime = DateTime.UtcNow, Status = "sold", CategoryName = "Cars", SellerUsername = "x", BidCount = 3 }
        };
        var mock = new Mock<IAuctionService>();
        mock.Setup(s => s.GetHistoryAsync(7)).ReturnsAsync(list);
        var controller = CreateController(mock);
        SetUser(controller, 5, "end_user");

        var result = await controller.GetHistoryForUser(7);

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        var body = ok.Value.Should().BeAssignableTo<IList<AuctionListDto>>().Subject;
        body.Should().HaveCount(1);
        body[0].Id.Should().Be(13);
        mock.Verify(s => s.GetHistoryAsync(7), Times.Once);
    }

    [Fact]
    public async Task GetFieldValues_WhenFieldNameEmpty_ReturnsBadRequest()
    {
        var mock = new Mock<IAuctionService>();
        var controller = CreateController(mock);

        var result = await controller.GetFieldValues("  ", null, null, 50);

        var badRequest = result.Should().BeOfType<BadRequestObjectResult>().Subject;
        badRequest.Value.Should().Be("fieldName is required.");
        mock.Verify(s => s.GetFieldValuesAsync(It.IsAny<string>(), It.IsAny<int?>(), It.IsAny<string?>(), It.IsAny<int>()), Times.Never);
    }
}
