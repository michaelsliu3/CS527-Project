# plzbuy.me — Implementation Order

Sequential task list. Each step becomes a PR (branch → review → merge to `main`).
Refer to `TECH_DOC.md` for full specs, table schemas, pseudocode, and API contracts.

---

## PBM-1 — Backend Scaffold ✅

**Layer:** Backend
**Branch:** `PBM-1/backend-scaffold`
**PR Title:** `[PBM-1] scaffold ASP.NET Core Web API project`

- Create `plzbuyme-backend/PlzBuyMe.sln` and `plzbuyme-backend/PlzBuyMe.Api/` project
- Create `plzbuyme-backend/PlzBuyMe.Tests/` xUnit test project, add project reference to `PlzBuyMe.Api`
- Install NuGet packages (Api): `Pomelo.EntityFrameworkCore.MySql`, `Microsoft.AspNetCore.Authentication.JwtBearer`, `Microsoft.AspNetCore.Identity.EntityFrameworkCore`, `BCrypt.Net-Next`, `Swashbuckle.AspNetCore`
- Install NuGet packages (Tests): `xunit`, `xunit.runner.visualstudio`, `Microsoft.NET.Test.Sdk`, `Moq`, `Microsoft.EntityFrameworkCore.InMemory`, `Microsoft.AspNetCore.Mvc.Testing`, `FluentAssertions`
- `Program.cs`: wire up MySQL DbContext (Pomelo), JWT Bearer auth, authorization policies (`AdminOnly`, `RepOrAdmin`, `EndUser`), CORS for `http://localhost:5173`, Swagger, controller mapping
- `appsettings.json`: connection string placeholder, JWT config (Key, Issuer, Audience, ExpiresInMinutes)
- Create empty folders: `Models/`, `Data/`, `Dtos/`, `Controllers/`, `Services/`
- Create `PlzBuyMe.Tests/Helpers/TestDbContextFactory.cs`: helper to create InMemory DbContext for tests

---

## PBM-2 — Frontend Scaffold ✅

**Layer:** Frontend + Backend + CDN
**Branch:** `PBM-2/frontend-scaffold`
**PR Title:** `[PBM-2] scaffold React + Chakra UI frontend`

- Bootstrap Vite + React + TypeScript project in `plzbuyme-frontend/`
- Install: `react-router-dom`, `@chakra-ui/react`, `@emotion/react`, `@emotion/styled`, `framer-motion`, `axios`, `react-hook-form`, `react-icons`, `jwt-decode`
- Install dev deps: `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`, `jsdom`, `msw`
- Configure Vitest in `vite.config.ts` (test environment: jsdom, setup files)
- `src/main.tsx`: wrap app in `ChakraProvider` + `BrowserRouter`
- `src/theme/index.ts`: custom Chakra theme (brand colors, fonts)
- `src/api/client.ts`: Axios instance with `baseURL` from env, request interceptor (attach Bearer token from localStorage), response interceptor (401 → clear token, redirect `/login`)
- `src/App.tsx`: React Router `<Routes>` skeleton with placeholder elements for all routes
- `.env`: `VITE_API_URL=http://localhost:5081/api`

---

## PBM-3 — EF Core Models, DbContext, Migration & Seed Data ✅

**Layer:** Backend
**Branch:** `PBM-3/models-dbcontext-seed`
**PR Title:** `[PBM-3] add EF Core models, DbContext, migration, and seed data`

- Create all entity models in `Models/`: `User`, `Category`, `CategoryField`, `Item`, `ItemFieldValue`, `Bid`, `AutoBid`, `Alert`, `Notification`, `Question`
- Create `Models/Enums.cs`: `UserRole`, `ItemStatus`, `FieldType`, `NotificationType`
- `Data/AppDbContext.cs`: all `DbSet<T>`, Fluent API config (FKs, composite unique constraints, indexes from TECH_DOC §4.3, enum-to-string conversions, decimal precision, cascade/restrict deletes)
- `Data/SeedData.cs`: seed admin account (`admin`/`admin123`), car category hierarchy (Cars → Sedans/SUVs/Trucks/Sports Cars/Electric), category fields per subcategory (Make, Model, Year, Mileage, Condition, Transmission, Fuel Type, Exterior Color), sample car listings with bids
- Generate initial migration: `dotnet ef migrations add InitialCreate`
- **Tests:** `SeedDataTests.cs` — seed creates admin account; seed creates category hierarchy with 3+ levels; seed creates category fields for each subcategory

---

## PBM-4 — Backend Auth ✅

**Layer:** Backend
**Branch:** `PBM-4/backend-auth`
**PR Title:** `[PBM-4] implement JWT auth service and auth API endpoints`

- `Services/AuthService.cs`: `HashPassword`, `VerifyPassword` (BCrypt), `GenerateJwt` (claims: sub, unique_name, email, role)
- `Dtos/Auth/`: `RegisterDto`, `LoginDto`, `AuthResponseDto`, `ProfileDto`
- `Controllers/AuthController.cs` at `api/auth`:
  - `POST /register` — validate unique username/email, hash pw, create user, return JWT
  - `POST /login` — find user, verify pw, check IsActive, return JWT
  - `GET /profile` — [Authorize] return current user
  - `DELETE /profile` — [Authorize] soft-delete
- Register `AuthService` in `Program.cs` DI
- **Tests:** `AuthServiceTests.cs` — hash/verify password roundtrip; JWT contains correct claims and expiry. `AuthControllerTests.cs` — register creates user; register rejects duplicate username/email; login returns valid JWT; login rejects wrong password; login rejects inactive user; delete soft-deletes user

---

## PBM-5 — Frontend Auth + Layout Shell ✅

**Layer:** Frontend
**Branch:** `PBM-5/frontend-auth-layout`
**PR Title:** `[PBM-5] implement auth context, layout, login/register/profile pages`

- `src/context/AuthContext.tsx`: AuthProvider with user state (decoded JWT), `login()`, `register()`, `logout()` (clears localStorage, no server call), hydrate from localStorage on mount
- `src/components/ProtectedRoute.tsx`: role-based route guard, redirect to `/login` or `/`
- `src/components/Layout.tsx`: navbar (brand link, Auctions link, conditional My Auctions/Alerts/bell icon/profile dropdown for logged-in, Login/Register for guests, Rep/Admin links for staff), `<Outlet />`
- `src/pages/HomePage.tsx`: landing page with CTA → `/auctions`
- `src/pages/LoginPage.tsx`: centered Card, form (username, password), calls `login()`, error toast
- `src/pages/RegisterPage.tsx`: form (username, email, password, confirm), calls `register()`
- `src/pages/ProfilePage.tsx`: fetch profile, display username/email (read-only), delete account button
- Update `src/App.tsx`: wire Layout, ProtectedRoute, real components into route tree
- **Tests:** `AuthContext.test.tsx` — login stores JWT and sets user state; logout clears token and redirects; expired token clears state on mount. `ProtectedRoute.test.tsx` — redirects unauthenticated; blocks wrong role; renders children for correct role. `LoginPage.test.tsx` — form submits and calls login

---

## PBM-6 — Backend Auctions + Bidding Engine + Close Job ✅

**Layer:** Backend
**Branch:** `PBM-6/backend-auctions-bidding`
**PR Title:** `[PBM-6] implement auction CRUD, search, bidding engine, and close job`

