using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PlzBuyMe.Api.Dtos.Questions;
using PlzBuyMe.Api.Services;

namespace PlzBuyMe.Api.Controllers;

[ApiController]
[Route("api/questions")]
public class QuestionsController : ControllerBase
{
    private readonly IQuestionsService _questionsService;

    public QuestionsController(IQuestionsService questionsService)
    {
        _questionsService = questionsService;
    }

    [Authorize]
    [HttpGet]
    public async Task<IActionResult> List([FromQuery] string? keyword)
    {
        var items = await _questionsService.GetQuestionsAsync(keyword);
        return Ok(items);
    }

    [Authorize(Policy = "EndUser")]
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateQuestionDto dto)
    {
        var userId = GetCurrentUserId();
        if (userId == null)
            return Forbid();

        if (string.IsNullOrWhiteSpace(dto.Subject) || string.IsNullOrWhiteSpace(dto.Body))
            return BadRequest("Subject and body are required.");

        var response = await _questionsService.CreateQuestionAsync(userId.Value, dto);
        return Ok(response);
    }

    [Authorize(Policy = "RepOnly")]
    [HttpPost("{id:int}/reply")]
    public async Task<IActionResult> Reply(int id, [FromBody] ReplyDto dto)
    {
        var userId = GetCurrentUserId();
        if (userId == null)
            return Forbid();

        if (string.IsNullOrWhiteSpace(dto.Reply))
            return BadRequest("Reply is required.");

        var response = await _questionsService.ReplyAsync(id, userId.Value, dto);
        if (response == null)
            return NotFound();
        return Ok(response);
    }

    private int? GetCurrentUserId()
    {
        var claim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return int.TryParse(claim, out var id) ? id : null;
    }
}

