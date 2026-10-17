# Portfolio Builder

A multi-user, multi-portfolio visual portfolio website builder. This
repository is a monorepo containing:

- `web/` — Next.js (App Router) frontend and public rendering layer.
- `api/` — FastAPI backend, the authoritative API and business-logic layer.
- PostgreSQL — source of truth for editable data.

> **Current status: Phase 3 (pages and navigation management).**
> The authentication foundation, portfolio CRUD (owner-scoped, CSRF-protected,
> slug validation), and per-portfolio pages and navigation (starter pages, page
> CRUD/ordering/homepage assignment, navigation replace-and-order) are complete.
> The visual editor/sections, themes, media, and publishing are **not**
> implemented yet. See [`PROJECT_SPEC.md`](./PROJECT_SPEC.md) for the full
> product and engineering specification.

## Repository layout

```text
PortfolioBuilder/
  PROJECT_SPEC.md        Canonical product and engineering specification
  README.md              This file
  .env.example           Reference for all environment variables
  .gitignore
  web/                   Next.js application
    src/
      app/               App Router routes
        (auth)/          Login and registration pages
      components/         Shared UI components
        auth/            Authentication forms and status panel
        portfolio/       Portfolio, page, and navigation managers
        ui/              Reusable UI primitives (button, text field)
      lib/api/            Typed API client
      lib/auth/          Client-side validation helpers
      lib/page/          Page and navigation validation helpers
      lib/portfolio/     Portfolio validation helpers
      types/              Shared TypeScript types
  api/                   FastAPI application
    app/
      main.py             FastAPI app factory / entry point
      core/config.py      Settings (pydantic-settings)
      core/security.py    Password hashing and token helpers
      db/                 SQLAlchemy base, engine, and session management
      models/             ORM models (users, sessions, portfolios, pages, navigation)
      schemas/            Pydantic request/response schemas
      services/           Business logic (auth, sessions, portfolios, pages, navigation)
      api/routes/         API route modules
      api/deps.py         Reusable auth/CSRF dependencies
      tests/              pytest suite
    alembic/              Alembic migrations
    alembic.ini
```

## Prerequisites

| Tool        | Version used / verified        | Notes                                   |
| ----------- | ------------------------------ | --------------------------------------- |
| Node.js     | 22.14 (requires ≥ 20.19)       | For the Next.js frontend                |
| pnpm        | 10.26                          | `corepack enable` or `npm i -g pnpm`    |
| Python      | 3.11+ (verified on 3.13)       | For the FastAPI backend                 |
| uv          | 0.12                           | Manages the Python environment + lock   |
| PostgreSQL  | 16+ (verified on 18)           | Database server                         |

## Environment configuration

Copy the example files and adjust them. **Never commit real secrets.**

```powershell
Copy-Item .env.example api\.env
Copy-Item web\.env.example web\.env.local
```

- `api/.env` is read by the backend (`DATABASE_URL`, `ENVIRONMENT`, `DEBUG`,
  `CORS_ORIGINS`, and optional authentication cookie settings).
- `web/.env.local` is read by Next.js (`NEXT_PUBLIC_API_BASE_URL`).

The backend deliberately has **no database fallback**: if `DATABASE_URL` is not
set, database features fail loudly instead of silently using another database.

## Database setup

Create a database and point `DATABASE_URL` at it:

```powershell
# Using the psql client bundled with PostgreSQL
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -c "CREATE DATABASE portfolio_builder;"
```

`DATABASE_URL` uses the psycopg (v3) driver:

```text
postgresql+psycopg://USER:PASSWORD@HOST:PORT/DATABASE
```

Example (local development):

```text
postgresql+psycopg://postgres:postgres@localhost:5432/portfolio_builder
```

Then apply migrations:

```powershell
uv run alembic upgrade head
```

## Backend (`api/`)

