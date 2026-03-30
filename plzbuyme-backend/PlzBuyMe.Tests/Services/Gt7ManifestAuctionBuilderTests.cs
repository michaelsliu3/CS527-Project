using FluentAssertions;
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
}
