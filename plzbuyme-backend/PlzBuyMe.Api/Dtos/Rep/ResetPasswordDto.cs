using System.ComponentModel.DataAnnotations;

namespace PlzBuyMe.Api.Dtos.Rep;

public record ResetPasswordDto
{
    [Required]
    [MinLength(6)]
    public string NewPassword { get; init; } = string.Empty;
}

