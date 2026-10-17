# Portfolio Builder Platform --- Product & Engineering Source of Truth

**Document:** `PROJECT_SPEC.md`\
**Purpose:** Canonical product, architecture, security, and delivery
specification for all developers and AI coding models.\
**Product type:** Multi-user, multi-portfolio, WordPress-style visual
portfolio website builder / CMS.\
**Core stack:** Next.js + TypeScript, FastAPI + Python, PostgreSQL.\
**Status:** Expanded baseline specification.

------------------------------------------------------------------------

# 1. Mandatory Instructions for AI Models

Read this file before implementing or modifying any feature. Also
inspect the actual repository; this file describes the intended product,
not proof that features already exist.

1.  Treat this document as the canonical baseline unless the owner
    explicitly approves a change.
2.  Inspect the existing code, database schema, migrations, tests,
    environment, and current UI before editing.
3.  Do not rewrite or delete working code unnecessarily.
4.  Work in small, reviewable phases. Do not implement the entire
    product in one large change.
5.  Before each phase, state the intended scope and dependencies. After
    it, report exact files changed, database changes, commands run,
    actual test results, limitations, and next step.
6.  Do not claim a test, migration, build, upload, save, preview, or
    publish succeeded unless it was actually verified.
7.  Never store portfolio-specific content, navigation, theme choices,
    layout configuration, or page order as fixed values in frontend
    code. Starter/demo content may be seeded as editable database
    records.
8.  The application engine and supported component renderers will be
    implemented in code; the **user's portfolio content and supported
    design choices must be data-driven**.
9.  Enforce authorization and portfolio ownership in FastAPI
    services/queries, not merely by hiding UI controls.
10. All database schema changes require Alembic migrations. Never depend
    on manual database edits.
11. Validate input on the backend. Frontend validation is for user
    experience and is not a security boundary.
12. Use environment variables for secrets and provide `.env.example`
    without real credentials.
13. Add tests alongside features. Do not postpone all testing to the
    end.
14. If a requirement is ambiguous, choose a safe, maintainable default,
    record the decision, and ask the owner only when the choice
    materially changes product behavior.
15. If implementation conflicts with this file, stop and explain the
    conflict. Do not silently diverge.
16. If the owner approves a lasting change, update this document and
    keep code, tests, and README consistent.
17. Never execute arbitrary user-supplied JavaScript, HTML, CSS, or
    server code from a portfolio.
18. Do not expose secrets, private drafts, another user's portfolio, or
    unpublished content through public APIs.

## 1.1 Required completion report

At the end of every meaningful task, provide:

-   **Completed:** Features that now work.
-   **Files changed:** Exact paths and short explanations.
-   **Database/migrations:** Changes and migration status.
-   **Verification:** Exact commands and actual pass/fail results.
-   **Manual checks:** Flows actually verified.
-   **Limitations:** Anything incomplete.
-   **Next step:** One recommended next task.

------------------------------------------------------------------------

# 2. Product Vision

Build a multi-user platform that lets people create, customize, preview,
publish, and manage their own professional portfolio websites without
editing code.

The product has two main experiences:

1.  **Admin Studio / Website Builder:** A protected workspace for
    creating portfolios, pages, sections, navigation, themes, media, and
    global layouts with drag-and-drop and configuration controls.
2.  **Public Portfolio Website:** A responsive, multi-page website
    rendered from the portfolio's published configuration. Each
    portfolio has its own public URL and independent content/design
    settings.

The platform is inspired by the flexibility of WordPress, with the
initial product focus on professional portfolio websites.

## 2.1 Core product promise

A user should be able to:

1.  Sign up and sign in.
2.  Create one or more portfolios.
3.  Choose a starter template.
4.  Create, rename, reorder, hide, and delete pages.
5.  Add and arrange sections visually.
6.  Edit content, images, links, and styling through controls.
7.  Customize theme, typography, colors, header, footer, and sidebar.
8.  Preview desktop, tablet, and mobile layouts.
9.  Save a private draft.
10. Publish the portfolio to a unique URL.
11. Make further changes without affecting the live site until
    publishing again.
12. Manage all supported website settings without editing code.

## 2.2 Important product boundary

This is not a system that generates a separate new codebase for every
user. It is a **multi-tenant platform with a shared rendering engine**.
Each portfolio's pages, content, theme, layout, navigation, and
published version are stored as data. The shared engine renders each
public website according to its own saved configuration.

The system can be expanded later to custom domains, paid plans,
collaboration, analytics, and other SaaS features, but these are not
prerequisites for the first usable release.

------------------------------------------------------------------------

# 3. Product Principles: Configurable Versus Implemented in Code

The platform must distinguish between the **builder engine** and the
**portfolio data**.

## 3.1 Implemented in code

These are product capabilities and need software implementation:

-   Authentication and account management.
-   Admin interface and editor controls.
-   Drag-and-drop engine and ordering logic.
-   Supported section types and their renderers.
-   Theme engine and design-token application.
-   Page routing and published-site rendering.
-   Preview, save, publish, and unpublish workflows.
-   API, validation, database persistence, media handling, and
    authorization.

## 3.2 Stored as data, not hardcoded per user

These values must be editable through the admin panel and persisted:

-   Portfolio name, slug, title, description, and profile details.
-   Page titles, slugs, order, visibility, and SEO metadata.
-   Navigation labels, destinations, order, and visibility.
-   Section types, content, order, visibility, and layout settings.
-   Headings, descriptions, paragraphs, images, captions, buttons,
    links, project information, skills, experience, and contact details.
-   Global header, footer, optional sidebar, logo, social links, and CTA
    settings.
-   Theme/template selection and all supported theme values.
-   Fonts, text sizes, weights, line heights, letter spacing, colors,
    backgrounds, spacing, widths, borders, shadows, radii, and button
    appearance.
-   Supported responsive overrides for desktop, tablet, and mobile.
-   Public/published status and published version.

Starter content and starter themes may be inserted into PostgreSQL as
seed records, but users must be able to edit them in the builder. Do not
use a hardcoded array of five page names as the only navigation source.
Home/About/Work/Projects/Contact are defaults only.

## 3.3 Honest flexibility boundary

Do not promise arbitrary pixel-level control over every CSS property in
the first release. The initial builder should provide a rich, safe,
responsive set of controls. Any style that the builder exposes must be
stored and applied dynamically. New component types or fundamentally new
capabilities may require code changes.

