using Microsoft.EntityFrameworkCore;
using PlzBuyMe.Api.Data;
using PlzBuyMe.Api.Dtos.Questions;

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
            .Include(q => q.RepliedByUser)
            .AsNoTracking();

        if (!string.IsNullOrWhiteSpace(keyword))
        {
            var term = keyword.Trim().ToLowerInvariant();
            query = query.Where(q =>
                q.Subject.ToLower().Contains(term) ||
                q.Body.ToLower().Contains(term) ||
                (q.Reply != null && q.Reply.ToLower().Contains(term)));
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

        return items;
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
            .Include(q => q.RepliedByUser)
            .AsNoTracking()
            .FirstAsync(q => q.Id == question.Id);

        return new QuestionResponseDto
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
    }

    public async Task<QuestionResponseDto?> ReplyAsync(int questionId, int repliedByUserId, ReplyDto dto)
    {
        var question = await _db.Questions
            .Include(q => q.User)
            .Include(q => q.RepliedByUser)
            .FirstOrDefaultAsync(q => q.Id == questionId);

        if (question == null)
            return null;

        question.Reply = dto.Reply.Trim();
        question.RepliedBy = repliedByUserId;
        question.RepliedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();

        return new QuestionResponseDto
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
    }
}

