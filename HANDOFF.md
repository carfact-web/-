# CARFACT Handoff

Last updated: 2026-08-14 12:48 KST

## Repository

- GitHub: https://github.com/carfact-web/-.git
- Branch at handoff: `main`
- Latest known good commit: `bf24f88f8d865f95bcb4cd5eaa666d5dab6ee3f3`
- Latest known good commit subject: `Add developer note community category`
- Remote sync at handoff: `main` and `origin/main` were in sync (`ahead 0 / behind 0`) before this handoff commit.

## Current Safe Baseline

The safe baseline before this handoff document is the commit above.

No loading animation implementation was committed before this handoff. The requested CARFACT loading animation work was stopped before any animation files were created or modified.

## Uncommitted Worktree At Handoff

These files were already dirty or untracked before `HANDOFF.md` was created. Do not assume they are part of one feature without reviewing them.

Tracked modifications:

- `.env.local.example`
  - Adds a blank `KOTSA_COMPREHENSIVE_API_KEY` placeholder.
  - No secret value was present in the reviewed diff.
- `supabase/.temp/cli-latest`
  - Local Supabase CLI version marker changed from `v2.105.0` to `v2.109.0`.
- `test-results/.last-run.json`
  - Test result metadata/newline-level local change.

Untracked files/directories:

- `app/admin/vehicle-report-preview/VehicleReportPreview.module.css`
- `app/admin/vehicle-report-preview/page.tsx`
- `app/api/admin/kotsa-comprehensive-test/route.ts`
- `lib/server/kotsa-comprehensive/client.ts`
- `lib/server/kotsa-comprehensive/config.ts`

## Incomplete Loading Animation Work

- Status: not started in code.
- Animation-related files created: none.
- Animation-related files modified: none.

The next Codex can start the loading animation from the current repository state, but should first inspect the dirty worktree above and decide whether to isolate the animation in a new feature branch.

## Recent API Investigation Summary

The CARFACT KOTSA comprehensive API investigation found:

- The comprehensive API call uses the shared KOTSA endpoint and sends only vehicle number in the request body.
- `sttusList1` maps to performance inspection info 1.
- `sttusList2` maps to performance inspection info 2.
- No separate `linkInfoCd`, endpoint, or request selector for `sttusList1` / `sttusList2` was found in the project materials.
- An operational server sample call for the same test vehicle returned HTTP 200 with:
  - `data` count: 1
  - `sttusList1` count: 2
  - `sttusList2` count: 2
- The 2026 performance inspection detail record was not present in the returned comprehensive API response.
- The current vehicle mileage value appeared only under basic vehicle info in the inspected response, not as a performance inspection detail record.
- Damage diagram data equivalent to the official performance record exterior/frame repair diagram was not present in the comprehensive response. Maintenance history does include part names that could be mapped separately with care.

Sensitive identifiers, raw vehicle numbers, API keys, certificates, private keys, passwords, VINs, and raw API responses must not be committed or exposed.

## How To Run Locally

Use the existing project scripts after installing dependencies:

```bash
npm install
npm run dev
```

For production-style validation:

```bash
npm run build
npm start
```

Run the repository's available checks before committing feature work:

```bash
npm run lint
npm test
```

If any of these scripts are missing or fail because of local environment requirements, record the exact result in the next handoff or commit message.

## Verification Performed For This Handoff

Commands used before creating this document:

```bash
git remote -v
git branch --show-current
git status --short --branch
git log -1 --format='%H%n%s%n%ci'
git rev-list --left-right --count HEAD...@{u}
git diff --name-status
git diff --stat
git ls-files --others --exclude-standard
```

No build, test, deploy, database, UI, PM2, or API call was performed as part of this handoff commit.

## Next Work

Recommended next steps:

1. Create a feature branch before implementing the CARFACT loading animation.
2. Review the existing dirty worktree and keep unrelated work out of the animation commit.
3. Add the loading animation as a small, isolated UI change.
4. Do not change the current KOTSA API call behavior, database behavior, or result UI unless a separate task explicitly asks for it.
5. Verify desktop and mobile behavior locally before opening or merging the animation work.

## Commit Discipline Going Forward

For all future work:

- Use feature branches for each task.
- Keep commits small and focused.
- Do not mix generated artifacts, local environment files, API investigation files, and UI feature work in the same commit.
- Never commit `.env`, `.env.local`, API keys, certificates, private keys, passwords, raw VINs, raw vehicle numbers, or raw private API responses.
- Do not use force push, destructive reset, checkout-based recovery, stash deletion, or file deletion unless explicitly authorized.