------------------------------------------------------------------------

# 4. Product Scope and User Model

## 4.1 Multi-user support

The platform must support multiple independent user accounts. Each user
may own multiple portfolios. Example:

-   User A owns `vaibhav-vats` and `vaibhav-developer`.
-   User B owns `jane-smith`.
-   Each portfolio has its own pages, theme, media, navigation, draft,
    and published version.

One user's private data must never be visible or editable by another
user. This is a foundational requirement, not an optional future
feature.

## 4.2 Roles

For the initial release:

-   **Portfolio Owner:** Can manage their own portfolios and all their
    content/settings.
-   **Public Visitor:** Can view published portfolio content only.

Platform-wide support/admin roles may be added later. Do not build a
large organization/permissions system unless requested.

## 4.3 Portfolio ownership and account behavior

-   A user can create, list, edit, publish, unpublish, and delete only
    their own portfolios.
-   All portfolio-scoped resources must be checked against the
    authenticated owner.
-   Deletion behavior must be explicit. Consider soft-delete or a
    confirmation/retention period for portfolios; document the chosen
    approach.
-   Public visitors must not need an account to view published pages.

------------------------------------------------------------------------

# 5. Recommended Portfolio Pages and Content

Starter pages should be created as editable database records when a
portfolio is created. Users can rename, hide, reorder, delete, or add
pages.

Default pages:

1.  **Home:** Hero, intro, profile image, calls to action, featured
    projects, skills, experience highlights, contact CTA.
2.  **About:** Biography, story, values, skills, tools, education,
    certifications, optional interests.
3.  **Work / Experience:** Work history, responsibilities, achievements,
    dates, technologies.
4.  **Projects:** Project cards and optional detail pages.
5.  **Contact:** Contact details, social links, optional secure contact
    form.

Optional pages/sections:

-   Resume / CV
-   Services
-   Testimonials
-   Case studies
-   Blog / Articles
-   Certifications
-   Speaking / Publications
-   FAQ
-   Custom landing pages

The user can create any number of pages subject to a configurable
product limit if limits are introduced later. No page name or count
should be hardcoded as a permanent product restriction.

## 5.1 Suggested Home page starter layout

1.  Hero: title, subtitle, buttons, portrait/illustration, image
    placement, optional availability indicator.
2.  Optional social proof / metrics.
3.  Featured projects.
4.  About preview.
5.  Skills/capabilities.
6.  Experience highlights.
7.  Call to action.
8.  Footer.

Every section is optional and reorderable. The user can change content,
visibility, section settings, and supported styling.

------------------------------------------------------------------------

# 6. Admin Studio Information Architecture

The admin interface should be professional, responsive, accessible, and
separate from the public portfolio's theme.

Recommended admin sidebar:

-   **Dashboard:** Portfolio overview, draft/published status, recent
    activity, quick actions.
-   **My Portfolios:** Create, select, rename, duplicate if supported,
    publish, unpublish, delete.
-   **Pages:** Page list, page creation, slug, homepage assignment, page
    visibility, SEO.
-   **Visual Editor:** Section library, canvas/preview, inspector,
    drag-and-drop, save status.
-   **Navigation:** Header/footer/sidebar navigation items and ordering.
-   **Design Studio:** Templates, global theme, typography, color
    palette, backgrounds, buttons, spacing, borders, shadows.
-   **Global Layout:** Header, footer, optional sidebar, logo, social
    links, site-wide CTA.
-   **Media Library:** Upload, search, reuse, replace, edit alt text and
    image focal point.
-   **Projects:** Reusable project records.
-   **Experience & Skills:** Optional structured record managers.
-   **SEO & Sharing:** Page metadata, social preview, indexing controls.
-   **Settings:** Portfolio name, slug, status, account/profile
    settings.
-   **Account & Security:** Profile, sessions/password features, sign
    out.

Only display menu items whose features exist. No fake or dead controls.

------------------------------------------------------------------------

# 7. Visual Editor and Drag-and-Drop

## 7.1 Recommended editing model

Build a **section-based visual editor**, not an unrestricted free-form
canvas. A section-based builder is easier to validate, make responsive,
save, and render consistently.

Desktop layout:

-   **Left panel:** Page tree, section list, add-section library.
-   **Center panel:** Visual preview/canvas with section selection and
    drop indicators.
-   **Right panel:** Inspector controls for the selected page, section,
    or element.
-   **Top toolbar:** Page selector, device preview, undo/redo if
    implemented, save status, Preview, Publish.

On smaller screens, panels may become drawers/tabs.

## 7.2 Drag-and-drop requirements

-   Add sections from an approved section library.
-   Reorder sections within a page.
-   Duplicate and delete sections.
-   Hide/show sections.
-   Select a section and edit its settings.
-   Show a visible drag handle and drop indicator.
-   Provide accessible move-up/move-down alternatives.
-   Persist stable section IDs and explicit ordering.
-   Validate ordering and section configuration on the backend.
-   Prevent one user's section from being moved to another user's page.
-   Keep draft editor state separate from published data.

## 7.3 Editing and save behavior

-   Selecting a section opens the relevant inspector controls.
-   Changes should update the draft preview.
-   Show unsaved/saving/saved/error states clearly.
-   Provide an explicit Save Draft action for the first release.
    Autosave may be added only if it is reliable and handles conflicts.
-   Warn about unsaved changes when leaving the editor.
-   Use stable IDs to avoid losing section state during reordering.
-   Use optimistic version checks or updated timestamps to prevent
    silent overwrites where practical.

------------------------------------------------------------------------

# 8. Section Library and Content Schema

Use a typed, extensible **section registry**. Each supported section
type should define:

1.  Stable section type identifier.
2.  Content schema.
3.  Layout/style schema.
4.  Admin inspector/editor controls.
5.  Backend validation.
6.  Public renderer.
7.  Default configuration.
8.  Schema version.

Recommended initial section types:

-   Hero
-   Rich text / About
-   Image + text
-   Image gallery
-   Project grid
-   Project list
-   Skills grid
-   Experience timeline
-   Education / Certifications
-   Testimonials
-   Metrics / Statistics
-   Logo strip
-   Call to action
-   Contact details / Contact form
-   Link list
-   Divider / Spacer

The exact initial list can be delivered incrementally. Each supported
type must work in editor, draft preview, and published rendering.

