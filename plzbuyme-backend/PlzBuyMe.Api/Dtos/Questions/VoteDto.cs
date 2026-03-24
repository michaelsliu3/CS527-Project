using System.ComponentModel.DataAnnotations;

namespace PlzBuyMe.Api.Dtos.Questions;

public record VoteDto
{
    [Range(-1, 1)]
    public int Value { get; init; }
}
