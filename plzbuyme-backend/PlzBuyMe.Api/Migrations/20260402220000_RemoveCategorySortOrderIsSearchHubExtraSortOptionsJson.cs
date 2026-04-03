using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using PlzBuyMe.Api.Data;

#nullable disable

namespace PlzBuyMe.Api.Migrations
{
    [DbContext(typeof(AppDbContext))]
    [Migration("20260402220000_RemoveCategorySortOrderIsSearchHubExtraSortOptionsJson")]
    public partial class RemoveCategorySortOrderIsSearchHubExtraSortOptionsJson : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ExtraSortOptionsJson",
                table: "Categories");

            migrationBuilder.DropColumn(
                name: "IsSearchHub",
                table: "Categories");

            migrationBuilder.DropColumn(
                name: "SortOrder",
                table: "Categories");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
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
        }
    }
}

