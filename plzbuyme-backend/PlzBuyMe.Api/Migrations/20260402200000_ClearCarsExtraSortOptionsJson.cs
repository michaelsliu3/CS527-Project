using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using PlzBuyMe.Api.Data;

#nullable disable

namespace PlzBuyMe.Api.Migrations
{
    [DbContext(typeof(AppDbContext))]
    [Migration("20260402200000_ClearCarsExtraSortOptionsJson")]
    public partial class ClearCarsExtraSortOptionsJson : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                "UPDATE `Categories` SET `ExtraSortOptionsJson` = NULL WHERE `StringKey` = 'cars' AND `ParentId` IS NULL;");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            const string json =
                """[{"value":"year_newest","label":"Year: newest"},{"value":"year_oldest","label":"Year: oldest"},{"value":"mileage_low","label":"Mileage: low to high"},{"value":"mileage_high","label":"Mileage: high to low"}]""";
            migrationBuilder.Sql(
                $"""
                UPDATE `Categories` SET `ExtraSortOptionsJson` = '{json}' WHERE `StringKey` = 'cars' AND `ParentId` IS NULL;
                """);
        }
    }
}
