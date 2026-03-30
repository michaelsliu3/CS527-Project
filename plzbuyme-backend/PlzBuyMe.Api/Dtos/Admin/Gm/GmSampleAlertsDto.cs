namespace PlzBuyMe.Api.Dtos.Admin.Gm;

public record GmSampleAlertsDto
{
    public int UserId { get; init; }
    public int Count { get; init; } = 3;
}
