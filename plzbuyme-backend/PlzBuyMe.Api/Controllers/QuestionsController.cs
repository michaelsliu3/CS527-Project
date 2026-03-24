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
    public async Task<IActionResult> List([FromQuery] string? keyword, [FromQuery] string? sort = null)
    {
        var items = await _questionsService.GetQuestionsAsync(keyword, GetCurrentUserId(), sort);
        return Ok(items);
    }

    [Authorize(Policy = "EndUser")]
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateQuestionDto? dto)
    {
        if (dto == null)
            return BadRequest("Request body is required.");

        var userId = GetCurrentUserId();
        if (userId == null)
            return Forbid();

        var response = await _questionsService.CreateQuestionAsync(userId.Value, dto);
        return Ok(response);
    }

    [Authorize(Policy = "RepOnly")]
    [HttpPost("{id:int}/reply")]
    public async Task<IActionResult> Reply(int id, [FromBody] ReplyDto? dto)
    {
        if (dto == null)
            return BadRequest("Request body is required.");

        var userId = GetCurrentUserId();
        if (userId == null)
            return Forbid();

        var response = await _questionsService.ReplyAsync(id, userId.Value, dto);
        if (response == null)
            return NotFound();
        return Ok(response);
    }

    [Authorize]
    [HttpPost("{id:int}/vote")]
    public async Task<IActionResult> VoteQuestion(int id, [FromBody] VoteDto? dto)
    {
        if (dto == null || dto.Value == 0)
            return BadRequest("Vote value must be 1 or -1.");

        var userId = GetCurrentUserId();
        if (userId == null)
            return Forbid();

        var response = await _questionsService.VoteQuestionAsync(id, userId.Value, dto.Value);
        if (response == null)
            return NotFound();
        return Ok(response);
    }

    [Authorize]
    [HttpPost("replies/{replyId:int}/vote")]
    public async Task<IActionResult> VoteReply(int replyId, [FromBody] VoteDto? dto)
    {
        if (dto == null || dto.Value == 0)
            return BadRequest("Vote value must be 1 or -1.");

        var userId = GetCurrentUserId();
        if (userId == null)
            return Forbid();

        var response = await _questionsService.VoteReplyAsync(replyId, userId.Value, dto.Value);
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

