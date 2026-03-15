using System.ComponentModel.DataAnnotations;

namespace PlzBuyMe.Api.Dtos.Rep;

public record EditUserDto
{
    [Required]
    [MaxLength(64)]
    public string Username { get; init; } = string.Empty;

    [Required]
    [MaxLength(128)]
    [EmailAddress]
    public string Email { get; init; } = string.Empty;
}

