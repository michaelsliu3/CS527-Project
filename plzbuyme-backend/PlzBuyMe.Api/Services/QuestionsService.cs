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

    public async Task<IReadOnlyList<QuestionResponseDto>> GetQuestionsAsync(string? keyword, int? currentUserId, string? sort)
    {
        var query = _db.Questions
            .Include(q => q.User)
            .Include(q => q.Replies)
            .ThenInclude(r => r.RepliedByUser)
            .Include(q => q.Replies)
            .ThenInclude(r => r.Votes)
            .Include(q => q.Replies)
            .ThenInclude(r => r.ChildReplies)
            .ThenInclude(r => r.RepliedByUser)
            .Include(q => q.Votes)
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

        var items = await query.ToListAsync();
        var sortedItems = ApplyQuestionSort(items, sort);

        return sortedItems.Select(q => MapQuestion(q, currentUserId, sort)).ToList();
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

        return MapQuestion(created, userId, "newest");
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

        var parentReply = dto.ParentReplyId.HasValue
            ? await _db.QuestionReplies
                .AsNoTracking()
                .FirstOrDefaultAsync(r => r.Id == dto.ParentReplyId.Value && r.QuestionId == questionId)
            : null;
        if (dto.ParentReplyId.HasValue && parentReply == null)
            return null;

        var replier = await _db.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.Id == repliedByUserId);

        var reply = new QuestionReply
        {
            QuestionId = question.Id,
            ParentReplyId = parentReply?.Id,
            RepliedByUserId = repliedByUserId,
            Body = dto.Body.Trim(),
            ReplierDisplayName = replier?.Username ?? "Support Team",
            ReplierDisplayNameColor = replier?.DisplayNameColor,
            ReplierRole = replier != null ? ToRoleLabel(replier.Role) : null,
            CreatedAt = DateTime.UtcNow
        };

        _db.QuestionReplies.Add(reply);

        await _db.SaveChangesAsync();

        var refreshed = await _db.Questions
            .Include(q => q.User)
            .Include(q => q.Replies)
            .ThenInclude(r => r.RepliedByUser)
            .Include(q => q.Replies)
            .ThenInclude(r => r.Votes)
            .Include(q => q.Replies)
            .ThenInclude(r => r.ChildReplies)
            .ThenInclude(r => r.RepliedByUser)
            .Include(q => q.Votes)
            .AsNoTracking()
            .FirstAsync(q => q.Id == question.Id);

        return MapQuestion(refreshed, repliedByUserId, "oldest");
    }

    public async Task<QuestionResponseDto?> VoteQuestionAsync(int questionId, int userId, int value)
    {
        if (value != 1 && value != -1)
            throw new InvalidOperationException("Vote value must be 1 or -1.");

        var question = await _db.Questions.FirstOrDefaultAsync(q => q.Id == questionId);
        if (question == null)
            return null;

        var existing = await _db.QuestionVotes
            .FirstOrDefaultAsync(v => v.UserId == userId && v.QuestionId == questionId);

        if (existing == null)
        {
            _db.QuestionVotes.Add(new QuestionVote
            {
                UserId = userId,
                QuestionId = questionId,
                Value = value
            });
        }
        else if (existing.Value == value)
        {
            _db.QuestionVotes.Remove(existing);
        }
        else
        {
            existing.Value = value;
        }

        await _db.SaveChangesAsync();
        return await GetQuestionForReturnAsync(questionId, userId);
    }

    public async Task<QuestionResponseDto?> VoteReplyAsync(int replyId, int userId, int value)
    {
        if (value != 1 && value != -1)
            throw new InvalidOperationException("Vote value must be 1 or -1.");

        var reply = await _db.QuestionReplies.AsNoTracking().FirstOrDefaultAsync(r => r.Id == replyId);
        if (reply == null)
            return null;

        var existing = await _db.QuestionVotes
            .FirstOrDefaultAsync(v => v.UserId == userId && v.QuestionReplyId == replyId);

        if (existing == null)
        {
            _db.QuestionVotes.Add(new QuestionVote
            {
                UserId = userId,
                QuestionReplyId = replyId,
                Value = value
            });
        }
        else if (existing.Value == value)
        {
            _db.QuestionVotes.Remove(existing);
        }
        else
        {
            existing.Value = value;
        }

        await _db.SaveChangesAsync();
        return await GetQuestionForReturnAsync(reply.QuestionId, userId);
    }

    private async Task<QuestionResponseDto?> GetQuestionForReturnAsync(int questionId, int currentUserId)
    {
        var question = await _db.Questions
            .Include(q => q.User)
            .Include(q => q.Replies)
            .ThenInclude(r => r.RepliedByUser)
            .Include(q => q.Replies)
            .ThenInclude(r => r.Votes)
            .Include(q => q.Replies)
            .ThenInclude(r => r.ChildReplies)
            .ThenInclude(r => r.RepliedByUser)
            .Include(q => q.Votes)
            .AsNoTracking()
            .FirstOrDefaultAsync(q => q.Id == questionId);

        return question == null ? null : MapQuestion(question, currentUserId, "oldest");
    }

    private static IReadOnlyList<Question> ApplyQuestionSort(IReadOnlyList<Question> questions, string? sort)
    {
        var normalizedSort = NormalizeSort(sort);
        return normalizedSort switch
        {
            "oldest" => questions.OrderBy(q => q.CreatedAt).ThenBy(q => q.Id).ToList(),
            "top" => questions
                .OrderByDescending(q => q.Votes.Sum(v => v.Value))
                .ThenByDescending(q => q.CreatedAt)
                .ThenByDescending(q => q.Id)
                .ToList(),
            _ => questions.OrderByDescending(q => q.CreatedAt).ThenByDescending(q => q.Id).ToList()
        };
    }

    private static QuestionResponseDto MapQuestion(Models.Question question, int? currentUserId, string? sort)
    {
        var repliesById = question.Replies.ToDictionary(r => r.Id);
        var rootReplies = question.Replies.Where(r => r.ParentReplyId == null).ToList();
        var sortedRootReplies = SortReplies(rootReplies, sort);

        return new QuestionResponseDto
        {
            Id = question.Id,
            UserId = question.UserId,
            Username = question.User.Username,
            UsernameAvatarUrl = question.User.AvatarUrl,
            UsernameDisplayNameColor = question.User.DisplayNameColor,
            Subject = question.Subject,
            Body = question.Body,
            Score = question.Votes.Sum(v => v.Value),
            CurrentUserVote = currentUserId.HasValue
                ? question.Votes.Where(v => v.UserId == currentUserId.Value).Select(v => v.Value).FirstOrDefault()
                : 0,
            Replies = sortedRootReplies.Select(r => MapReply(r, repliesById, currentUserId, sort)).ToList(),
            CreatedAt = question.CreatedAt
        };
    }

    private static QuestionReplyDto MapReply(
        QuestionReply reply,
        IReadOnlyDictionary<int, QuestionReply> repliesById,
        int? currentUserId,
        string? sort)
    {
        var childReplies = repliesById.Values.Where(r => r.ParentReplyId == reply.Id).ToList();
        var sortedChildren = SortReplies(childReplies, sort);

        return new QuestionReplyDto
        {
            Id = reply.Id,
            ParentReplyId = reply.ParentReplyId,
            Body = reply.Body,
            ReplierDisplayName = reply.ReplierDisplayName,
            ReplierAvatarUrl = reply.RepliedByUser?.AvatarUrl,
            ReplierDisplayNameColor = reply.ReplierDisplayNameColor ?? reply.RepliedByUser?.DisplayNameColor,
            ReplierRole = reply.ReplierRole ?? (reply.RepliedByUser != null ? ToRoleLabel(reply.RepliedByUser.Role) : null),
            Score = reply.Votes.Sum(v => v.Value),
            CurrentUserVote = currentUserId.HasValue
                ? reply.Votes.Where(v => v.UserId == currentUserId.Value).Select(v => v.Value).FirstOrDefault()
                : 0,
            Replies = sortedChildren.Select(r => MapReply(r, repliesById, currentUserId, sort)).ToList(),
            CreatedAt = reply.CreatedAt
        };
    }

    private static IReadOnlyList<QuestionReply> SortReplies(IReadOnlyList<QuestionReply> replies, string? sort)
    {
        return NormalizeSort(sort) switch
        {
            "oldest" => replies.OrderBy(r => r.CreatedAt).ThenBy(r => r.Id).ToList(),
            "top" => replies
                .OrderByDescending(r => r.Votes.Sum(v => v.Value))
                .ThenByDescending(r => r.CreatedAt)
                .ThenByDescending(r => r.Id)
                .ToList(),
            _ => replies.OrderByDescending(r => r.CreatedAt).ThenByDescending(r => r.Id).ToList()
        };
    }

    private static string NormalizeSort(string? sort)
    {
        var normalized = sort?.Trim().ToLowerInvariant();
        return normalized is "top" or "newest" or "oldest" ? normalized : "oldest";
    }

    private static string ToRoleLabel(UserRole role)
    {
        return role switch
        {
            UserRole.CustomerRep => "customer_rep",
            UserRole.Admin => "admin",
            UserRole.Vip => "vip",
            _ => "end_user"
        };
    }
}

