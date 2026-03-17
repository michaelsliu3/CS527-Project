using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using PlzBuyMe.Api.Models;

namespace PlzBuyMe.Api.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
    {
    }

    public DbSet<User> Users => Set<User>();
    public DbSet<Category> Categories => Set<Category>();
    public DbSet<CategoryField> CategoryFields => Set<CategoryField>();
    public DbSet<Item> Items => Set<Item>();
    public DbSet<ItemFieldValue> ItemFieldValues => Set<ItemFieldValue>();
    public DbSet<Bid> Bids => Set<Bid>();
    public DbSet<AutoBid> AutoBids => Set<AutoBid>();
    public DbSet<Alert> Alerts => Set<Alert>();
    public DbSet<Notification> Notifications => Set<Notification>();
    public DbSet<Question> Questions => Set<Question>();
    public DbSet<QuestionReply> QuestionReplies => Set<QuestionReply>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // ── Enum to string (snake_case for DB / JWT compatibility) ──
        modelBuilder.Entity<User>()
            .Property(u => u.Role)
            .HasConversion(EnumToSnakeCase<UserRole>())
            .HasMaxLength(32);
        modelBuilder.Entity<Item>()
            .Property(i => i.Status)
            .HasConversion(EnumToSnakeCase<ItemStatus>())
            .HasMaxLength(32);
        modelBuilder.Entity<CategoryField>()
            .Property(c => c.FieldType)
            .HasConversion(EnumToSnakeCase<FieldType>())
            .HasMaxLength(32);
        modelBuilder.Entity<Notification>()
            .Property(n => n.Type)
            .HasConversion(EnumToSnakeCase<NotificationType>())
            .HasMaxLength(32);

        // ── User ──
        modelBuilder.Entity<User>(e =>
        {
            e.HasIndex(u => u.Username).IsUnique();
            e.HasIndex(u => u.Email).IsUnique();
            e.Property(u => u.Username).HasMaxLength(64);
            e.Property(u => u.Email).HasMaxLength(128);
            e.Property(u => u.PasswordHash).HasMaxLength(256);
        });

        // ── Category (self-ref) ──
        modelBuilder.Entity<Category>(e =>
        {
            e.Property(c => c.Name).HasMaxLength(64);
            e.HasOne(c => c.Parent)
                .WithMany(c => c.Children)
                .HasForeignKey(c => c.ParentId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        // ── CategoryField ──
        modelBuilder.Entity<CategoryField>(e =>
        {
            e.Property(c => c.FieldName).HasMaxLength(64);
            e.HasOne(c => c.Category)
                .WithMany(cat => cat.CategoryFields)
                .HasForeignKey(c => c.CategoryId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        // ── Item ──
        modelBuilder.Entity<Item>(e =>
        {
            e.Property(i => i.Title).HasMaxLength(256);
            e.Property(i => i.InitialPrice).HasPrecision(12, 2);
            e.Property(i => i.BidIncrement).HasPrecision(12, 2);
            e.Property(i => i.ReservePrice).HasPrecision(12, 2);
            e.Property(i => i.CurrentPrice).HasPrecision(12, 2);
            e.HasOne(i => i.Seller)
                .WithMany(u => u.ItemsSold)
                .HasForeignKey(i => i.SellerId)
                .OnDelete(DeleteBehavior.Restrict);
            e.HasOne(i => i.Category)
                .WithMany(c => c.Items)
                .HasForeignKey(i => i.CategoryId)
                .OnDelete(DeleteBehavior.Restrict);
            e.HasOne(i => i.Winner)
                .WithMany(u => u.ItemsWon)
                .HasForeignKey(i => i.WinnerId)
                .OnDelete(DeleteBehavior.Restrict);
            e.HasIndex(i => new { i.Status, i.CloseDateTime }).HasDatabaseName("idx_items_status_close");
            e.HasIndex(i => i.CategoryId).HasDatabaseName("idx_items_category");
            e.HasIndex(i => i.SellerId).HasDatabaseName("idx_items_seller");
        });

        // ── ItemFieldValue (unique item_id + field_id) ──
        modelBuilder.Entity<ItemFieldValue>(e =>
        {
            e.Property(iv => iv.Value).HasMaxLength(256);
            e.HasOne(iv => iv.Item)
                .WithMany(i => i.ItemFieldValues)
                .HasForeignKey(iv => iv.ItemId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasOne(iv => iv.Field)
                .WithMany(f => f.ItemFieldValues)
                .HasForeignKey(iv => iv.FieldId)
                .OnDelete(DeleteBehavior.Restrict);
            e.HasIndex(iv => new { iv.ItemId, iv.FieldId }).IsUnique();
        });

        // ── Bid ──
        modelBuilder.Entity<Bid>(e =>
        {
            e.Property(b => b.Amount).HasPrecision(12, 2);
            e.HasOne(b => b.Item)
                .WithMany(i => i.Bids)
                .HasForeignKey(b => b.ItemId)
                .OnDelete(DeleteBehavior.Restrict);
            e.HasOne(b => b.Bidder)
                .WithMany(u => u.Bids)
                .HasForeignKey(b => b.BidderId)
                .OnDelete(DeleteBehavior.Restrict);
            e.HasIndex(b => new { b.ItemId, b.CreatedAt }).HasDatabaseName("idx_bids_item");
            e.HasIndex(b => b.BidderId).HasDatabaseName("idx_bids_bidder");
        });

        // ── AutoBid (unique item_id + bidder_id) ──
        modelBuilder.Entity<AutoBid>(e =>
        {
            e.Property(ab => ab.UpperLimit).HasPrecision(12, 2);
            e.HasOne(ab => ab.Item)
                .WithMany(i => i.AutoBids)
                .HasForeignKey(ab => ab.ItemId)
                .OnDelete(DeleteBehavior.Restrict);
            e.HasOne(ab => ab.Bidder)
                .WithMany(u => u.AutoBids)
                .HasForeignKey(ab => ab.BidderId)
                .OnDelete(DeleteBehavior.Restrict);
            e.HasIndex(ab => new { ab.ItemId, ab.BidderId }).IsUnique();
        });

        // ── Alert ──
        modelBuilder.Entity<Alert>(e =>
        {
            e.Property(a => a.Keyword).HasMaxLength(128);
            e.HasOne(a => a.User)
                .WithMany(u => u.Alerts)
                .HasForeignKey(a => a.UserId)
                .OnDelete(DeleteBehavior.Restrict);
            e.HasOne(a => a.Category)
                .WithMany(c => c.Alerts)
                .HasForeignKey(a => a.CategoryId)
                .OnDelete(DeleteBehavior.Restrict);
            e.HasIndex(a => new { a.UserId, a.IsActive }).HasDatabaseName("idx_alerts_user");
        });

        // ── Notification ──
        modelBuilder.Entity<Notification>(e =>
        {
            e.HasOne(n => n.User)
                .WithMany(u => u.Notifications)
                .HasForeignKey(n => n.UserId)
                .OnDelete(DeleteBehavior.Restrict);
            e.HasOne(n => n.Item)
                .WithMany(i => i.Notifications)
                .HasForeignKey(n => n.ItemId)
                .OnDelete(DeleteBehavior.Restrict);
            e.HasIndex(n => new { n.UserId, n.IsRead }).HasDatabaseName("idx_notifications_user");
        });

        // ── Question ──
        modelBuilder.Entity<Question>(e =>
        {
            e.Property(q => q.Subject).HasMaxLength(256);
            e.HasOne(q => q.User)
                .WithMany(u => u.QuestionsAsked)
                .HasForeignKey(q => q.UserId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        // ── QuestionReply ──
        modelBuilder.Entity<QuestionReply>(e =>
        {
            e.Property(qr => qr.Title).HasMaxLength(256);
            e.Property(qr => qr.ReplierDisplayName).HasMaxLength(128);
            e.Property(qr => qr.ReplierRole).HasMaxLength(32);
            e.HasOne(qr => qr.Question)
                .WithMany(q => q.Replies)
                .HasForeignKey(qr => qr.QuestionId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasOne(qr => qr.RepliedByUser)
                .WithMany(u => u.QuestionReplies)
                .HasForeignKey(qr => qr.RepliedByUserId)
                .OnDelete(DeleteBehavior.SetNull);
            e.HasIndex(qr => new { qr.QuestionId, qr.CreatedAt });
        });
    }

    private static ValueConverter<T, string> EnumToSnakeCase<T>() where T : struct, Enum
    {
        return new ValueConverter<T, string>(
            v => ToSnakeCase(v.ToString()),
            v => Enum.Parse<T>(FromSnakeCase(v)));
    }

    private static string ToSnakeCase(string value)
    {
        if (string.IsNullOrEmpty(value)) return value;
        var result = new System.Text.StringBuilder();
        for (int i = 0; i < value.Length; i++)
        {
            var c = value[i];
            if (char.IsUpper(c) && i > 0)
                result.Append('_');
            result.Append(char.ToLowerInvariant(c));
        }
        return result.ToString();
    }

    private static string FromSnakeCase(string value)
    {
        if (string.IsNullOrEmpty(value)) return value;
        var result = new System.Text.StringBuilder();
        bool nextUpper = true;
        foreach (var c in value)
        {
            if (c == '_')
            {
                nextUpper = true;
                continue;
            }
            result.Append(nextUpper ? char.ToUpperInvariant(c) : char.ToLowerInvariant(c));
            nextUpper = false;
        }
        return result.ToString();
    }
}
