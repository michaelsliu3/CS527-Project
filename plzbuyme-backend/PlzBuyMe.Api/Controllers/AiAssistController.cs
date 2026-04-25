using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;

namespace PlzBuyMe.Controllers
{
    /// <summary>
    /// NOVELTY FEATURE: Proxies AI description requests to the Anthropic API.
    /// Keeps the API key server-side -- never exposed to the client.
    /// Register in Program.cs:
    ///   builder.Services.AddHttpClient();
    ///   Add "Anthropic:ApiKey" to appsettings.json or user-secrets.
    /// </summary>
    [ApiController]
    [Route("api/ai")]
    [Authorize]
    public class AiAssistController : ControllerBase
    {
        private readonly IHttpClientFactory _httpFactory;
        private readonly string _apiKey;

        public AiAssistController(IHttpClientFactory httpFactory, IConfiguration config)
        {
            _httpFactory = httpFactory;
            _apiKey = config["Anthropic:ApiKey"] ?? "";
        }

        /// <summary>POST /api/ai/describe-item -- generates an AI-written listing description</summary>
        [HttpPost("describe-item")]
        public async Task<IActionResult> DescribeItem([FromBody] DescribeItemRequest req)
        {
            if (string.IsNullOrWhiteSpace(req.Prompt))
                return BadRequest("Prompt is required.");
            if (string.IsNullOrWhiteSpace(_apiKey))
                return StatusCode(503, "AI service is not configured.");

            var client = _httpFactory.CreateClient();
            client.DefaultRequestHeaders.Add("x-api-key", _apiKey);
            client.DefaultRequestHeaders.Add("anthropic-version", "2023-06-01");
            var body = new { model = "claude-sonnet-4-20250514", max_tokens = 300, messages = new[] { new { role = "user", content = req.Prompt } } };
            var json = JsonSerializer.Serialize(body);
            var httpContent = new StringContent(json, Encoding.UTF8, "application/json");
            var response = await client.PostAsync("https://api.anthropic.com/v1/messages", httpContent);
            if (!response.IsSuccessStatusCode) return StatusCode(502, "AI upstream error.");
            using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
            var text = doc.RootElement.GetProperty("content")[0].GetProperty("text").GetString() ?? "";
            return Ok(new { description = text.Trim() });
        }
    }

    public record DescribeItemRequest(string Prompt);
}
