namespace PlzBuyMe.Api.Dtos.Admin.Gm;

public record GmSeedQuestionsDto
{
    public int Count { get; init; }

    /// <summary>If true, roughly half of questions get a rep/admin reply.</summary>
    public bool IncludeRepReplies { get; init; }
}
