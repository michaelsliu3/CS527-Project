using PlzBuyMe.Api.Dtos.Questions;

namespace PlzBuyMe.Api.Services;

public interface IQuestionsService
{
    Task<IReadOnlyList<QuestionResponseDto>> GetQuestionsAsync(string? keyword, int? currentUserId, string? sort);
    Task<QuestionResponseDto> CreateQuestionAsync(int userId, CreateQuestionDto dto);
    Task<QuestionResponseDto?> ReplyAsync(int questionId, int repliedByUserId, ReplyDto dto);
    Task<QuestionResponseDto?> VoteQuestionAsync(int questionId, int userId, int value);
    Task<QuestionResponseDto?> VoteReplyAsync(int replyId, int userId, int value);
}

