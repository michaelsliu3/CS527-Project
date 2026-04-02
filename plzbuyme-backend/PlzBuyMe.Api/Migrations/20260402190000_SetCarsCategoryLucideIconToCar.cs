using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using PlzBuyMe.Api.Data;

#nullable disable

namespace PlzBuyMe.Api.Migrations
{
    [DbContext(typeof(AppDbContext))]
    [Migration("20260402190000_SetCarsCategoryLucideIconToCar")]
    public partial class SetCarsCategoryLucideIconToCar : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                "UPDATE `Categories` SET `LucideIconKey` = 'Car' WHERE `StringKey` = 'cars';");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                "UPDATE `Categories` SET `LucideIconKey` = 'LayoutGrid' WHERE `StringKey` = 'cars';");
        }
    }
}
