using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Migrations;
using PlzBuyMe.Api.Data;

#nullable disable

namespace PlzBuyMe.Api.Migrations
{
    [DbContext(typeof(AppDbContext))]
    [Migration("20260402120000_CategorySearchMetadata")]
    public partial class CategorySearchMetadata : Migration
    {
        private const string CarExtraSortJson =
            """[{"value":"year_newest","label":"Year: newest"},{"value":"year_oldest","label":"Year: oldest"},{"value":"mileage_low","label":"Mileage: low to high"},{"value":"mileage_high","label":"Mileage: high to low"}]""";

        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ExtraSortOptionsJson",
                table: "Categories",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<bool>(
                name: "IsSearchHub",
                table: "Categories",
                type: "tinyint(1)",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<int>(
                name: "SortOrder",
                table: "Categories",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "Slug",
                table: "Categories",
                type: "varchar(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.Sql(
                """
                UPDATE `Categories` SET `Slug` = CASE `Name`
                  WHEN 'Cars' THEN 'cars'
                  WHEN 'Sedans' THEN 'sedans'
                  WHEN 'SUVs' THEN 'suvs'
                  WHEN 'Trucks' THEN 'trucks'
                  WHEN 'Sports Cars' THEN 'sports-cars'
                  WHEN 'Electric' THEN 'electric'
                  WHEN 'Compact Sedans' THEN 'compact-sedans'
                  WHEN 'Full-Size Sedans' THEN 'full-size-sedans'
                  ELSE CONCAT('cat-', `Id`)
                END
                WHERE `Slug` IS NULL;
                """);

            migrationBuilder.Sql(
                $"""
                UPDATE `Categories`
                SET `IsSearchHub` = 1,
                    `SortOrder` = 0,
                    `ExtraSortOptionsJson` = '{CarExtraSortJson}'
                WHERE `Name` = 'Cars' AND `ParentId` IS NULL;
                """);

            migrationBuilder.Sql(
                """
                UPDATE `Categories` SET `SortOrder` = 10 WHERE `Name` = 'Sedans' AND `Slug` = 'sedans';
                UPDATE `Categories` SET `SortOrder` = 20 WHERE `Name` = 'SUVs' AND `Slug` = 'suvs';
                UPDATE `Categories` SET `SortOrder` = 30 WHERE `Name` = 'Trucks' AND `Slug` = 'trucks';
                UPDATE `Categories` SET `SortOrder` = 40 WHERE `Name` = 'Sports Cars' AND `Slug` = 'sports-cars';
                UPDATE `Categories` SET `SortOrder` = 50 WHERE `Name` = 'Electric' AND `Slug` = 'electric';
                UPDATE `Categories` SET `SortOrder` = 60 WHERE `Name` = 'Compact Sedans' AND `Slug` = 'compact-sedans';
                UPDATE `Categories` SET `SortOrder` = 70 WHERE `Name` = 'Full-Size Sedans' AND `Slug` = 'full-size-sedans';
                """);

            migrationBuilder.CreateIndex(
                name: "IX_Categories_Slug",
                table: "Categories",
                column: "Slug",
                unique: true);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Categories_Slug",
                table: "Categories");

            migrationBuilder.DropColumn(
                name: "ExtraSortOptionsJson",
                table: "Categories");

            migrationBuilder.DropColumn(
                name: "IsSearchHub",
                table: "Categories");

            migrationBuilder.DropColumn(
                name: "SortOrder",
                table: "Categories");

            migrationBuilder.DropColumn(
                name: "Slug",
                table: "Categories");
        }

        protected override void BuildTargetModel(ModelBuilder modelBuilder)
        {
        }
    }
}
