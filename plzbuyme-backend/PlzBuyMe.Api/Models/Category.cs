namespace PlzBuyMe.Api.Models;

public class Category
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    /// <summary>Stable string key for integrations (e.g. GT7 manifest routing). Unique when set.</summary>
    public string? StringKey { get; set; }
    public int SortOrder { get; set; }
    /// <summary>When true, search UI shows this root as a hub: &quot;All {name}&quot; plus one tab per direct child.</summary>
    public bool IsSearchHub { get; set; }
    /// <summary>Optional JSON array: [{&quot;value&quot;:&quot;year_newest&quot;,&quot;label&quot;:&quot;Year: newest&quot;}, ...]</summary>
    public string? ExtraSortOptionsJson { get; set; }
    public int? ParentId { get; set; }

    public Category? Parent { get; set; }
    public ICollection<Category> Children { get; set; } = new List<Category>();
    public ICollection<CategoryField> CategoryFields { get; set; } = new List<CategoryField>();
    public ICollection<Item> Items { get; set; } = new List<Item>();
    public ICollection<Alert> Alerts { get; set; } = new List<Alert>();
}
