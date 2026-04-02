using Microsoft.EntityFrameworkCore;
using PlzBuyMe.Api.Models;

namespace PlzBuyMe.Api.Data;

public static class SeedData
{
    public static void Initialize(AppDbContext db)
    {
        if (db.Users.Any())
            return;

        // ── Admin account ──
        var admin = new User
        {
            Username = "admin",
            Email = "admin@plzbuy.me",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("admin123"),
            Role = UserRole.Admin,
            IsActive = true,
            WalletBalance = 0m
        };
        db.Users.Add(admin);
        db.SaveChanges();

        // ── Category hierarchy: Cars → Sedans, SUVs, Trucks, Sports Cars, Electric ──
        const string carHubExtraSortJson =
            """[{"value":"year_newest","label":"Year: newest"},{"value":"year_oldest","label":"Year: oldest"},{"value":"mileage_low","label":"Mileage: low to high"},{"value":"mileage_high","label":"Mileage: high to low"}]""";
        var cars = new Category
        {
            Name = "Cars",
            ParentId = null,
            StringKey = "cars",
            SortOrder = 0,
            IsSearchHub = true,
            ExtraSortOptionsJson = carHubExtraSortJson,
        };
        db.Categories.Add(cars);
        db.SaveChanges();

        var sedans = new Category { Name = "Sedans", ParentId = cars.Id, StringKey = "sedans", SortOrder = 10 };
        var suvs = new Category { Name = "SUVs", ParentId = cars.Id, StringKey = "suvs", SortOrder = 20 };
        var trucks = new Category { Name = "Trucks", ParentId = cars.Id, StringKey = "trucks", SortOrder = 30 };
        var sportsCars = new Category { Name = "Sports Cars", ParentId = cars.Id, StringKey = "sports-cars", SortOrder = 40 };
        var electric = new Category { Name = "Electric", ParentId = cars.Id, StringKey = "electric", SortOrder = 50 };
        db.Categories.AddRange(sedans, suvs, trucks, sportsCars, electric);
        db.SaveChanges();

        // Third level under Sedans so hierarchy has 3+ levels (Cars → Sedans → Compact/Full-Size)
        var compactSedans = new Category
        {
            Name = "Compact Sedans",
            ParentId = sedans.Id,
            StringKey = "compact-sedans",
            SortOrder = 60,
        };
        var fullSizeSedans = new Category
        {
            Name = "Full-Size Sedans",
            ParentId = sedans.Id,
            StringKey = "full-size-sedans",
            SortOrder = 70,
        };
        db.Categories.AddRange(compactSedans, fullSizeSedans);
        db.SaveChanges();

        var subcategories = new[] { sedans, suvs, trucks, sportsCars, electric };
        var conditionOptions = "[\"New\",\"Like New\",\"Excellent\",\"Good\",\"Fair\",\"Poor\"]";
        var transmissionOptions = "[\"Automatic\",\"Manual\",\"CVT\"]";
        var fuelOptions = "[\"Gasoline\",\"Diesel\",\"Electric\",\"Hybrid\",\"Plug-in Hybrid\"]";

        foreach (var sub in subcategories)
        {
            db.CategoryFields.Add(new CategoryField { CategoryId = sub.Id, FieldName = "Make", FieldType = FieldType.Text, IsRequired = true });
            db.CategoryFields.Add(new CategoryField { CategoryId = sub.Id, FieldName = "Model", FieldType = FieldType.Text, IsRequired = true });
            db.CategoryFields.Add(new CategoryField { CategoryId = sub.Id, FieldName = "Year", FieldType = FieldType.Number, IsRequired = true });
            db.CategoryFields.Add(new CategoryField { CategoryId = sub.Id, FieldName = "Mileage", FieldType = FieldType.Number, IsRequired = true });
            db.CategoryFields.Add(new CategoryField { CategoryId = sub.Id, FieldName = "Condition", FieldType = FieldType.Select, IsRequired = true, Options = conditionOptions });
            db.CategoryFields.Add(new CategoryField { CategoryId = sub.Id, FieldName = "Transmission", FieldType = FieldType.Select, IsRequired = true, Options = transmissionOptions });
            db.CategoryFields.Add(new CategoryField { CategoryId = sub.Id, FieldName = "Fuel Type", FieldType = FieldType.Select, IsRequired = true, Options = fuelOptions });
            db.CategoryFields.Add(new CategoryField { CategoryId = sub.Id, FieldName = "Exterior Color", FieldType = FieldType.Text, IsRequired = true });
        }
        db.SaveChanges();

        // ── End user for sample listings ──
        var seller = new User
        {
            Username = "seller1",
            Email = "seller1@example.com",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("password"),
            Role = UserRole.EndUser,
            IsActive = true,
            WalletBalance = 500_000m
        };
        db.Users.Add(seller);
        db.SaveChanges();

        var bidder = new User
        {
            Username = "bidder1",
            Email = "bidder1@example.com",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("password"),
            Role = UserRole.EndUser,
            IsActive = true,
            WalletBalance = 500_000m
        };
        db.Users.Add(bidder);
        db.SaveChanges();

        // ── Fetch category fields for Sedans (ids assigned after SaveChanges) ──
        var sedanFields = db.CategoryFields.Where(f => f.CategoryId == sedans.Id).OrderBy(f => f.Id).ToList();
        var makeField = sedanFields.First(f => f.FieldName == "Make");
        var modelField = sedanFields.First(f => f.FieldName == "Model");
        var yearField = sedanFields.First(f => f.FieldName == "Year");
        var mileageField = sedanFields.First(f => f.FieldName == "Mileage");
        var conditionField = sedanFields.First(f => f.FieldName == "Condition");
        var transmissionField = sedanFields.First(f => f.FieldName == "Transmission");
        var fuelField = sedanFields.First(f => f.FieldName == "Fuel Type");
        var colorField = sedanFields.First(f => f.FieldName == "Exterior Color");

        // ── Sample car listing 1: Toyota Camry (active, with bids) ──
        var close1 = DateTime.UtcNow.AddDays(7);
        var item1 = new Item
        {
            SellerId = seller.Id,
            CategoryId = sedans.Id,
            Title = "2022 Toyota Camry SE",
            Description = "Well maintained sedan, single owner.",
            InitialPrice = 22000.00m,
            BidIncrement = 500.00m,
            ReservePrice = 25000.00m,
            CurrentPrice = 23000.00m,
            CloseDateTime = close1,
            Status = ItemStatus.Active
        };
        db.Items.Add(item1);
        db.SaveChanges();

        db.ItemFieldValues.AddRange(
            new ItemFieldValue { ItemId = item1.Id, FieldId = makeField.Id, Value = "Toyota" },
            new ItemFieldValue { ItemId = item1.Id, FieldId = modelField.Id, Value = "Camry" },
            new ItemFieldValue { ItemId = item1.Id, FieldId = yearField.Id, Value = "2022" },
            new ItemFieldValue { ItemId = item1.Id, FieldId = mileageField.Id, Value = "25000" },
            new ItemFieldValue { ItemId = item1.Id, FieldId = conditionField.Id, Value = "Excellent" },
            new ItemFieldValue { ItemId = item1.Id, FieldId = transmissionField.Id, Value = "Automatic" },
            new ItemFieldValue { ItemId = item1.Id, FieldId = fuelField.Id, Value = "Gasoline" },
            new ItemFieldValue { ItemId = item1.Id, FieldId = colorField.Id, Value = "Silver" }
        );
        var bidder2 = new User
        {
            Username = "bidder2",
            Email = "bidder2@example.com",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("password"),
            Role = UserRole.EndUser,
            IsActive = true,
            WalletBalance = 500_000m
        };
        db.Users.Add(bidder2);
        db.SaveChanges();

        db.Bids.Add(new Bid { ItemId = item1.Id, BidderId = bidder.Id, Amount = 22500.00m, IsAuto = false });
        db.Bids.Add(new Bid { ItemId = item1.Id, BidderId = bidder2.Id, Amount = 23000.00m, IsAuto = false });
        db.SaveChanges();

        db.BidHolds.Add(new BidHold { ItemId = item1.Id, UserId = bidder2.Id, Amount = 23000.00m });

        // ── Sample car listing 2: Honda Civic ──
        var item2 = new Item
        {
            SellerId = seller.Id,
            CategoryId = sedans.Id,
            Title = "2020 Honda Civic LX",
            Description = "Reliable daily driver.",
            InitialPrice = 18000.00m,
            BidIncrement = 250.00m,
            ReservePrice = 20000.00m,
            CurrentPrice = 18500.00m,
            CloseDateTime = DateTime.UtcNow.AddDays(3),
            Status = ItemStatus.Active
        };
        db.Items.Add(item2);
        db.SaveChanges();

        db.ItemFieldValues.AddRange(
            new ItemFieldValue { ItemId = item2.Id, FieldId = makeField.Id, Value = "Honda" },
            new ItemFieldValue { ItemId = item2.Id, FieldId = modelField.Id, Value = "Civic" },
            new ItemFieldValue { ItemId = item2.Id, FieldId = yearField.Id, Value = "2020" },
            new ItemFieldValue { ItemId = item2.Id, FieldId = mileageField.Id, Value = "42000" },
            new ItemFieldValue { ItemId = item2.Id, FieldId = conditionField.Id, Value = "Good" },
            new ItemFieldValue { ItemId = item2.Id, FieldId = transmissionField.Id, Value = "CVT" },
            new ItemFieldValue { ItemId = item2.Id, FieldId = fuelField.Id, Value = "Gasoline" },
            new ItemFieldValue { ItemId = item2.Id, FieldId = colorField.Id, Value = "Black" }
        );
        db.Bids.Add(new Bid { ItemId = item2.Id, BidderId = bidder.Id, Amount = 18500.00m, IsAuto = false });
        db.SaveChanges();

        db.BidHolds.Add(new BidHold { ItemId = item2.Id, UserId = bidder.Id, Amount = 18500.00m });
        db.SaveChanges();
    }