- `Dtos/Auctions/`: `CreateAuctionDto`, `AuctionListDto`, `AuctionDetailDto`, `BidDto`, `AutoBidDto`, `BidHistoryItemDto`, `SearchQueryDto`
- `Services/AuctionService.cs`:
  - `CreateAuction` — create Item + ItemFieldValues, call AlertService.CheckAlertsForNewItem
  - `PlaceBid` — validate (active, not seller, meets increment), create Bid, update CurrentPrice, notify outbid users, trigger auto-bids
  - `SetAutoBid` — create/update AutoBid, trigger if applicable
  - `TriggerAutoBids` — cascade auto-bid logic (TECH_DOC §8.2)
  - `CloseExpired` — find expired active items, determine winner vs reserve not met, notify, update status
  - `GetSimilarItems` — same subcategory, preceding month, ranked by field-value overlap
- `Controllers/AuctionsController.cs` at `api/auctions`:
  - `GET /` — browse/search with full-text search, category/price/status/closing-date/seller filters, category-specific field filters (`field_filters` JSON), car shortcut params (`make`, `model`, `year_min`, `year_max`, `mileage_max`, `condition`, `transmission`, `fuel_type`, `exterior_color`), sort (incl. most_bids, year_newest, year_oldest, mileage_low, mileage_high), pagination (TECH_DOC §10)
  - `GET /{id}` — detail + bid history
  - `POST /` — [EndUser] create auction
  - `POST /{id}/bids` — [EndUser] place bid
  - `POST /{id}/autobids` — [EndUser] set auto-bid
  - `GET /mine` — [Authorize] current user's auctions
  - `GET /{id}/similar` — similar items
  - `GET /history/{userId}` — [Authorize] auctions user participated in
  - `GET /field-values` — distinct values for a given category field (autocomplete for Make, Model, Color)
- Register `AuctionCloseService` as a hosted BackgroundService in `Program.cs` (runs `CloseExpired` every 30 seconds)
- **Tests:** `AuctionServiceTests.cs` — create auction persists item + field values; bid below increment rejected; bid by seller rejected; bid on closed auction rejected; valid bid updates current price; auto-bid cascade triggers correctly; auto-bid stops at upper limit and creates notification; CloseExpired sets winner when reserve met; CloseExpired marks closed when reserve not met; similar items returns same subcategory within preceding month. `AuctionsControllerTests.cs` — search returns paginated results; search filters by category/price/status; search filters by closing date range; search filters by seller username; search with category-specific field filters (text partial match, number range, select exact match); sort by most_bids works; car shortcut params (make, year_min/max, mileage_max, condition[], transmission[], fuel_type[]) translate to field_filters; field-values endpoint returns distinct values with prefix filtering; sort by year_newest and mileage_low order correctly

---

## PBM-7 — Backend Alerts & Notifications ✅

**Layer:** Backend
**Branch:** `PBM-7/backend-alerts-notifications`
**PR Title:** `[PBM-7] implement alerts and notifications API`

- `Dtos/Alerts/`: `CreateAlertDto`, `AlertResponseDto`
- `Dtos/Notifications/`: `NotificationDto`
- `Services/AlertService.cs`: `CheckAlertsForNewItem(Item)` — match active alerts on category/keyword/criteria, create Notifications (TECH_DOC §9). `MatchesCriteria` helper.
- `Controllers/AlertsController.cs` at `api/alerts` [EndUser]:
  - `GET /` — list user's alerts
  - `POST /` — create alert
  - `DELETE /{id}` — verify ownership, delete
- `Controllers/NotificationsController.cs` at `api/notifications` [Authorize]:
  - `GET /` — list user's notifications (newest first), include unread count
  - `PATCH /{id}/read` — mark as read
- Register `AlertService` in `Program.cs` DI
- **Tests:** `AlertServiceTests.cs` — new item triggers matching alerts; keyword filter matches/rejects correctly; category filter works; notification created on match. `AlertsControllerTests.cs` — user can only delete own alerts; create alert returns correct response. `NotificationsControllerTests.cs` — list returns user's notifications; mark-read updates flag

---

## PBM-8 — Backend Q&A + Customer Rep ✅

**Layer:** Backend
**Branch:** `PBM-8/backend-qa-rep`
**PR Title:** `[PBM-8] implement Q&A and customer rep API endpoints`

- `Dtos/Questions/`: `CreateQuestionDto`, `ReplyDto`, `QuestionResponseDto`
- `Dtos/Rep/`: `EditUserDto`, `ResetPasswordDto`
- `Controllers/QuestionsController.cs` at `api/questions`:
  - `GET /` — [Authorize] list Q&As, support `?keyword=` search
  - `POST /` — [EndUser] create question
  - `POST /{id}/reply` — [RepOrAdmin] set reply
- `Controllers/RepController.cs` at `api/rep` [RepOrAdmin]:
  - `GET /users` — list end-users (paginated, searchable)
  - `PUT /users/{id}` — edit user info
  - `DELETE /users/{id}` — soft-delete
  - `POST /users/{id}/reset-password` — hash and set new password
  - `DELETE /bids/{id}` — delete bid, recalculate item's CurrentPrice
  - `DELETE /auctions/{id}` — set status to Removed
- **Tests:** `QuestionsControllerTests.cs` — user posts question; rep replies; keyword search filters correctly. `RepControllerTests.cs` — rep edits user; rep soft-deletes user; rep resets password; rep removes bid and recalculates CurrentPrice to next-highest (or InitialPrice); rep removes auction sets status Removed

---

## PBM-9 — Backend Admin + Reports ✅

**Layer:** Backend
**Branch:** `PBM-9/backend-admin-reports`
**PR Title:** `[PBM-9] implement admin endpoints and sales report queries`

- `Dtos/Admin/`: `CreateRepDto`, `EarningsReportDto`, `EarningsByItemDto`, `EarningsByTypeDto`, `EarningsByUserDto`, `BestSellingItemDto`, `BestBuyerDto`
- `Services/ReportService.cs`:
  - `GetTotalEarnings()` — SUM(CurrentPrice) where Sold
  - `GetEarningsByItem()` — each sold item's title + price
  - `GetEarningsByType()` — SUM grouped by Category
  - `GetEarningsByUser()` — SUM grouped by Seller/Winner
  - `GetBestSellingItems(top)` — sold items by price DESC + bid count
  - `GetBestBuyers(top)` — users by total spend DESC + win count
- `Controllers/AdminController.cs` at `api/admin` [AdminOnly]:
  - `POST /reps` — create customer rep account
  - `GET /reports/earnings` — total earnings
  - `GET /reports/earnings-by-type` — by category
  - `GET /reports/earnings-by-user` — by user
  - `GET /reports/best-selling` — top items
  - `GET /reports/best-buyers` — top buyers
- Register `ReportService` in `Program.cs` DI
- **Tests:** `AdminControllerTests.cs` — create rep account with correct role; non-admin rejected. `ReportServiceTests.cs` — total earnings sums sold items only; earnings by type groups by category; best-selling returns top N by price with bid count; best buyers returns top N spenders with win count

---

## PBM-10 — Frontend Auction Pages ✅

**Layer:** Frontend
**Branch:** `PBM-10/frontend-auction-pages`
**PR Title:** `[PBM-10] implement auction browse, detail, create, and my-auctions pages`

