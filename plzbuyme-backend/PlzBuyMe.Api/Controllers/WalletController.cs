using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PlzBuyMe.Api.Dtos.Wallet;
using PlzBuyMe.Api.Services;

namespace PlzBuyMe.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class WalletController : ControllerBase
{
    private readonly IWalletService _walletService;

    public WalletController(IWalletService walletService)
    {
        _walletService = walletService;
    }

    [Authorize(Policy = "EndUser")]
    [HttpPost("deposit")]
    public async Task<IActionResult> Deposit([FromBody] WalletDepositRequestDto dto)
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out var userId))
            return Forbid();

        var amount = ResolveDepositAmount(dto);
        if (amount == null)
            return BadRequest("Specify a positive amount or a preset: small, medium, or large.");

        try
        {
            var (balance, available) = await _walletService.DepositAsync(userId, amount.Value);
            return Ok(new WalletDepositResponseDto
            {
                WalletBalance = balance,
                WalletAvailableBalance = available
            });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ex.Message);
        }
    }

    [Authorize(Policy = "EndUser")]
    [HttpPost("withdraw")]
    public async Task<IActionResult> Withdraw([FromBody] WalletWithdrawRequestDto dto)
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out var userId))
            return Forbid();

        if (dto.Amount is not { } amount || amount <= 0m)
            return BadRequest("Specify a positive withdrawal amount.");

        try
        {
            var (balance, available) = await _walletService.WithdrawAsync(userId, amount);
            return Ok(new WalletWithdrawResponseDto
            {
                WalletBalance = balance,
                WalletAvailableBalance = available
            });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ex.Message);
        }
    }

    private static decimal? ResolveDepositAmount(WalletDepositRequestDto dto)
    {
        if (!string.IsNullOrWhiteSpace(dto.Preset))
        {
            return dto.Preset.Trim().ToLowerInvariant() switch
            {
                "small" => 100m,
                "medium" => 500m,
                "large" => 2000m,
                _ => null
            };
        }

        if (dto.Amount.HasValue && dto.Amount.Value > 0m)
            return dto.Amount.Value;

        return null;
    }
}
