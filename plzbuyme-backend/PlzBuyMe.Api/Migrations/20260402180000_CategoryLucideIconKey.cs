using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using PlzBuyMe.Api.Data;

#nullable disable

namespace PlzBuyMe.Api.Migrations
{
    [DbContext(typeof(AppDbContext))]
    [Migration("20260402180000_CategoryLucideIconKey")]
    public partial class CategoryLucideIconKey : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                    name: "LucideIconKey",
                    table: "Categories",
                    type: "varchar(64)",
                    maxLength: 64,
                    nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.Sql(
                """
                UPDATE `Categories` SET `LucideIconKey` = 'Car' WHERE `StringKey` = 'cars';
                UPDATE `Categories` SET `LucideIconKey` = 'CarFront' WHERE `StringKey` IN ('sedans', 'compact-sedans', 'full-size-sedans');
                UPDATE `Categories` SET `LucideIconKey` = 'Truck' WHERE `StringKey` IN ('suvs', 'trucks');
                UPDATE `Categories` SET `LucideIconKey` = 'Gauge' WHERE `StringKey` = 'sports-cars';
                UPDATE `Categories` SET `LucideIconKey` = 'Battery' WHERE `StringKey` = 'electric';
                """);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "LucideIconKey",
                table: "Categories");
        }
    }
}
