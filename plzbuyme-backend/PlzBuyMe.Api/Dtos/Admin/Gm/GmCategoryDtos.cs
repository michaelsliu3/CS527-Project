namespace PlzBuyMe.Api.Dtos.Admin.Gm;

public record GmCreateCategoryDto
{
    public string Name { get; init; } = string.Empty;
    public int? ParentId { get; init; }
    public string? StringKey { get; init; }
    /// <summary>Lucide icon key; omit or empty uses platform default (Car).</summary>
    public string? LucideIconKey { get; init; }
}

public record GmUpdateCategoryDto
{
    public string? Name { get; init; }
    public string? StringKey { get; init; }
    /// <summary>When set, empty string clears to platform default (null in DB).</summary>
    public string? LucideIconKey { get; init; }
}

public record GmCategoryMutationResultDto
{
    public int Id { get; init; }
    public string Name { get; init; } = string.Empty;
}

public record GmDeleteCategoryResultDto
{
    public int Id { get; init; }
    public bool Deleted { get; init; }
}
