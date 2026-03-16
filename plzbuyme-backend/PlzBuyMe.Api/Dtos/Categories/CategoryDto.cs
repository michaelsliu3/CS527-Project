namespace PlzBuyMe.Api.Dtos.Categories;

public record CategoryDto
{
    public int Id { get; init; }
    public string Name { get; init; } = string.Empty;
    public int? ParentId { get; init; }
    public List<CategoryDto> Children { get; init; } = new();
}

