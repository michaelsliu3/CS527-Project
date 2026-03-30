namespace PlzBuyMe.Api.Dtos.Admin.Gm;

public record GmSampleNotificationsDto
{
    public int UserId { get; init; }
    public int Count { get; init; } = 5;
}
