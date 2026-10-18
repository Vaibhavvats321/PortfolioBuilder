# Portfolio Builder

A multi-user, multi-portfolio visual portfolio website builder. This
repository is a monorepo containing:

- `web/` — Next.js (App Router) frontend and public rendering layer.
- `api/` — FastAPI backend, the authoritative API and business-logic layer.
- PostgreSQL — source of truth for editable data.

> **Current status: Phase 9 (hardening and release).**
> Phases 1–8 are implemented: authentication, multi-portfolio management,
> page/navigation management, the typed section engine and visual editor,
> themes and the Design Studio, the media library with responsive preview
> controls, draft save / protected preview / publish with immutable snapshots,
> and the public website renderer (`/p/{portfolio_slug}` and
> `/p/{portfolio_slug}/{page_slug}`) with SEO metadata, 404 behavior, and
> caching. Phase 9 adds the remaining security sweeps, the end-to-end journey
> test, documentation updates, and release verification (fresh-install
> migrations and the production build). See
> [`PROJECT_SPEC.md`](./PROJECT_SPEC.md) for the full product and engineering
> specification.

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
        dashboard/       Portfolio dashboard and editor screens
        p/               Public published-site routes (/p/{slug}, /p/{slug}/{page})
        not-found.tsx    Branded catch-all 404
        robots.ts        Crawler policy (public site indexable, admin disallowed)
        sitemap.ts       Sitemap built from currently published sites
      components/         Shared UI components
        auth/            Authentication forms and status panel
        builder/         Section editor (list, library, inspector, preview)
        design/          Theme design studio, preview, and template gallery
        portfolio/       Portfolio, page, navigation, and publication managers
        public/          Server-rendered published-site chrome and sections
        ui/              Reusable UI primitives (button, text field)
      lib/api/            Typed API client (incl. publication + public site)
      lib/auth/          Client-side validation helpers
      lib/page/          Page and navigation validation helpers
      lib/portfolio/     Portfolio validation helpers
      lib/public/        Public-route path, navigation, and SEO helpers
      lib/section/       Section field validation, defaults, responsive breakpoints
      lib/theme/         Theme fonts, contrast, and preview-style helpers
      types/              Shared TypeScript types
  api/                   FastAPI application
    app/
      main.py             FastAPI app factory / entry point
      core/config.py      Settings (pydantic-settings)
      core/security.py    Password hashing and token helpers
      db/                 SQLAlchemy base, engine, and session management
      models/             ORM models (users, sessions, portfolios, pages, navigation, sections, themes, media, versions)
      schemas/            Pydantic request/response schemas
      sections/           Section type registry and shared field engine
      theme/              Theme token/component registry and templates
      services/           Business logic (auth, sessions, portfolios, pages, navigation, sections, themes, media, publication)
      api/routes/         API route modules (incl. media and public)
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
- `web/.env.local` is read by Next.js (`NEXT_PUBLIC_API_BASE_URL`, and
  optionally `NEXT_PUBLIC_SITE_URL` — the absolute origin used to build
  canonical URLs, Open Graph URLs, the sitemap, and the robots sitemap
  pointer; it defaults to `http://localhost:3000`).

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

### Sections, themes, and the design studio

Phase 4 adds the visual section editor and Phase 5 adds themes. Sections are
described once in a typed registry (`api/app/sections/registry.py`); defaults,
backend validation, and the editor controls are all derived from those
descriptors, so no section shape is hardcoded in the frontend. Each section
stores validated `content`, `layout`, and `style` JSON. The theme registry
(`api/app/theme/registry.py`) drives the design studio the same way.

