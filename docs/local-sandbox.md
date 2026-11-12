# Isolated local DB, Auth and Storage

Prepared and verified 2026-11-12 on macOS arm64. No hosted Supabase operation,
production data export, real-user copy, OAuth setting change or paid service was
used. The production-connected local server was stopped and its two public
settings preserved privately outside Git. The active `.env.local` now points
only to local Supabase and has mode 0600.

## Running services

- App: http://127.0.0.1:3100
- Local email/password login and test account signup: http://127.0.0.1:3100/local-test
- Synthetic vehicle: http://127.0.0.1:3100/car/123가4567
- Review form: http://127.0.0.1:3100/car/123가4567/review
- Local Supabase API: http://127.0.0.1:54321
- Local Studio (test data only): http://127.0.0.1:54323
- Local test mailbox: http://127.0.0.1:54324

Create an invented test account on `/local-test` with an email/password of your
choice. Do not enter real member information. A generated test account is also
stored in the private parent `local-test-account.json`; its password is not in
Git, documentation, logs or this page. The normal Google/Kakao OAuth flow is
not configured locally. Use `/local-test` for local Auth validation.

## Start and stop

Run these commands from the repository:

```sh
python3 scripts/local-sandbox/manage.py status
python3 scripts/local-sandbox/manage.py start
python3 scripts/local-sandbox/manage.py app
```

`app` starts the Node22 development server on loopback port 3100. Stop that
foreground server with Ctrl+C. Stop the backend separately when finished:

```sh
python3 scripts/local-sandbox/manage.py stop
```

The backend stores data in the sibling `../supabase-home/` and keeps it across
stop/start. Do not delete those directories unless you intentionally want to
remove the synthetic local database and uploads. These scripts never support
remote push/pull/link or a hosted database URL. No global Docker/Node install
was made. Local processes and about 1.5 GB of downloaded service artifacts are
kept in the project work directory.

## Recreate on this Mac / bootstrap audit

The project-local CLI is Supabase 3.1.0, with a separate `pg` client under
`../supabase-tools`; app dependencies and root package-lock.json were unchanged.
Docker, Podman, Colima and existing Supabase were absent. The official
experimental native runtime was used instead, with SUPABASE_HOME pointing to
`../supabase-home`. Auth, Postgres, REST, Storage, Studio and Mail are enabled;
Realtime, Functions, Analytics and Pooler are not needed and were excluded.

For an empty local backend only:

```sh
python3 scripts/local-sandbox/manage.py prepare
python3 scripts/local-sandbox/manage.py start
python3 scripts/local-sandbox/manage.py seed
python3 scripts/local-sandbox/manage.py app
```

`prepare` copies only SQL and a local config template to `../local-backend`.
It does not copy tracked `supabase/.temp` linked-project/pooler metadata.
Never use the repository's linked CLI metadata for this local workflow.

The repository contains 48 incremental migrations but no initial migration or
local config. `schema.sql` cannot be applied naively before them: it has a
user_id/legacy author_id inconsistency on community_posts and newer function
signatures. The local bootstrap extracts its nine table definitions, provides
the legacy author_id compatibility column, and then applies all 48 migrations.
Two local-only function drop/recreate shims handle changed signatures for
set_review_helpful_count and public_get_recent_home_reviews. The original
schema.sql and all original migrations remain unchanged. Initial failed local
bootstrap instances contained no users and were recreated before seeding.

`seed` applies explicit local-only RLS and review-images policies that otherwise
belong to the missing bootstrap, inserts one invented vehicle, and provisions a
synthetic ordinary user. It checks all DB/API endpoints are loopback first.
The tested local schema is a reconstruction, not a claim of exact production
schema parity. Storage includes review-images and community-images; no real
files or catalog/vehicle data were imported from production.

## Safety and mocks

`manage.py app` refuses a nonlocal DB or a missing sandbox flag and loads a
server network guard allowing only loopback plus read-only Google font assets.
Production Supabase/API endpoints are not allowed. Local analytics loading and
IndexNow submissions are disabled. Auth, RLS and Storage are real local services,
not mock implementations. Do not start the old production-reference runner.

The vehicle-history handler (also shared by commercial-plate) returns only the
synthetic fixture for 123가4567 when NODE_ENV=development, the explicit local
sandbox flag is enabled and the Supabase URL is loopback. It validates a real
local Auth token first. Unknown vehicles return 404 and missing sessions 401.
The fixture is marked mock:true and no paid API is contacted. Production mode,
missing flag and a hosted Supabase URL cannot enable this path. Other paid
network calls are blocked by the local server network guard.

Do not use `npm run build` with these local flags: the sandbox feature is
intentionally development-only, and the original production URL validator is
unchanged. Node22 dev server + TypeScript/lint checks were used for this setup.

## Verified

```sh
sh scripts/with-project-node.sh node scripts/local-sandbox/check.cjs
sh scripts/with-project-node.sh node scripts/local-sandbox/browser-check.cjs
```

The browser check uses a separately installed parent browser-tools/playwright-core
and Chrome; it blocks all nonlocal requests and uses only the generated local
account. It creates a synthetic review, edits it and soft-deletes it.

- Native backend ready; 49 applied migrations including local bootstrap.
- Real local Auth signup, password login, invalid password rejection and logout.
- Anonymous review insertion rejected; authenticated insert and update persist.
- Other test user cannot edit or delete the first user's review.
- Author deletion uses the application's hide_review RPC; hidden review is not
  returned publicly. This is a soft delete, matching application behavior.
- Storage upload/download and owner deletion pass; other user deletion denied.
- Vehicle mock rejects missing Auth and succeeds with local Auth.
- Browser login → actual review form registration → edit → delete → logout pass;
  zero page JavaScript errors. Images were separately verified via local SDK;
  browser image compression/upload UI was not tested.
- Sandbox gate matrix: production, hosted URL or missing flag disables mocks.
- TypeScript passes, lint 0 errors/20 pre-existing warnings, whitespace passes.

Real OAuth, live vehicle data and paid providers remain intentionally untested.
No production server, DB, Auth or Storage setting was changed. This native CLI
runtime is experimental; use the documented management commands and keep the
existing local state separate from any future container runtime.