```powershell
cd api
uv sync                      # create .venv and install locked dependencies
uv run alembic upgrade head   # apply migrations (requires PostgreSQL)
uv run uvicorn app.main:app --reload
```

The API is served at `http://localhost:8000`. Health check:

```powershell
curl http://localhost:8000/health
# {"status":"ok","service":"Portfolio Builder API","environment":"development"}
```

Interactive OpenAPI docs: `http://localhost:8000/docs`.

### Authentication

Phase 1B provides email/password authentication with opaque, server-side
sessions. Endpoints:

| Method | Path             | Description                                        |
| ------ | ---------------- | -------------------------------------------------- |
| POST   | `/auth/register` | Create an account and start a session (201)        |
| POST   | `/auth/login`    | Authenticate and start a session (200)             |
| POST   | `/auth/logout`   | Revoke the session (204); requires CSRF token      |
| GET    | `/auth/me`       | Return the authenticated user (200, else 401)      |
| GET    | `/portfolios`    | List current user's portfolios (200; auth required)|
| POST   | `/portfolios`    | Create a portfolio (201; auth + CSRF required)     |
| GET    | `/portfolios/{id}` | Get one owned portfolio (200/404; auth required)  |
| PATCH  | `/portfolios/{id}` | Update owned portfolio (200/404; auth + CSRF)     |
| DELETE | `/portfolios/{id}` | Delete owned portfolio (204/404; auth + CSRF)     |

### Pages and navigation

Phase 3 adds per-portfolio pages and navigation. Creating a portfolio seeds five
editable starter pages (`Home`, `About`, `Work`, `Projects`, `Contact`); `Home`
is the initial homepage. Nothing about these pages is hardcoded in the renderer.

| Method | Path                                     | Description                                              |
| ------ | ---------------------------------------- | -------------------------------------------------------- |
| GET    | `/portfolios/{id}/pages`                 | List owned portfolio's pages (200/404; auth)             |
| POST   | `/portfolios/{id}/pages`                 | Create a page (201/404/409/422; auth + CSRF)             |
| PUT    | `/portfolios/{id}/pages/order`           | Reorder pages (200/404/422; auth + CSRF)                 |
| GET    | `/pages/{page_id}`                       | Get one owned page (200/404; auth)                       |
| PATCH  | `/pages/{page_id}`                       | Update a page (200/404/409/422; auth + CSRF)             |
| DELETE | `/pages/{page_id}`                       | Delete a page (204/404/409; auth + CSRF)                 |
| GET    | `/portfolios/{id}/navigation`            | List navigation items (200/404; auth)                    |
| PUT    | `/portfolios/{id}/navigation`            | Atomically replace navigation (200/404/422; auth + CSRF) |

Page and navigation design notes:

- One homepage per portfolio, enforced by a partial unique index
  (`uq_pages_portfolio_homepage`). Deleting the homepage or unsetting it
  directly returns `409`; assign another page as the homepage first. The first
  page created in an otherwise empty portfolio becomes the homepage.
- Page slugs are unique within a portfolio (`uq_pages_portfolio_slug`) and
  validated with the same slug rules as portfolios (but without the platform
  reserved-word list).
- Navigation is stored as an ordered list per portfolio and replaced as a whole:
  the request's item order defines `sort_order`, and page destinations are
  validated against the portfolio before the swap. Deleting a page cascades to
  any navigation items that referenced it.

Design notes:

- Passwords are hashed with Argon2 via `pwdlib`; hashes and raw session tokens
  are never returned or logged.
- Sessions are stored server-side and only the SHA-256 hash of the session
  token is persisted. The raw token lives in an `HttpOnly`, `SameSite=Lax`
  cookie (plus `Secure` outside development).
- CSRF uses a session-bound double-submit token: a JavaScript-readable
  `pb_csrf` cookie whose value must be echoed in the `X-CSRF-Token` header for
  state-changing authenticated requests. Keep the cookie name in sync with
  `web/src/lib/api/client.ts`.
