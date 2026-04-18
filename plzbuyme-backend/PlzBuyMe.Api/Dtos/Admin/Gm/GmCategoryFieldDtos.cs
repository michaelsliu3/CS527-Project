namespace PlzBuyMe.Api.Dtos.Admin.Gm;

public record GmCreateCategoryFieldDto
{
    public string FieldName { get; init; } = string.Empty;
    public string FieldType { get; init; } = string.Empty;
    public bool IsRequired { get; init; } = true;
    public List<string>? Options { get; init; }
}

public record GmUpdateCategoryFieldDto
{
    public string? FieldName { get; init; }
    public bool? IsRequired { get; init; }
    public List<string>? Options { get; init; }
}

public record GmCategoryFieldMutationResultDto
{
    public int Id { get; init; }
    public int CategoryId { get; init; }
    public string FieldName { get; init; } = string.Empty;
    public string FieldType { get; init; } = string.Empty;
    public bool IsRequired { get; init; }
    public List<string>? Options { get; init; }
}

public record GmDeleteCategoryFieldResultDto
{
    public int Id { get; init; }
    public bool Deleted { get; init; }
}