**Possible with current backend (PBM-6):**
- **AuctionListPage** — Use `GET /api/auctions/browse` (not `/api/auctions`) with query params: `q`, `categoryId`, `minPrice`, `maxPrice`, `status`, `closingBefore`, `closingAfter`, `seller`, `fieldFilters`, `sort`, `page`, `pageSize`; car shortcuts: `make`, `model`, `yearMin`, `yearMax`, `mileageMax`, `condition`, `transmission`, `fuelType`, `exteriorColor`.
- **SearchBar** — Drive filters from URL; autocomplete via `GET /api/auctions/field-values?fieldName=Make&categoryId=...&prefix=...` (and Model, Exterior Color).
- **AuctionCard, BidHistory** — Pure UI from list/detail data.
- **AuctionDetailPage** — `GET /api/auctions/view/{id}`; place bid `POST /api/auctions/{id}/bids/place` (body `{ amount }`); set auto-bid `POST /api/auctions/{id}/autobids/set` (body `{ upperLimit }`); similar items `GET /api/auctions/view/{id}/similar?limit=10`.
- **MyAuctionsPage** — `GET /api/auctions/mine?status=...` (optional status filter).
- **CreateAuctionPage submit** — `POST /api/auctions/create` with `CreateAuctionDto` (title, description, categoryId, initialPrice, bidIncrement, reservePrice, closeDateTime, fieldValues: `{ fieldId, value }[]`) works once the user has a category and field values. **Cascading category dropdowns and dynamic category fields** are not possible in a data-driven way until **PBM-13** (Categories API) is implemented; until then, the create form can use a hardcoded Cars hierarchy and field definitions, or PBM-13 can be done first.

- `src/components/AuctionCard.tsx`: Card with title, current price, countdown, status badge, category tag → links to detail
- `src/components/SearchBar.tsx`: keyword input, category dropdown, price range, status filter, closing date range, seller username input, sort dropdown → updates URL query params. When a Cars subcategory (or root Cars) is selected, render the car filter panel: Make/Model text inputs with autocomplete (via `GET /api/auctions/field-values`), Year range (dual number inputs), Mileage cap slider/input, Condition multi-select checkboxes, Transmission multi-select chips, Fuel Type multi-select chips with icons, Exterior Color input with color-swatch preview. Car-specific sort options (year newest/oldest, mileage low/high) appended to sort dropdown.
- `src/components/BidHistory.tsx`: table of bids (bidder, amount, auto badge, timestamp)
- `src/pages/AuctionListPage.tsx`: SearchBar + paginated grid of AuctionCards, fetch `GET /api/auctions/browse`
- `src/pages/AuctionDetailPage.tsx`: full item info, category-specific fields, countdown, bid form (manual + auto-bid), BidHistory, similar items section
- `src/pages/CreateAuctionPage.tsx`: cascading category dropdowns, dynamic category fields, standard fields (title, description, prices, close date), submit
- `src/pages/MyAuctionsPage.tsx`: fetch `GET /api/auctions/mine`, tabs by status
- Update `src/App.tsx` route imports
- **Tests:** `AuctionCard.test.tsx` — renders title, price, countdown; links to detail. `SearchBar.test.tsx` — updates URL query params on submit; selecting a Cars subcategory renders car filter panel; Make autocomplete fetches field-values endpoint; car sort options appear when Cars selected. `AuctionListPage.test.tsx` — fetches and renders paginated results (MSW mock)

---

## PBM-11 — Frontend Alerts, Notifications & Q&A ✅

**Layer:** Frontend
**Branch:** `PBM-11/frontend-alerts-notifs-qa`
**PR Title:** `[PBM-11] implement alerts, notifications, and Q&A pages`

- `src/pages/AlertsPage.tsx`: list alerts, create alert form/modal (category, keyword, criteria), delete with confirmation
- `src/pages/NotificationsPage.tsx`: notification list (icon by type, message, timestamp, unread bold), click to mark read, link to auction if has ItemId
- `src/pages/QuestionsPage.tsx`: Q&A list with keyword search, "Ask a Question" modal (end-user), inline reply form (rep/admin)
- Update `src/components/Layout.tsx`: fetch unread notification count, display badge on bell icon
- Update `src/App.tsx` route imports
- **Tests:** `AlertsPage.test.tsx` — create alert form submits correct payload; delete shows confirmation. `NotificationsPage.test.tsx` — renders with unread styling; mark-read updates state

---

## PBM-12 — Frontend Rep + Admin Dashboards ✅

**Layer:** Frontend
**Branch:** `PBM-12/frontend-rep-admin`
**PR Title:** `[PBM-12] implement rep dashboard and admin dashboard with reports`

- `src/pages/rep/RepDashboard.tsx`: tabs for Users (table with edit/reset-pw/delete actions), Questions (unanswered first, inline reply), Auctions (search, remove auction, drill into bids, remove bid)
- `src/pages/admin/AdminDashboard.tsx`: "Create Rep" form (username, email, password)
- `src/pages/admin/ReportsPage.tsx`: tabs for each report — total earnings stat, earnings by type table, earnings by user table, best-selling items table, best buyers table, each with refresh
- Update `src/App.tsx` route imports
- **Tests:** `RepDashboard.test.tsx` — user table renders and supports edit/delete actions. `ReportsPage.test.tsx` — report tabs fetch and display data correctly

---

## PBM-13 — Backend Categories API + data-driven Create Auction ✅

**Layer:** Backend + Frontend
**Branch:** `PBM-13/backend-categories-api`
**PR Title:** `[PBM-13] add categories and category-fields API for frontend`

- Add endpoints so the frontend can build **cascading category dropdowns** and **dynamic category fields** on CreateAuctionPage (PBM-10) from the database instead of hardcoding.
- `GET /api/categories` — return category tree (or flat list with `parentId`). Response: list of categories with `id`, `name`, `parentId` (nullable). Optionally include `children` for a nested tree, or frontend builds tree from flat list.
- `GET /api/categories/{id}/fields` — return category fields for a given category. Response: list of fields with `id`, `fieldName`, `fieldType` (text | number | select), `isRequired`, `options` (for select-type, JSON array of strings). Used to render the dynamic field inputs on CreateAuctionPage and to know which `fieldId` values to send in `CreateAuctionDto.FieldValues`.
- DTOs: e.g. `CategoryDto` (Id, Name, ParentId, Children), `CategoryFieldDto` (Id, FieldName, FieldType, IsRequired, Options).
- Controller: `CategoriesController` at `api/categories`, or extend an existing controller. Public access (no auth required for read).
- Frontend: wire `CreateAuctionPage` to use `GET /api/categories` for **Category/Subcategory** cascading dropdowns and `GET /api/categories/{id}/fields` for dynamic field inputs instead of hardcoded car fields.
- Frontend: update `SearchBar` to use categories tree (Category + Subcategory selects) and to show the **car filter panel** whenever the Cars category or any Cars subcategory is selected, without requiring an initial search submit.
- **Tests:** Categories endpoint returns hierarchy; category-fields endpoint returns fields for a category; fields include options when fieldType is select. `SearchBar.test.tsx` and `AuctionListPage.test.tsx` updated or extended to cover category/subcategory selection and car filter visibility when Cars is selected.

---

## PBM-14 — Frontend Forums nav link ✅

**Layer:** Frontend
**Branch:** `PBM-14/frontend-forums-nav`
**PR Title:** `[PBM-14] add Forums nav link for Q&A`

- Add a **Forums** link in the top navbar (`Layout.tsx`) that goes to the existing questions page (`/questions`). Label the tab "Forums" only; do not rename the route, page component, or any "question" text elsewhere.
- Show the link for logged-in users (e.g. next to Alerts or after Auctions).
- No backend changes.
- **Tests:** Nav link "Forums" is visible when logged in and navigates to `/questions`.

---

## PBM-15 — Q&A multi-reply + replier metadata ✅

**Layer:** Backend + Frontend
**Branch:** `PBM-15/qa-replies-enhancement`
**PR Title:** `[PBM-15] add multi-reply support with replier metadata in Q&A`

