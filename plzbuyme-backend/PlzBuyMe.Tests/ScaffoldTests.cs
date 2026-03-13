using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using PlzBuyMe.Api.Data;
using PlzBuyMe.Tests.Helpers;

namespace PlzBuyMe.Tests;

public class ScaffoldTests
{
    [Fact]
    public void TestDbContextFactory_Create_ReturnsWorkingContext()
    {
        using var context = TestDbContextFactory.Create();

        context.Should().NotBeNull();
        context.Database.IsInMemory().Should().BeTrue();
    }

    [Fact]
    public void TestDbContextFactory_Create_WithCustomName_UsesGivenName()
    {
        using var ctx1 = TestDbContextFactory.Create("test-db-1");
        using var ctx2 = TestDbContextFactory.Create("test-db-1");

        ctx1.Should().NotBeNull();
        ctx2.Should().NotBeNull();
    }

    [Fact]
    public void TestDbContextFactory_Create_WithoutName_CreatesIsolatedDatabases()
    {
        using var ctx1 = TestDbContextFactory.Create();
        using var ctx2 = TestDbContextFactory.Create();

        ctx1.Should().NotBeSameAs(ctx2);
    }

    [Fact]
    public void AppDbContext_CanBeInstantiated_WithInMemoryProvider()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        using var context = new AppDbContext(options);

        context.Should().NotBeNull();
        context.Database.EnsureCreated().Should().BeTrue();
    }

    [Fact]
    public void AppDbContext_OnModelCreating_DoesNotThrow()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        var act = () =>
        {
            using var context = new AppDbContext(options);
            context.Database.EnsureCreated();
        };

        act.Should().NotThrow();
    }

    [Fact]
    public void Program_Class_Exists_And_HasMainMethod()
    {
        var programType = typeof(PlzBuyMe.Api.Program);

        programType.Should().NotBeNull();
        programType.GetMethod("Main", System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Static)
            .Should().NotBeNull("Program.Main should be the application entry point");
    }
}
