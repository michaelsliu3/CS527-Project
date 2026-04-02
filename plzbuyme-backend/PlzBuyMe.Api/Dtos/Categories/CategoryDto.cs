namespace PlzBuyMe.Api.Dtos.Categories;

public record CategoryDto
{
    public int Id { get; init; }
    public string Name { get; init; } = string.Empty;
    public string? StringKey { get; init; }
    public int SortOrder { get; init; }
    public bool IsSearchHub { get; init; }
    public IReadOnlyList<CategoryExtraSortOptionDto>? ExtraSortOptions { get; init; }
    public int? ParentId { get; init; }
    public List<CategoryDto> Children { get; init; } = new();
}

