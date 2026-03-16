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
                ParentId = c.ParentId,
                Children = new List<CategoryDto>()
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
            .OrderBy(c => c.Name)
            .ToList();

        return Ok(roots);
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