- CORS uses explicit origins with credentials; wildcard origins are rejected.
- In production, serve the web app and API over HTTPS under a shared parent
  domain so the CSRF cookie is readable by the browser app.

### Backend commands

| Command                       | Purpose                                  |
| ----------------------------- | ---------------------------------------- |
| `uv run uvicorn app.main:app --reload` | Run the development server      |
| `uv run pytest`               | Run the test suite                       |
| `uv run ruff check .`         | Lint                                     |
| `uv run ruff format --check .`| Verify formatting                        |
| `uv run alembic upgrade head` | Apply database migrations                |
| `uv run alembic revision --autogenerate -m "message"` | Create a migration |

## Frontend (`web/`)

```powershell
cd web
pnpm install
pnpm dev
```

- The frontend provides login/registration, an account panel, and a dashboard
  for creating, listing, viewing, updating, and deleting portfolios. Each
  portfolio page has tabs to manage its metadata, pages (create/edit/reorder/
  homepage visibility), and navigation. All credentialed requests include
  cookies and the CSRF header for state-changing operations.

### Frontend commands

| Command              | Purpose                       |
| -------------------- | ----------------------------- |
| `pnpm dev`           | Run the development server    |
| `pnpm build`         | Production build              |
| `pnpm start`         | Serve the production build    |
| `pnpm lint`          | ESLint                        |
| `pnpm typecheck`     | TypeScript type checking      |
| `pnpm format`        | Format with Prettier          |
| `pnpm format:check`  | Verify formatting             |

## Running both applications

1. Start PostgreSQL and ensure the database and `api/.env` are configured.
2. Terminal 1: `cd api; uv run uvicorn app.main:app --reload`
3. Terminal 2: `cd web; pnpm dev`
4. Open `http://localhost:3000` — the health panel should report `ok`.

## Testing

```powershell
# Backend
cd api; uv run pytest

# Frontend
cd web; pnpm lint; pnpm typecheck; pnpm format:check; pnpm build
```

Backend tests cover the health endpoint, configuration loading, the
authentication flows (registration, duplicate/case-normalized emails, invalid
input, login failures, current-user retrieval, logout and session reuse,
expired/revoked sessions, disabled users, CSRF rejection/acceptance, cookie
attributes, database uniqueness, and per-user session isolation), owner-scoped
portfolio management (list/create/get/update/delete, ownership enforcement,
cross-user isolation, slug validation/uniqueness, pagination validation, and
CSRF/session authorization), and pages/navigation (starter-page seeding, page
CRUD and ordering, homepage assignment/uniqueness/delete guard, page slug
uniqueness per portfolio, navigation replace/edit/reorder and destination
validation, cascade cleanup, and database constraint enforcement).

Tests run against a separate database derived from `DATABASE_URL` by appending
`_test` (override with `TEST_DATABASE_URL`). The fixtures refuse to run against
the configured development database, so test cleanup never touches development
data. The frontend is validated by lint, strict TypeScript type checking,
formatting checks, and a production build.

## Architecture notes

- The backend is the authoritative API. Core persistence, validation, and
  business rules belong in FastAPI, not in Next.js route handlers.
- Configuration is environment-driven and loaded with `pydantic-settings`;
  secrets are never committed.
- The SQLAlchemy engine and session factory are created lazily so the app can
  start without a database for the health endpoint.
- Alembic reads `DATABASE_URL` from application settings; `alembic.ini`
  contains no credentials.
- Portfolio- and page-scoped endpoints depend on `get_current_user` (and, for
  portfolio-scoped paths, `get_owned_portfolio`) and verify ownership
  server-side to prevent insecure direct object references (IDOR). The
  portfolios, pages, and navigation APIs enforce owner-scoped queries and return
  404 for non-owned resources.
- Cookies and secrets default to safe values: `Secure` is enabled outside
  development, session tokens are stored only as hashes, and no secrets are
  logged.