- Extend Q&A so each question returns a **replies collection** (ordered oldest-to-newest), allowing multiple replies per question.
- Standardize reply payload to **body-only** input (`ReplyDto.Body`) and remove reply title from model/DTO/UI.
- Include reply metadata in responses: `replierDisplayName`, `replierRole` (`customer_rep` / `admin` / `end_user`), and `createdAt`.
- Backend: update `QuestionReply` persistence model, Q&A DTO mapping, keyword search (subject/body/reply body/replier name), and migration removing `QuestionReplies.Title`.
- Frontend: update forums and rep dashboard Q&A views to render reply threads with replier labels/badges and relative reply timestamps.
- Authorization remains rep/admin-only for replying.

---

## PBM-16 — Auction search UI redesign ✅

**Layer:** Frontend
**Branch:** `PBM-16/auction-search-ui-redesign`
**PR Title:** `[PBM-16] redesign auction search UI layout, format, and styling`

- Restructured `AuctionListPage` into a two-part search experience: a top search/category bar plus a dedicated filter sidebar (`SearchBar` `variant="top"` + `variant="filters"`), with responsive desktop/mobile behavior.
- Implemented top-category quick selectors (including Cars root + subcategories) and preserved relevant filter inputs when switching categories so users do not lose in-progress search criteria.
- Expanded and polished filter controls in `SearchBar` (grouped sections, improved spacing, quick price presets, date controls, and car-specific filter/sort options such as year/mileage).
- Updated browse results presentation and pagination composition, and ensured explicit loading/empty/error states remain consistent in the redesigned page flow.
- Backend search behavior was refined to use wildcard matching for `q` against title/description so the redesigned search UI aligns with expected keyword matching behavior.
- Standardized horizontal page spacing across app pages via shared `APP_PAGE_PX` layout token, and added/updated `SearchBar` tests covering key redesigned interactions.

---

## PBM-17 — Admin user role management in Rep dashboard ✅

**Layer:** Backend + Frontend
**Branch:** `PBM-17/admin-role-management-rep-dashboard`
**PR Title:** `[PBM-17] allow admins to update user role from rep dashboard edit flow`

- Add support for **admin-managed user role changes** in the Rep dashboard Users tab edit flow.
- In `RepDashboard`, when an admin clicks **Edit** on a user, include a role dropdown with values: `User`, `Rep`, `Admin`.
- Restrict role editing to admins only. Non-admin users should not see or be able to submit role changes.
- Backend: ensure the update-user endpoint accepts and validates role updates from admins, rejects invalid role values, and enforces admin authorization.
- Frontend: prefill dropdown with current role, submit role updates with the rest of the edit form, and show success/error toasts accordingly.
- **Tests:** add/extend frontend tests for admin-only role dropdown visibility and role update submission; add backend tests for authorization, validation, and successful role change persistence.

---

## PBM-18 — User profile pictures + forums identity polish ✅

**Layer:** Backend + Frontend
**Branch:** `PBM-18/profile-pictures-forums`
**PR Title:** `[PBM-18] add profile picture upload and display across app and forums`

- Add support for user profile pictures (avatar image URL/storage key) in the user model and profile API response/update flow.
- Backend: add persistence and API support for avatar uploads/updates (or avatar URL updates), including validation for allowed file types/size and safe replacement behavior.
- Frontend: update `ProfilePage` to upload/change/remove profile picture and preview current avatar.
- Frontend: show avatars in shared identity surfaces (navbar/profile menu and user-related cards/lists where appropriate).
- **Forums/Q&A reminder:** make sure forums views (`QuestionsPage`, reply threads, and rep Q&A tab) are updated to display profile pictures next to usernames so identity metadata changes stay consistent there.
- **Tests:** add backend tests for avatar validation/update behavior; add frontend tests for profile picture upload UI states and forum avatar rendering fallback behavior.

---

## PBM-19 — Forums advanced comments/replies UX ✅

**Layer:** Backend + Frontend
**Branch:** `PBM-19/forums-advanced-comments-replies`
**PR Title:** `[PBM-19] add advanced forum interactions for voting, threaded replies, and sorting`

- Enhance forums/question threads with richer interaction controls directly under question and reply content.
- Add action icons/UI affordances for `Upvote`, `Downvote`, and `Reply` (comment) actions on questions and replies, with clear active/inactive states and counts.
- Implement threaded reply presentation (tree-style or nested reply layout) so users can understand parent-child conversation flow at a glance.
- Add comment/reply sorting options (e.g., `Top`, `Newest`, `Oldest`) and define deterministic tie-breaking behavior for equal score/timestamp cases.
- Backend: add persistence and APIs for vote state/counts and reply parent relationships; enforce one vote per user per target with toggle/update behavior.
- Frontend: update forums components to render vote/comment controls, nested thread UI, and sorting controls with responsive behavior and accessible interaction targets.
- **Tests:** backend tests for vote constraints, score aggregation, and thread retrieval/sorting; frontend tests for icon action behavior, nested rendering, and sort mode changes.
- **Implemented in this branch (UX hardening):**
  - Added forum detail-route behavior improvements so opening `/questions/:questionId` resets scroll position to top.
  - Fixed accidental forum-card navigation when interacting with nested controls in list view (vote/reply clicks, SVG icon click targets, and keyboard events such as `Space` in reply textarea and `Enter` on nested action buttons).
  - Expanded `QuestionsPage` frontend regression tests to cover detail-view navigation, scroll reset, and nested interaction safety.

---

## PBM-20 — VIP role + customizable display name color ✅

**Layer:** Backend + Frontend
**Branch:** `PBM-20/vip-role-name-color`
**PR Title:** `[PBM-20] add VIP role and customizable display name color for VIP+ users`

- Add a new `VIP` role tier and ensure role handling supports `VIP` for end-users and any higher-privilege roles.
- Backend: update role enum/validation/JWT claim handling so users can be assigned `VIP` without breaking existing `end_user`, `customer_rep`, and `admin` permissions.
- Backend: add persistence and API support for a user-configurable display name color (e.g., validated hex color) in profile/update flows.
- Authorization rule: users with `VIP` role or higher roles (`customer_rep`, `admin`) can customize their display name color; non-VIP end-users cannot.
- Frontend: add profile settings control for name color selection (picker + manual input), preview state, save/reset actions, and user-facing validation feedback.
- Frontend: render customized name color consistently in shared identity surfaces (forums/Q&A, navbar/profile menu, and other username displays where applicable), with safe fallback when unset/invalid.
- **Tests:** backend tests for role validation, VIP-or-higher authorization, and color format validation/persistence; frontend tests for control visibility by role, submit payload, preview behavior, and fallback rendering.

---

## PBM-21 — Advanced auction item cards with richer visuals ✅

**Layer:** Frontend + Backend + CDN handoff
**Branch:** `PBM-21/advanced-auction-item-cards`
**PR Title:** `[PBM-21] upgrade auction item cards with images, improved countdown, and richer text formatting`

