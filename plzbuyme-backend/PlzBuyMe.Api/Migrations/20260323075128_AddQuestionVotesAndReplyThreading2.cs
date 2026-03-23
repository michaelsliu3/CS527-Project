using System;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PlzBuyMe.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddQuestionVotesAndReplyThreading2 : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "ParentReplyId",
                table: "QuestionReplies",
                type: "int",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "QuestionVotes",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("MySql:ValueGenerationStrategy", MySqlValueGenerationStrategy.IdentityColumn),
                    UserId = table.Column<int>(type: "int", nullable: false),
                    QuestionId = table.Column<int>(type: "int", nullable: true),
                    QuestionReplyId = table.Column<int>(type: "int", nullable: true),
                    Value = table.Column<int>(type: "int", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_QuestionVotes", x => x.Id);
                    table.ForeignKey(
                        name: "FK_QuestionVotes_QuestionReplies_QuestionReplyId",
                        column: x => x.QuestionReplyId,
                        principalTable: "QuestionReplies",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_QuestionVotes_Questions_QuestionId",
                        column: x => x.QuestionId,
                        principalTable: "Questions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_QuestionVotes_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "IX_QuestionReplies_ParentReplyId",
                table: "QuestionReplies",
                column: "ParentReplyId");

            migrationBuilder.CreateIndex(
                name: "IX_QuestionVotes_QuestionId",
                table: "QuestionVotes",
                column: "QuestionId");

            migrationBuilder.CreateIndex(
                name: "IX_QuestionVotes_QuestionReplyId",
                table: "QuestionVotes",
                column: "QuestionReplyId");

            migrationBuilder.CreateIndex(
                name: "IX_QuestionVotes_UserId_QuestionId",
                table: "QuestionVotes",
                columns: new[] { "UserId", "QuestionId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_QuestionVotes_UserId_QuestionReplyId",
                table: "QuestionVotes",
                columns: new[] { "UserId", "QuestionReplyId" },
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_QuestionReplies_QuestionReplies_ParentReplyId",
                table: "QuestionReplies",
                column: "ParentReplyId",
                principalTable: "QuestionReplies",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_QuestionReplies_QuestionReplies_ParentReplyId",
                table: "QuestionReplies");

            migrationBuilder.DropTable(
                name: "QuestionVotes");

            migrationBuilder.DropIndex(
                name: "IX_QuestionReplies_ParentReplyId",
                table: "QuestionReplies");

            migrationBuilder.DropColumn(
                name: "ParentReplyId",
                table: "QuestionReplies");
        }
    }
}
