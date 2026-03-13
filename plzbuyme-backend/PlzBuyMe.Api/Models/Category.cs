namespace PlzBuyMe.Api.Models;

public class Category
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public int? ParentId { get; set; }

    public Category? Parent { get; set; }
    public ICollection<Category> Children { get; set; } = new List<Category>();
    public ICollection<CategoryField> CategoryFields { get; set; } = new List<CategoryField>();
    public ICollection<Item> Items { get; set; } = new List<Item>();
    public ICollection<Alert> Alerts { get; set; } = new List<Alert>();
}
