# Windows local CARFACT development

Checkout: `C:/Users/user/carfact-handoff/carfact-review`.
Branch: `dev/carfact-windows-2026-11-12`, based on PDF commit `dd6e266`.
Mac mini unpushed changes remain unknown; do not edit/push its shared branch.

## Installed and verified on 2026-11-12

- Project-local Node22.23.0/npm10.9.8, official archive SHA256 verified.
- App `npm ci` completed; package-lock unchanged.
- Docker Desktop + Microsoft WSL installed with user approval; Windows reboot completed.
- Windows Linux Docker engine verified through its local named pipe.
- Supabase CLI3.1.0/pg in `../supabase-tools`; browser/PDF tools in `../browser-tools`.
- Separate `../local-backend-windows`, project ID `carfact-windows`, no linked metadata.
- DB/Auth/Storage/Studio/Mail run locally, eager mode, published ports loopback only.
- State/account/.env files use restricted Windows ACLs, outside Git or ignored.
- Synthetic accounts/vehicle/images/Korean PDFs only. No production values/data copied.

Native Supabase is unsupported on Windows, so the separate Windows manager uses
Docker. The original macOS shell wrapper and Python/native manager are unchanged.
CLI3 experimental stack returns the same readiness/env/endpoints structure as the
existing verifier: no fabricated status adapter and no weakened checks are needed.
Its help without an explicit workdir can show legacy options. With the experimental
stack enabled, exclude capabilities are `realtime,functions,analytics,pooler`.
A running stack ignores changed eager flags; the manager stops/starts that one stack
without destroying data. `--eager` prevents the default60-second idle stops.

## Restart and stop

Run in the checkout, after starting Docker Desktop:

```powershell
.\scripts\with-project-node.ps1 node scripts/local-sandbox/manage-windows.cjs doctor
.\scripts\with-project-node.ps1 node scripts/local-sandbox/manage-windows.cjs start
.\scripts\with-project-node.ps1 node scripts/local-sandbox/manage-windows.cjs app
```

App is `http://127.0.0.1:3100`; test login `/local-test`; webtoon admin `/admin/webtoons`.
Ctrl+C stops the foreground app. To stop only this backend, preserving synthetic data:

```powershell
.\scripts\with-project-node.ps1 node scripts/local-sandbox/manage-windows.cjs stop
```

`status` refreshes the private state after verifying Docker identity, actual
container bindings, ready services and every advertised local endpoint.
`app` additionally checks process/env key equality and loads the network guard.
Inherited remote Docker overrides are refused. The named-pipe desktop-linux context
is checked before daemon access. A project-only bridge sets host_binding_ipv4 to
127.0.0.1, and actual published ports are checked after start. No remote CLI
link/push/pull/reset/destroy command is exposed by the manager.

## Recreate an empty local sandbox

Only for a new isolated backend:

```powershell
.\scripts\with-project-node.ps1 node scripts/local-sandbox/manage-windows.cjs prepare
.\scripts\with-project-node.ps1 node scripts/local-sandbox/manage-windows.cjs start
.\scripts\with-project-node.ps1 node scripts/local-sandbox/manage-windows.cjs seed
.\scripts\with-project-node.ps1 node scripts/webtoons/prepare-local-pdfs.cjs
```

Preparation reuses the existing nine-table bootstrap, legacy author_id compatibility
and two local-only function signature shims; original SQL is unchanged. SQL input
normalizes CRLF. State and account values must never be printed. seed writes the
actual checkout's ignored .env.local, rather than assuming its folder is `repo`.
The PDF generator uses installed malgun.ttf on Windows; pass an installed Korean
TTF as its first argument on another platform. It generates30/40/60/201 pages,
corrupt bytes and a genuinely encrypted synthetic file outside Git. Browser tools
use installed Chrome/Edge on Windows and the existing Chrome path on Mac.

## Verification

Through the Node wrapper run:

- scripts/local-sandbox/safety-check.cjs
- scripts/local-sandbox/check.cjs
- scripts/webtoons/check.cjs
- scripts/webtoons/concurrency-check.cjs
- scripts/webtoons/pdf-check.cjs
- scripts/webtoons/pdf-browser-check.cjs
- scripts/webtoons/browser-check.cjs
- scripts/webtoons/promotion-check.cjs

Initial Windows DB/Auth/review/RLS/Storage, image/concurrency and30/40-page Korean
PDF upload/viewer browser suites passed. safety-check normalizes source CRLF before
its VM gate check. Promotion suite verifies its full API/UI flow separately.
Browser checks use only local data and block nonlocal browser requests. Screenshots
and test state remain in the parent directory, outside Git. Chrome emulation is
not a real iOS/Android device or worst-case scanned-PDF memory result.

## Normal build using only local synthetic data

Stop the dev server first, then run:

```powershell
.\scripts\with-project-node.ps1 node scripts/local-sandbox/build-local.cjs
```

This runs normal npm run build including the unchanged prebuild validator, with
no VERCEL_ENV preview and local sandbox flags OFF. The build-only HTTPS-format
address `https://carfact-local-build.supabase.co` is an alias, not a hosted project:
the preload rewrites only the three existing sitemap GETs (limit5000) to the
verified local stack. Responses come from real local Postgres, not fabricated
fixtures. All other external API calls and all writes are refused; Google Fonts
GET/HEAD assets are allowed. Only local anon key is supplied; server key is empty.
The ignored .env.local stays local. The compiled test bundle points at the test
alias, so it is a build verification artifact, not a deployable release. Restart
`manage-windows.cjs app` afterward to use the normal local development environment.

Result: normal compile, TypeScript and27 static pages passed; all three sitemap
SELECTs used the synthetic local DB. Never deploy this verification artifact.
