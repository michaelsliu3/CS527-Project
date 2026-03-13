using System.ComponentModel.DataAnnotations.Schema;

namespace PlzBuyMe.Api.Models;

public class Alert
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public int? CategoryId { get; set; }
    public string? Keyword { get; set; }
    [Column(TypeName = "json")]
    public string? Criteria { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public User User { get; set; } = null!;
    public Category? Category { get; set; }
}