Unknown section types or invalid schemas must fail safely and should not
crash an entire public website.

## 8.1 Content editing

Support relevant controls per section type:

-   Plain text and multiline text.
-   Rich text through a safe, constrained editor if implemented.
-   Image/media picker.
-   Internal page link or validated external link.
-   Button label and destination.
-   Lists and repeated cards.
-   Alignment and supported layout options.
-   Visibility and optional display settings.

Never execute arbitrary HTML, JavaScript, or CSS supplied as content. If
rich text is supported, sanitize and render it using a safe allowlist.

------------------------------------------------------------------------

# 9. Theme and Design Studio --- Core Requirement

Theme customization is a first-class feature, not a decorative add-on.
Users must be able to personalize the appearance of their own portfolios
through the admin panel.

## 9.1 Theme/template model

A **template** is a starting arrangement of pages, sections, and design
tokens. A **theme** defines visual design choices. Users can select a
template and then customize the supported theme settings without
affecting other users.

Starter templates should be stored as versioned templates/configuration,
not permanently tied to one hardcoded user's page content.

Selecting a new template must have an explicit behavior. Recommended:
apply to a new portfolio during setup, or offer a deliberate
migration/replace action for existing content. Never silently overwrite
a user's pages or custom theme when they select a template.

## 9.2 Global theme controls

Provide admin controls for the following, with a sensible default theme:

### Colors

-   Primary color.
-   Secondary color.
-   Accent color.
-   Page background.
-   Surface/card background.
-   Main text color.
-   Muted text color.
-   Border color.
-   Link color and hover color.
-   Header background/text.
-   Footer background/text.
-   Sidebar background/text.
-   Button background/text.
-   Focus/active colors where appropriate.

Support hex color inputs and visual color pickers. Validate color values
on the backend. Maintain sufficient contrast and warn about low-contrast
combinations where feasible.

### Typography

-   Font family from an approved font list.
-   Heading font and body font, if supported.
-   Heading sizes.
-   Body text size.
-   Font weight.
-   Line height.
-   Letter spacing.
-   Text alignment.
-   Text transformation where appropriate.
-   Responsive typography presets.

Do not accept arbitrary remote font URLs in the first release. Use a
safe, known font catalog or configured font provider.

### Layout and spacing

-   Content maximum width.
-   Section vertical spacing.
-   Container padding.
-   Grid columns and gap.
-   Text/image proportions for supported layouts.
-   Section alignment.
-   Page-level background.
-   Border radius scale.
-   Shadow presets.
-   Border width/style presets.

### Buttons and links

-   Button shape: square, slightly rounded, pill.
-   Button size presets.
-   Primary/secondary button styles.
-   Hover/focus states.
-   Link underline/hover behavior.

### Global appearance

-   Light/dark/system theme if supported.
-   Background color or approved gradient presets.
-   Header and footer appearance.
-   Optional sidebar design.
-   Logo and favicon.
-   Social link appearance.
-   Site-wide default content width.

## 9.3 Component-level styling

Global theme settings are not enough. Each section should expose a
curated set of local overrides, where relevant:

-   Background/surface.
-   Text color or theme token.
-   Heading alignment.
-   Content alignment.
-   Top/bottom spacing presets.
-   Container width.
-   Image placement.
-   Column ratio.
-   Border/shadow/radius presets.
-   Optional section background image from the media library.

A section can use global defaults or override selected settings. Make
inheritance clear in the inspector, e.g. "Use theme default" versus
"Custom value". Avoid making users manually style every section.

## 9.4 Sidebar customization

If a template uses a sidebar, the owner should be able to configure:

-   Show/hide sidebar.
-   Position: left/right where supported by that template.
-   Width preset or bounded width value.
-   Background and text colors.
-   Link colors and active state.
-   Border/divider.
-   Logo/avatar and profile information.
-   Navigation items and order.
-   Typography and spacing presets.
-   Responsive behavior, including collapse/hide behavior on mobile.

The editor must explain when a layout option is not supported by the
current template. Do not show controls that silently do nothing.

## 9.5 Header and footer customization

Allow supported options for:

-   Logo/text branding.
-   Header/footer background and text colors.
-   Navigation layout and item order.
-   Sticky/static header if implemented.
-   CTA button.
-   Social links.
-   Footer columns or link groups, if supported.
-   Copyright text.
-   Spacing, borders, and alignment.
-   Visibility of selected elements.

Navigation destinations and visible pages are data-driven. Header/footer
styles are stored as configuration.

## 9.6 Theme architecture and storage

Use versioned, validated theme configuration (for example JSONB in
PostgreSQL). Define a typed schema such as:

-   `tokens`: global colors, typography, spacing, radius, shadows.
-   `components`: default styles for header, footer, sidebar, buttons,
    cards, links.
-   `responsive`: supported breakpoint-specific values.
-   `schema_version`: configuration format version.

The exact shape should be finalized during implementation, but it must
be typed and validated. Apply theme tokens through CSS custom properties
or an equivalent controlled mechanism. Do not create arbitrary dynamic
CSS from untrusted input.

Theme changes must affect the draft preview immediately and the public
site only after publication. One portfolio's theme must never change
another portfolio's appearance.

------------------------------------------------------------------------

# 10. Responsive Design

Every public portfolio must support desktop, tablet, and mobile
rendering.

The editor should provide device preview modes. Initial responsive
controls should be curated rather than unrestricted:

-   Section visibility per supported breakpoint, if implemented.
-   Column layout presets.
-   Image placement presets.
-   Typography presets.
-   Spacing presets.
-   Navigation collapse behavior.
-   Sidebar hide/collapse behavior.

Default responsive behavior must be sensible even when a user never
opens advanced settings. Mobile layouts must not overflow horizontally,
hide important content, or require drag-and-drop to operate.

Store only supported responsive overrides. Use documented breakpoints
consistently across editor and renderer.

------------------------------------------------------------------------

# 11. Media Library and Images

-   Upload images through the backend or a controlled upload service.
-   Store files in object storage/S3-compatible storage in production;
    store metadata and storage keys in PostgreSQL.
-   A local development storage adapter is acceptable initially.
-   Validate file size, actual file type, dimensions, and safe storage
    key.
-   Generate filenames/keys rather than trusting user filenames.
-   Support selecting an existing image, replacing it, and reusing it in
    multiple sections.
-   Store alt text, dimensions, MIME type, size, and ownership.
-   Support `cover` / `contain`, crop ratio, focal position where
    practical, caption, and link.
