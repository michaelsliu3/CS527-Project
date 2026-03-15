using System.ComponentModel.DataAnnotations;

namespace PlzBuyMe.Api.Dtos.Questions;

public record CreateQuestionDto
{
    [Required]
    [MaxLength(256)]
    public string Subject { get; init; } = string.Empty;

    [Required]
    public string Body { get; init; } = string.Empty;
}