| Method | Path                                             | Description                                            |
| ------ | ------------------------------------------------ | ------------------------------------------------------ |
| GET    | `/section-types`                                 | List section type descriptors (200)                    |
| GET    | `/pages/{page_id}/sections`                      | List a page's sections (200/404; auth)                 |
| POST   | `/pages/{page_id}/sections`                      | Create a section (201/404/422; auth + CSRF)            |
| PUT    | `/pages/{page_id}/sections/order`                | Reorder sections (200/404/422; auth + CSRF)            |
| GET    | `/sections/{section_id}`                         | Get one owned section (200/404; auth)                  |
| PATCH  | `/sections/{section_id}`                         | Update a section (200/404/422; auth + CSRF)            |
| DELETE | `/sections/{section_id}`                         | Delete a section (204/404; auth + CSRF)                |
| POST   | `/sections/{section_id}/duplicate`               | Duplicate a section (201/404; auth + CSRF)             |
| GET    | `/theme/options`                                 | Theme token/layout descriptors + defaults (200; auth)  |
| GET    | `/portfolios/{id}/theme`                         | Get theme tokens + components (200/404; auth)          |
| PUT    | `/portfolios/{id}/theme`                         | Replace theme tokens (200/404/422; auth + CSRF)        |
| GET    | `/portfolios/{id}/global-layout`                 | Get global layout components (200/404; auth)           |
| PUT    | `/portfolios/{id}/global-layout`                 | Replace layout components (200/404/422; auth + CSRF)   |
| GET    | `/templates`                                     | List starter templates (200; auth)                     |
| POST   | `/portfolios/{id}/templates/{template_id}/apply` | Apply a template to a portfolio's design (200/404; auth + CSRF) |

Section, theme, and template design notes:

- A section's `style` overrides (background, text color, spacing, width, radius,
  shadow, border) default to `inherit`; concrete values are validated against the
  shared field engine, and colors are restricted to hex values.
- Theme tokens (colors, typography, spacing, borders, buttons, cards, links,
  background) and global-layout components (header, footer, sidebar, branding,
  social) are stored together on one `theme_configs` row per portfolio and are
  validated as a whole: unknown groups/fields are rejected and missing groups are
  filled from defaults, so a partial design never persists an incomplete
  document.
- Applying a template replaces the design only (tokens + components); it never
  modifies page or section content.
- Themes are owner-scoped and isolated per portfolio: two portfolios can use
  different themes and layouts.

### Media library

Phase 6 adds image uploads. Files are stored on disk through a local
filesystem adapter (an object-storage adapter is the production path); only
metadata lives in PostgreSQL. Uploads are validated by actual content (size,
sniffed type, and declared type must agree) and stored under generated keys.

| Method | Path                                | Description                                             |
| ------ | ----------------------------------- | ------------------------------------------------------- |
| GET    | `/portfolios/{id}/media`            | List the portfolio's assets (200/404; auth)             |
| POST   | `/portfolios/{id}/media`            | Upload an image (201/400/404/422; auth + CSRF)          |
| GET    | `/media/{media_id}`                 | Fetch one asset's metadata (200/404; auth, owner-only)  |
| PATCH  | `/media/{media_id}`                 | Update alt text / caption (200/404/422; auth + CSRF)    |
| DELETE | `/media/{media_id}`                 | Delete an asset (204/404; auth + CSRF)                  |
| GET    | `/media/{media_id}/file`            | Stream the file inline (owner, or any visitor while the portfolio is published) |

The editor's media picker stores the absolute `/media/{id}/file` URL into a
section's `image_url` field. Anonymous visitors can only read files whose
portfolio is currently published; draft media answers 401 so its existence is
never revealed.

### Preview, publish, and snapshots

Phase 7 separates draft editing from publication. Drafts are validated on
every write; publishing re-validates the whole portfolio, builds an immutable
snapshot (`portfolio_versions.snapshot_json`), and repoints
`portfolios.current_published_version_id` in one transaction.

| Method | Path                              | Description                                            |
| ------ | --------------------------------- | ------------------------------------------------------ |
| GET    | `/portfolios/{id}/preview`        | Owner's live draft bundle, same shape as a snapshot (200/404; auth) |
| POST   | `/portfolios/{id}/publish`        | Validate and publish atomically (200/404/422; auth + CSRF) |
| POST   | `/portfolios/{id}/unpublish`      | Return to draft; history is kept (200/404; auth + CSRF) |

Failed publication never disturbs the previously active version, and
unpublished sites always resolve to 404 on the public surface.

### Public website API

Phase 8 adds the anonymous read surface the Next.js `/p/...` routes render
from. It is the only unauthenticated content API and serves strictly from the
active published snapshot — never from draft tables.

| Method | Path                            | Description                                          |
| ------ | ------------------------------- | ---------------------------------------------------- |
| GET    | `/public/portfolios/{slug}`     | Full published bundle (200/404, `Cache-Control: no-store`) |
| GET    | `/public/sites`                 | Index of currently published sites for the sitemap   |