-   Optimize public image delivery and responsive sizes where practical.
-   Prevent users from accessing or deleting another portfolio's private
    media.
-   Define what happens to media referenced by published snapshots
    before deleting it.

Do not store raw image binary data inside page JSON or ordinary
PostgreSQL rows.

------------------------------------------------------------------------

# 12. Save, Preview, Publish, and Versioning

These are separate states and actions.

## 12.1 Draft

The owner edits draft pages, navigation, theme, and sections. Draft
changes are private until published.

## 12.2 Save Draft

-   Persist changes to PostgreSQL.
-   Show saved/error state.
-   Validate data and ownership.
-   Preserve the last published version.
-   Handle stale editor versions safely where practical.

## 12.3 Preview

-   Use the same renderer and theme engine as the public site.
-   Preview the latest draft.
-   Provide desktop/tablet/mobile modes.
-   Require authentication or a secure, expiring preview token.
-   Prevent preview pages from being indexed.
-   Make the "Draft Preview" state unmistakable.

## 12.4 Publish

-   Validate slugs, homepage, navigation destinations, section schemas,
    theme schema, and required configuration.
-   Create an immutable published snapshot or equivalent versioned
    representation.
-   Atomically change the active published version.
-   Record publication time and version.
-   Display the public URL only after success.
-   Do not expose partially saved or invalid content.

## 12.5 Unpublish

-   Remove the portfolio from public rendering or show a deliberate
    unpublished state.
-   Never fall back to returning draft content.
-   Define whether a public URL returns 404, 410, or an unlisted status
    page; document the chosen behavior.

## 12.6 Version history

Full rollback UI is optional for the first release, but publication
snapshots should be designed so version history/restore can be added
later. Published snapshots must not be mutated after creation.

------------------------------------------------------------------------

# 13. Public URLs and Routing

Initial URL scheme:

-   Portfolio home: `/p/{portfolio_slug}`
-   Other page: `/p/{portfolio_slug}/{page_slug}`

Example: `/p/vaibhav-vats/about`

Requirements:

-   Portfolio slugs must be unique under the chosen routing scheme.
-   Page slugs must be unique within a portfolio.
-   Reserve platform paths and blocked slugs.
-   Normalize and validate slugs on the backend.
-   Handle slug changes deliberately; implement redirects if practical.
-   Render only the active published snapshot.
-   Show a branded 404 for missing portfolio/page.
-   Keep unpublished/draft pages private.
-   Provide canonical URLs and page-specific metadata.
-   Do not claim that a new domain/server is created for each user.
    Initially, all portfolios use the same application infrastructure
    with separate routes and data.

**Future feature:** Custom domains such as `www.example.com` require
domain verification, DNS instructions, TLS, host-to-portfolio
resolution, and hosting configuration. This is not part of the first
release.

------------------------------------------------------------------------

# 14. Recommended Technical Architecture

## 14.1 Frontend

-   Next.js App Router.
-   TypeScript strict mode.
-   React.
-   Tailwind CSS and a consistent accessible component system.
-   A maintained drag-and-drop library compatible with the chosen React
    version.
-   Typed API client for FastAPI.
-   Client-side schemas/forms where useful.
-   Server Components for public routes where beneficial; Client
    Components for interactive editor controls.
-   Shared section registry/rendering contracts without duplicating
    business logic in multiple places.

Inspect existing dependencies and compatibility before installing
packages.

## 14.2 Backend

-   FastAPI.
-   Python type hints.
-   Pydantic schemas.
-   SQLAlchemy 2.x or an explicitly chosen consistent ORM.
-   Alembic migrations.
-   PostgreSQL.
-   Secure authentication.
-   Service/query layer enforcing authorization.
-   Consistent error handling and structured logging.
-   Automated unit/API/integration tests.

FastAPI is the authoritative API for persistence, authorization,
validation, publishing, and business rules. Do not move core application
logic into Next.js route handlers.

## 14.3 Suggested repository layout

Adapt to the current repository; do not force a rewrite just to match
this tree.

``` text
portfolio-builder/
  PROJECT_SPEC.md
  README.md
  .env.example
  web/
    src/
      app/
        (auth)/
        admin/
        p/[portfolioSlug]/
      components/
        admin/
        builder/
        portfolio/
        ui/
      lib/
        api/
        schemas/
        auth/
      types/
  api/
    app/
      main.py
      core/
      db/
      models/
      schemas/
      services/
      api/routes/
      tests/
    alembic/
  docs/
```

------------------------------------------------------------------------

# 15. Initial Data Model

Finalize after repository inspection, preserving the concepts and
ownership rules below.

## 15.1 `users`

-   `id`
-   `email` (unique)
-   `password_hash` or external identity reference
-   `display_name`
-   `is_active`
-   `created_at`, `updated_at`

## 15.2 `portfolios`

-   `id`
-   `owner_id` → users
-   `name`
-   `slug`
-   `status`
-   `settings_json`
-   `created_at`, `updated_at`
-   `published_at`
-   optional `current_published_version_id`

Enforce slug uniqueness at the correct platform scope.

## 15.3 `pages`

-   `id`
-   `portfolio_id`
-   `title`
-   `slug`
-   `is_homepage`
-   `is_visible`
-   navigation visibility flags if these are not fully represented by
    navigation records
-   `status`
-   `sort_order`
-   SEO title/description
-   timestamps

Enforce one homepage per portfolio and unique page slugs within a
portfolio. A page's publication state and navigation visibility are
distinct concepts.

## 15.4 `page_sections`

-   `id`
-   `page_id`
-   `section_type`
-   `name`
-   `sort_order`
-   `is_visible`
-   `content_json`
-   `layout_json`
-   `schema_version`
-   timestamps

Validate content and layout against the registered section type.

## 15.5 `navigation_items`

-   `id`
-   `portfolio_id`
-   `location` (`header`, `footer`, `sidebar`)
-   `label`
-   `destination_type` (`page`, `external_url`, or approved anchor)
-   `page_id` nullable
-   `external_url` nullable
-   `sort_order`
-   `is_visible`

Validate destination consistency, ownership, and allowed URL schemes.

## 15.6 `theme_configs` or portfolio theme fields

-   `id`
-   `portfolio_id`
-   `config_json`
-   `schema_version`
-   timestamps

