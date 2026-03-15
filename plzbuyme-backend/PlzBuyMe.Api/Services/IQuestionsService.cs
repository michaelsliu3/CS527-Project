using PlzBuyMe.Api.Dtos.Questions;

namespace PlzBuyMe.Api.Services;

public interface IQuestionsService
{
    Task<IReadOnlyList<QuestionResponseDto>> GetQuestionsAsync(string? keyword);
    Task<QuestionResponseDto> CreateQuestionAsync(int userId, CreateQuestionDto dto);
    Task<QuestionResponseDto?> ReplyAsync(int questionId, int repliedByUserId, ReplyDto dto);
}

