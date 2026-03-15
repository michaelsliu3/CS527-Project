using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PlzBuyMe.Api.Data;
using PlzBuyMe.Api.Dtos.Questions;

namespace PlzBuyMe.Api.Controllers;

[ApiController]
[Route("api/questions")]
public class QuestionsController : ControllerBase
{
    private readonly AppDbContext _db;

    public QuestionsController(AppDbContext db)
    {
        _db = db;
    }

    [Authorize]
    [HttpGet]
    public async Task<IActionResult> List([FromQuery] string? keyword)
    {
        var query = _db.Questions
            .Include(q => q.User)
            .Include(q => q.RepliedByUser)
            .AsNoTracking();

        if (!string.IsNullOrWhiteSpace(keyword))
        {
            var term = keyword.Trim();
            query = query.Where(q =>
                q.Subject.Contains(term) ||
                q.Body.Contains(term) ||
                (q.Reply != null && q.Reply.Contains(term)));
        }

        var items = await query
            .OrderByDescending(q => q.CreatedAt)
            .Select(q => new QuestionResponseDto
            {
                Id = q.Id,
                UserId = q.UserId,
                Username = q.User.Username,
                Subject = q.Subject,
                Body = q.Body,
                Reply = q.Reply,
                RepliedBy = q.RepliedBy,
                RepliedByUsername = q.RepliedByUser != null ? q.RepliedByUser.Username : null,
                CreatedAt = q.CreatedAt,
                RepliedAt = q.RepliedAt
            })
            .ToListAsync();

        return Ok(items);
    }

    [Authorize(Policy = "EndUser")]
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateQuestionDto dto)
    {
        var userId = GetCurrentUserId();
        if (userId == null)
            return Forbid();

        if (string.IsNullOrWhiteSpace(dto.Subject) || string.IsNullOrWhiteSpace(dto.Body))
            return BadRequest("Subject and body are required.");

        var question = new Models.Question
        {
            UserId = userId.Value,
            Subject = dto.Subject.Trim(),
            Body = dto.Body.Trim()
        };

        _db.Questions.Add(question);
        await _db.SaveChangesAsync();

        var created = await _db.Questions
            .Include(q => q.User)
            .Include(q => q.RepliedByUser)
            .AsNoTracking()
            .FirstAsync(q => q.Id == question.Id);

        var response = new QuestionResponseDto
        {
            Id = created.Id,
            UserId = created.UserId,
            Username = created.User.Username,
            Subject = created.Subject,
            Body = created.Body,
            Reply = created.Reply,
            RepliedBy = created.RepliedBy,
            RepliedByUsername = created.RepliedByUser != null ? created.RepliedByUser.Username : null,
            CreatedAt = created.CreatedAt,
            RepliedAt = created.RepliedAt
        };

        return Ok(response);
    }

    [Authorize(Policy = "RepOnly")]
    [HttpPost("{id:int}/reply")]
    public async Task<IActionResult> Reply(int id, [FromBody] ReplyDto dto)
    {
        var userId = GetCurrentUserId();
        if (userId == null)
            return Forbid();

        if (string.IsNullOrWhiteSpace(dto.Reply))
            return BadRequest("Reply is required.");

        var question = await _db.Questions
            .Include(q => q.User)
            .Include(q => q.RepliedByUser)
            .FirstOrDefaultAsync(q => q.Id == id);

        if (question == null)
            return NotFound();

        question.Reply = dto.Reply.Trim();
        question.RepliedBy = userId.Value;
        question.RepliedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();

        var response = new QuestionResponseDto
        {
            Id = question.Id,
            UserId = question.UserId,
            Username = question.User.Username,
            Subject = question.Subject,
            Body = question.Body,
            Reply = question.Reply,
            RepliedBy = question.RepliedBy,
            RepliedByUsername = question.RepliedByUser?.Username,
            CreatedAt = question.CreatedAt,
            RepliedAt = question.RepliedAt
        };

        return Ok(response);
    }

    private int? GetCurrentUserId()
    {
        var claim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return int.TryParse(claim, out var id) ? id : null;
    }
}

