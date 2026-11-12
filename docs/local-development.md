# Local development verification

Verified 2026-11-12 on macOS arm64, branch `dev/carfact-2026-11-12`.

## Project-only Node

`.node-version` pins Node.js 22.23.0. The official darwin-arm64 archive was
verified against the official SHASUMS256.txt and extracted into the sibling
`../toolchain/node-v22.23.0-darwin-arm64/` directory. No global Node, shell
profile, other repository, or SSH key was changed. npm is 10.9.8.

From this repository, run commands with the local wrapper:

```sh
sh scripts/with-project-node.sh node --version
sh scripts/with-project-node.sh npm ci --cache ../toolchain/npm-cache --no-audit --no-fund
sh scripts/with-project-node.sh npm run lint
```

The toolchain is local and is not committed. On a new Mac, download the matching
archive from `https://nodejs.org/dist/v22.23.0/`, verify its SHA256 against
`SHASUMS256.txt`, and extract it to the sibling toolchain directory. The wrapper
fails rather than falling back to a global Node installation. This wrapper is
for the verified macOS arm64 workspace; other systems should use their own
project version manager with `.node-version`.

Read `AGENTS.md` and the installed `node_modules/next/dist/docs/` before editing
Next.js code. Keep the existing committed package-lock.json unchanged unless
an intentional dependency change has been reviewed.

## Build without production credentials

A normal `npm run build` correctly fails the environment precheck until these
variables are supplied for a separate test Supabase project:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Do not copy production credentials. Do not commit .env files. The repository
already supports a credential-free preview build:

```sh
VERCEL_ENV=preview NEXT_TELEMETRY_DISABLED=1 sh scripts/with-project-node.sh npm run build
NEXT_TELEMETRY_DISABLED=1 sh scripts/with-project-node.sh npm start -- --hostname 127.0.0.1 --port 3100
```

Preview compilation uses the production optimizer but does not validate a fully
configured production environment. Supabase Auth remains disabled. Clear the
preview flag and rebuild with approved test environment settings to verify Auth
and backend behavior later. Google font downloads may be needed during build.
The normal production environment validator was not weakened.

## Results and safe browser scope

- Node 22.23.0 / npm 10.9.8: verified.
- `npm ci`: passed, 376 packages; package-lock.json unchanged.
- `npm run lint`: passed, 0 errors and 20 existing warnings.
- Normal build: blocked at prebuild by the two missing variable names above.
- Preview `npm run build`: passed compilation, TypeScript, and all 24 static pages.
- Built server bound only to 127.0.0.1:3100.
- Chromium: `/`, `/lookup`, `/login` returned 200 with zero page JavaScript errors.
- Home and lookup: empty/invalid plate disables submit; invalid plate displays
  validation feedback; valid-format plate enables submit. No lookup submitted.
- Home login link navigates to `/login`.
- Kakao/Google login buttons are disabled without Supabase configuration.
- Screenshots visually checked for all three pages.

The browser used a fresh isolated context, blocked service workers and all
external requests, and intercepted every `/api/` request and non-GET/HEAD
request. Page-view recording was mocked as not recorded and maintenance status
was mocked as disabled. Analytics and external font requests were blocked.
Thus these checks cover UI rendering and local input/navigation behavior only;
API responses, live maintenance state, Auth, vehicle-history matching, paid
external APIs, DB and Storage are not verified. No data registration/deletion
or production DB/Storage operation occurred. The server reported missing KOTSA
server configuration/certificates, as expected for this credential-free clone.

Raw installation/build/browser logs, screenshots, and the isolated browser test
script are in the parent local work directory, outside the repository. No app
behavior was changed to bypass unavailable services. Existing lint warnings
remain in admin/community/report hooks and image components.

## General build follow-up: 2026-11-12

The two approved public Supabase variables were copied directly over the
existing SSH connection into the ignored local `.env.local` (mode 0600).
Only those two names were extracted; the anon key role was checked before
writing. No service-role key or other production secret was copied. The values
were not placed in commands, responses, logs, or commits. `.env.local` is
excluded by `.gitignore` and is not tracked. This supersedes the missing-variable
state in the earlier verification above.

Before running the build, the prerender paths were inspected. `app/sitemap.ts`
issues SELECT queries against vehicles, reviews, and community_posts during
static generation when the public client is configured. It does not perform a
write, but it creates a build dependency on the live database. Dynamic vehicle
and community routes can read data at request time; they were not requested.
The root layout also uses Google-hosted Geist fonts. npm has no custom postbuild
script, and no business API or database-write action was found in the reviewed
prerender entry points.

The normal `npm run build` was executed with VERCEL_ENV removed and no change to
`scripts/validate-env.mjs`. A local Node preload denied fetch/http/https requests,
and a macOS process sandbox denied non-loopback outbound traffic, including
native Turbopack traffic. Output was filtered in memory to redact the two copied
values and the project hostname before being saved to the local build log.

Result: the normal environment precheck passed, but the build exited 1 during
compilation because Google Fonts could not be downloaded under the network
block. It did not reach sitemap static generation. This is not a successful
normal build, and no normal-build browser smoke test was claimed. The earlier
successful preview build and credential-free UI checks remain separate results.

To complete a fully offline normal build without live services, the Google font
assets need to be provisioned locally and sitemap generation needs a deliberate
strategy that does not query production during build (for example, runtime
sitemap generation with a reviewed caching policy). Both choices affect product
assets or sitemap behavior and were not silently introduced as build-test fixes.
A less restrictive verification could allow only public static font downloads,
but the current sitemap would still require a read strategy. Fake database
results were not substituted, and no environment validator was bypassed.

Remaining unverified: successful normal compilation/prerender, normal-build
local production UI, actual OAuth, vehicle API, database and Storage behavior,
and live maintenance status. No production server setting/process or data was
changed. The local `.env.local` now points to production; do not start ordinary
unrestricted browser tests, because page-view tracking and other UI features
can write data. Continue using blocked API/external requests for local UI checks.

## Scoped-network normal build succeeded: 2026-11-12

The latest verification in WORKLOG.md supersedes the offline-build blocker
above. The blanket test network deny was removed. Google font downloads and
the existing sitemap's three public SELECT queries were allowed, with other
network operations including writes and paid vehicle APIs still denied.
Normal `npm run build` passed on Node 22.23.0 without preview mode or validator
changes; all three reads returned 200 and all 24 static pages were generated.
No execution-environment network limitation remained. Fonts, sitemap and cache
policy were not changed.

The resulting local production server passed isolated Chrome checks for home,
lookup and login (all 200, no page JS errors), plate input validation, home login
navigation, and enabled Kakao/Google buttons. API/external requests were blocked
in the browser; OAuth and vehicle lookups were not submitted. This is UI
verification, not live backend or authentication verification. The server was
stopped after checking. Continue to block writes and paid APIs when using the
local production-project public settings.
