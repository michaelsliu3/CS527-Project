namespace PlzBuyMe.Api.Dtos.Auctions;

public record SetAutoBidDto
{
    public decimal UpperLimit { get; init; }
}
