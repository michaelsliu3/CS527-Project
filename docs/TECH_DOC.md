# plzbuy.me — Online Auction System Technical Document

## CS 527 Database Systems — Programming Project

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Technology Stack](#2-technology-stack)
3. [System Architecture](#3-system-architecture)
4. [Database Design](#4-database-design)
5. [User Roles & Permissions](#5-user-roles--permissions)
6. [Feature Specification](#6-feature-specification)
7. [API Routes](#7-api-routes)
8. [Auction Engine Logic](#8-auction-engine-logic)
9. [Alert System](#9-alert-system)
10. [Search & Browsing](#10-search--browsing)
11. [Admin & Reports](#11-admin--reports)
12. [Project Structure](#12-project-structure)
13. [Setup & Deployment](#13-setup--deployment)
14. [Testing Strategy](#14-testing-strategy)
15. [Team & Contributions](#15-team--contributions)

---

## 1. Project Overview

**plzbuy.me** is a web-based online auction platform where users can buy and sell items through timed auctions. The frontend design and marketplace UX are inspired by [CSFloat](https://csfloat.com) — a clean, modern marketplace layout with advanced search/filter panels, detailed item cards, and streamlined bidding flows. The system is scoped to a **single item category** with at least three hierarchical subcategories. It supports three user roles — end-users, customer representatives, and an administrator — each with distinct capabilities.

### Category Choice

> **Chosen Category:** Vehicles (Cars)
>
> Category hierarchy:
> - **Cars** *(root)*
>   - **Sedans** → Toyota Camry, Honda Civic, BMW 3 Series, etc.
>   - **SUVs** → Toyota RAV4, Honda CR-V, Jeep Wrangler, etc.
>   - **Trucks** → Ford F-150, Ram 1500, Toyota Tacoma, etc.
>   - **Sports Cars** → Ford Mustang, Chevrolet Corvette, Porsche 911, etc.
>   - **Electric** → Tesla Model 3, Rivian R1T, Chevrolet Bolt, etc.

Each subcategory shares the following category-specific fields:

| Field | Type | Description |
|-------|------|-------------|
| Make | text | Manufacturer (e.g., Toyota, Ford, BMW) |
| Model | text | Model name (e.g., Camry, F-150, Model 3) |
| Year | number | Model year (e.g., 2024) |
| Mileage | number | Odometer reading in miles |
| Condition | select | New, Like New, Excellent, Good, Fair, Poor |
| Transmission | select | Automatic, Manual, CVT |
| Fuel Type | select | Gasoline, Diesel, Electric, Hybrid, Plug-in Hybrid |
| Exterior Color | text | Body color |

### Design Inspiration

The frontend takes visual and UX cues from CSFloat's marketplace:
- **Item cards** with key details at a glance (price, status, countdown, category badge)
- **Advanced search panel** with category filters, price range, and category-specific field filters
- **Clean auction detail page** with bid history, item attributes, and similar items
- **Quick-Bid and Auto-Bid** UX patterns for streamlined bidding

### Bonus Goal

Make item categories and their required fields **data-driven** — stored in the database rather than hard-coded — so new categories/fields can be added without recompiling.

---

## 2. Technology Stack

| Layer            | Technology                        | Notes                                          |
|------------------|-----------------------------------|------------------------------------------------|
| Frontend         | React 18 + Chakra UI              | SPA with Vite, React Router, Axios             |
| Backend          | C# / ASP.NET Core MVC (Web API)  | REST API controllers                           |
| ORM              | Entity Framework Core             | Code-first migrations, models → MySQL tables   |
| Database         | MySQL 8.x                         | Local instance via Pomelo EF Core provider     |
| Auth             | ASP.NET Identity + JWT            | Token-based auth (Bearer tokens)               |
| Background Jobs  | ASP.NET Core `BackgroundService`   | Built-in hosted service for auction closing    |
| Backend Testing  | xUnit + Moq + EF InMemory         | Unit tests per service/controller              |
| Frontend Testing | Vitest + React Testing Library     | Component and integration tests                |
| E2E Testing      | Browser agents (Cursor)            | Automated browser-based feature validation     |
| CI               | GitHub Actions                     | Runs all tests on every push/PR                |
| Version Control  | Git + GitHub                       | Private repo                                   |

### Backend NuGet Packages

```
Microsoft.AspNetCore.Identity.EntityFrameworkCore
Microsoft.AspNetCore.Authentication.JwtBearer
Pomelo.EntityFrameworkCore.MySql
Swashbuckle.AspNetCore          # Swagger UI for API docs
BCrypt.Net-Next
```

### Backend Test NuGet Packages *(PlzBuyMe.Tests project)*

```
xunit
xunit.runner.visualstudio
Microsoft.NET.Test.Sdk
Moq
Microsoft.EntityFrameworkCore.InMemory
Microsoft.AspNetCore.Mvc.Testing
FluentAssertions
```

### Frontend npm Packages

```
react
react-dom
react-router-dom
@chakra-ui/react
@emotion/react
@emotion/styled
framer-motion
axios
react-hook-form
react-icons
jwt-decode
```

### Frontend Test npm Packages *(devDependencies)*

```
vitest
@testing-library/react
@testing-library/jest-dom
@testing-library/user-event
jsdom
msw                              # Mock Service Worker for API mocking
```

### Repository Layout

This is a **monorepo** — both frontend and backend live in the same `CS527-Project/` repository under two sibling folders:

```
CS527-Project/
├── plzbuyme-backend/    # ASP.NET Core Web API (C#)
├── plzbuyme-frontend/   # React SPA (TypeScript)
├── docs/
├── TECH_DOC.md
├── TICKETS.md
└── README.md
```

---

## 3. System Architecture

```
┌──────────────────────────────────────────────────┐
│               Browser (Client)                   │
│     React 18 SPA  +  Chakra UI  +  React Router │
│              (Vite dev server :5173)             │
└──────────────────┬───────────────────────────────┘
                   │  REST / JSON  (Axios)
                   │  Authorization: Bearer <JWT>
┌──────────────────▼───────────────────────────────┐
│         ASP.NET Core Web API  (:5081)            │
│                                                  │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐ │
│  │ Controllers│  │  ASP.NET   │  │ Background │ │
│  │  (per      │  │  Identity  │  │  Service   │ │
│  │  domain)   │  │  + JWT     │  │ (Auction   │ │
│  │            │  │            │  │  closing)  │ │
│  └─────┬──────┘  └────────────┘  └────────────┘ │
│        │                                         │
│  ┌─────▼──────────────────────────────────────┐  │
│  │      Entity Framework Core (Pomelo)        │  │
│  └─────┬──────────────────────────────────────┘  │
└────────┼─────────────────────────────────────────┘
         │  SQL
┌────────▼─────────────────────────────────────────┐
│                MySQL Database                     │
└──────────────────────────────────────────────────┘
```

### Controller Organization

| Controller              | Route Prefix        | Responsibility                          |
|-------------------------|---------------------|-----------------------------------------|
| `AuthController`        | `api/auth`          | Register, login, logout, profile        |
| `AuctionsController`    | `api/auctions`      | Create, bid, browse, search, history    |
| `AlertsController`      | `api/alerts`        | Manage item alerts                      |
| `NotificationsController`| `api/notifications`| List and mark-read notifications        |
| `QuestionsController`   | `api/questions`     | Customer Q&A                            |
| `AdminController`       | `api/admin`         | Admin dashboard and reports             |
| `RepController`         | `api/rep`           | Customer rep functions                  |

### Frontend Page Structure (React Router)

| Route                    | Component              | Access     |
|--------------------------|------------------------|------------|
| `/`                      | `HomePage`             | Public     |
| `/login`                 | `LoginPage`            | Public     |
| `/register`              | `RegisterPage`         | Public     |
| `/auctions`              | `AuctionListPage`      | Public     |
| `/auctions/:id`          | `AuctionDetailPage`    | Public     |
| `/auctions/create`       | `CreateAuctionPage`    | End-user   |
| `/my-auctions`           | `MyAuctionsPage`       | End-user   |
| `/alerts`                | `AlertsPage`           | End-user   |
| `/notifications`         | `NotificationsPage`    | Logged in  |
| `/questions`             | `QuestionsPage`        | Logged in  |
| `/questions/:questionId` | `QuestionsPage`        | Logged in  |
| `/profile`               | `ProfilePage`          | Logged in  |
| `/rep/*`                 | `RepDashboard`         | Rep        |
| `/admin/*`               | `AdminDashboard`       | Admin      |

---

## 4. Database Design

### 4.1 ER Diagram Summary

> An ER diagram should be created using a tool like draw.io or dbdiagram.io and committed as `docs/er_diagram.png`.

### 4.2 Table Definitions

#### `users`

| Column          | Type              | Constraints                       |
|-----------------|-------------------|-----------------------------------|
| `id`            | INT               | PK, AUTO_INCREMENT                |
| `username`      | VARCHAR(64)       | UNIQUE, NOT NULL                  |
| `email`         | VARCHAR(128)      | UNIQUE, NOT NULL                  |
| `password_hash` | VARCHAR(256)      | NOT NULL                          |
| `role`          | ENUM('end_user', 'customer_rep', 'admin') | NOT NULL, DEFAULT 'end_user' |
| `is_active`     | BOOLEAN           | DEFAULT TRUE                      |
| `created_at`    | DATETIME          | DEFAULT CURRENT_TIMESTAMP         |

#### `categories`

| Column          | Type              | Constraints                       |
|-----------------|-------------------|-----------------------------------|
| `id`            | INT               | PK, AUTO_INCREMENT                |
| `name`          | VARCHAR(64)       | NOT NULL                          |
| `parent_id`     | INT               | FK → categories.id, NULLABLE      |

Self-referencing foreign key enables the hierarchical subcategory tree.

#### `category_fields` *(bonus: data-driven schema)*

| Column          | Type              | Constraints                       |
|-----------------|-------------------|-----------------------------------|
| `id`            | INT               | PK, AUTO_INCREMENT                |
| `category_id`   | INT               | FK → categories.id, NOT NULL      |
| `field_name`    | VARCHAR(64)       | NOT NULL                          |
| `field_type`    | ENUM('text', 'number', 'select') | NOT NULL          |
| `is_required`   | BOOLEAN           | DEFAULT TRUE                      |
| `options`       | JSON              | NULLABLE (for select-type fields) |

#### `items`

| Column           | Type              | Constraints                       |
|------------------|-------------------|-----------------------------------|
| `id`             | INT               | PK, AUTO_INCREMENT                |
| `seller_id`      | INT               | FK → users.id, NOT NULL           |
| `category_id`    | INT               | FK → categories.id, NOT NULL      |
| `title`          | VARCHAR(256)      | NOT NULL                          |
| `description`    | TEXT              | NULLABLE                          |
| `image_url`      | VARCHAR(2048)     | NULLABLE (persisted primary image URL or media key) |
| `image_storage_key` | VARCHAR(1024)  | NULLABLE (storage key / GT7 external id) |
| `image_source`   | VARCHAR(64)       | NULLABLE (`uploaded` / `gt7-default` / `placeholder`) |
| `image_match_level` | VARCHAR(64)    | NULLABLE (`exact` / `partial` / `make-only` / `none`) |
| `initial_price`  | DECIMAL(12,2)     | NOT NULL                          |
| `bid_increment`  | DECIMAL(12,2)     | NOT NULL                          |
| `reserve_price`  | DECIMAL(12,2)     | NOT NULL (secret, never shown)    |
| `current_price`  | DECIMAL(12,2)     | DEFAULT = initial_price           |
| `close_datetime`  | DATETIME          | NOT NULL                          |
| `status`         | ENUM('active', 'closed', 'sold', 'removed') | DEFAULT 'active' |
| `winner_id`      | INT               | FK → users.id, NULLABLE           |
| `created_at`     | DATETIME          | DEFAULT CURRENT_TIMESTAMP         |

#### `item_field_values` *(bonus: stores dynamic category-specific attributes)*

| Column           | Type              | Constraints                       |
|------------------|-------------------|-----------------------------------|
| `id`             | INT               | PK, AUTO_INCREMENT                |
| `item_id`        | INT               | FK → items.id, NOT NULL           |
| `field_id`       | INT               | FK → category_fields.id, NOT NULL |
| `value`          | VARCHAR(256)      | NOT NULL                          |

**UNIQUE constraint** on (`item_id`, `field_id`).

#### `bids`

| Column           | Type              | Constraints                       |
|------------------|-------------------|-----------------------------------|
| `id`             | INT               | PK, AUTO_INCREMENT                |
| `item_id`        | INT               | FK → items.id, NOT NULL           |
| `bidder_id`      | INT               | FK → users.id, NOT NULL           |
| `amount`         | DECIMAL(12,2)     | NOT NULL                          |
| `is_auto`        | BOOLEAN           | DEFAULT FALSE                     |
| `created_at`     | DATETIME          | DEFAULT CURRENT_TIMESTAMP         |

#### `auto_bids`

| Column           | Type              | Constraints                       |
|------------------|-------------------|-----------------------------------|
| `id`             | INT               | PK, AUTO_INCREMENT                |
| `item_id`        | INT               | FK → items.id, NOT NULL           |
| `bidder_id`      | INT               | FK → users.id, NOT NULL           |
| `upper_limit`    | DECIMAL(12,2)     | NOT NULL (secret)                 |
| `is_active`      | BOOLEAN           | DEFAULT TRUE                      |
| `created_at`     | DATETIME          | DEFAULT CURRENT_TIMESTAMP         |

**UNIQUE constraint** on (`item_id`, `bidder_id`) — one auto-bid config per user per item.

#### `alerts`

| Column           | Type              | Constraints                       |
|------------------|-------------------|-----------------------------------|
| `id`             | INT               | PK, AUTO_INCREMENT                |
| `user_id`        | INT               | FK → users.id, NOT NULL           |
| `category_id`    | INT               | FK → categories.id, NULLABLE      |
| `keyword`        | VARCHAR(128)      | NULLABLE                          |
| `criteria`       | JSON              | NULLABLE (field-value filters)    |
| `is_active`      | BOOLEAN           | DEFAULT TRUE                      |
| `created_at`     | DATETIME          | DEFAULT CURRENT_TIMESTAMP         |

#### `notifications`

| Column           | Type              | Constraints                       |
|------------------|-------------------|-----------------------------------|
| `id`             | INT               | PK, AUTO_INCREMENT                |
| `user_id`        | INT               | FK → users.id, NOT NULL           |
| `item_id`        | INT               | FK → items.id, NULLABLE           |
| `message`        | TEXT              | NOT NULL                          |
| `type`           | ENUM('outbid', 'auto_limit_reached', 'auto_bid_placed', 'auction_won', 'alert_match', 'reserve_not_met') | NOT NULL |
| `is_read`        | BOOLEAN           | DEFAULT FALSE                     |
| `created_at`     | DATETIME          | DEFAULT CURRENT_TIMESTAMP         |

#### `questions`

| Column           | Type              | Constraints                       |
|------------------|-------------------|-----------------------------------|
| `id`             | INT               | PK, AUTO_INCREMENT                |
| `user_id`        | INT               | FK → users.id, NOT NULL           |
| `subject`        | VARCHAR(256)      | NOT NULL                          |
| `body`           | TEXT              | NOT NULL                          |
| `created_at`     | DATETIME          | DEFAULT CURRENT_TIMESTAMP         |

#### `question_replies`

| Column                 | Type              | Constraints                                                     |
|------------------------|-------------------|-----------------------------------------------------------------|
| `id`                   | INT               | PK, AUTO_INCREMENT                                              |
| `question_id`          | INT               | FK → questions.id, NOT NULL, ON DELETE CASCADE                 |
| `replied_by_user_id`   | INT               | FK → users.id, NULLABLE, ON DELETE SET NULL                    |
| `body`                 | TEXT              | NOT NULL                                                        |
| `replier_display_name` | VARCHAR(128)      | NOT NULL                                                        |
| `replier_role`         | VARCHAR(32)       | NULLABLE (`customer_rep`, `admin`, `end_user`)                 |
| `created_at`           | DATETIME          | DEFAULT CURRENT_TIMESTAMP                                       |

### 4.3 Key Indexes

```sql
CREATE INDEX idx_items_status_close ON items(status, close_datetime);
CREATE INDEX idx_items_category      ON items(category_id);
CREATE INDEX idx_items_seller        ON items(seller_id);
CREATE INDEX idx_bids_item           ON bids(item_id, created_at);
CREATE INDEX idx_bids_bidder         ON bids(bidder_id);
CREATE INDEX idx_notifications_user  ON notifications(user_id, is_read);
CREATE INDEX idx_alerts_user         ON alerts(user_id, is_active);
CREATE FULLTEXT INDEX idx_items_ft   ON items(title, description);
```

---

## 5. User Roles & Permissions

### Role Matrix

| Action                          | End-User | Customer Rep | Admin |
|---------------------------------|:--------:|:------------:|:-----:|
| Register / Login / Logout       | Yes      | Yes          | Yes   |
| Create auction                  | Yes      | —            | —     |
| Place bid                       | Yes      | —            | —     |
| Set alerts                      | Yes      | —            | —     |
| Search & browse                 | Yes      | Yes          | Yes   |
| View bid history                | Yes      | Yes          | Yes   |
| Post questions                  | Yes      | —            | —     |
| Reply to questions              | —        | Yes          | —     |
| Edit/delete user accounts       | —        | Yes          | —     |
| Remove bids                     | —        | Yes          | —     |
| Remove auctions                 | —        | Yes          | —     |
| Reset passwords                 | —        | Yes          | —     |
| Create customer rep accounts    | —        | —            | Yes   |
| Generate sales reports          | —        | —            | Yes   |

### Access Control Implementation

**Backend — Custom `[Authorize]` policy + role check:**

JWT tokens carry a `role` claim. ASP.NET Core policies enforce access:

```csharp
// Program.cs — register policies
builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("AdminOnly", p => p.RequireRole("admin"));
    options.AddPolicy("RepOnly",   p => p.RequireRole("customer_rep", "admin"));
    options.AddPolicy("EndUser",   p => p.RequireRole("end_user"));
});

// Usage on a controller action
[Authorize(Policy = "AdminOnly")]
[HttpPost("create-rep")]
public async Task<IActionResult> CreateRep(CreateRepDto dto) { ... }
```

**Frontend — Route guards (React Router):**

```tsx
function ProtectedRoute({ roles, children }: { roles: string[]; children: ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" />;
  if (!roles.includes(user.role)) return <Navigate to="/" />;
  return <>{children}</>;
}
```

---

## 6. Feature Specification

### 6.1 Accounts & Authentication

| Feature            | Details                                                        |
|--------------------|----------------------------------------------------------------|
| Registration       | Username, email, password (hashed with BCrypt.Net)             |
| Login              | Accepts **username or email** plus password; returns JWT access token (stored in localStorage on client) |
| Logout             | Client discards token from localStorage and redirects to `/`   |
| Delete account     | Soft-delete (`is_active = FALSE`); preserves auction data      |
| Password reset     | Customer rep can reset on behalf of a user                     |

### 6.2 Auctions (Seller)

- **Create auction:** title, description, category (with subcategory-specific fields), initial price, bid increment, reserve price, closing date/time.
  - The Create Auction page fetches the **category tree** from `GET /api/categories` to render cascading **category → subcategory** dropdowns.
  - When a subcategory is selected, the UI calls `GET /api/categories/{id}/fields` to fetch the dynamic `category_fields` for that subcategory and renders the appropriate inputs (text / number / select) before submitting `CreateAuctionDto` (including `fieldValues: { fieldId, value }[]`).
  - Optional image upload uses the media service; when no uploaded image is provided, backend resolves a GT7 default once on create, persists the resolved URL/key + match metadata, and reuses persisted values on subsequent reads.
- **View own auctions:** filter by status (active / closed / sold).

### 6.3 Bidding (Buyer)

- **Manual bid:** must be ≥ `current_price + bid_increment`.
- **Automatic bid:** buyer sets a secret upper limit. The system auto-bids the minimum necessary amount each time another bid is placed, until the upper limit is exceeded.
- **Outbid notification:** when a manual bidder is outbid.
- **Upper limit reached notification:** when an auto-bidder's limit is exceeded.

### 6.4 Auction Closing

An ASP.NET Core `BackgroundService` runs every **30 seconds** to process auctions whose `close_datetime` has passed:

1. Find all `active` items where `close_datetime ≤ NOW()`.
2. For each item:
   - If `current_price ≥ reserve_price` → status = `sold`, set `winner_id`, notify winner.
   - If `current_price < reserve_price` → status = `closed`, notify seller that reserve was not met.

### 6.5 Search & Browsing

- **Full-text search** on item title and description.
- **Filter** by category, subcategory, price range, status, closing date range.
- **Auction browse card UX** includes stronger card hierarchy with image-first presentation, highlight status chips (`Ending soon`, `Reserve met`, `No reserve`, `Newly listed`), and a real-time urgency-aware countdown bar/text.
- **Category type chip styling** is rendered as a compact gradient tag (including a rainbow variant for Sports Cars) positioned inline with price for quick visual scanning.
- **Category-specific field filters** — dynamic filters driven by `category_fields` (e.g., Year range, Mileage range, Condition, Transmission, Fuel Type for Cars). When a subcategory is selected, the UI fetches its `category_fields` and renders appropriate filter controls (text input, number range, or select dropdown). Filters are passed as a JSON object of `{ fieldId: value }` pairs.
- **Seller filter** — filter by seller username.
- **Sort** by price (asc/desc), closing date, newest listed, most bids.
- **Bid history** for a specific auction (all bids, timestamps, bidders).
- **User auction history** — all auctions a given user participated in as buyer or seller.
- **Similar items** — items in the same category listed in the preceding month, ranked by field overlap / keyword similarity.

### 6.6 Alerts

Users configure alerts with optional filters (category, keyword, field criteria). When a new item is posted that matches, a notification is created.

### 6.7 Q&A / Customer Service

- End-users post questions (subject + body).
- Customer reps browse and reply.
- All users can browse Q&A (searchable by keyword).
- Forums support question/reply voting and threaded replies with `Top`, `Newest`, and `Oldest` sorting.
- Frontend thread navigation supports list + detail modes (`/questions` and `/questions/:questionId`), resets scroll to top when opening a detail thread, and prevents nested interactive controls (vote/reply actions and reply textarea keyboard input) from accidentally triggering card navigation.

### 6.8 Admin Reports

| Report                      | Query Logic                                     |
|-----------------------------|--------------------------------------------------|
| Total earnings              | SUM of `current_price` for all `sold` items      |
| Earnings per item           | `current_price` grouped by item                  |
| Earnings per item type      | SUM grouped by `category_id`                     |
| Earnings per end-user       | SUM grouped by `seller_id` (or `winner_id`)      |
| Best-selling items          | Items with highest sale price or most bids        |
| Best buyers                 | Users with highest total spend                   |

---

## 7. API Endpoints (REST)

All endpoints return JSON. Protected routes require `Authorization: Bearer <token>` header.

### Auth — `api/auth`

| Method | Route                       | Description            | Access      |
|--------|-----------------------------|------------------------|-------------|
| POST   | `api/auth/register`         | Create account         | Public      |
| POST   | `api/auth/login`            | Authenticate → JWT. Request body: `username` (or email) + `password`; user may log in with either identifier. | Public      |
| GET    | `api/auth/profile`          | Get own profile        | Logged in   |
| POST   | `api/auth/profile/avatar`   | Upload/replace avatar (multipart form field: `avatar`) | Logged in |
| DELETE | `api/auth/profile/avatar`   | Remove own avatar      | Logged in   |
| DELETE | `api/auth/profile`          | Soft-delete account    | Logged in   |

- `POST api/auth/register` and `POST api/auth/login` responses include:
  - `token`, `userId`, `username`, `avatarUrl`, `displayNameColor`, `email`, `role`
- `GET api/auth/profile` response includes:
  - `id`, `username`, `avatarUrl`, `displayNameColor`, `email`, `role`
- `POST api/auth/profile/avatar` response:
  - `{ "avatarUrl": "avatars/..." }` (backend stores media key/filename; frontend resolves to CDN URL)
- `DELETE api/auth/profile/avatar` response:
  - `{ "avatarUrl": null }`

### Auctions — `api/auctions`

| Method | Route                                       | Description                   | Access    |
|--------|---------------------------------------------|-------------------------------|-----------|
| GET    | `api/auctions/browse`                       | Browse / search (see §10)     | Public    |
| POST   | `api/auctions/create`                       | Create new auction            | End-user  |
| GET    | `api/auctions/view/{id}`                    | Auction detail + bid history  | Public    |
| POST   | `api/auctions/{id}/bids/place`               | Place a manual bid            | End-user  |
| POST   | `api/auctions/{id}/autobids/set`            | Set automatic bid             | End-user  |
| GET    | `api/auctions/mine`                         | Current user's auctions       | End-user  |
| GET    | `api/auctions/view/{id}/similar`            | Similar items                 | Public    |
| GET    | `api/auctions/history/{userId}`             | Auctions user participated in | Logged in |
| GET    | `api/auctions/field-values`                | Distinct field values (autocomplete) | Public |

- `GET api/auctions/view/{id}` response includes seller identity fields:
  - `sellerId`, `sellerUsername`, `sellerAvatarUrl`, `sellerDisplayNameColor`
- `GET api/auctions/view/{id}` bid history items include bidder identity fields:
  - `bidderUsername`, `bidderAvatarUrl`, `bidderDisplayNameColor`
- Auction list/detail responses include persisted image metadata:
  - list: `imageUrl`, `imageSource`, `imageMatchLevel`
  - detail: `imageUrl`, `detailImageUrl`, `imageSource`, `imageMatchLevel`
- `POST api/auctions/create` accepts optional image fields:
  - `imageStorageKey` (preferred) and `imageUrl` (fallback key/value input)

### Categories — `api/categories`

| Method | Route                               | Description                                              | Access |
|--------|--------------------------------------|----------------------------------------------------------|--------|
| GET    | `api/categories`                    | List category hierarchy (root categories with children)  | Public |
| GET    | `api/categories/{id}/fields`        | List dynamic fields for the given category/subcategory   | Public |

### Alerts — `api/alerts`

| Method | Route                | Description              | Access    |
|--------|----------------------|--------------------------|-----------|
| GET    | `api/alerts`         | List user's alerts       | End-user  |
| POST   | `api/alerts`         | Create a new alert       | End-user  |
| DELETE | `api/alerts/{id}`    | Remove an alert          | End-user  |

### Notifications — `api/notifications`

| Method | Route                          | Description          | Access    |
|--------|--------------------------------|----------------------|-----------|
| GET    | `api/notifications`            | List notifications   | Logged in |
| PATCH  | `api/notifications/{id}/read`  | Mark as read         | Logged in |
| PATCH  | `api/notifications/read-all`   | Mark all as read     | Logged in |

**Frontend polling:** When the user is logged in, `Layout.tsx` polls `GET api/notifications` every **5 seconds** to update the bell badge count and to show a top-right toast for new unread notifications. The interval is defined as `NOTIFICATION_POLL_INTERVAL_MS` in `src/components/Layout.tsx`.

### Questions — `api/questions`

| Method | Route                          | Description          | Access    |
|--------|--------------------------------|----------------------|-----------|
| GET    | `api/questions`                | Browse Q&A           | Logged in |
| POST   | `api/questions`                | Post a question      | End-user  |
| POST   | `api/questions/{id}/reply`     | Reply to a question  | Rep       |

- `POST api/questions/{id}/reply` request body:
  - `{ "body": "..." }`
- `GET api/questions` and `POST` responses return each question with:
  - `id`, `userId`, `username`, `usernameAvatarUrl`, `subject`, `body`, `createdAt`
  - `replies[]` ordered oldest-to-newest, where each reply includes:
    - `id`, `body`, `replierDisplayName`, `replierAvatarUrl`, `replierRole`, `createdAt`

### Customer Rep — `api/rep`

| Method | Route                                | Description          | Access |
|--------|----------------------------------------|----------------------|--------|
| GET    | `api/rep/users`                       | List end-users       | Rep    |
| PUT    | `api/rep/users/{id}`                  | Edit user info       | Rep    |
| DELETE | `api/rep/users/{id}`                  | Remove user          | Rep    |
| POST   | `api/rep/users/{id}/reset-password`   | Reset password       | Rep    |
| DELETE | `api/rep/bids/{id}`                   | Remove a bid         | Rep    |
| DELETE | `api/rep/auctions/{id}`               | Remove an auction    | Rep    |

### Admin — `api/admin`

| Method | Route                              | Description                 | Access |
|--------|--------------------------------------|-----------------------------|--------|
| POST   | `api/admin/reps`                    | Create rep account          | Admin  |
| GET    | `api/admin/reports/earnings`        | Total & per-item earnings   | Admin  |
| GET    | `api/admin/reports/earnings-by-type`| Earnings by category        | Admin  |
| GET    | `api/admin/reports/earnings-by-user`| Earnings by end-user        | Admin  |
| GET    | `api/admin/reports/best-selling`    | Best-selling items          | Admin  |
| GET    | `api/admin/reports/best-buyers`     | Top buyers                  | Admin  |

---

## 8. Auction Engine Logic

All auction business logic lives in `Services/AuctionService.cs`.

### 8.1 Manual Bidding

```csharp
public async Task PlaceBid(int itemId, int bidderId, decimal amount)
{
    var item = await _db.Items.FindAsync(itemId);

    if (item.Status != ItemStatus.Active)
        throw new InvalidOperationException("Auction is not active");
    if (item.SellerId == bidderId)
        throw new InvalidOperationException("Sellers cannot bid on their own items");
    if (amount < item.CurrentPrice + item.BidIncrement)
        throw new InvalidOperationException("Bid too low");

    _db.Bids.Add(new Bid { ItemId = itemId, BidderId = bidderId, Amount = amount });
    item.CurrentPrice = amount;

    await NotifyOtherBidders(item, bidderId, NotificationType.Outbid);
    await TriggerAutoBids(item, excludeUserId: bidderId);
    await _db.SaveChangesAsync();
}
```

### 8.2 Automatic Bidding

```csharp
private async Task TriggerAutoBids(Item item, int excludeUserId)
{
    var autoBids = await _db.AutoBids
        .Where(ab => ab.ItemId == item.Id && ab.IsActive && ab.BidderId != excludeUserId)
        .OrderByDescending(ab => ab.UpperLimit)
        .ToListAsync();

    foreach (var ab in autoBids)
    {
        var needed = item.CurrentPrice + item.BidIncrement;
        if (needed <= ab.UpperLimit)
        {
            _db.Bids.Add(new Bid
            {
                ItemId = item.Id, BidderId = ab.BidderId,
                Amount = needed, IsAuto = true
            });
            item.CurrentPrice = needed;
            await NotifyOtherBidders(item, ab.BidderId, NotificationType.Outbid);
            await TriggerAutoBids(item, excludeUserId: ab.BidderId);
            return;
        }
        else
        {
            ab.IsActive = false;
            await CreateNotification(ab.BidderId, item.Id,
                NotificationType.AutoLimitReached,
                $"Your auto-bid limit was exceeded on \"{item.Title}\"");
        }
    }
}
```

### 8.3 Auction Close Job (BackgroundService)

```csharp
// Registered in Program.cs:
// builder.Services.AddHostedService<AuctionCloseService>();

public async Task CloseExpired()
{
    var expired = await _db.Items
        .Where(i => i.Status == ItemStatus.Active && i.CloseDateTime <= DateTime.UtcNow)
        .ToListAsync();

    foreach (var item in expired)
    {
        var highestBid = await _db.Bids
            .Where(b => b.ItemId == item.Id)
            .OrderByDescending(b => b.Amount)
            .FirstOrDefaultAsync();

        if (highestBid != null && highestBid.Amount >= item.ReservePrice)
        {
            item.Status = ItemStatus.Sold;
            item.WinnerId = highestBid.BidderId;
            await CreateNotification(highestBid.BidderId, item.Id,
                NotificationType.AuctionWon,
                $"You won the auction for \"{item.Title}\"!");
        }
        else
        {
            item.Status = ItemStatus.Closed;
        }
    }
    await _db.SaveChangesAsync();
}
```

---

## 9. Alert System

### Matching Logic

When a new item is listed, `AlertService.CheckAlertsForNewItem` runs:

```csharp
public async Task CheckAlertsForNewItem(Item item)
{
    var alerts = await _db.Alerts.Where(a => a.IsActive).ToListAsync();

    foreach (var alert in alerts)
    {
        if (alert.CategoryId.HasValue && alert.CategoryId != item.CategoryId)
            continue;

        var text = $"{item.Title} {item.Description}";
        if (!string.IsNullOrEmpty(alert.Keyword)
            && !text.Contains(alert.Keyword, StringComparison.OrdinalIgnoreCase))
            continue;

        if (alert.Criteria != null && !MatchesCriteria(item, alert.Criteria))
            continue;

        _db.Notifications.Add(new Notification
        {
            UserId  = alert.UserId,
            ItemId  = item.Id,
            Type    = NotificationType.AlertMatch,
            Message = $"New item matching your alert: \"{item.Title}\""
        });
    }
    await _db.SaveChangesAsync();
}
```

---

## 10. Search & Browsing

### Search Parameters

| Parameter        | Type     | Description                              |
|------------------|----------|------------------------------------------|
| `q`              | string   | Full-text keyword search (title + description) |
| `category_id`    | int      | Filter by category/subcategory           |
| `min_price`      | decimal  | Minimum current price                    |
| `max_price`      | decimal  | Maximum current price                    |
| `status`         | string   | active / closed / sold                   |
| `closing_before` | datetime | Auctions closing before this date        |
| `closing_after`  | datetime | Auctions closing after this date         |
| `seller`         | string   | Filter by seller username (partial match)|
| `field_filters`  | JSON     | Category-specific field filters (see below) |
| `sort`           | string   | price_asc, price_desc, closing_soon, newest, most_bids |
| `page`           | int      | Page number (default 1)                  |
| `pageSize`       | int      | Results per page (default 20, max 50)    |

### Category-Specific Field Filters

When a `category_id` is provided, the caller can also pass `field_filters` — a JSON object mapping `category_field` IDs to filter values. The backend joins through `item_field_values` to match:

| Field Type | Filter behavior | Example |
|------------|----------------|---------|
| `text`     | Case-insensitive partial match (LIKE `%value%`) | `{ "1": "Toyota" }` matches "Toyota Camry" |
| `number`   | Exact match, or range via `min`/`max` object | `{ "3": { "min": 2020, "max": 2025 } }` filters Year |
| `select`   | Exact match or array for multi-select | `{ "5": "Automatic" }` or `{ "5": ["Automatic", "CVT"] }` |

**Backend implementation:** For each entry in `field_filters`, add a subquery / join on `item_field_values` where `field_id = key` and `value` matches per the type rules above. All field filters are ANDed together.

### Full-Text Search Details

The `q` parameter performs a case-insensitive search across `items.title` and `items.description` using `LIKE '%keyword%'`. For better performance on large datasets, consider adding a MySQL `FULLTEXT` index on `(title, description)` and using `MATCH ... AGAINST` with natural language mode.

### Car-Specific Search Features

Since the platform's item category is **Vehicles (Cars)**, the search UI and backend provide purpose-built shortcuts that map to the underlying `field_filters` mechanism but are exposed as first-class query parameters for convenience and a richer UX.

#### Car Query Parameters

These are syntactic sugar — the backend translates each into the equivalent `field_filters` entry before executing the query.

| Parameter          | Type     | Maps to field    | Description                                      |
|--------------------|----------|------------------|--------------------------------------------------|
| `make`             | string   | Make (text)      | Partial match on manufacturer (e.g., "Toy" → Toyota) |
| `model`            | string   | Model (text)     | Partial match on model name                      |
| `year_min`         | int      | Year (number)    | Minimum model year                               |
| `year_max`         | int      | Year (number)    | Maximum model year                               |
| `mileage_max`      | int      | Mileage (number) | Maximum odometer reading                         |
| `condition`        | string[] | Condition (select)| One or more: New, Like New, Excellent, Good, Fair, Poor |
| `transmission`     | string[] | Transmission (select) | One or more: Automatic, Manual, CVT          |
| `fuel_type`        | string[] | Fuel Type (select) | One or more: Gasoline, Diesel, Electric, Hybrid, Plug-in Hybrid |
| `exterior_color`   | string   | Exterior Color (text) | Partial match on body color                |

#### Car Search UI

When any Cars subcategory is selected (or the root Cars category), the `SearchBar` component renders a dedicated car filter panel in addition to the generic filters:

- **Make / Model** — two linked text inputs with autocomplete (populated from existing `item_field_values` for those fields via `GET /api/auctions/field-values?fieldName=Make`)
- **Year range** — dual number inputs (e.g., 2018–2025) or a range slider
- **Mileage cap** — single number input or slider (e.g., "Under 50,000 mi")
- **Condition** — multi-select checkbox group with badge counts
- **Transmission** — multi-select chips (Automatic / Manual / CVT)
- **Fuel Type** — multi-select chips with icons (gas pump, bolt, leaf, etc.)
- **Exterior Color** — text input with color-swatch preview, or a preset palette picker

#### Field-Value Autocomplete Endpoint

To power autocomplete for Make, Model, and Exterior Color:

| Method | Route                              | Description                          | Access |
|--------|-------------------------------------|--------------------------------------|--------|
| GET    | `api/auctions/field-values`        | Distinct values for a given field    | Public |

**Query params:**

| Parameter    | Type   | Description                                      |
|--------------|--------|--------------------------------------------------|
| `fieldName`  | string | The `field_name` from `category_fields` (e.g., "Make") |
| `category_id`| int    | Scope to a specific subcategory (optional)       |
| `prefix`     | string | Partial match prefix for autocomplete (optional) |

**Response:** `string[]` of distinct values, ordered by frequency descending, limited to 50.

**Backend:** Query `item_field_values` joined with `category_fields` where `field_name` matches, optionally filtered by `category_id` and `value LIKE 'prefix%'`. Group by value, order by `COUNT(*) DESC`.

#### Car-Specific Sort Options

In addition to the generic sort modes, car searches support:

| Sort value       | Description                                  |
|------------------|----------------------------------------------|
| `year_newest`    | Newest model year first                      |
| `year_oldest`    | Oldest model year first                      |
| `mileage_low`    | Lowest mileage first                         |
| `mileage_high`   | Highest mileage first                        |

**Backend:** These require a join on `item_field_values` for the Year or Mileage field, casting `value` to an integer for ordering.

### Similar Items Algorithm

Two items are "similar" if they share the same subcategory and were listed within the preceding month. Rank by the number of matching category-specific field values. This leverages the `item_field_values` table for a flexible similarity comparison.

---

## 11. Admin & Reports

### Report Queries (pseudocode)

**Total Earnings:**
```sql
SELECT SUM(current_price) AS total FROM items WHERE status = 'sold';
```

**Earnings per Item Type:**
```sql
SELECT c.name, SUM(i.current_price) AS earnings
FROM items i JOIN categories c ON i.category_id = c.id
WHERE i.status = 'sold'
GROUP BY c.id ORDER BY earnings DESC;
```

**Best-Selling Items:**
```sql
SELECT i.title, i.current_price, COUNT(b.id) AS bid_count
FROM items i LEFT JOIN bids b ON i.id = b.item_id
WHERE i.status = 'sold'
GROUP BY i.id ORDER BY i.current_price DESC LIMIT 10;
```

**Best Buyers:**
```sql
SELECT u.username, SUM(i.current_price) AS total_spent, COUNT(i.id) AS wins
FROM items i JOIN users u ON i.winner_id = u.id
WHERE i.status = 'sold'
GROUP BY u.id ORDER BY total_spent DESC LIMIT 10;
```

---

## 12. Project Structure

```
CS527-Project/
│
├── plzbuyme-backend/                  # ASP.NET Core Web API
│   ├── PlzBuyMe.sln
│   └── PlzBuyMe.Api/
│       ├── Program.cs                # App entry, DI, middleware, BackgroundService
│       ├── appsettings.json          # Connection strings, JWT config
│       ├── PlzBuyMe.Api.csproj
│       │
│       ├── Models/                   # EF Core entity classes
│       │   ├── User.cs
│       │   ├── Item.cs
│       │   ├── Category.cs
│       │   ├── CategoryField.cs
│       │   ├── ItemFieldValue.cs
│       │   ├── Bid.cs
│       │   ├── AutoBid.cs
│       │   ├── Alert.cs
│       │   ├── Notification.cs
│       │   └── Question.cs
│       │
│       ├── Data/
│       │   ├── AppDbContext.cs        # DbContext with DbSets + Fluent API config
│       │   └── SeedData.cs            # Admin account + sample categories/items
│       │
│       ├── Dtos/                      # Request/response DTOs
│       │   ├── Auth/
│       │   ├── Auctions/
│       │   ├── Alerts/
│       │   ├── Admin/
│       │   └── Questions/
│       │
│       ├── Controllers/
│       │   ├── AuthController.cs
│       │   ├── AuctionsController.cs
│       │   ├── AlertsController.cs
│       │   ├── NotificationsController.cs
│       │   ├── QuestionsController.cs
│       │   ├── RepController.cs
│       │   └── AdminController.cs
│       │
│       ├── Services/
│       │   ├── AuctionService.cs      # Bidding logic, auto-bid, close job
│       │   ├── AlertService.cs        # Alert matching
│       │   ├── AuthService.cs         # JWT generation, password hashing
│       │   └── ReportService.cs       # Admin report queries
│       │
│       └── Migrations/                # EF Core auto-generated migrations
│
│   └── PlzBuyMe.Tests/               # xUnit test project
│       ├── PlzBuyMe.Tests.csproj
│       ├── Services/                  # Service unit tests
│       │   ├── AuthServiceTests.cs
│       │   ├── AuctionServiceTests.cs
│       │   ├── AlertServiceTests.cs
│       │   └── ReportServiceTests.cs
│       ├── Controllers/               # Controller integration tests
│       │   ├── AuthControllerTests.cs
│       │   ├── AuctionsControllerTests.cs
│       │   ├── AlertsControllerTests.cs
│       │   ├── RepControllerTests.cs
│       │   └── AdminControllerTests.cs
│       └── Helpers/
│           └── TestDbContextFactory.cs # InMemory DB setup for tests
│
├── plzbuyme-frontend/                 # React SPA
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── index.html
│   └── src/
│       ├── main.tsx                   # Entry, ChakraProvider, RouterProvider
│       ├── App.tsx                    # Route definitions
│       ├── api/
│       │   └── client.ts             # Axios instance with JWT interceptor
│       ├── context/
│       │   └── AuthContext.tsx        # Auth state, login/logout, token mgmt
│       ├── components/
│       │   ├── Layout.tsx             # Navbar + notification badge + outlet
│       │   ├── ProtectedRoute.tsx     # Role-based route guard
│       │   ├── AuctionCard.tsx
│       │   ├── BidHistory.tsx
│       │   ├── SearchBar.tsx
│       │   └── ...
│       ├── pages/
│       │   ├── HomePage.tsx
│       │   ├── LoginPage.tsx
│       │   ├── RegisterPage.tsx
│       │   ├── AuctionListPage.tsx
│       │   ├── AuctionDetailPage.tsx
│       │   ├── CreateAuctionPage.tsx
│       │   ├── MyAuctionsPage.tsx
│       │   ├── AlertsPage.tsx
│       │   ├── NotificationsPage.tsx
│       │   ├── QuestionsPage.tsx
│       │   ├── ProfilePage.tsx
│       │   ├── rep/
│       │   │   └── RepDashboard.tsx
│       │   └── admin/
│       │       ├── AdminDashboard.tsx
│       │       └── ReportsPage.tsx
│       ├── __tests__/                # Vitest test files
│       │   ├── components/
│       │   │   ├── AuctionCard.test.tsx
│       │   │   ├── SearchBar.test.tsx
│       │   │   └── ProtectedRoute.test.tsx
│       │   ├── pages/
│       │   │   ├── LoginPage.test.tsx
│       │   │   ├── AuctionListPage.test.tsx
│       │   │   └── ...
│       │   └── context/
│       │       └── AuthContext.test.tsx
│       └── theme/
│           └── index.ts              # Chakra UI custom theme overrides
│
├── .github/
│   └── workflows/
│       └── ci.yml                    # Runs backend + frontend tests on push/PR
├── docs/
│   └── er_diagram.png                # ER diagram
├── TECH_DOC.md                        # This document
└── README.md
```

---

## 13. Setup & Deployment

### Prerequisites

- **.NET 8 SDK** (or later)
- **Node.js 18+** and **npm**
- **MySQL 8.x** running locally

### Backend Setup

```bash
# 1. Clone the repo
git clone git@github.com:<org>/CS527-Project.git
cd CS527-Project/plzbuyme-backend

# 2. Update connection string in appsettings.json
#    "ConnectionStrings": {
#        "DefaultConnection": "Server=localhost;Database=plzbuyme;User=root;Password=yourpw;"
#    }

# 3. Create the MySQL database
mysql -u root -p -e "CREATE DATABASE plzbuyme;"

# 4. Apply EF Core migrations
dotnet ef database update --project PlzBuyMe.Api

# 5. Run the API (seeds admin account on first start)
dotnet run --project PlzBuyMe.Api
# → API starts at http://localhost:5081 (or https, see launchSettings.json)
# → Swagger UI at http://localhost:5081/swagger
```

### Local Media CDN Setup (`plzbuyme-cdn`)

```bash
cd CS527-Project/plzbuyme-cdn
dotnet run --project PlzBuyMe.Cdn
# → CDN starts at http://localhost:5090
# → Media files are served from http://localhost:5090/media/{key}
```

Backend media config (in `plzbuyme-backend/PlzBuyMe.Api/appsettings.json`):

```json
"MediaStorage": {
  "ServiceBaseUrl": "http://localhost:5090"
}
```

### GT7 Car Thumbnail Manifest (PBM-25)

PBM-25 uses a **manifest-only** approach for reference car thumbnails:

- A scraper script generates one JSON manifest with GT thumbnail `sourceUrl` values.
- The app can use these remote GT CDN URLs directly (no local image ingestion required).
- Metadata fields are included for auction display/filtering (`make`, parsed `model`, parsed `year`, `color` placeholder).

Generate/refresh manifest:

```bash
cd CS527-Project/plzbuyme-cdn/tools/car-assets
node generate-gt7-source-list.mjs
# → writes manifests/gt7-car-thumbnails.manifest.json
```

Notes:

- `color` defaults to `Unknown` because GT7 metadata does not provide a reliable color attribute per thumbnail.
- Entries tagged `needs-curation` / `needs-color-curation` should be reviewed manually.

### Temp Auction Seeder Script (dev helper)

To rapidly seed local auction data using GT7 manifest entries:

```bash
cd CS527-Project
API_BASE_URL="http://localhost:5081/api" \
AUCTION_SEED_USERNAME="<seed-user>" \
AUCTION_SEED_PASSWORD="<seed-password>" \
AUCTION_SEED_CATEGORY="auto" \
AUCTION_SEED_COUNT="40" \
node plzbuyme-backend/scripts/create-auctions-temp.mjs
```

Supported behavior:

- `AUCTION_SEED_CATEGORY=auto` infers `Sedans`/`SUVs`/`Trucks`/`Sports Cars`/`Electric` from manifest vehicle keywords.
- Manual category override still works by setting `AUCTION_SEED_CATEGORY` to a specific category name.
- Cars are chosen **at random** (without replacement) from the manifest up to `AUCTION_SEED_COUNT`; with `AUCTION_SEED_TITLE_KEYWORD`, the pool is filtered first, then shuffled.
- Auction values are randomized per item (close window, initial price, reserve, bid increment, mileage) to avoid deterministic demo data.
- Concept-car seeding is supported via `AUCTION_SEED_TITLE_KEYWORD=concept`; missing manifest year values are derived from title (or safely defaulted) so creation does not fail.

### Frontend Setup

```bash
cd CS527-Project/plzbuyme-frontend

# 1. Install dependencies
npm install

# 2. Configure API base URL in .env
echo "VITE_API_URL=http://localhost:5081/api" > .env

# 3. Start the dev server
npm run dev
# → React app at http://localhost:5173
```

### Default Admin Credentials (from seed)

| Field    | Value           |
|----------|-----------------|
| Username | `admin`         |
| Password | `admin123`      |

> Change the admin password immediately after first login.

### CORS Configuration

The backend must allow the frontend origin. In `Program.cs`:

```csharp
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
        policy.WithOrigins("http://localhost:5173")
              .AllowAnyHeader()
              .AllowAnyMethod());
});
```

---

## 14. Testing Strategy

Every implementation step must include corresponding tests. Tests run automatically via GitHub Actions on every push and PR, and can also be run locally.

### 14.1 Backend Unit Tests (xUnit)

The backend test project `PlzBuyMe.Tests` uses xUnit with EF Core InMemory provider and Moq for dependency isolation. Each service and controller gets its own test class.

**Run locally:**
```bash
cd plzbuyme-backend
dotnet test
```

**Test coverage per step:**

| Step | Test Class(es) | Key Test Cases |
|------|----------------|----------------|
| 3 — Models & Data | `SeedDataTests` | Seed creates admin account; seed creates category hierarchy with 3+ levels; seed creates category fields for each subcategory |
| 4 — Auth | `AuthServiceTests`, `AuthControllerTests` | Register creates user with hashed password; register rejects duplicate username/email; login returns valid JWT with correct claims; login rejects wrong password; login rejects inactive user; delete soft-deletes user |
| 6 — Auctions | `AuctionServiceTests`, `AuctionsControllerTests` | Create auction persists item + field values; bid below increment is rejected; bid by seller is rejected; bid on closed auction is rejected; valid bid updates current price; auto-bid triggers cascade; auto-bid stops at upper limit and notifies; CloseExpired sets winner when reserve met; CloseExpired marks closed when reserve not met; similar items returns same subcategory within preceding month |
| 21 — Advanced Auction Cards (backend support) | `AuctionServiceTests` | Create without uploaded image resolves GT7 default once and persists source/match metadata; no-match create persists placeholder metadata; uploaded image path takes priority and bypasses GT7 resolver |
| 7 — Alerts | `AlertServiceTests`, `AlertsControllerTests` | New item triggers matching alerts; alert with keyword filters correctly; alert with category filters correctly; notification created on match; user can only delete own alerts |
| 8 — Q&A & Rep | `RepControllerTests`, `QuestionsControllerTests` | User posts question; rep replies to question; rep edits user; rep soft-deletes user; rep resets password; rep removes bid and recalculates current price; rep removes auction sets status to Removed |
| 9 — Admin | `AdminControllerTests`, `ReportServiceTests` | Create rep account with correct role; total earnings sums sold items; earnings by type groups by category; best-selling returns top items by price; best buyers returns top spenders |

### 14.2 Frontend Tests (Vitest + React Testing Library)

Frontend tests live in `plzbuyme-frontend/src/__tests__/` and use Vitest with jsdom and MSW (Mock Service Worker) to mock API responses.

**Run locally:**
```bash
cd plzbuyme-frontend
npx vitest run
```

**Test coverage per step:**

| Step | Test File(s) | Key Test Cases |
|------|-------------|----------------|
| 5 — Auth + Layout | `AuthContext.test.tsx`, `LoginPage.test.tsx`, `ProtectedRoute.test.tsx` | Login stores JWT and sets user state; logout clears token and redirects; expired token hydration clears state; protected route redirects unauthenticated users; protected route blocks wrong role |
| 10 — Auction Pages | `AuctionCard.test.tsx`, `SearchBar.test.tsx`, `AuctionListPage.test.tsx` | AuctionCard renders price/title/countdown; search bar updates URL query params; auction list fetches and renders paginated results; bid form validates minimum amount |
| 11 — Alerts/Notifs/Q&A | `AlertsPage.test.tsx`, `NotificationsPage.test.tsx`, `QuestionsPage.test.tsx` | Create alert form submits correct payload; delete alert shows confirmation; notifications render with unread styling; mark-read updates state; Q&A supports ask access by role, sort-mode refetch, forum card navigation to detail, detail scroll reset, and guards against unintended navigation from nested vote/reply interactions |
| 12 — Rep + Admin | `RepDashboard.test.tsx`, `ReportsPage.test.tsx` | Rep user table renders and supports actions; admin create rep form submits; report tabs fetch and display data |
| 21 — Advanced Auction Cards | `AuctionCard.test.tsx` | Renders real-time countdown text, status/highlight badges (`Ending soon`, `Reserve met`, `No reserve`, `Newly listed`), and card link behavior for browse/detail navigation |

### 14.3 E2E Testing (Browser Agents)

Full end-to-end feature validation is performed by Cursor browser agents that interact with the running application. These tests exercise the complete stack (frontend → API → database) by navigating pages, filling forms, clicking buttons, and verifying results in the browser.

Browser agent tests cover critical user flows:
- Register → Login → Create auction → Place bid → Verify bid history
- Set auto-bid → Trigger outbid cascade → Verify notifications
- Set alert → Create matching item → Verify alert notification
- Rep: edit user, remove bid (verify price recalculation), remove auction
- Admin: create rep account, view all sales reports

### 14.4 GitHub Actions CI

A workflow at `.github/workflows/ci.yml` runs on every push and pull request:

```yaml
name: CI
on: [push, pull_request]

jobs:
  backend-tests:
    runs-on: ubuntu-latest
    services:
      mysql:
        image: mysql:8.0
        env:
          MYSQL_ROOT_PASSWORD: testpw
          MYSQL_DATABASE: plzbuyme_test
        ports: ['3306:3306']
        options: --health-cmd="mysqladmin ping" --health-interval=10s --health-timeout=5s --health-retries=3
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-dotnet@v4
        with: { dotnet-version: '8.0.x' }
      - run: dotnet test plzbuyme-backend/PlzBuyMe.Tests

  frontend-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '18' }
      - run: npm ci
        working-directory: plzbuyme-frontend
      - run: npx vitest run
        working-directory: plzbuyme-frontend
```

### 14.5 Running Tests

| Command | What it runs | Where |
|---------|-------------|-------|
| `dotnet test` | All backend xUnit tests | `plzbuyme-backend/` |
| `npx vitest run` | All frontend Vitest tests (single run) | `plzbuyme-frontend/` |
| `npx vitest` | Frontend tests in watch mode | `plzbuyme-frontend/` |
| `git push` | Triggers CI — both suites run automatically | GitHub Actions |

---

## 15. Team & Contributions

| Member | GitHub Handle | Primary Responsibility |
|--------|---------------|------------------------|
| TBD    | @tbd          | TBD                    |
| TBD    | @tbd          | TBD                    |
| TBD    | @tbd          | TBD                    |
| TBD    | @tbd          | TBD                    |

### Collaboration Guidelines

- Each ticket (`PBM-1` through `PBM-12`) is implemented as a **pull request** merged to `main`.
- Branch naming: `PBM-<num>/<short-description>` (e.g., `PBM-4/backend-auth`).
- PR title format: `[PBM-<num>] <description>` (e.g., `[PBM-4] implement JWT auth service and auth API endpoints`).
- All team members must commit code directly to the repo.
- Commit messages should follow: `feat:`, `fix:`, `docs:`, `refactor:`, `test:` prefixes.
- The ER diagram must be committed under `docs/`.
- Invite `pranikamassey@gmail.com` and `zhetang1@gmail.com` to the private repo.
