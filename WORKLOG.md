# CARFACT development verification

## 2026-11-12 — normal production build completed

Branch: `dev/carfact-2026-11-12`.
Runtime: project-local Node.js 22.23.0 / npm 10.9.8, using
`sh scripts/with-project-node.sh`.

### Environment and network scope

Only NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are stored in
local .env.local (0600, Git ignored and untracked). No values, service-role key,
returned database data, or other production secrets are included in this log.

The previous font failure came from our own sandbox-exec outbound deny rule and
Node network-deny test preload. For this run that blanket deny was removed,
and the execution environment allowed the required networking. No unresolved
platform network limitation was observed. There was no need to localize fonts
or alter sitemap/cache policy.

A replacement Node preload allowed HTTPS Google Fonts resources and only GET
requests for the existing sitemap queries to vehicles, reviews, community_posts
with limit 5000 on the configured public Supabase project. Other fetch and
low-level HTTP(S) operations, including DB writes and paid vehicle API calls,
were denied. Native Turbopack font fetching was permitted. Only table names and
HTTP status were logged, never response bodies or credential values.

### Results

- Normal `npm run build` passed with VERCEL_ENV removed, no preview mode and no
  changes to the environment validator. NEXT_TELEMETRY_DISABLED=1.
- Compile passed; TypeScript passed; all 24 static pages generated.
- Exactly three sitemap public SELECTs were permitted, each returned HTTP 200.
- Existing sitemap output and 1-hour revalidation remained unchanged.
- package-lock.json remained unchanged; .env.local and .next remain Git ignored.
- Local `npm start -- --hostname 127.0.0.1 --port 3100` started successfully.
- Isolated Chrome: home `/`, lookup `/lookup`, login `/login` all HTTP 200 and
  zero page JavaScript errors; screenshots visually checked.
- Home and lookup: empty/invalid plates keep submit disabled, invalid format
  shows validation feedback, valid-format input enables submit. No vehicle
  lookup submitted.
- Home login link navigates to login; Kakao and Google buttons are enabled with
  the configured public variables. Neither OAuth button was clicked.

For UI checks a fresh browser context blocked external traffic and all API/write
requests, mocked page-view recording as not recorded, and mocked maintenance
status as disabled. Thus home live data, real maintenance state and backend
integration are not part of this UI result. This avoids production analytics or
other writes. No OAuth login, vehicle API call, data creation/deletion, deployment,
production server setting/process change, or DB/Storage change was performed.
The local verification server was stopped after the checks.

### Evidence and remaining scope

Sanitized build/server/browser logs and screenshots remain outside Git in the
local parent work directory: build-general-allowed.log, server-general.log,
browser-general.log, browser-general.json, screenshots-general/.
They were checked for absence of the copied environment values.

Actual OAuth completion, vehicle-history API behavior, authenticated writes,
Storage operations, live home data, and live maintenance behavior remain
unverified. KOTSA server configuration/certificates are intentionally absent
from this developer clone. Earlier lint result remains 0 errors / 20 existing
warnings. No application-code, font, dependency, sitemap, or cache change was
needed; this commit records the verification results only.

## 2026-11-12 — isolated functional sandbox

Replaced the active production-public local environment with a separate native
Supabase DB/Auth/Storage on loopback. No production data or real accounts copied.
Docker/CLI were absent; installed CLI 3.1.0 in a sibling tool folder and used
SUPABASE_HOME inside the work directory. Initial local-only bootstrap errors
were resolved with a table-only baseline, legacy author_id compatibility and
two drop/recreate shims; originals remain unchanged. All 49 local migrations
applied. Synthetic account/vehicle and local RLS/Storage policies seeded.

Added development+explicit flag+loopback guarded local Auth page and authenticated
vehicle fixtures; production conditions cannot enable them. Disabled local GA
and IndexNow. Server networking is restricted to local services and font assets.
No new paid service or OAuth setting is needed. Local services remain running.

Local Auth, invalid credentials, review insert/update/soft-delete and RLS negative
checks passed; Storage upload/download/owner-delete and other-user denial passed.
Browser actual login/register-review/edit/delete/logout passed with zero page
errors. Fixed a fixture-only inspection vs inspections property mismatch found
by the first UI check. TypeScript/lint pass (20 existing warnings).
See docs/local-sandbox.md for URLs, restart/stop and limits. Credentials and
runtime status remain private outside Git. Real OAuth/paid APIs/production data
are intentionally untested. Browser image upload UI not covered; SDK Storage is.

Local synthetic-account signup UI also passed; the reusable management app launcher was verified.

## 2026-11-12 — final sandbox security/build review

Split local login into a server-gated page (404 outside local development) and
client form. Added a private CARFACT_LOCAL_SANDBOX flag and server-only import
boundary; shared vehicle route and fixture each check it. Browser query/body/
headers/cookies do not affect process flags. Production gate test and actual
production HTTP checks passed: /local-test 404; injected mock API request 401,
no mock response.

Added full local DB/REST/Auth/Storage/service URL validation, inherited endpoint
override checks, app-origin consistency and exact local key matching. App launch
and server preload both enforce it; seed validates before writing. Remote/mixed
endpoint and key negative tests, including real launcher refusal, passed.

Read-only production-checkout SQL hashes match all 49 local original SQL files.
Live production DB catalog not audited. docs/local-schema-parity.md records
source-shared behavior, stricter/different local policies and untested areas.

Normal Node22 npm run build passed, no preview or validator bypass: compile,
TypeScript, 24 static pages. Only approved production public read settings were
in the build process, local flags off/service-role empty; active .env.local
remained local. Font/sitemap reads allowed, writes/paid APIs blocked; cached
sitemap fetch data could be reused. Temporary production test server stopped;
local development app and DB restored for user access. Lint/type checks pass.

After hardening, safety matrix, local backend CRUD/RLS/Storage checks and the
actual browser login→review create→edit→delete→logout flow passed again; browser
page errors 0. Production HTTP flags injected in query/body/header/cookie did
not enable local features. Actual app startup refusal was tested for hosted
app URL, remote Auth override and mismatched server key. The local developer
server is running again on port 3100 with the independent backend active.

## 2026-11-12 — visible browser demo prepared

Added a server-gated sticky local-only banner explaining that this is not the
production service and 123가4567 is a synthetic vehicle with mocked history and
isolated local DB/Auth/Storage. Included navigation links for the demo steps.
Opened a separate visible Chrome profile, logged in with the private synthetic
account, followed home plate lookup → review form → submitted a clearly labeled
synthetic demonstration review → confirmed it in the report. Kept logged-in
home, lookup, blank review form and registered-review tabs open for the user.
Home/lookup have the test plate prefilled. External browser requests are blocked.
No production deployment/data change. Lint/type checks passed (20 old warnings).
