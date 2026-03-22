using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PlzBuyMe.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddVipRoleAndDisplayNameColor : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "DisplayNameColor",
                table: "Users",
                type: "varchar(7)",
                maxLength: 7,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "ReplierDisplayNameColor",
                table: "QuestionReplies",
                type: "varchar(7)",
                maxLength: 7,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "DisplayNameColor",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "ReplierDisplayNameColor",
                table: "QuestionReplies");
        }
    }
}
