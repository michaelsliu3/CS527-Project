namespace PlzBuyMe.Api.Dtos.Categories;

public record CategoryFieldDto
{
    public int Id { get; init; }
    public int CategoryId { get; init; }
    public string FieldName { get; init; } = string.Empty;
    public string FieldType { get; init; } = string.Empty;
    public bool IsRequired { get; init; }
    public List<string>? Options { get; init; }
    public string? SelectMode { get; init; }
    public bool IsInherited { get; init; }
}

