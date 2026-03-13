namespace PlzBuyMe.Api.Models;

public class ItemFieldValue
{
    public int Id { get; set; }
    public int ItemId { get; set; }
    public int FieldId { get; set; }
    public string Value { get; set; } = string.Empty;

    public Item Item { get; set; } = null!;
    public CategoryField Field { get; set; } = null!;
}
