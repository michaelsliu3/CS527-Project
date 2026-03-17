using System;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PlzBuyMe.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddQuestionRepliesMetadata : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Questions_Users_RepliedBy",
                table: "Questions");

            migrationBuilder.DropIndex(
                name: "IX_Questions_RepliedBy",
                table: "Questions");

            migrationBuilder.DropColumn(
                name: "RepliedAt",
                table: "Questions");

            migrationBuilder.DropColumn(
                name: "RepliedBy",
                table: "Questions");

            migrationBuilder.DropColumn(
                name: "Reply",
                table: "Questions");

            migrationBuilder.CreateTable(
                name: "QuestionReplies",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("MySql:ValueGenerationStrategy", MySqlValueGenerationStrategy.IdentityColumn),
                    QuestionId = table.Column<int>(type: "int", nullable: false),
                    RepliedByUserId = table.Column<int>(type: "int", nullable: true),
                    Title = table.Column<string>(type: "varchar(256)", maxLength: 256, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Body = table.Column<string>(type: "longtext", nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    ReplierDisplayName = table.Column<string>(type: "varchar(128)", maxLength: 128, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    ReplierRole = table.Column<string>(type: "varchar(32)", maxLength: 32, nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    CreatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_QuestionReplies", x => x.Id);
                    table.ForeignKey(
                        name: "FK_QuestionReplies_Questions_QuestionId",
                        column: x => x.QuestionId,
                        principalTable: "Questions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_QuestionReplies_Users_RepliedByUserId",
                        column: x => x.RepliedByUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "IX_QuestionReplies_QuestionId_CreatedAt",
                table: "QuestionReplies",
                columns: new[] { "QuestionId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_QuestionReplies_RepliedByUserId",
                table: "QuestionReplies",
                column: "RepliedByUserId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "QuestionReplies");

            migrationBuilder.AddColumn<DateTime>(
                name: "RepliedAt",
                table: "Questions",
                type: "datetime(6)",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "RepliedBy",
                table: "Questions",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Reply",
                table: "Questions",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "IX_Questions_RepliedBy",
                table: "Questions",
                column: "RepliedBy");

            migrationBuilder.AddForeignKey(
                name: "FK_Questions_Users_RepliedBy",
                table: "Questions",
                column: "RepliedBy",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }
    }
}