One clear canonical theme configuration should be chosen; avoid multiple
conflicting sources of truth.

## 15.7 `media_assets`

-   `id`
-   `portfolio_id`
-   `storage_key`
-   `original_filename`
-   `mime_type`
-   `size_bytes`
-   `width`, `height`
-   `alt_text`
-   timestamps

## 15.8 `portfolio_versions`

-   `id`
-   `portfolio_id`
-   `version_number`
-   `snapshot_json` or equivalent immutable snapshot
-   `published_by`
-   `published_at`

The snapshot must contain the configuration needed to render the
published site consistently: pages, sections, navigation, theme, global
layout, and referenced media identifiers/URLs as appropriate.

## 15.9 Optional later tables

-   `projects`
-   `experience_entries`
-   `skills`
-   `custom_domains`
-   `redirects`
-   `contact_submissions`
-   `audit_events`
-   `template_definitions`

Do not build every optional table before the core
create-edit-preview-publish flow works.

------------------------------------------------------------------------

# 16. Proposed API Surface

The exact routes can adapt to existing conventions, but equivalent
functionality is required.

## Authentication

-   `POST /auth/register` if registration is enabled.
-   `POST /auth/login`
-   `POST /auth/logout`
-   `GET /auth/me`

## Portfolios

-   `GET /portfolios`
-   `POST /portfolios`
-   `GET /portfolios/{portfolio_id}`
-   `PATCH /portfolios/{portfolio_id}`
-   `DELETE /portfolios/{portfolio_id}`
-   `POST /portfolios/{portfolio_id}/publish`
-   `POST /portfolios/{portfolio_id}/unpublish`

## Pages and sections

-   `GET /portfolios/{portfolio_id}/pages`
-   `POST /portfolios/{portfolio_id}/pages`
-   `GET /pages/{page_id}`
-   `PATCH /pages/{page_id}`
-   `DELETE /pages/{page_id}`
-   Endpoints for section create/update/delete/reorder or an atomic
    ordered configuration save.

## Navigation, theme, global layout

-   `GET/PUT /portfolios/{portfolio_id}/navigation`
-   `GET/PUT /portfolios/{portfolio_id}/theme`
-   `GET/PUT /portfolios/{portfolio_id}/global-layout`

## Media

-   `POST /portfolios/{portfolio_id}/media`
-   `GET /portfolios/{portfolio_id}/media`
-   `PATCH /media/{media_id}`
-   `DELETE /media/{media_id}`

## Templates

-   `GET /templates`
-   Optional template detail endpoint.
-   Applying a template must have explicit, validated behavior and must
    not silently destroy existing custom content.

## Preview and public rendering

-   Authenticated preview endpoint or secure expiring preview-token
    flow.
-   Public portfolio endpoint resolved by slug.
-   Public page endpoint resolved by portfolio slug and page slug.

All public endpoints return published data only. Protected endpoints
verify ownership on every request.

------------------------------------------------------------------------

# 17. Security, Privacy, and Reliability

-   Hash passwords with a modern algorithm.
-   Define secure session/token lifecycle, expiry, revocation, and
    browser storage.
-   Use HTTP-only secure cookies and CSRF protection when using cookie
    sessions.
-   Enforce ownership on every portfolio-scoped API operation.
-   Test against insecure direct object reference (IDOR).
-   Use parameterized ORM operations.
-   Sanitize rich text and validate external URLs.
-   Never execute arbitrary user HTML, JavaScript, or CSS.
-   Restrict file types, sizes, dimensions, and storage paths.
-   Rate-limit login and public contact submissions where appropriate.
-   Avoid logging secrets or private form content.
-   Configure explicit CORS origins.
-   Keep admin and draft preview out of search indexes.
-   Use transactions for multi-record saves and publishing.
-   Make public snapshots immutable.
-   Ensure a failure during publishing leaves the previous published
    version intact.
-   Define portfolio/media deletion and retention behavior.
-   Add tests proving User A cannot read/edit/publish/delete User B's
    resources.

------------------------------------------------------------------------

# 18. SEO, Accessibility, Performance, and UX

## SEO

-   Per-page title and description.
-   Canonical URLs.
-   Open Graph/social preview metadata.
-   Sitemap and robots behavior based on published status.
-   No indexing of drafts or private preview links.
-   Semantic heading hierarchy and meaningful alt text.

## Accessibility

-   Keyboard alternatives for drag-and-drop.
-   Visible focus states and accessible labels.
-   Sufficient color contrast; warn about risky combinations where
    practical.
-   Accessible dialogs, menus, forms, and error messages.
-   Do not rely on color alone to communicate state.

## Performance

-   Optimize images and responsive sizes.
-   Avoid shipping the full admin builder bundle to public visitors
    unnecessarily.
-   Cache published data where safe, with reliable invalidation on
    publish/unpublish.
-   Prevent stale published content after a successful publication
    beyond the documented cache window.
-   Add pagination for growing lists.

## UI quality

-   Professional and uncluttered admin UI.
-   Clear Save Draft, Preview, Publish, and Unpublish actions.
-   Loading, empty, success, and error states.
-   Confirmation for destructive actions.
-   No dead controls or fake save states.
-   Responsive editor layout.
-   Clear indication of which portfolio and page are being edited.

------------------------------------------------------------------------

# 19. Testing and Acceptance Criteria

The product is not complete merely because a sample homepage looks good.

## 19.1 Multi-user isolation

-   User A can create and manage their portfolio.
-   User B can create and manage their own portfolio.
-   User A cannot read, edit, publish, or delete User B's portfolio by
    changing an ID or slug in a protected request.
-   Media, pages, navigation, themes, and snapshots are
    ownership-checked.
-   Public visitors see only published content.

## 19.2 Data-driven builder

-   Creating a page through the UI persists it in PostgreSQL.
-   The page list and navigation are fetched from the API/database, not
    fixed frontend arrays.
-   Editing heading, description, image, link, color, font, spacing, and
    supported layout settings persists after refresh.
-   Section reordering persists and is reflected in preview/public
    output.
-   Adding a new supported section type requires no user-specific page
    code.
-   Theme changes to one portfolio do not affect another portfolio.
-   Sidebar/header/footer styling changes appear in preview and after
    publication.

## 19.3 Draft and publish

-   Save Draft persists without changing the public site.
-   Preview reflects the latest draft.
-   Publish creates a new immutable version.
-   Public pages show the active published version.
-   Invalid publication is rejected with useful errors.
-   Unpublish never reveals draft content.
-   Failed publication leaves the previous published version intact.

