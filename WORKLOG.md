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
