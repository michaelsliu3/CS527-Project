using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
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
    public DbSet<QuestionVote> QuestionVotes => Set<QuestionVote>();
    public DbSet<BidHold> BidHolds => Set<BidHold>();

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
            e.Property(u => u.IsAuctionIdentityAnonymous).HasDefaultValue(false);
            e.Property(u => u.AvatarUrl).HasMaxLength(2048);
            e.Property(u => u.AvatarStorageKey).HasMaxLength(1024);
            e.Property(u => u.DisplayNameColor).HasMaxLength(7);
            e.Property(u => u.Email).HasMaxLength(128);
            e.Property(u => u.PasswordHash).HasMaxLength(256);
            e.Property(u => u.WalletBalance).HasPrecision(12, 2);
        });

        // ── Category (self-ref) ──
        modelBuilder.Entity<Category>(e =>
        {
            e.Property(c => c.Name).HasMaxLength(64);
            e.Property(c => c.StringKey).HasMaxLength(64);
            e.Property(c => c.LucideIconKey).HasMaxLength(64);
            e.HasIndex(c => c.StringKey).IsUnique();
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
            e.Property(i => i.ImageUrl).HasMaxLength(2048);
            e.Property(i => i.ImageStorageKey).HasMaxLength(1024);
            e.Property(i => i.ImageSource).HasMaxLength(64);
            e.Property(i => i.ImageMatchLevel).HasMaxLength(64);
            e.Property(i => i.InitialPrice).HasPrecision(12, 2);
            e.Property(i => i.BidIncrement).HasPrecision(12, 2);
            e.Property(i => i.ReservePrice).HasPrecision(12, 2);
            e.Property(i => i.CurrentPrice).HasPrecision(12, 2);
            var catProp = e.Property(i => i.CategoryIds);
            if (Database.ProviderName == "Microsoft.EntityFrameworkCore.InMemory")
            {
                catProp.HasConversion(
                    v => JsonSerializer.Serialize(v, (JsonSerializerOptions?)null),
                    v => JsonSerializer.Deserialize<List<int>>(v, (JsonSerializerOptions?)null) ?? new List<int>(),
                    new ValueComparer<List<int>>(
                        (a, b) => a!.SequenceEqual(b!),
                        c => c.Aggregate(0, (hash, i) => HashCode.Combine(hash, i)),
                        c => c.ToList()));
            }
            else
            {
                catProp.HasColumnType("json");
            }
            e.HasOne(i => i.Seller)
                .WithMany(u => u.ItemsSold)
                .HasForeignKey(i => i.SellerId)
                .OnDelete(DeleteBehavior.Restrict);
            e.HasOne(i => i.Winner)
                .WithMany(u => u.ItemsWon)
                .HasForeignKey(i => i.WinnerId)
                .OnDelete(DeleteBehavior.Restrict);
            e.HasIndex(i => new { i.Status, i.CloseDateTime }).HasDatabaseName("idx_items_status_close");
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

        // ── BidHold (one active hold per auction — current high bidder) ──
        modelBuilder.Entity<BidHold>(e =>
        {
            e.Property(h => h.Amount).HasPrecision(12, 2);
            e.HasOne(h => h.Item)
                .WithMany()
                .HasForeignKey(h => h.ItemId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasOne(h => h.User)
                .WithMany()
                .HasForeignKey(h => h.UserId)
                .OnDelete(DeleteBehavior.Restrict);
            e.HasIndex(h => h.ItemId).IsUnique().HasDatabaseName("idx_bid_holds_item");
            e.HasIndex(h => h.UserId).HasDatabaseName("idx_bid_holds_user");
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
            e.Property(qr => qr.ReplierDisplayName).HasMaxLength(128);
            e.Property(qr => qr.ReplierDisplayNameColor).HasMaxLength(7);
            e.Property(qr => qr.ReplierRole).HasMaxLength(32);
            e.HasOne(qr => qr.Question)
                .WithMany(q => q.Replies)
                .HasForeignKey(qr => qr.QuestionId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasOne(qr => qr.RepliedByUser)
                .WithMany(u => u.QuestionReplies)
                .HasForeignKey(qr => qr.RepliedByUserId)
                .OnDelete(DeleteBehavior.SetNull);
            e.HasOne(qr => qr.ParentReply)
                .WithMany(qr => qr.ChildReplies)
                .HasForeignKey(qr => qr.ParentReplyId)
                .OnDelete(DeleteBehavior.Restrict);
            e.HasIndex(qr => new { qr.QuestionId, qr.CreatedAt });
        });

        modelBuilder.Entity<QuestionVote>(e =>
        {
            e.Property(v => v.Value).IsRequired();
            e.HasOne(v => v.User)
                .WithMany(u => u.QuestionVotes)
                .HasForeignKey(v => v.UserId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasOne(v => v.Question)
                .WithMany(q => q.Votes)
                .HasForeignKey(v => v.QuestionId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasOne(v => v.QuestionReply)
                .WithMany(r => r.Votes)
                .HasForeignKey(v => v.QuestionReplyId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasIndex(v => new { v.UserId, v.QuestionId }).IsUnique();
            e.HasIndex(v => new { v.UserId, v.QuestionReplyId }).IsUnique();
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

    /// <summary>
    /// Pomelo 8.0.2 can't translate List&lt;int&gt;.Contains() on JSON columns.
    /// Use EF.Functions.JsonContains for MySQL; fall back to LINQ Contains for InMemory tests.
    /// </summary>
    public IQueryable<Item> WhereItemCategoryContains(IQueryable<Item> query, int categoryId)
    {
        if (Database.ProviderName == "Microsoft.EntityFrameworkCore.InMemory")
            return query.Where(i => i.CategoryIds.Contains(categoryId));
        var catIdJson = categoryId.ToString();
        return query.Where(i => EF.Functions.JsonContains(i.CategoryIds, catIdJson));
    }

    public Task<bool> AnyItemWithCategoryAsync(int categoryId)
    {
        if (Database.ProviderName == "Microsoft.EntityFrameworkCore.InMemory")
            return Items.AnyAsync(i => i.CategoryIds.Contains(categoryId));
        var catIdJson = categoryId.ToString();
        return Items.AnyAsync(i => EF.Functions.JsonContains(i.CategoryIds, catIdJson));
    }
}