## 19.4 Routing and customization

-   Multiple portfolios render correctly under unique slugs.
-   Each portfolio can have independent pages, navigation, theme, and
    global layout.
-   Page slugs are unique within a portfolio.
-   Missing pages show a designed 404.
-   Mobile layouts work without horizontal overflow.
-   Header/footer/sidebar settings follow the saved configuration.

## 19.5 Quality gates

-   Backend tests pass.
-   Frontend lint, type-check, and production build pass.
-   Migrations work on a clean database.
-   README explains setup, migrations, test commands, and how to run
    both apps.
-   `.env.example` contains names/placeholders, not secrets.
-   At least one automated integration/E2E test covers: create account →
    create portfolio → edit page/section/theme → save → preview →
    publish → open public URL.

------------------------------------------------------------------------

# 20. Implementation Roadmap

Implement in phases. Each phase must pass its exit criteria before
expanding scope.

## Phase 0 --- Repository audit

-   Inspect repository and current implementation.
-   Record runtime versions, packages, database, migrations, routes,
    tests, and UI.
-   Identify existing work, gaps, and risks.
-   Run baseline checks where possible.

**Exit criteria:** Written repository map, gap analysis, and phased
plan. No unnecessary code edits.

## Phase 1 --- Foundation and authentication

-   Configure Next.js, FastAPI, PostgreSQL, environment variables, and
    Alembic.
-   Implement registration/login/session strategy if not already
    present.
-   Implement users and ownership authorization.
-   Add tests for protected resources.

**Exit criteria:** Secure sign-in, database connectivity, migrations,
and ownership tests.

## Phase 2 --- Multi-portfolio management

-   Allow users to create and list portfolios.
-   Add portfolio settings and unique slug validation.
-   Build dashboard and portfolio switcher.
-   Create editable starter pages as database records.

**Exit criteria:** Two different users can create portfolios without
seeing or modifying each other's data.

## Phase 3 --- Page and navigation management

-   Implement page CRUD, page ordering, homepage assignment, slug
    validation, and visibility.
-   Implement header/footer/sidebar navigation data.
-   Build admin Pages and Navigation screens.

**Exit criteria:** Page names and navigation are fully database-driven
and manageable through UI.

## Phase 4 --- Section engine and visual editor

-   Build typed section registry and validators.
-   Implement section library, inspector,
    add/reorder/duplicate/delete/hide.
-   Implement starter section types.
-   Persist configuration and display draft preview.

**Exit criteria:** A user can build and rearrange a multi-section page
without editing code.

## Phase 5 --- Theme and Design Studio

-   Implement versioned theme schema and design tokens.
-   Add color, typography, spacing, button, card, and background
    controls.
-   Add section-level style overrides and inheritance.
-   Implement supported header/footer/sidebar customization.
-   Add template selection and safe application behavior.

**Exit criteria:** Two portfolios can use different themes and layouts.
Changes persist and do not leak across portfolios.

## Phase 6 --- Media library and responsive controls

-   Implement secure upload, media selection, alt text, image fit/crop,
    and reuse.
-   Add desktop/tablet/mobile preview and supported responsive
    overrides.
-   Test mobile public output.

**Exit criteria:** Images and responsive settings work end-to-end.

## Phase 7 --- Save, preview, publish, and snapshots

-   Implement reliable draft save.
-   Implement protected preview.
-   Implement publication validation and immutable snapshots.
-   Implement publish/unpublish and status UI.

**Exit criteria:** Draft and published content remain separate, and
publication is atomic.

## Phase 8 --- Public website renderer

-   Implement `/p/{portfolio_slug}` and
    `/p/{portfolio_slug}/{page_slug}`.
-   Render pages, sections, theme, navigation, and global layout from
    published data.
-   Add SEO metadata, 404 behavior, and caching/invalidation.

**Exit criteria:** Multiple independent portfolios work as real public
multi-page websites.

## Phase 9 --- Hardening and release

-   Complete security and isolation tests.
-   Review accessibility, performance, responsive behavior, error
    states, and documentation.
-   Verify fresh-install migrations and production build.
-   Test the full create → customize → preview → publish journey.

**Exit criteria:** Core acceptance criteria pass and a new developer can
set up the project from the README.

## Future roadmap, not required for first release

-   Custom domains and DNS verification.
-   Billing/subscriptions and usage limits.
-   Advanced version history/restore UI.
-   Collaboration and additional roles.
-   Contact-form inbox and email notifications.
-   Blog/CMS and analytics.
-   More templates and section types.
-   Custom code injection, if ever considered, requires a separate
    security design and must not be casually added.

------------------------------------------------------------------------

# 21. Definition of Done

A feature is complete only when:

1.  UI is implemented and responsive.
2.  Backend validation and authorization are implemented.
3.  Data persists correctly in PostgreSQL.
4.  Alembic migrations exist for schema changes.
5.  Loading, empty, success, and error states work.
6.  Relevant tests cover success and failure cases.
7.  Lint/type-check/build and backend checks are run as applicable.
8.  No secrets, unsafe execution paths, or debug bypasses are
    introduced.
9.  The feature is checked against this document.
10. Completion report lists exact files, commands, outcomes, and
    limitations.

------------------------------------------------------------------------

# 22. Initial Product Decisions

Unless the owner explicitly changes them, use these defaults:

-   Product is a multi-user, multi-portfolio visual website builder.
-   Next.js is the frontend and public rendering layer; FastAPI is the
    authoritative backend; PostgreSQL is the source of truth for
    editable data.
-   Portfolio content, page lists, navigation, theme, global layout, and
    section configuration are data-driven.
-   Shared engine/components are implemented in code; individual user
    sites are not separately hardcoded.
-   Use a section-based visual builder rather than arbitrary free-form
    canvas.
-   Default pages are editable starter data, not fixed code.
-   Use `/p/{portfolio_slug}` and `/p/{portfolio_slug}/{page_slug}`
    initially.
-   Keep draft and published versions separate.
-   Use a typed, versioned section registry and theme schema.
-   Store uploaded media outside PostgreSQL in production and metadata
    in PostgreSQL.
-   Each portfolio has independent theme/layout settings.
-   Custom domains, billing, collaboration, analytics, and advanced
    version restore are future features unless reprioritized.
