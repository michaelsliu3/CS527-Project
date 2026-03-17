using System.ComponentModel.DataAnnotations;

namespace PlzBuyMe.Api.Dtos.Questions;

public record ReplyDto
{
    [MaxLength(256)]
    public string? Title { get; init; }

    [Required]
    public string Body { get; init; } = string.Empty;
}