- Redesign auction result cards (`AuctionCard`) with a stronger visual hierarchy and modern card layout optimized for desktop and mobile.
- Add item image support in cards (thumbnail + fallback placeholder when no image exists), including consistent image aspect ratio, object-fit behavior, and lazy-loading.
- Hybrid image strategy for defaults: use CDN GT7 resolver once when an auction is created/updated without an uploaded image, then persist the resolved image URL in DB for future reads.
- Backend: store image provenance and match quality metadata for deterministic rendering (`uploaded` / `gt7-default` / `placeholder`; `exact` / `partial` / `make-only` / `none`).
- Backend/API contract: auction list/detail payloads should return persisted image URL directly so frontend does not re-run GT7 matching per render.
- Replace the current timer presentation with a clearer real-time countdown component (days/hours/minutes/seconds), urgency color states, and expired/closed formatting.
- Improve text formatting for title/price/status/meta data (seller, category, bids, close time) with better typography, spacing, truncation, and alignment for scanability.
- Add optional highlight badges/tags for high-signal states (e.g., `Ending soon`, `Reserve met`, `No reserve`, `Newly listed`) when data is available.
- Ensure accessible semantics and keyboard focus states for the full card click target and internal actions.
- **Tests:** add/extend frontend tests for image fallback rendering, countdown state transitions (active/ending-soon/expired), and card text truncation/metadata display.
- **Tests:** add backend tests to verify one-time default image resolution, persisted image reuse on subsequent reads, and uploaded-image priority over GT7 defaults.
- **Implemented in this branch (additional):**
  - Backend image provenance metadata was delivered on `Item` and auction DTOs (`imageSource`, `imageMatchLevel`) with migration support.
  - Create-auction now resolves GT7 defaults once (when no uploaded image is provided), persists the resolved URL/key, and returns persisted image data to frontend card/detail payloads.
  - Auction detail now supports separate `detailImageUrl` for GT7-backed items so card/detail can use fit-for-surface variants without re-running matcher logic on render.
  - Frontend card UI shipped richer highlight tags (`Ending soon`, `Reserve met`, `No reserve`, `Newly listed`) and urgency countdown color states.
  - Frontend card polish shipped category-type gradient tags (including rainbow `Sports Cars`), price-row tag placement, and soft tag glow treatment for stronger scanability.
  - Timer polish shipped a dark-blue default countdown/bar state while preserving orange/red urgency transitions for near-expiry auctions.
  - `plzbuyme-backend/scripts/create-auctions-temp.mjs` now supports `AUCTION_SEED_CATEGORY=auto` category inference, randomized auction time/price/mileage generation, and robust concept-car seeding when manifest year data is missing.
- **Follow-up items still open under PBM-21 acceptance scope:**
  - AuctionCard image element should explicitly enable lazy loading (`loading="lazy"`).
  - Frontend tests should be expanded for image fallback behavior, countdown state transitions, and truncation/metadata assertions beyond current baseline checks.

---

## PBM-22 — Advanced top filter bar with category preview dropdown (DONE IN https://github.com/michaelsliu3/CS527-Project/pull/31) ✅

**Layer:** Frontend
**Branch:** `PBM-22/advanced-top-filter-bar`
**PR Title:** `[PBM-22] redesign top filter bar with category dropdown item previews`

- Redesign the top filter/search bar on the auction browse page for a cleaner, more modern layout and clearer quick-filter interactions.
- Add a rich category dropdown experience that previews matching items in the selected category with thumbnail image, item title, current price, and key metadata at a glance.
- Support typeahead within category context so users can quickly scan and select items from the dropdown without leaving the filter flow.
- Ensure dropdown preview rows are responsive, keyboard-navigable, and accessible (focus states, arrow navigation, enter-to-select, and screen-reader labels).
- Define loading/empty/error states for dropdown content (skeleton rows, no-results state, and retry behavior) so the filter bar feels reliable.
- Keep selection behavior consistent with existing query param/search behavior so choosing a preview item/category updates results deterministically.
- **Tests:** add/extend frontend tests for dropdown preview rendering (image/title/price), keyboard navigation, select-to-filter behavior, and loading/empty/error states.

---

## PBM-23 — Rich text comments in forums (Markdown/HTML)

**Layer:** Backend + Frontend
**Branch:** `PBM-23/questions-rich-text-comments`
**PR Title:** `[PBM-23] support markdown/sanitized html rendering for question and reply comments`

- Add support for rich text formatting in forums comments (`QuestionsPage`) so users can write formatted question bodies and replies.
- Backend: define the accepted format strategy (Markdown and/or sanitized HTML), validate payload size, and sanitize/normalize stored content to prevent XSS.
- Backend: ensure existing plain-text comments remain compatible and render correctly after migration/format changes.
- Frontend: add a composer UX for comments with formatting help (e.g., bold/italic/code/link/list examples) and optional preview mode before submit.
- Frontend: render rich content consistently for question bodies and reply bodies while preserving line breaks and safe fallback for malformed input.
- Security: enforce strict allowlist sanitization for tags/attributes/links and block script/event-handler injection attempts.
- **Tests:** backend tests for sanitization rules and payload validation; frontend tests for composer submit payload, preview behavior, and safe rendering/fallback for markdown/html content.

---

## PBM-24 — Local media server for user and item images ✅

**Layer:** Backend + Frontend
**Branch:** `PBM-24/local-media-server-storage`
**PR Title:** `[PBM-24] integrate local media server storage for avatars and auction images`

- Replace direct local upload-disk writes with a separate local media service (e.g., `plzbuyme-cdn`) used for profile avatars and auction/item images.
- Backend: add a `MediaStorageService` abstraction and local-service implementation for upload, replace, and delete operations, with simple environment-based configuration (base URL, storage root/path).
- Backend: support server-side upload flow, content-type and size validation, deterministic path naming, and safe replacement cleanup of old files.
- Backend: persist media URLs/keys in entities/DTOs and ensure existing avatar endpoints use the new media service without breaking API contracts.
- Frontend: update image upload codepaths (profile and auction image flows) to use the new backend contract and preserve current preview/fallback UX.
- Dev setup: document how to run/configure the local media service (`plzbuyme-cdn`) and required env vars in docs/example config.
- **Tests:** backend tests for media service validation/error handling/replacement behavior; frontend tests for upload success/failure flows with local-media-service responses.

---

## PBM-25 — GT7 car thumbnail manifest + CDN resolver/mirror ✅

**Layer:** Data + Manifest Tooling + CDN  
**Branch:** `PBM-25/gt7-car-thumbnail-manifest`  
**PR Title:** `[PBM-25] generate GT7 car thumbnail manifest with labels`

- Build a repeatable scraping workflow that outputs a **single manifest JSON** (no local image downloads required) for GT7 car thumbnails.
- Use GT7 car list data to generate per-asset entries with:
  - `sourceUrl` (direct GT CDN thumbnail URL),
  - `make`, parsed `model`, parsed `year`,
  - placeholder `color` (`Unknown`) plus curation tags for unresolved metadata.
- Include source attribution and extraction metadata (carlist page URL, bundle URL, metadata chunk URLs, timestamp).
- Keep the manifest as the canonical GT thumbnail catalog and lookup source for downstream services.
- Add CDN support for:
  - GT7 thumbnail resolve endpoint (`exact` -> `partial` -> `make-only` -> `none`) that returns a CDN URL + match metadata.
  - On-demand mirror/caching middleware for `/media/gt7/car{id}.png` and `/media/cars/gt7/car{id}.png` to fetch from GT CDN on cache miss.
- Establish PBM-21 handoff contract: resolve once (via CDN), then persist resolved URL in DB so auction cards do not re-run matching per render.
- **Validation:** regenerate manifest, confirm schema/count integrity, verify resolver match tiers, and verify mirrored CDN routes return GT assets (or 404 for unknown IDs).

---

## PBM-26 — Merge Sell flow into reusable popup modal ✅

**Layer:** Frontend  
**Branch:** `PBM-26/sell-flow-popup-modal`  
**PR Title:** `[PBM-26] replace standalone sell page with reusable sell item modal`

