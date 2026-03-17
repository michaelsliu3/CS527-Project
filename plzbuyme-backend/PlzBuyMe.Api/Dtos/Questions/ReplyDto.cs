using System.ComponentModel.DataAnnotations;

namespace PlzBuyMe.Api.Dtos.Questions;

public record ReplyDto
{
    [Required]
    public string Body { get; init; } = string.Empty;
}

