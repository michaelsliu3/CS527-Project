using System.ComponentModel.DataAnnotations;

namespace PlzBuyMe.Api.Dtos.Questions;

public record ReplyDto
{
    [Required]
    public string Reply { get; init; } = string.Empty;
}

