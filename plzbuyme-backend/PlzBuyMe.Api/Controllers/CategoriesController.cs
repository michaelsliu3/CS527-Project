using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PlzBuyMe.Api.Data;
using PlzBuyMe.Api.Dtos.Categories;
using PlzBuyMe.Api.Models;

namespace PlzBuyMe.Api.Controllers;

[ApiController]
[Route("api/categories")]
public class CategoriesController : ControllerBase
{
    private static readonly JsonSerializerOptions JsonCaseInsensitiveOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    private readonly AppDbContext _db;

    public CategoriesController(AppDbContext db)
    {
        _db = db;
    }

    [HttpGet]
    public async Task<ActionResult<List<CategoryDto>>> GetCategories()
    {
        var categories = await _db.Categories
            .AsNoTracking()
            .ToListAsync();

        var lookup = categories.ToDictionary(
            c => c.Id,
            c => new CategoryDto
            {
                Id = c.Id,
                Name = c.Name,
                StringKey = c.StringKey,
                LucideIconKey = c.LucideIconKey,
                ParentId = c.ParentId,
                Children = new List<CategoryDto>(),
            });

        foreach (var category in lookup.Values)
        {
            if (category.ParentId is { } parentId && lookup.TryGetValue(parentId, out var parent))
            {
                parent.Children.Add(category);
            }
        }

        var roots = lookup.Values
            .Where(c => c.ParentId == null)
            .ToList();

        return Ok(roots);
    }

    [HttpGet("{id:int}/fields")]
    public async Task<ActionResult<List<CategoryFieldDto>>> GetCategoryFields(int id)
    {
        var categories = await _db.Categories
            .AsNoTracking()
            .Select(c => new Category
            {
                Id = c.Id,
                ParentId = c.ParentId
            })
            .ToListAsync();
        var categoryById = categories.ToDictionary(c => c.Id);
        if (!categoryById.ContainsKey(id))
        {
            return NotFound();
        }

        var ownerCategoryIds = ResolveEffectiveFieldOwnerCategoryIds(categoryById, id);
        var fields = await _db.CategoryFields
            .AsNoTracking()
            .Where(f => ownerCategoryIds.Contains(f.CategoryId))
            .ToListAsync();

        var ownerDepth = BuildOwnerDepthMap(categoryById, id);
        var dedupedFields = fields
            .OrderBy(f => ownerDepth.GetValueOrDefault(f.CategoryId, int.MaxValue))
            .ThenBy(f => f.FieldName)
            .GroupBy(f => f.FieldName, StringComparer.OrdinalIgnoreCase)
            .Select(g => g.First())
            .OrderBy(f => f.FieldName)
            .ToList();

        var result = dedupedFields
            .Select(f => ToCategoryFieldDto(f, f.CategoryId != id))
            .ToList();

        return Ok(result);
    }

    private static CategoryFieldDto ToCategoryFieldDto(CategoryField f, bool isInherited)
    {
        var (options, selectMode) = DeserializeFieldOptionsPayload(f.Options);

        return new CategoryFieldDto
        {
            Id = f.Id,
            CategoryId = f.CategoryId,
            FieldName = f.FieldName,
            FieldType = f.FieldType.ToString().ToLowerInvariant(),
            IsRequired = f.IsRequired,
            Options = options,
            SelectMode = selectMode,
            IsInherited = isInherited,
        };
    }

    private static (List<string>? Options, string? SelectMode) DeserializeFieldOptionsPayload(string? rawOptionsJson)
    {
        if (string.IsNullOrWhiteSpace(rawOptionsJson))
            return (null, null);

        try
        {
            using var doc = JsonDocument.Parse(rawOptionsJson);
            if (doc.RootElement.ValueKind == JsonValueKind.Array)
            {
                var options = JsonSerializer.Deserialize<List<string>>(rawOptionsJson) ?? new List<string>();
                return (options, null);
            }

            if (doc.RootElement.ValueKind == JsonValueKind.Object)
            {
                var payload = JsonSerializer.Deserialize<SelectFieldOptionsPayload>(
                    rawOptionsJson,
                    JsonCaseInsensitiveOptions);
                var options = payload?.Options ?? new List<string>();
                var selectMode = NormalizeSelectMode(payload?.SelectMode);
                return (options, selectMode);
            }
        }
        catch (JsonException)
        {
            // Fall through to empty options.
        }

        return (new List<string>(), null);
    }

    private static string? NormalizeSelectMode(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw))
            return null;
        return raw.Trim().ToLowerInvariant();
    }

    private sealed record SelectFieldOptionsPayload
    {
        public List<string> Options { get; init; } = new();
        public string? SelectMode { get; init; }
    }

    private static HashSet<int> ResolveEffectiveFieldOwnerCategoryIds(
        IReadOnlyDictionary<int, Category> categoryById,
        int requestedCategoryId)
    {
        var ownerIds = new HashSet<int>();
        var cursor = requestedCategoryId;
        while (true)
        {
            ownerIds.Add(cursor);
            var parentId = categoryById[cursor].ParentId;
            if (!parentId.HasValue || !categoryById.ContainsKey(parentId.Value))
                break;
            cursor = parentId.Value;
        }
        return ownerIds;
    }

    private static Dictionary<int, int> BuildOwnerDepthMap(
        IReadOnlyDictionary<int, Category> categoryById,
        int requestedCategoryId)
    {
        var depthByCategory = new Dictionary<int, int>();
        var depth = 0;
        var cursor = requestedCategoryId;
        while (true)
        {
            depthByCategory[cursor] = depth;
            var parentId = categoryById[cursor].ParentId;
            if (!parentId.HasValue || !categoryById.ContainsKey(parentId.Value))
                break;
            cursor = parentId.Value;
            depth++;
        }
        return depthByCategory;
    }
}

