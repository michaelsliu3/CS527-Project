using System.ComponentModel.DataAnnotations.Schema;

namespace PlzBuyMe.Api.Models;

public class CategoryField
{
    public int Id { get; set; }
    public int CategoryId { get; set; }
    public string FieldName { get; set; } = string.Empty;
    public FieldType FieldType { get; set; }
    public bool IsRequired { get; set; } = true;
    [Column(TypeName = "json")]
    public string? Options { get; set; }

    public Category Category { get; set; } = null!;
    public ICollection<ItemFieldValue> ItemFieldValues { get; set; } = new List<ItemFieldValue>();
}
