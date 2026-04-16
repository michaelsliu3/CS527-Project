using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using PlzBuyMe.Api.Data;

#nullable disable

namespace PlzBuyMe.Api.Migrations
{
    [DbContext(typeof(AppDbContext))]
    [Migration("20260415130000_AddAuctionIdentityAnonymityToggle")]
    public partial class AddAuctionIdentityAnonymityToggle : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsAuctionIdentityAnonymous",
                table: "Users",
                type: "tinyint(1)",
                nullable: false,
                defaultValue: false);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "IsAuctionIdentityAnonymous",
                table: "Users");
        }
    }
}
