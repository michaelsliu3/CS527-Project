using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using PlzBuyMe.Api.Data;
using PlzBuyMe.Api.Dtos.Alerts;
using PlzBuyMe.Api.Models;

namespace PlzBuyMe.Api.Services;

public class AlertService : IAlertService
{
    private readonly AppDbContext _db;

    public AlertService(AppDbContext db)
    {
        _db = db;
    }

    public async Task CheckAlertsForNewItemAsync(Item item)
    {
        var itemWithFields = await _db.Items
            .AsNoTracking()
            .Include(i => i.ItemFieldValues)
            .ThenInclude(iv => iv.Field)
            .FirstOrDefaultAsync(i => i.Id == item.Id);
        if (itemWithFields == null)
            return;

        var alerts = await _db.Alerts
            .Where(a => a.IsActive)
            .ToListAsync();

        foreach (var alert in alerts)
        {
            if (alert.CategoryId.HasValue && alert.CategoryId != itemWithFields.CategoryId)
                continue;

            var text = $"{itemWithFields.Title} {itemWithFields.Description ?? ""}";
            if (!string.IsNullOrEmpty(alert.Keyword)
                && !text.Contains(alert.Keyword, StringComparison.OrdinalIgnoreCase))
                continue;

            if (!string.IsNullOrEmpty(alert.Criteria) && !MatchesCriteria(itemWithFields, alert.Criteria))
                continue;

            _db.Notifications.Add(new Notification
            {
                UserId = alert.UserId,
                ItemId = itemWithFields.Id,
                Type = NotificationType.AlertMatch,
                Message = $"New item matching your alert: \"{itemWithFields.Title}\""
            });
        }

        await _db.SaveChangesAsync();
    }

    /// <summary>
    /// Checks if the item's field values satisfy the alert's criteria JSON.
    /// Criteria: object mapping fieldId (string key) to value (string), or { "min": n, "max": n }, or array of strings for multi-select.
    /// Invalid or empty criteria JSON is treated as "no filter" (returns true) so alerts are not silently broken.
    /// </summary>
    internal static bool MatchesCriteria(Item item, string criteriaJson)
    {
        if (string.IsNullOrWhiteSpace(criteriaJson))
            return true;

        JsonElement root;
        try
        {
            root = JsonDocument.Parse(criteriaJson).RootElement;
        }
        catch
        {
            return true; // Invalid JSON treated as no filter
        }

        if (root.ValueKind != JsonValueKind.Object)
            return true;

        var fieldValuesByFieldId = item.ItemFieldValues.ToDictionary(iv => iv.FieldId, iv => iv);

        foreach (var prop in root.EnumerateObject())
        {
            if (!int.TryParse(prop.Name, out var fieldId))
                continue;
            if (!fieldValuesByFieldId.TryGetValue(fieldId, out var itemField))
                return false;

            var field = itemField.Field;
            var itemValue = itemField.Value;
            var filter = prop.Value;

            if (filter.ValueKind == JsonValueKind.Array)
            {
                // Multi-select: item value must match one of the array elements (exact, case-insensitive for select).
                var allowed = new List<string>();
                foreach (var e in filter.EnumerateArray())
                    if (e.ValueKind == JsonValueKind.String)
                        allowed.Add(e.GetString() ?? "");
                if (allowed.Count == 0)
                    continue;
                if (!allowed.Any(a => string.Equals(a, itemValue, StringComparison.OrdinalIgnoreCase)))
                    return false;
            }
            else if (filter.ValueKind == JsonValueKind.Object && filter.TryGetProperty("min", out var minEl) && filter.TryGetProperty("max", out var maxEl))
            {
                // Number range
                if (field.FieldType != FieldType.Number)
                    return false;
                if (!decimal.TryParse(itemValue, out var num))
                    return false;
                var min = minEl.TryGetDecimal(out var m) ? m : decimal.MinValue;
                var max = maxEl.TryGetDecimal(out var x) ? x : decimal.MaxValue;
                if (num < min || num > max)
                    return false;
            }
            else
            {
                // Text partial match or number/select exact match
                var filterStr = filter.ValueKind == JsonValueKind.String ? filter.GetString() ?? "" : filter.GetRawText().Trim('"');
                if (field.FieldType == FieldType.Text)
                {
                    if (!itemValue.Contains(filterStr, StringComparison.OrdinalIgnoreCase))
                        return false;
                }
                else
                {
                    if (!string.Equals(itemValue, filterStr, StringComparison.OrdinalIgnoreCase))
                        return false;
                }
            }
        }

        return true;
    }

    public async Task<IReadOnlyList<AlertResponseDto>> GetAlertsForUserAsync(int userId)
    {
        var alerts = await _db.Alerts
            .Where(a => a.UserId == userId)
            .OrderByDescending(a => a.CreatedAt)
            .ToListAsync();
        return alerts.Select(a => new AlertResponseDto
        {
            Id = a.Id,
            UserId = a.UserId,
            CategoryId = a.CategoryId,
            Keyword = a.Keyword,
            Criteria = a.Criteria,
            IsActive = a.IsActive,
            CreatedAt = a.CreatedAt
        }).ToList();
    }

    public async Task<CreateAlertResultDto> CreateAlertAsync(int userId, CreateAlertDto dto)
    {
        var hasFilter = dto.CategoryId.HasValue
            || !string.IsNullOrWhiteSpace(dto.Keyword)
            || !string.IsNullOrWhiteSpace(dto.Criteria);
        if (!hasFilter)
            return new CreateAlertResultDto { ErrorMessage = "At least one filter (category, keyword, or criteria) is required." };

        if (dto.CategoryId.HasValue)
        {
            var exists = await _db.Categories.AnyAsync(c => c.Id == dto.CategoryId.Value);
            if (!exists)
                return new CreateAlertResultDto { ErrorMessage = "Invalid category." };
        }

        var keyword = string.IsNullOrWhiteSpace(dto.Keyword) ? null : dto.Keyword.Trim();
        if (keyword != null && keyword.Length > 128)
            keyword = keyword[..128];

        var alert = new Alert
        {
            UserId = userId,
            CategoryId = dto.CategoryId,
            Keyword = keyword,
            Criteria = string.IsNullOrWhiteSpace(dto.Criteria) ? null : dto.Criteria.Trim(),
            IsActive = true
        };
        _db.Alerts.Add(alert);
        await _db.SaveChangesAsync();

        return new CreateAlertResultDto
        {
            Alert = new AlertResponseDto
            {
                Id = alert.Id,
                UserId = alert.UserId,
                CategoryId = alert.CategoryId,
                Keyword = alert.Keyword,
                Criteria = alert.Criteria,
                IsActive = alert.IsActive,
                CreatedAt = alert.CreatedAt
            }
        };
    }

    public async Task<bool> DeleteAlertAsync(int alertId, int userId)
    {
        var alert = await _db.Alerts.FirstOrDefaultAsync(a => a.Id == alertId && a.UserId == userId);
        if (alert == null)
            return false;
        _db.Alerts.Remove(alert);
        await _db.SaveChangesAsync();
        return true;
    }
}
