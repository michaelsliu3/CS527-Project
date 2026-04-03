namespace PlzBuyMe.Api.Models;

public class Category
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    /// <summary>Stable string key for integrations (e.g. GT7 manifest routing). Unique when set.</summary>
    public string? StringKey { get; set; }
    /// <summary>Lucide icon key for search tabs (react-icons/lu name without Lu prefix), e.g. Car. Null uses platform default.</summary>
    public string? LucideIconKey { get; set; }
    public int? ParentId { get; set; }

    public Category? Parent { get; set; }
    public ICollection<Category> Children { get; set; } = new List<Category>();
    public ICollection<CategoryField> CategoryFields { get; set; } = new List<CategoryField>();
    public ICollection<Alert> Alerts { get; set; } = new List<Alert>();
}
