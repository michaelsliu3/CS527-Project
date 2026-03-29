namespace PlzBuyMe.Api.Models;

public enum UserRole
{
    EndUser,
    Vip,
    CustomerRep,
    Admin
}

public enum ItemStatus
{
    Active,
    Closed,
    Sold,
    Removed
}

public enum FieldType
{
    Text,
    Number,
    Select
}

public enum NotificationType
{
    Outbid,
    AutoLimitReached,
    AutoBidPlaced,
    AuctionWon,
    AuctionLost,
    AuctionSold,
    AlertMatch,
    ReserveNotMet
}
