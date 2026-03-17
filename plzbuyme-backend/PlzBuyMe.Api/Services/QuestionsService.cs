using Microsoft.EntityFrameworkCore;
using PlzBuyMe.Api.Data;
using PlzBuyMe.Api.Dtos.Questions;
using PlzBuyMe.Api.Models;

namespace PlzBuyMe.Api.Services;

public class QuestionsService : IQuestionsService
{
    private readonly AppDbContext _db;

    public QuestionsService(AppDbContext db)
    {
        _db = db;
    }

    public async Task<IReadOnlyList<QuestionResponseDto>> GetQuestionsAsync(string? keyword)
    {
        var query = _db.Questions
            .Include(q => q.User)
            .Include(q => q.Replies)
            .ThenInclude(r => r.RepliedByUser)
            .AsNoTracking();

        if (!string.IsNullOrWhiteSpace(keyword))
        {
            var term = keyword.Trim().ToLowerInvariant();
            query = query.Where(q =>
                q.Subject.ToLower().Contains(term) ||
                q.Body.ToLower().Contains(term) ||
                q.Replies.Any(r =>
                    r.Body.ToLower().Contains(term) ||
                    r.ReplierDisplayName.ToLower().Contains(term)));
        }

        var items = await query
            .OrderByDescending(q => q.CreatedAt)
            .ToListAsync();

        return items.Select(MapQuestion).ToList();
    }

    public async Task<QuestionResponseDto> CreateQuestionAsync(int userId, CreateQuestionDto dto)
    {
        var question = new Models.Question
        {
            UserId = userId,
            Subject = dto.Subject.Trim(),
            Body = dto.Body.Trim()
        };

        _db.Questions.Add(question);
        await _db.SaveChangesAsync();

        var created = await _db.Questions
            .Include(q => q.User)
            .Include(q => q.Replies)
            .ThenInclude(r => r.RepliedByUser)
            .AsNoTracking()
            .FirstAsync(q => q.Id == question.Id);

        return MapQuestion(created);
    }

    public async Task<QuestionResponseDto?> ReplyAsync(int questionId, int repliedByUserId, ReplyDto dto)
    {
        var question = await _db.Questions
            .Include(q => q.User)
            .Include(q => q.Replies)
            .ThenInclude(r => r.RepliedByUser)
            .FirstOrDefaultAsync(q => q.Id == questionId);

        if (question == null)
            return null;

        var replier = await _db.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.Id == repliedByUserId);

        var reply = new QuestionReply
        {
            QuestionId = question.Id,
            RepliedByUserId = repliedByUserId,
            Body = dto.Body.Trim(),
            ReplierDisplayName = replier?.Username ?? "Support Team",
            ReplierRole = replier != null ? ToRoleLabel(replier.Role) : null,
            CreatedAt = DateTime.UtcNow
        };

        _db.QuestionReplies.Add(reply);

        await _db.SaveChangesAsync();

        var refreshed = await _db.Questions
            .Include(q => q.User)
            .Include(q => q.Replies)
            .ThenInclude(r => r.RepliedByUser)
            .AsNoTracking()
            .FirstAsync(q => q.Id == question.Id);

        return MapQuestion(refreshed);
    }

    private static QuestionResponseDto MapQuestion(Models.Question question)
    {
        return new QuestionResponseDto
        {
            Id = question.Id,
            UserId = question.UserId,
            Username = question.User.Username,
            Subject = question.Subject,
            Body = question.Body,
            Replies = question.Replies
                .OrderBy(r => r.CreatedAt)
                .Select(r => new QuestionReplyDto
                {
                    Id = r.Id,
                    Body = r.Body,
                    ReplierDisplayName = r.ReplierDisplayName,
                    ReplierRole = r.ReplierRole ?? (r.RepliedByUser != null ? ToRoleLabel(r.RepliedByUser.Role) : null),
                    CreatedAt = r.CreatedAt
                })
                .ToList(),
            CreatedAt = question.CreatedAt
        };
    }

    private static string ToRoleLabel(UserRole role)
    {
        return role switch
        {
            UserRole.CustomerRep => "customer_rep",
            UserRole.Admin => "admin",
            _ => "end_user"
        };
    }
}

