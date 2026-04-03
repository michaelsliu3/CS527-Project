using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using PlzBuyMe.Api.Data;

#nullable disable

namespace PlzBuyMe.Api.Migrations
{
    [DbContext(typeof(AppDbContext))]
    [Migration("20260402140000_RenameCategorySlugToStringKey")]
    public partial class RenameCategorySlugToStringKey : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Categories_Slug",
                table: "Categories");

            // Pomelo cannot generate RenameColumn SQL for hand-authored migrations without a Designer
            // snapshot. Use CHANGE COLUMN so MySQL 5.7 / MariaDB 10.4+ are covered (RENAME COLUMN is 8.0.2+).
            migrationBuilder.Sql(
                "ALTER TABLE `Categories` CHANGE COLUMN `Slug` `StringKey` varchar(64) NULL;");

            migrationBuilder.CreateIndex(
                name: "IX_Categories_StringKey",
                table: "Categories",
                column: "StringKey",
                unique: true);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Categories_StringKey",
                table: "Categories");

            migrationBuilder.Sql(
                "ALTER TABLE `Categories` CHANGE COLUMN `StringKey` `Slug` varchar(64) NULL;");

            migrationBuilder.CreateIndex(
                name: "IX_Categories_Slug",
                table: "Categories",
                column: "Slug",
                unique: true);
        }
    }
}
