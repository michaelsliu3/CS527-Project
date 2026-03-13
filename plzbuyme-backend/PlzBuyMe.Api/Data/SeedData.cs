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
            IsActive = true
        };
        db.Users.Add(admin);
        db.SaveChanges();

        // ── Category hierarchy: Cars → Sedans, SUVs, Trucks, Sports Cars, Electric ──
        var cars = new Category { Name = "Cars", ParentId = null };
        db.Categories.Add(cars);
        db.SaveChanges();

        var sedans = new Category { Name = "Sedans", ParentId = cars.Id };
        var suvs = new Category { Name = "SUVs", ParentId = cars.Id };
        var trucks = new Category { Name = "Trucks", ParentId = cars.Id };
        var sportsCars = new Category { Name = "Sports Cars", ParentId = cars.Id };
        var electric = new Category { Name = "Electric", ParentId = cars.Id };
        db.Categories.AddRange(sedans, suvs, trucks, sportsCars, electric);
        db.SaveChanges();

        // Third level under Sedans so hierarchy has 3+ levels (Cars → Sedans → Compact/Full-Size)
        var compactSedans = new Category { Name = "Compact Sedans", ParentId = sedans.Id };
        var fullSizeSedans = new Category { Name = "Full-Size Sedans", ParentId = sedans.Id };
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
            IsActive = true
        };
        db.Users.Add(seller);
        db.SaveChanges();

        var bidder = new User
        {
            Username = "bidder1",
            Email = "bidder1@example.com",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("password"),
            Role = UserRole.EndUser,
            IsActive = true
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
        db.Bids.Add(new Bid { ItemId = item1.Id, BidderId = bidder.Id, Amount = 22500.00m, IsAuto = false });
        db.Bids.Add(new Bid { ItemId = item1.Id, BidderId = admin.Id, Amount = 23000.00m, IsAuto = false });
        db.SaveChanges();

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
    }
}
