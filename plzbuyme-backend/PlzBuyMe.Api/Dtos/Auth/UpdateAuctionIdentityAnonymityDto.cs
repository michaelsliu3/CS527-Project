namespace PlzBuyMe.Api.Dtos.Auth;

public record UpdateAuctionIdentityAnonymityDto
{
    public bool IsAuctionIdentityAnonymous { get; init; }
}
