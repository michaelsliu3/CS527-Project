# plzbuy.me

A full-stack online auction platform built for **CS 527 (Database Systems) — Programming Project**. Users list cars, bid in real time (with auto-bid + a wallet ledger), and admins/customer reps run the marketplace.

---

## Prerequisites

Install these once on your machine:

| Tool | Version | macOS install hint |
|---|---|---|
| .NET SDK | **8.0+** | `brew install dotnet@8` |
| Node.js | **18+** (20 recommended) | `brew install node` |
| MySQL | **8.x** | `brew install mysql` then `brew services start mysql` |

> **Recommended OS:** macOS or Linux. The setup scripts (`./run`, `./test`) are bash and assume a Unix-like shell; on Windows, use WSL2.

---

## Quick start (one command)

After prerequisites are installed, from the repo root:

```bash
# 1. Create the database (only the first time)
mysql -u root -p -e "CREATE DATABASE plzbuyme;"

# 2. Update connection string if your MySQL password is not "password":
#    plzbuyme-backend/PlzBuyMe.Api/appsettings.json -> ConnectionStrings.DefaultConnection

# 3. Install frontend deps once
cd plzbuyme-frontend && npm install && cd ..

# 4. Boot everything
./run
```

Once it's running, open <http://localhost:5173>.

---

## Repository structure

```
CS527-Project/
├── plzbuyme-backend/        # ASP.NET Core 8 Web API (C#)
├── plzbuyme-frontend/       # React + TypeScript + Vite SPA
├── plzbuyme-cdn/            # Local media server (avatars + item images)
├── docs/
│   ├── TECH_DOC.md          # ★ Full system spec — schemas, APIs, pseudocode
│   └── TICKETS.md           # ★ Sequential implementation plan, every PBM-N ticket
├── .github/workflows/       # CI pipelines (tests + AWS deploy)
├── run                      # ./run  — start all services locally
├── test                     # ./test — run all tests
├── README.md                # This file
└── CS 527 Project.pdf       # Original course assignment
```

### The two important docs

- **`docs/TECH_DOC.md`** — the source of truth. It defines the database schema (§4), business rules (§6), every API endpoint (§7), the auction engine pseudocode (§8), search/filter rules (§10), the test plan (§14), and the project layout (§12). When in doubt, read this first.
- **`docs/TICKETS.md`** — the sequential ticket list. Each ticket (`PBM-1`, `PBM-2`, …) is a single PR-sized chunk of work with bullet-point acceptance criteria and a list of tests to write. Tickets that ship are marked with a ✅. The ticket also dictates the branch name and PR title.

---

## Notes for the grader

A few things to make grading and demoing this project as smooth as possible.

### 1. Default admin login

Use these credentials to log in immediately at <http://localhost:5173/login>:

| Field | Value |
|---|---|
| Username | `admin` |
| Password | `admin123` |

The admin account is created automatically by `SeedData` on the very first backend startup. From there you can register additional end-user accounts through the UI, or use the GM tools (below) to bulk-create them.

### 2. The GM ("Game Master") debug tool — please use it

We built an **admin-only "GM" panel** that takes the pain out of QA / grading. Instead of manually clicking around to create realistic data, the GM panel can in one click:

- Bulk-seed dozens of auctions (random or pulled from the GT7 car manifest with real images)
- Bulk-create end-user accounts
- Top up wallet balances
- Seed Q&A threads, alerts, in-app notifications
- Generate sold-history fixtures so the admin **Reports** page has real numbers
- End every active auction at once, run the expired-close sweep on demand, or wipe every listing for a clean slate

**Where to find it:** log in as `admin` / `admin123`. On **any page**, look at the **right edge of the screen** — there's a small vertical "GM" tab. Click it and a panel slides in from the right. (It also lives inside the **Admin dashboard** at `/admin`.)

The GM tool is the recommended way to populate data for any feature you want to test (browse/search, bidding, reports, notifications, etc.). It's much faster than creating auctions one at a time through the UI.

### 3. Open the project in Cursor for the best experience

This README, [`docs/TECH_DOC.md`](docs/TECH_DOC.md), and [`docs/TICKETS.md`](docs/TICKETS.md) are written to be **AI-friendly**: every API endpoint, table schema, business rule, and ticket is documented in a structured way. If you open the repo in **[Cursor](https://cursor.com)** (or any AI-capable editor), the assistant can answer questions like *"how does auto-bidding work?"* or *"where is the alert matching logic?"* by jumping straight to the relevant code/spec — `TECH_DOC.md` is essentially a guided index of the system. We strongly recommend it for code review and exploration.

### 4. Suggested demo flow

1. Run `./run` from the repo root.
2. Visit <http://localhost:5173>, log in as `admin` / `admin123`.
3. Open **GM tools** (right-edge tab) → seed ~40 auctions from the GT7 manifest, ~10 end-users, top-up wallets, seed Q&A.
4. Log out, register a fresh end-user (or log in as one of the seeded users), browse `/auctions`, place bids, set an auto-bid, set an alert.
5. Log back in as `admin` and look at `/admin/reports` for the sold-history reports.

### 5. Known assumptions / limitations

- The wallet is a **demo ledger** — there is no real payment integration. The "Deposit" UI is intentionally fake (admin/QA aid).
- Default secrets in `appsettings.json` (JWT key, DB password) are **dev placeholders**; rotate before any real deployment.
- The CDN serves files out of `plzbuyme-cdn/storage/` (gitignored). Image uploads work locally; in CI we don't persist media.

---

## Hosted fallback (AWS)

If local setup fails for any reason, the project is also deployed on AWS at:

> **<http://plzbuyme.shop/>**

You can use this hosted version to test/demo the app end-to-end (the default `admin` / `admin123` login works there too). **Caveat:** the hosted environment is best-effort and some features may be broken or out of date relative to `main` (image uploads, the CDN, scheduled jobs, etc.). We strongly recommend running locally with `./run` if you can — the hosted site is intended as a last-resort fallback only.

---

Questions or trouble? Check `docs/TECH_DOC.md` first — almost every behavior is documented there. Otherwise, open an issue on GitHub.