    /// <summary>
    /// Adds sold (and some closed) items so admin reports have data. Safe to call every startup; skips if enough sold items exist.
    /// </summary>
    public static void SeedSoldItemsForReports(AppDbContext db)
    {
        if (db.Items.Count(i => i.Status == ItemStatus.Sold) >= 20)
            return;

        var endUsers = db.Users.Where(u => u.Role == UserRole.EndUser).OrderBy(u => u.Id).ToList();
        if (endUsers.Count < 2)
            return;

        var sedans = db.Categories.FirstOrDefault(c => c.Name == "Sedans");
        if (sedans == null)
            return;

        var sedanFields = db.CategoryFields.Where(f => f.CategoryId == sedans.Id).OrderBy(f => f.Id).ToList();
        if (sedanFields.Count < 8)
            return;

        var makeF = sedanFields.First(f => f.FieldName == "Make");
        var modelF = sedanFields.First(f => f.FieldName == "Model");
        var yearF = sedanFields.First(f => f.FieldName == "Year");
        var mileageF = sedanFields.First(f => f.FieldName == "Mileage");
        var conditionF = sedanFields.First(f => f.FieldName == "Condition");
        var transmissionF = sedanFields.First(f => f.FieldName == "Transmission");
        var fuelF = sedanFields.First(f => f.FieldName == "Fuel Type");
        var colorF = sedanFields.First(f => f.FieldName == "Exterior Color");

        var makes = new[] { "Toyota", "Honda", "Ford", "Chevrolet", "BMW", "Nissan", "Hyundai", "Mazda" };
        var models = new[] { "Camry", "Civic", "F-150", "Silverado", "3 Series", "Altima", "Elantra", "Mazda3" };
        var conditions = new[] { "Excellent", "Good", "Like New" };
        var transmissions = new[] { "Automatic", "Manual", "CVT" };
        var fuels = new[] { "Gasoline", "Electric", "Hybrid" };
        var colors = new[] { "Black", "White", "Silver", "Blue" };

        for (var i = 0; i < 25; i++)
        {
            var seller = endUsers[i % endUsers.Count];
            var winner = endUsers[(i + 1) % endUsers.Count];
            if (winner.Id == seller.Id)
                winner = endUsers[(i + 2) % endUsers.Count];

            var year = 2018 + (i % 7);
            var price = 15000m + (i * 1200m);
            var bidCount = 2 + (i % 3);
            var closeDate = DateTime.UtcNow.AddDays(-(30 + i * 2));

            var item = new Item
            {
                SellerId = seller.Id,
                CategoryId = sedans.Id,
                Title = $"{year} {makes[i % makes.Length]} {models[i % models.Length]}",
                Description = "Sold listing (seed data for reports).",
                InitialPrice = price - 2000m,
                BidIncrement = 500m,
                ReservePrice = price - 500m,
                CurrentPrice = price,
                CloseDateTime = closeDate,
                Status = ItemStatus.Sold,
                WinnerId = winner.Id,
                CreatedAt = closeDate.AddDays(-7),
            };
            db.Items.Add(item);
            db.SaveChanges();

            db.ItemFieldValues.AddRange(
                new ItemFieldValue { ItemId = item.Id, FieldId = makeF.Id, Value = makes[i % makes.Length] },
                new ItemFieldValue { ItemId = item.Id, FieldId = modelF.Id, Value = models[i % models.Length] },
                new ItemFieldValue { ItemId = item.Id, FieldId = yearF.Id, Value = year.ToString() },
                new ItemFieldValue { ItemId = item.Id, FieldId = mileageF.Id, Value = (30000 + i * 2000).ToString() },
                new ItemFieldValue { ItemId = item.Id, FieldId = conditionF.Id, Value = conditions[i % conditions.Length] },
                new ItemFieldValue { ItemId = item.Id, FieldId = transmissionF.Id, Value = transmissions[i % transmissions.Length] },
                new ItemFieldValue { ItemId = item.Id, FieldId = fuelF.Id, Value = fuels[i % fuels.Length] },
                new ItemFieldValue { ItemId = item.Id, FieldId = colorF.Id, Value = colors[i % colors.Length] }
            );

            var bidAmount = item.InitialPrice;
            for (var b = 0; b < bidCount; b++)
            {
                bidAmount += item.BidIncrement;
                var bidder = b == bidCount - 1 ? winner : endUsers[(i + b + 2) % endUsers.Count];
                if (bidder.Id == item.SellerId)
                    bidder = endUsers[(i + b + 3) % endUsers.Count];
                db.Bids.Add(new Bid { ItemId = item.Id, BidderId = bidder.Id, Amount = bidAmount, IsAuto = false, CreatedAt = closeDate.AddMinutes(-b * 10) });
            }
            db.SaveChanges();
        }

        // A few closed (reserve not met) for variety
        for (var i = 0; i < 5; i++)
        {
            var seller = endUsers[i % endUsers.Count];
            var year = 2019 + i;
            var price = 18000m + (i * 1000m);
            var closeDate = DateTime.UtcNow.AddDays(-(10 + i));

            var item = new Item
            {
                SellerId = seller.Id,
                CategoryId = sedans.Id,
                Title = $"{year} Sedan (closed, reserve not met)",
                Description = "Closed listing seed data.",
                InitialPrice = price,
                BidIncrement = 250m,
                ReservePrice = price + 3000m,
                CurrentPrice = price + 500m,
                CloseDateTime = closeDate,
                Status = ItemStatus.Closed,
                WinnerId = null,
                CreatedAt = closeDate.AddDays(-5),
            };
            db.Items.Add(item);
            db.SaveChanges();

            db.ItemFieldValues.AddRange(
                new ItemFieldValue { ItemId = item.Id, FieldId = makeF.Id, Value = "Honda" },
                new ItemFieldValue { ItemId = item.Id, FieldId = modelF.Id, Value = "Civic" },
                new ItemFieldValue { ItemId = item.Id, FieldId = yearF.Id, Value = year.ToString() },
                new ItemFieldValue { ItemId = item.Id, FieldId = mileageF.Id, Value = "50000" },
                new ItemFieldValue { ItemId = item.Id, FieldId = conditionF.Id, Value = "Good" },
                new ItemFieldValue { ItemId = item.Id, FieldId = transmissionF.Id, Value = "Automatic" },
                new ItemFieldValue { ItemId = item.Id, FieldId = fuelF.Id, Value = "Gasoline" },
                new ItemFieldValue { ItemId = item.Id, FieldId = colorF.Id, Value = "Gray" }
            );
            db.Bids.Add(new Bid { ItemId = item.Id, BidderId = endUsers[(i + 1) % endUsers.Count].Id, Amount = item.CurrentPrice, IsAuto = false, CreatedAt = closeDate.AddMinutes(-5) });
            db.SaveChanges();
        }
    }
}
