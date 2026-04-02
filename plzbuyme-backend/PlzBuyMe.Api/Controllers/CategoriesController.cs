using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PlzBuyMe.Api.Data;
using PlzBuyMe.Api.Dtos.Categories;

namespace PlzBuyMe.Api.Controllers;

[ApiController]
[Route("api/categories")]
public class CategoriesController : ControllerBase
{
    private static readonly JsonSerializerOptions ExtraSortJsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
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
                SortOrder = c.SortOrder,
                IsSearchHub = c.IsSearchHub,
                ExtraSortOptions = ParseExtraSortOptions(c.ExtraSortOptionsJson),
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

        SortCategoryTree(roots);

        return Ok(roots);
    }

    private static void SortCategoryTree(List<CategoryDto> nodes)
    {
        nodes.Sort(static (a, b) =>
            a.SortOrder != b.SortOrder
                ? a.SortOrder.CompareTo(b.SortOrder)
                : string.CompareOrdinal(a.Name, b.Name));
        foreach (var n in nodes)
        {
            SortCategoryTree(n.Children);
        }
    }

    private static IReadOnlyList<CategoryExtraSortOptionDto>? ParseExtraSortOptions(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            return null;
        }

        try
        {
            var list = JsonSerializer.Deserialize<List<CategoryExtraSortOptionDto>>(json, ExtraSortJsonOptions);
            return list is { Count: > 0 } ? list : null;
        }
        catch (JsonException)
        {
            return null;
        }
    }

    [HttpGet("{id:int}/fields")]
    public async Task<ActionResult<List<CategoryFieldDto>>> GetCategoryFields(int id)
    {
        var categoryExists = await _db.Categories
            .AsNoTracking()
            .AnyAsync(c => c.Id == id);

        if (!categoryExists)
        {
            return NotFound();
        }

        var fields = await _db.CategoryFields
            .AsNoTracking()
            .Where(f => f.CategoryId == id)
            .OrderBy(f => f.FieldName)
            .ToListAsync();

        var result = fields
            .Select(f =>
            {
                List<string>? options = null;
                if (!string.IsNullOrWhiteSpace(f.Options))
                {
                    try
                    {
                        options = JsonSerializer.Deserialize<List<string>>(f.Options!) ?? new List<string>();
                    }
                    catch (JsonException)
                    {
                        options = new List<string>();
                    }
                }

                return new CategoryFieldDto
                {
                    Id = f.Id,
                    FieldName = f.FieldName,
                    FieldType = f.FieldType.ToString().ToLowerInvariant(),
                    IsRequired = f.IsRequired,
                    Options = options
                };
            })
            .ToList();

        return Ok(result);
    }
}