- Remove the separate dedicated Sell route/page and consolidate selling into a reusable `Sell Item` modal flow.
- Make the modal launchable from both `My Auctions` and main `Auctions` surfaces via clear CTA entry points.
- Reuse existing sell form fields/validation while adapting layout for modal UX (responsive sizing, scroll handling, focus trap, keyboard close).
- Preserve current create-auction behavior and API payload contract so backend integration remains unchanged.
- Define deterministic post-submit behavior (success toast, modal close/reset, list refresh/navigation behavior from each launch context).
- Ensure role/permission checks remain consistent with current app rules for users who can create auctions.
- **Tests:** add/extend frontend tests for modal open/close triggers from both pages, form validation/submit in modal context, and state reset when reopening.

---

## PBM-27 — Wallet balance system with fake deposits and real bid charging ✅

**Layer:** Backend + Frontend  
**Branch:** `PBM-27/wallet-balance-and-bid-charging`  
**PR Title:** `[PBM-27] add wallet balance flow and enforce bid-time balance charging`

- Add a wallet/balance model for end users and expose balance in authenticated profile/session payloads so UI can show spendable funds.
- Implement temporary/fake deposit support for development/demo use (manual top-up endpoint and/or simple fixed-amount presets) with clear labeling that external payment processing is not yet integrated.
- Enforce bid eligibility by available balance: users cannot place bids they cannot fund, and API returns deterministic validation errors for insufficient funds.
- Apply real balance accounting on bid actions so bidding affects funds immediately (reserve/hold or deduct according to chosen policy), including correct rollback/release behavior when users are outbid or bids are canceled/invalidated.
- Ensure auction close/settlement flow reconciles held funds and winner payment outcomes so final balances remain consistent for winner and non-winners.
- Frontend: add wallet/deposit UI entry points (e.g., in profile or auctions area), display live balance in key bidding surfaces, and show clear error/toast messaging for insufficient funds.
- **Tests:** backend tests for balance mutations, insufficient-funds rejection, outbid release/refund logic, and close-settlement reconciliation; frontend tests for deposit interactions, bid blocked states, and balance display updates.

---

## PBM-28 — Auction card image loading + coverage hardening

**Layer:** Frontend  
**Branch:** `PBM-28/auction-card-image-loading-placeholder`  
**PR Title:** `[PBM-28] harden auction card image loading and coverage`

- Add explicit lazy loading for auction card images (`loading="lazy"`) to improve list-page performance and bandwidth usage.
- Ensure fallback behavior remains robust when preferred card image variants fail (card variant -> persisted base image -> placeholder).
- Add or refine accessible semantics for image and placeholder states (descriptive alt text, non-decorative fallback labeling where needed).
- **Tests:** extend `AuctionCard.test.tsx` to cover lazy-loading attr, missing-image placeholder rendering, and image-fallback transitions.

---

## PBM-29 — Multi-tag car subtypes (Electric + Sports Car, etc.) ✅

**Layer:** Backend + Frontend  
**Branch:** `PBM-29/multi-tag-car-subtypes`  
**PR Title:** `[PBM-29] item subcategory tags, OR browse filter, seller/admin UI, and category platform`

**Shipped in this PR:**

- **Category platform (tree + metadata):** `categories` uses `string_key` (unique when set) and `lucide_icon_key` for integrations and SearchBar tab icons. `GET /api/categories` returns the hierarchy with `stringKey` and `lucideIconKey`. Search hub behavior is driven from that tree (e.g. Cars root via `stringKey === 'cars'` with name fallback). GM category CRUD, seed alignment with GT7 string keys, create/alerts flows consuming the API tree, and Development rethrow on migration/seed failure remain as earlier increments on this line of work.
- **Per-item multi-category:** `items.category_ids` JSON column (`List<int>`; MySQL native JSON, InMemory uses JSON string conversion). First element is the primary category; extras are subcategory tags (e.g. Electric + Sports Cars). Migration `20260403084418_ReplaceCategoryIdWithCategoryIdsJson` replaces the earlier `category_id` FK and `ItemSubcategoryTags` junction table. Validation: all IDs must exist; when >1 they must be non-root subcategories under the same top-level root; duplicates are removed.
- **API:** `POST api/auctions/create` accepts `categoryIds` (ordered list; first is primary). List rows include `categoryNames` (resolved from `category_ids`). Detail includes `categoryNames` and `categoryIds`. `PATCH api/admin/auctions/{id}` accepts optional `categoryIds`: **omit/null** leaves unchanged; **empty array** clears.
- **Browse filter:** When `category_id` is set, results include items whose `category_ids` JSON array contains the value (**OR** semantics via `JsonContains`). Explicit AND/OR query modes are not implemented.
- **Frontend:** Create Auction and sell modal support multi-select **additional subcategories** (chips) under the same root as the chosen primary category. Admin auction **Edit** can view/change tags. `AuctionCard` and auction detail show multiple category labels/chips.
- **GT7 category auto routing:** Manifest assets can carry an ordered `categories` array; seeding normalizes those values to category string keys and prefers that curated order before keyword inference, selecting the first resolvable category that has fields.
- **Live browse refresh integration:** GM category edits emit an in-app refresh signal so open `AuctionListPage` / `SearchBar` and create-related category consumers refetch category data without manual page reload.
- **Tests:** `AuctionServiceTests` coverage for create/patch/browse/tag validation paths.

**Follow-up (optional):**

- Browse/search **AND** vs **OR** switch (or multi-select category facets). Alert matching now checks all `CategoryIds` entries; further refinements possible.

---

## PBM-30 — Admin “GM” tools menu (bulk seeding & fixtures) ✅

**Layer:** Backend + Frontend  
**Branch:** `PBM-30/admin-gm-tools-menu`  
**PR Title:** `[PBM-30] add admin GM menu for bulk auctions, users, forums, and fixtures`

- **Admin-only surface:** `GmToolsDock` (right-edge tab) + slide-in `GmToolsPanel` for admins; integrated with `/admin` (legacy `/admin/gm` redirects to `/admin`). Intended for **demos, load testing, and QA**, not unchecked production use.
- **API:** `POST /api/admin/gm/...` via `AdminGmController` and `GmToolsService` — auction seed (random fields + optional synthetic bids, caps), **GT7 manifest** seed (aligned with `scripts/create-auctions-temp.mjs`), bulk end-user creation, Q&amp;A seed (optional rep/admin replies), wallet top-up, sample alerts and in-app notifications, idempotent sold-history fixture, bulk close all **active** listings (`natural` vs `closed`), run expired close sweep (same as background job), and **`auctions/delete-all`** to wipe every listing plus dependent rows (bids, auto-bids, bid holds, item-linked notifications) for environment reset.
- **Guardrails:** all routes use `AdminOnly`; batch/recipient caps on seeding and top-ups; UI confirmations for destructive or high-volume actions where appropriate; successful GM actions audit-logged at **Warning** with admin id and affected counts.
- **Docs:** endpoint catalog and usage notes in `docs/TECH_DOC.md` (§7 Admin GM tools table; §11 GM tools overview).
- **Tests:** `AdminGmControllerTests`, `GmToolsServiceTests`, `AuctionServiceTests`; frontend `GmToolsPanel.test.tsx` (role gating, triggers, errors).

---

## PBM-31 — “My bids” page (auctions the user has bid on)

**Layer:** Backend + Frontend  
**Branch:** `PBM-31/my-bids-page`  
**PR Title:** `[PBM-31] add My bids page for auctions the user has bid on`

- Add a **logged-in** destination (e.g. `/my-bids` or a **My bids** tab alongside **My auctions**) that lists every auction where the current user has **at least one `Bid` row**, with clear status (active / sold / closed), closing time, current price, and a link to the auction detail page.
- **Backend:** Today `GET api/auctions/history/{userId}` returns items the user **bid on or sold** (`GetHistoryAsync`). Either:
  - add a dedicated endpoint (e.g. `GET api/auctions/my-bids` or `history` query `scope=bids`) that returns **only** items with user bids, or
  - reuse `history` on the frontend but **filter client-side** to bid-only (document tradeoff: extra payload if user sells many listings).
  Prefer a **server-side bids-only list** if the combined history response is large or confusing.