-   Never silently overwrite user content when applying templates or
    publishing.
-   Do not claim a feature exists until code and tests demonstrate it.

------------------------------------------------------------------------

# Final instruction

This file is the canonical product and engineering reference. Read it
before starting any feature. Inspect the repository rather than assuming
its state. Build incrementally, keep all user-specific portfolio content
and supported customization data-driven, and ensure that every completed
phase is verified against the acceptance criteria. If an approved
product decision changes the specification, update this file
deliberately and keep implementation, tests, and README aligned.


---

# 23. Code Quality, Maintainability, and Clean Architecture Standards

These standards apply to every frontend, backend, database, test, and configuration change. The goal is production-minded code that is readable, reusable, easy to test, and straightforward for another developer or AI model to understand.

## 23.1 General coding principles

- Write clean, readable, maintainable code. Prefer clarity over cleverness.
- Keep functions, components, modules, and classes focused on one clear responsibility.
- Follow **DRY** (Don't Repeat Yourself), but do not create abstractions for code that is not genuinely repeated or likely to vary.
- Follow **KISS** (Keep It Simple) and **YAGNI** (You Aren't Gonna Need It). Do not build speculative frameworks or future features before they are needed.
- Avoid unnecessary code, duplicate logic, dead code, unused imports, unused variables, commented-out old implementations, and redundant dependencies.
- Do not add abstractions, wrappers, hooks, services, factories, or generic utilities without a clear benefit.
- Prefer explicit and predictable behavior over hidden side effects.
- Use meaningful names for files, functions, components, variables, database fields, and API schemas.
- Keep modules small enough to understand, but do not split every few lines into a separate file without a reason.
- Avoid giant files, giant components, deeply nested conditionals, and functions that perform unrelated work.
- Use early returns and small helper functions where they make logic easier to follow.
- Keep business logic separate from UI presentation and database access.
- Never duplicate the same business rule independently across the frontend and backend. The backend is authoritative; frontend validation may mirror rules for usability.
- Do not change unrelated code while implementing a focused feature.
- Do not suppress errors or type errors just to make a build pass.
- Do not use `any`, broad exception handling, or type-ignore comments as a shortcut. When an exception is necessary, keep it narrow and explain why.
- Do not leave TODO/FIXME markers for work that the task claims to complete. If something is intentionally deferred, report it clearly.
- Add comments for non-obvious reasoning, constraints, or trade-offs—not comments that merely restate the code.
- Keep formatting and lint rules consistent with the existing project. Do not introduce competing formatters or style conventions without a reason.

## 23.2 Reusable frontend architecture

- Build reusable components for genuinely shared UI patterns such as buttons, form fields, dialogs, navigation items, loading states, error states, and empty states.
- Keep shared UI components generic enough for reuse but not overloaded with many unrelated boolean props.
- Keep portfolio section renderers separate by section type. Avoid one enormous component containing every possible section and styling condition.
- Use a central, typed section registry to connect section type IDs with their schema, editor controls, default configuration, and renderer.
- Reuse the same rendering logic for draft preview and published portfolio pages wherever possible, with explicit data/status differences.
- Keep admin components separate from public portfolio components. Public routes should not load the full builder/editor unnecessarily.
- Separate API communication into a consistent client/service layer instead of scattering raw `fetch` calls across components.
- Keep shared TypeScript types and validation schemas in predictable locations. Avoid copying the same interface into multiple files.
- Use custom React hooks only when they encapsulate meaningful reusable stateful behavior. Do not create a hook for a trivial one-line expression.
- Keep component state local unless it must be shared. Avoid adding global state management without a demonstrated need.
- Avoid prop drilling with complex workarounds; introduce context or a state library only when the actual data flow warrants it.
- Use stable keys for lists and section IDs. Never use array indices as identity for reorderable sections.
- Prefer semantic HTML and accessible controls over custom clickable elements.
- Keep responsive styling consistent and use a documented design-token/breakpoint system.
- Avoid repeated inline style objects or duplicated Tailwind class strings where a clear shared abstraction improves maintainability. Do not create abstractions solely to shorten a class string.
- Keep UI states explicit: loading, empty, saving, saved, validation error, API error, and success.

## 23.3 Reusable backend architecture

- Organize FastAPI code by clear responsibility: API routes, request/response schemas, services/business logic, database models, and shared infrastructure.
- Route handlers should remain thin: parse/validate requests, call the appropriate service, and return a response.
- Keep complex business rules in service/domain functions rather than embedding them in route handlers or ORM model callbacks.
- Keep database queries and transaction boundaries explicit.
- Use Pydantic schemas for request and response contracts. Do not return ORM objects blindly.
- Use type hints for function inputs, outputs, and important data structures.
- Use dependency injection for shared concerns such as the database session and authenticated user, following the existing project pattern.
- Use consistent error types and HTTP status codes. Do not expose stack traces, SQL details, or secrets in API responses.
- Catch only exceptions that can be handled meaningfully. Do not catch every exception and return success or a generic empty response.
- Use transactions for multi-record changes such as saving page sections, applying a template, and publishing a snapshot.
- Avoid N+1 query patterns when loading pages, sections, navigation, and media.
- Use pagination for potentially large collections.
- Keep external-service calls (such as media storage) behind a small, clear interface only when this enables configuration, testing, or a real alternate implementation.
- Do not introduce repository/service/factory layers mechanically if they add indirection without improving the current codebase.

## 23.4 Database and migration standards

- Use consistent naming for tables, columns, constraints, indexes, foreign keys, and migrations.
- Add foreign keys, uniqueness constraints, indexes, and check constraints where they enforce real invariants.
- Enforce important integrity rules in PostgreSQL as well as application code when appropriate.
- Use transactions for logically atomic changes.
- Avoid duplicate columns or duplicate sources of truth for the same setting.
- Do not store values in JSONB merely because it is flexible if the values need relational constraints, joins, or reliable querying. Use JSONB for validated, versioned configuration where it is appropriate.
- Keep JSON configuration schemas versioned and validate them before saving and rendering.
- Write reversible migrations where practical and inspect generated migrations before applying them.
- Never edit an already-applied migration casually. Add a new migration for subsequent schema changes.
- Do not use production data as test fixtures.
- Ensure tests can run against a separate test database and do not accidentally mutate a developer's or production database.
- Keep seed/demo data clearly separated from migrations and production secrets.

## 23.5 Portfolio builder-specific design rules

- Treat the section registry as the single source of truth for supported section types.
- Each section type should have a clear content schema, layout schema, defaults, editor controls, validation, and renderer.
- Avoid duplicating a section's default configuration in multiple unrelated places.
- Keep theme tokens separate from section content. A section may inherit global theme tokens and optionally override supported values.
- Keep page content, navigation, theme, global layout, and publication state logically separate, even if some data is stored together in a validated snapshot.
- Use stable IDs for pages, sections, media, and navigation records.
- Keep draft editing and published snapshots separate. Do not mutate published snapshots in place.
- Make template application explicit and safe. Do not silently destroy existing user customizations.
- Keep user content out of source-code conditionals. Do not add conditions such as `if portfolio_slug == "vaibhav-vats"` to customize an individual site.
- Avoid portfolio-specific CSS selectors or one-off components when the same result can be represented through the supported theme/layout configuration.
- Do not create a new page component in code for every page a user creates. Pages should be data records rendered by the shared page renderer.
- Do not make navigation depend on a hardcoded list of page names.
- If a style option is shown in the editor, it must be validated, persisted, previewed, and applied to the published site. Remove controls that do not work yet or label them clearly as unavailable.
- Keep the public renderer defensive: invalid or unknown configuration should fail safely and be observable through appropriate logs, without exposing private information.

## 23.6 Type safety and validation

- Use TypeScript strict mode and avoid `any` wherever possible.
- Define explicit API request/response types.
- Use discriminated unions for section types and other data that has multiple valid shapes.
- Validate all untrusted backend input with Pydantic or an equivalent server-side validator.
- Validate theme colors, sizes, layout values, URLs, section types, and configuration shapes against allowlists/ranges.
- Do not rely on client-side validation for security.
- Avoid unsafe casts and unchecked assumptions about API response data.
- Prefer clear typed helper functions over repeated unsafe object access.
- Treat database values and published JSON as potentially invalid until validated against the expected schema/version.

## 23.7 Error handling, logging, and observability

- Show users helpful, non-technical error messages while preserving useful diagnostic detail in server logs.
- Never silently swallow errors.
- Never report a save or publish success if the backend operation failed.
- Include enough context in logs to debug failures without logging passwords, access tokens, secrets, or sensitive form content.
- Use consistent request/error logging and avoid noisy logs for expected user validation errors.
- Handle expected failures such as duplicate slugs, missing pages, unauthorized access, invalid sections, upload errors, and publish validation failures explicitly.
- Use loading, retry, and error UI states where appropriate.
- Do not add a large observability stack before the application's needs justify it.

## 23.8 Testing standards

- Test business rules and failure cases, not only the happy path.
- Keep unit tests focused and fast; use integration tests for database/API behavior and end-to-end tests for critical user journeys.
- Test ownership boundaries, invalid input, duplicate slugs, section ordering, theme validation, media authorization, and publication behavior.
- Avoid brittle tests that depend on internal implementation details when behavior can be tested instead.
- Use factories/fixtures for repeatable test data. Do not copy large setup blocks into every test.
- Keep tests independent and clean up test data.
- Do not weaken or delete a test merely to make a change pass; fix the underlying issue or explain why the expected behavior changed.
- Run targeted tests during development and the relevant full suite before reporting completion.
- Report skipped tests and environmental blockers honestly.

## 23.9 Dependencies and configuration

- Before adding a dependency, check whether existing libraries already solve the problem.
- Add only maintained, compatible dependencies that provide clear value.
- Avoid multiple libraries for the same purpose.
- Do not upgrade unrelated packages during a feature task without a clear need.
- Keep frontend and backend configuration explicit and documented.
- Use `.env.example` with placeholder values and never commit real `.env` files or credentials.
- Do not add local machine paths, personal tokens, or machine-specific assumptions to committed code.
- Keep development-only tools and debug endpoints out of production behavior.

## 23.10 Performance without premature optimization

- Avoid unnecessary client-side JavaScript on public portfolio pages.
- Avoid repeated API requests, redundant database queries, and unbounded list endpoints.
- Use image optimization, pagination, caching, and lazy loading where appropriate.
- Do not add complicated caching or premature micro-optimizations before identifying a real bottleneck.
- When performance matters, measure or profile before making speculative changes.
- Ensure publish/unpublish invalidates any relevant public cache reliably.

## 23.11 Refactoring and code-change discipline

Before refactoring:

1. Identify the concrete problem (duplication, complexity, bug risk, poor testability, or performance).
2. Keep the refactor scoped to that problem.
3. Preserve externally visible behavior unless a behavior change is explicitly intended.
4. Add/update tests for affected behavior.
5. Run the relevant checks.
6. Explain why the refactor improves the code.

Do not refactor the entire project just because a file could be organized differently. Prefer small, incremental improvements.

## 23.12 Code review checklist

Before declaring a task complete, check:

- Is the code readable and appropriately named?
- Is logic reused where it genuinely should be?
- Did we avoid unnecessary abstractions and dependencies?
- Is business logic separated from UI and database access?
- Are types and server-side validation correct?
- Are authentication and ownership checks enforced?
- Are database changes covered by migrations?
- Are errors handled rather than hidden?
- Are loading/empty/error states covered?
- Are tests meaningful and passing?
- Did we avoid changing unrelated files?
- Does the implementation follow this specification?
- Can another developer or AI model understand and continue this code without reverse-engineering unnecessary complexity?

---

# 24. Repository Hygiene and Developer Experience

- Keep folder names and module boundaries predictable.
- Maintain a useful README with prerequisites, setup, environment variables, migrations, seed instructions, test commands, and frontend/backend run commands.
- Keep `.env.example` up to date whenever configuration variables change.
- Use consistent scripts for linting, type checking, tests, and production builds.
- Ensure generated files, caches, local databases, secrets, build outputs, and dependency folders are appropriately ignored by Git.
- Do not commit temporary debugging scripts, exported personal data, local logs, or generated artifacts unless they are intentional project assets.
- Keep API documentation and frontend types aligned with actual backend contracts.
- Document non-obvious architecture decisions briefly in the relevant code or a `docs/` note.
- Prefer a small number of clear setup steps over complicated local setup.
- Avoid adding documentation that merely duplicates code without explaining intent, setup, constraints, or behavior.
- Keep PR/commit scope focused when Git is used; avoid bundling unrelated formatting and feature changes.
