namespace PlzBuyMe.Api.Dtos.Categories;

public record CategoryDto
{
    public int Id { get; init; }
    public string Name { get; init; } = string.Empty;
    public string? StringKey { get; init; }
    /// <summary>Lucide icon key for UI; null means use platform default.</summary>
    public string? LucideIconKey { get; init; }
    public int? ParentId { get; init; }
    public List<CategoryDto> Children { get; init; } = new();
}

