using Microsoft.AspNetCore.Mvc;
using PlzBuyMe.Cdn.Dtos.Common;
using PlzBuyMe.Cdn.Dtos.Media;
using PlzBuyMe.Cdn.Services;

namespace PlzBuyMe.Cdn.Controllers;

[ApiController]
[Route("api/media")]
public sealed class MediaController : ControllerBase
{
    private readonly IMediaStorageService _mediaStorageService;

    public MediaController(IMediaStorageService mediaStorageService)
    {
        _mediaStorageService = mediaStorageService;
    }

    [HttpPost("upload")]
    public async Task<IActionResult> Upload([FromForm] UploadMediaRequestDto dto, CancellationToken cancellationToken)
    {
        var result = await _mediaStorageService.UploadAsync(dto.File, dto.Folder, dto.ReplaceKey, cancellationToken);
        if (!result.Success)
        {
            return BadRequest(new ErrorResponseDto
            {
                Message = result.ErrorMessage ?? "Upload failed."
            });
        }

        return Ok(new UploadMediaResponseDto
        {
            Key = result.Upload!.Key,
            Url = result.Upload.Url
        });
    }

    [HttpDelete("{*key}")]
    public IActionResult Delete(string key)
    {
        var result = _mediaStorageService.Delete(key);
        if (!result.Success && result.ErrorMessage != null)
        {
            return BadRequest(new ErrorResponseDto
            {
                Message = result.ErrorMessage
            });
        }

        if (result.NotFound)
            return NotFound();

        return NoContent();
    }
}
