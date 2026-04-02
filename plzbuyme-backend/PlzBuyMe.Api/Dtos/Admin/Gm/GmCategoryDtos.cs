namespace PlzBuyMe.Api.Dtos.Admin.Gm;

public record GmCreateCategoryDto
{
    public string Name { get; init; } = string.Empty;
    public int? ParentId { get; init; }
    public string? StringKey { get; init; }
    public int? SortOrder { get; init; }
    public bool? IsSearchHub { get; init; }
    public string? ExtraSortOptionsJson { get; init; }
}

public record GmUpdateCategoryDto
{
    public string? Name { get; init; }
    public string? StringKey { get; init; }
    public int? SortOrder { get; init; }
    public bool? IsSearchHub { get; init; }
    public string? ExtraSortOptionsJson { get; init; }
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
