using FluentAssertions;
using PlzBuyMe.Api.Models;
using PlzBuyMe.Api.Services;
using Xunit;

namespace PlzBuyMe.Tests.Services;

public class Gt7ManifestAuctionBuilderTests
{
    [Fact]
    public void InferCategoryName_Tesla_ReturnsElectric()
    {
        var asset = new Gt7ManifestAsset { Title = "Tesla Model 3", Make = "Tesla", Model = "Model 3" };
        Gt7ManifestAuctionBuilder.InferCategoryName(asset).Should().Be(Gt7ManifestAuctionBuilder.CategoryElectric);
    }

    [Fact]
    public void ResolveAssetYear_UsesJsonYear()
    {
        var asset = new Gt7ManifestAsset { Year = 1999, Title = "x" };
        Gt7ManifestAuctionBuilder.ResolveAssetYear(asset).Should().Be(1999);
    }

    [Fact]
    public void BuildCreateDto_LeavesImageUnset_SoCreateAuctionResolvesViaCdn()
    {
        var category = new Category
        {
            Id = 1,
            Name = "Sedans",
            CategoryFields =
            [
                new CategoryField { Id = 1, FieldName = "Make", CategoryId = 1 },
                new CategoryField { Id = 2, FieldName = "Model", CategoryId = 1 },
                new CategoryField { Id = 3, FieldName = "Year", CategoryId = 1 },
                new CategoryField { Id = 4, FieldName = "Mileage", CategoryId = 1 },
                new CategoryField { Id = 5, FieldName = "Condition", CategoryId = 1 },
                new CategoryField { Id = 6, FieldName = "Transmission", CategoryId = 1 },
                new CategoryField { Id = 7, FieldName = "Fuel Type", CategoryId = 1 },
                new CategoryField { Id = 8, FieldName = "Exterior Color", CategoryId = 1 },
            ]
        };
        var asset = new Gt7ManifestAsset
        {
            ExternalId = "102",
            SourceUrl = "https://example.com/remote-thumbnail.png",
            DetailSourceUrl = "https://example.com/remote-detail.jpg",
            Make = "Toyota",
            Model = "Camry",
            Year = 2020
        };
        var dto = Gt7ManifestAuctionBuilder.BuildCreateDto(asset, category, 6, 120);
        dto.ImageStorageKey.Should().Be("102");
        dto.ImageUrl.Should().BeNull();
    }
}
