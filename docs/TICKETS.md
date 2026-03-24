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

## PBM-21 — Advanced auction item cards with richer visuals

**Layer:** Frontend
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

---

## PBM-22 — Advanced top filter bar with category preview dropdown

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

## PBM-26 — Merge Sell flow into reusable popup modal

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

### PBM-BUG-2 — General bug triage and stabilization sweep

**Layer:** Full Stack  
**Branch:** `PBM-BUG-2/general-bug-sweep`  
**PR Title:** `[PBM-BUG-2] fix prioritized cross-app bugs and regressions`

- **Scope:** Triage and fix confirmed bugs across frontend and backend (auth/session edge cases, auction flows, alerts/notifications behavior, rep/admin actions, API validation/error handling).
- **Goals:** Prioritize user-facing and data-integrity issues first; group fixes by severity and include clear reproduction steps.
- **Deliverables:** Bugfix patches with a tracked checklist of issues addressed, plus regression tests for high-impact fixes.
- **Validation:** Run unit/integration tests for touched areas and perform smoke testing on critical flows (login, browse/search, bid, create auction, notifications).
