namespace PlzBuyMe.Api.Dtos.Categories;

public record CategoryFieldDto
{
    public int Id { get; init; }
    public string FieldName { get; init; } = string.Empty;
    public string FieldType { get; init; } = string.Empty;
    public bool IsRequired { get; init; }
    public List<string>? Options { get; init; }
}

