using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PlzBuyMe.Api.Migrations
{
    /// <inheritdoc />
    public partial class ReplaceCategoryIdWithCategoryIdsJson : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "CategoryIds",
                table: "Items",
                type: "json",
                nullable: false,
                defaultValue: "[]")
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.Sql(@"
                UPDATE Items i
                SET i.CategoryIds = (
                    SELECT JSON_ARRAYAGG(cid)
                    FROM (
                        SELECT i.CategoryId AS cid
                        UNION
                        SELECT t.CategoryId AS cid
                        FROM ItemSubcategoryTags t
                        WHERE t.ItemId = i.Id
                    ) AS all_cats
                )
                WHERE i.CategoryId IS NOT NULL;
            ");

            migrationBuilder.DropForeignKey(
                name: "FK_Items_Categories_CategoryId",
                table: "Items");

            migrationBuilder.DropTable(
                name: "ItemSubcategoryTags");

            migrationBuilder.DropIndex(
                name: "idx_items_category",
                table: "Items");

            migrationBuilder.DropColumn(
                name: "CategoryId",
                table: "Items");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CategoryIds",
                table: "Items");

            migrationBuilder.AddColumn<int>(
                name: "CategoryId",
                table: "Items",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateTable(
                name: "ItemSubcategoryTags",
                columns: table => new
                {
                    ItemId = table.Column<int>(type: "int", nullable: false),
                    CategoryId = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ItemSubcategoryTags", x => new { x.ItemId, x.CategoryId });
                    table.ForeignKey(
                        name: "FK_ItemSubcategoryTags_Categories_CategoryId",
                        column: x => x.CategoryId,
                        principalTable: "Categories",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ItemSubcategoryTags_Items_ItemId",
                        column: x => x.ItemId,
                        principalTable: "Items",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "idx_items_category",
                table: "Items",
                column: "CategoryId");

            migrationBuilder.CreateIndex(
                name: "idx_item_subcategory_tags_category",
                table: "ItemSubcategoryTags",
                column: "CategoryId");

            migrationBuilder.AddForeignKey(
                name: "FK_Items_Categories_CategoryId",
                table: "Items",
                column: "CategoryId",
                principalTable: "Categories",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }
    }
}