- **Enrichment (recommended):** extend the list DTO (or add a slim `MyBidAuctionRowDto`) with fields such as **user’s highest bid on that item**, **whether they are the current high bidder** (when active), and **winner flag** when sold—so the page is useful without opening every detail view.
- **Frontend:** new page using existing list/card patterns (`AuctionCard` or table variant), loading and empty states (“You have not placed any bids yet”), sort default (e.g. active first, then by close date or last bid time).
- **Nav:** add **My bids** to `Layout` for roles that can bid (aligned with **My auctions** / **Sell** visibility rules).
- **Tests:** backend tests for authorization (only self), bids-only vs history semantics, and DTO fields; frontend tests for route guard, empty list, and row actions linking to detail.

---

## PBM-32 — Seller actions on own active auctions (no listing edits)

**Layer:** Backend + Frontend  
**Branch:** `PBM-32/seller-auction-lifecycle-actions`  
**PR Title:** `[PBM-32] seller lifecycle actions for active auctions (end early, etc.; no field edits)`

**Placeholder / intent:** Give sellers limited control over auctions that are **still active**—without reopening **create-time listing data** (title, description, category fields, reserve, images, etc. remain immutable after publish). Primary candidate: **end the auction early** (business rules TBD: e.g. immediate close vs. scheduled, reserve/winner semantics, notifications to bidders).

- **Out of scope for this ticket (explicit):** General “edit my listing” or admin-style field patches; those stay separate (admin/rep flows or a different product decision).
- **Backend (sketch):** Authenticated seller-only endpoint(s), e.g. `POST api/auctions/{id}/end-early` or `POST api/auctions/{id}/seller-actions` with a small action enum; validate item is active, seller owns item, and any policy checks (min time open, bid count, etc.—to be specified). Reuse or align with existing close/winner logic where possible.
- **Frontend (sketch):** From **My auctions** and/or **auction detail** (when viewer is seller and auction is active), expose safe actions (e.g. **End auction now**) with confirmation modal and clear copy about consequences.
- **Product follow-ups to decide:** Whether other actions belong here (e.g. “withdraw” if no bids, messaging-only nudges) vs. separate tickets; audit/logging if required.
- **Tests:** Authorization (only owner, only active), happy path close, rejection cases; frontend tests for visibility and confirm flow.

---

## PBM-33 — 3D car viewer + image carousel on auction detail page ✅

**Layer:** Frontend  
**Branch:** `PBM-33/3d-car-viewer-image-carousel`  
**PR Title:** `[PBM-33] add interactive 3D SU7 viewer and image carousel to auction detail`

- Add an interactive **Three.js 3D car viewer** (`Su7ThreeHero`) for SU7-related auction listings, loaded from a compressed `.glb` model with meshopt decoding.
- 3D viewer features: studio-grade multi-light setup (key, fill, rim, top spotlights + accent point lights), PMREM environment map, reflective floor (Reflector), ACES filmic tone mapping, orbit controls (interactive mode) or pointer-follow camera + drive animation (non-interactive mode), and auto-fit camera framing based on model bounding box.
- Add an in-view **exterior paint color selector** for the SU7 3D slide (compact vertical swatch rail), defaulting to yellow, with smooth animated transitions and paint-only material targeting.
- Fallback geometry (box-based car silhouette with torus wheels) renders immediately while the `.glb` model loads asynchronously.
- Add a reusable **`ImageCarousel`** component supporting mixed `image` and `3d` slide types with swipe/drag gestures, keyboard navigation (arrow keys), prev/next arrows, dot indicators with active-state animation, a "3D" badge overlay, and a "Drag to rotate · Scroll to zoom" hint on 3D slides.
- Integrate the carousel into **`AuctionDetailPage`**: for SU7 auctions, build a multi-slide deck (3D view + primary image + angle variants derived from URL frame tags `2_01`, `2_02`); for non-SU7 auctions, show the primary image as a single slide. Lazy-load `Su7ThreeHero` via `React.lazy` + `Suspense` to avoid loading Three.js for non-SU7 pages.
- Add static assets: `public/models/su7.glb` (compressed GLTF model) and `public/models/env_night.hdr` (HDR environment map).
- New dependencies: `three`, `@types/three`, `meshoptimizer`.
- **Driving mode (click-and-hold):** In both interactive and hero modes, pressing and holding the mouse triggers a driving simulation — wheels spin with progressive acceleration (max speed 8), 400 instanced speed-line streaks (additive-blended, multi-color palette) fade in around the car forming a warp tunnel, and the camera FOV widens with an ease-in-out curve (35→75) for a rush sensation. Releasing smoothly decelerates everything back to idle.
- **Tests:** add frontend tests for carousel navigation (prev/next/dot/keyboard), slide type rendering (image vs 3D), swipe gesture thresholds, and lazy-loading behavior for the 3D component.
- **Spoiler (tail wing) animation:** The model's "WeiYi" node (尾翼) is detected at load time. During the cinematic intro it tilts up gently; while driving, the tilt scales quadratically with speed (up to ~14°) and the spoiler lifts 0.1 units. On mouse release everything smoothly retracts with exponential-decay lerping. Transition rates are asymmetric — faster when opening, slower when closing — for a natural feel.
- **Carousel overlay hiding:** `ImageCarousel` accepts a `hideOverlays` prop that fades out arrows, dot indicators, 3D badge, and zoom hint during driving and before the intro completes. Hide is fast (0.15 s) to stay out of the way; reveal is slow (0.8 s) for a cinematic fade-in. `Su7ThreeHero` exposes `onDrivingChange` and `onIntroComplete` callbacks so `AuctionDetailPage` can coordinate overlay visibility.

---

## PBM-34 — Auction browse sorting on auction page ✅

**Layer:** Frontend + Backend  
**Branch:** `PBM-34/auction-page-sorting`  
**PR Title:** `[PBM-34] implement and verify auction browse sorting controls on auction page`

- Ensure the auction browse page exposes a clear sort control and reliably applies sort changes to the displayed auction list.
- Frontend: wire sort UI state to query params and data fetch (`sort` param), preserve selection across pagination/navigation, and show deterministic default sort behavior on initial load.
- Frontend: support expected sort options for general browse and Cars contexts (including car-specific year/mileage sorts where applicable) with accessible labels.
- Backend/API: confirm browse endpoint accepts and enforces all advertised sort modes consistently (including tie-break behavior) and returns stable ordering for repeated requests.
- UX: provide visible feedback when sort changes are applied and ensure no stale/unsorted results remain after rapid filter + sort changes.
- **Tests:** add/extend frontend tests for sort control rendering, query param updates, API request params, and result order updates; add/extend backend tests for each supported sort mode and deterministic tie-break ordering.

---

## PBM-35 — Admin quick-create auction from car manifest ✅

**Layer:** Frontend + Backend  
**Branch:** `PBM-35/admin-quick-create-from-manifest`  
**PR Title:** `[PBM-35] add admin quick-create auction autofill from car manifest`