Caching: the backend keeps a small process-local cache of resolved bundles.
Invalidation is immediate in the process that handles publish, unpublish,
portfolio metadata changes, and deletion; in multi-process deployments other
processes converge within the documented cache window of **60 seconds**
(`PUBLISHED_CACHE_TTL_SECONDS`). HTTP responses are `no-store`, so browsers
and proxies never extend that window.

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
  homepage visibility), navigation, media, and design (theme tokens, global
  layout, and starter templates). The page editor adds, edits, reorders, and
  previews sections (with desktop/tablet/mobile preview modes), including
  per-section style overrides and per-breakpoint responsive overrides. The
  publication panel saves drafts, opens the protected preview, and
  publishes/unpublishes with a link to the live site. All credentialed requests
  include cookies and the CSRF header for state-changing operations.
- Published sites render server-side at `/p/{portfolio_slug}` and
  `/p/{portfolio_slug}/{page_slug}` from the published snapshot only. These
  routes ship no admin/builder JavaScript, emit per-page SEO metadata
  (title, description, canonical URL, Open Graph), and fall back to a branded
  404 for unknown, draft, unpublished, or corrupt sites. `robots.txt` allows
  indexing of the public surface while disallowing the dashboard and auth
  routes, and `sitemap.xml` is built exclusively from currently published
  sites.

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
CSRF/session authorization), pages/navigation (starter-page seeding, page
CRUD and ordering, homepage assignment/uniqueness/delete guard, page slug
uniqueness per portfolio, navigation replace/edit/reorder and destination
validation, cascade cleanup, and database constraint enforcement), the visual
editor and themes (section-type descriptors, section CRUD/ordering/
duplication, per-section content/layout/style/responsive-override validation,
theme options and token/component validation, global-layout persistence,
template listing and application, per-portfolio theme isolation, and
ownership enforcement), the media library (upload validation, metadata,
per-portfolio scoping, ownership isolation, and public file serving gated on
publication state), publication (validation, immutable snapshots, atomic
publish/unpublish, draft/published separation, and republish versioning), the
public website API (anonymous reads, 404 for draft/unpublished/unknown/corrupt
sites, cache invalidation on publish/unpublish/metadata change/delete, and
sitemap discovery), and security sweeps that walk the entire route table to
prove every protected route rejects anonymous callers and every state-changing
route rejects missing CSRF tokens. `test_journey.py` additionally runs the
whole create → customize → preview → publish → unpublish journey end to end
through the HTTP API (spec 19.5).

Tests run against a separate database derived from `DATABASE_URL` by appending
`_test` (override with `TEST_DATABASE_URL`). The fixtures refuse to run against
the configured development database, so test cleanup never touches development
data. The frontend is validated by lint, strict TypeScript type checking,
formatting checks, and a production build.

### Release verification

A clean checkout can be verified end to end with:

```powershell
# 1. Fresh-install migrations against an empty database
#    (use a scratch database name; never point this at real data)
$env:DATABASE_URL = "postgresql+psycopg://postgres:postgres@localhost:5432/portfolio_builder_fresh_check"
cd api; uv run alembic upgrade head

# 2. Backend checks
uv run pytest
uv run ruff check .
uv run ruff format --check .

# 3. Frontend checks and production build
cd ..\web; pnpm install; pnpm lint; pnpm typecheck; pnpm format:check; pnpm build
```

## Known limitations

- **Per-breakpoint responsive overrides on the public site.** Section
  `responsive_override` values for desktop/tablet/mobile are stored,
  validated, and rendered in the editor's device-preview modes, but the
  public renderer currently applies each section's base (desktop) style only.
  Public pages remain fluid (flexible layouts, wrapping navigation, no fixed
  viewport overflow); only the explicit per-breakpoint style deltas are not
  yet translated into media queries on published pages.
- **Published-site cache window across processes.** The published-bundle
  cache is process-local: publish/unpublish and metadata changes invalidate
  immediately in the process that handled them, while other worker processes
  converge within the documented 60-second TTL. HTTP responses are
  `no-store`, so clients never cache beyond that window.
- **Local media storage.** The default storage adapter writes uploads to the
  local filesystem (`MEDIA_ROOT`), which suits single-instance development;
  production multi-instance deployments should point media at shared
  object storage.

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
