namespace PlzBuyMe.Api.Models;

/// <summary>
/// Additional category tags for an item (beyond the primary <see cref="Item.CategoryId"/>).
/// </summary>
public class ItemSubcategoryTag
{
    public int ItemId { get; set; }
    public int CategoryId { get; set; }

    public Item Item { get; set; } = null!;
    public Category Category { get; set; } = null!;
}