- Add an **admin-only** action in the **Create Auction** popup: place a `Quick create` button at the top-right of the modal/popup shell, visually secondary to the final submit action.
- Clicking `Quick create` opens or focuses a manifest-driven car selector with **autocomplete search** (make/model/year/variant keywords) sourced from the GT7 car manifest.
- After selecting a manifest car, auto-populate create-auction form fields (at minimum: title, description template, brand/model/year, image(s), category/tags, and any car metadata already represented in the form).
- Keep admin control: populated values remain editable before submit; do not auto-submit.
- Define missing/partial-manifest behavior: if a field cannot be populated, leave it blank and show a non-blocking hint so admins know what still needs manual input.
- Data source approach: either expose a slim backend endpoint returning searchable manifest rows or preload a compact client dataset with indexing; prefer the approach that keeps modal open latency low and payload size controlled.
- Access control: feature should only render for admin role(s); non-admin users should see no UI or API path changes.
- **Tests:** add frontend tests for admin-only visibility, autocomplete interactions, and autofill behavior; add backend tests (if endpoint added) for auth and response shaping; include manual QA checklist for end-to-end create flow with autofill and edits.
- **UX fix:** Opening the sell modal resets quick-create trigger state so the manifest selector does not stay open after the user closes the modal without choosing a car (regression test: close/reopen).
- **Autofill polish:** After a manifest row is chosen, collapse the manifest selector; prefill common vehicle detail fields with baseline defaults when the manifest does not specify them (condition, fuel type, transmission).

---

## PBM-36 — 3D model menu improvements ✅

**Layer:** Frontend  
**Branch:** `PBM-36/3d-model-menu-improvements`  
**PR Title:** `[PBM-36] improve 3d model menu interactions and usability`

- Extend `Su7ThreeHero` to support multiple model configurations via a typed `modelKey` prop, with per-model loader paths and rendering controls (`rootYaw`, `rootLift`, wheel spin axis, and wheel spin direction).
- Add support for the Praga 3D model (`public/models/ac_-_praga_r1_free.glb`) with fallback candidate loading behavior so the viewer remains resilient to missing assets.
- Update wheel animation logic to use model-aware rotation axes/direction so driving and idle spin behavior remains visually correct across different vehicle rigs.
- Wire `AuctionDetailPage` 3D slide detection to support both SU7 and Praga listings, selecting the proper hero model key from auction title/description/model field text and preserving lazy-loaded 3D rendering.
- Keep existing carousel and interactive viewer behavior intact while broadening coverage to additional 3D vehicle assets without changing non-3D listings.

---

## Bugs

### PBM-BUG-1 — Login state lost on page refresh ✅

**Layer:** Frontend  
**Branch:** `PBM-BUG-1/fix-session-persistence`  
**PR Title:** `[PBM-BUG-1] persist auth across page refresh`

- **Bug:** Refreshing the page at any route clears login state; user is logged out and must sign in again.
- **Expected:** JWT (or equivalent auth token) should be restored from storage on app load so the user remains logged in after refresh.
- **Likely cause:** Auth context is not hydrating from `localStorage` on mount, or the token key/lifecycle is incorrect. Verify `AuthContext` reads the stored token on init and restores user state; ensure the API client attaches the token to requests after hydration.

---

## General Cleanup

### PBM-STYLE-1 — Global UI styling consistency pass ✅

**Layer:** Frontend  
**Branch:** `PBM-STYLE-1/frontend-styling-pass`  
**PR Title:** `[PBM-STYLE-1] perform global styling consistency cleanup`

- **Scope delivered:** Focused styling and role-access consistency cleanup across shared navigation and action-heavy pages (`Layout`, `App` route guards, Alerts, Q&A, Admin dashboard/reports).
- **Implemented fixes:**
  - Align role-based frontend access with backend policy intent so admins can use end-user flows (`Sell`, `My Auctions`, `Alerts`, and `Ask a Question` in Q&A).
  - Standardize primary/secondary action button patterns to match the established `Create auction` style (solid brand primary + outline secondary) in Alerts and Q&A dialogs/forms.
  - Improve admin-facing CTA consistency in dashboard/reports screens.
  - Add/adjust regression tests for role-based nav visibility and Q&A ask access behavior.
- **Validation completed:** Targeted frontend unit tests for touched role-gated flows and manual visual checks for updated button/CTA consistency in touched pages.

### PBM-STYLE-2 — Ongoing UI styling consistency backlog

**Layer:** Frontend  
**Branch:** `PBM-STYLE-2/frontend-styling-backlog`  
**PR Title:** `[PBM-STYLE-2] apply ongoing UI styling consistency fixes`

- **Scope:** Ongoing ticket to capture and implement incremental visual/style consistency fixes discovered during regular usage and QA review.
- **Initial issue:** On `MyAuctionsPage`, the `All` / `Active` / `Sold` / `Closed` filter controls are not visually consistent with the established action button style used by `Set auto-bid`.
- **Goal:** Standardize control appearance and interaction states (default, hover, active, focus, disabled) using existing Chakra theme tokens/components so related actions feel cohesive across pages.
- **Validation:** Add/extend targeted frontend tests where practical and perform manual UI checks on touched screens.

### PBM-STYLE-3 — Auction detail bid panel styling refresh

**Layer:** Frontend  
**Branch:** `PBM-STYLE-3/auction-detail-bid-panel-styling`  
**PR Title:** `[PBM-STYLE-3] rework auto-bid and bid history styling on auction detail page`

- **Scope:** Refresh the visual design and layout of the Auction Detail page sections for `Set auto-bid` and `Bid history` to improve readability and consistency with the newer card/filter UI patterns.
- **Problem:** Current styling in these sections feels visually uneven (spacing, hierarchy, typography, table/card treatment, and action emphasis), making bid interactions harder to scan.
- **Goals:** Improve spacing and grouping, unify heading/text/button styles, refine bid-row readability (amount/user/time/autobid badge), and ensure responsive behavior remains clear on mobile and desktop.
- **Validation:** Add/extend targeted frontend tests for key rendering states and run manual UI checks for alignment, hierarchy, and responsive behavior in the auction detail view.

### PBM-BUG-2 — General bug triage and stabilization sweep

**Layer:** Full Stack  
**Branch:** `PBM-BUG-2/general-bug-sweep`  
**PR Title:** `[PBM-BUG-2] fix prioritized cross-app bugs and regressions`

- **Scope:** Triage and fix confirmed bugs across frontend and backend (auth/session edge cases, auction flows, alerts/notifications behavior, rep/admin actions, API validation/error handling).
- **Goals:** Prioritize user-facing and data-integrity issues first; group fixes by severity and include clear reproduction steps.
- **Deliverables:** Bugfix patches with a tracked checklist of issues addressed, plus regression tests for high-impact fixes.
- **Validation:** Run unit/integration tests for touched areas and perform smoke testing on critical flows (login, browse/search, bid, create auction, notifications).

### PBM-BUG-3 — Auto-bid upper limit input is incorrectly constrained ✅

**Layer:** Frontend + Backend  
**Branch:** `PBM-BUG-3/fix-autobid-upper-limit-constraint`  
**PR Title:** `[PBM-BUG-3] allow valid auto-bid upper limits beyond strict increment multiples`

- **Bug:** In auction detail, the auto-bid max amount input only accepts values that are exact multiples of `currentPrice + (n * bidIncrement)` instead of allowing any valid upper-limit value.
- **Expected:** Users should be able to set any upper limit that is greater than or equal to the minimum allowed threshold; auto-bid execution should apply increment rules when placing bids, not when capturing the user’s max budget.
- **Likely cause:** Frontend validation/UI controls are reusing manual-bid increment constraints for auto-bid upper-limit entry, or backend validation enforces increment-multiple checks on `upperLimit` rather than on generated bid amounts.
- **Validation:** Add/extend tests to confirm non-multiple upper limits are accepted (e.g., `currentPrice + bidIncrement + 1`) while invalid low values are still rejected; verify auto-bid bidding steps continue to respect increment logic during actual bid placement.
