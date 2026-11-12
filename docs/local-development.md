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
