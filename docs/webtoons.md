# CARFACT webtoon authoring and public reading

Implemented on `dev/carfact-2026-11-12`. AGENTS.md and WORKLOG.md were read first.
The existing remote branch `dev/carfact-webtoon-chatgpt-20261112` was fetched and
inspected: it still points to the original main c9a1267 and contains no webtoon
code, commits or schema. No existing webtoon work was overwritten. Existing
Supabase connection helpers, user_profiles roles, Auth hook, admin navigation,
local isolation tools and application styling were reused.

## Local use

- Admin: http://127.0.0.1:3100/admin/webtoons
- Public works: http://127.0.0.1:3100/webtoons
- Local test login: http://127.0.0.1:3100/local-test
- Local Studio: http://127.0.0.1:54323

A separate synthetic webtoon administrator was created only in local Auth. Its
credentials are in the private parent `webtoon-admin-account.json`, not Git or
logs. The browser is opened with that account, a synthetic work and episode
selected. Ordinary `local-test-account.json` remains an ordinary user, not an
administrator. All test pictures are generated geometric panels labeled
CARFACT LOCAL / SYNTHETIC TEST ONLY. No real work, customer or production file
was copied. Local state and browser profiles are outside Git.

From this repository:

```sh
python3 scripts/local-sandbox/manage.py start
python3 scripts/local-sandbox/manage.py prepare
sh scripts/with-project-node.sh node scripts/webtoons/apply-local.cjs
sh scripts/with-project-node.sh node scripts/webtoons/create-local-admin.cjs
python3 scripts/local-sandbox/manage.py app
```

The migration/admin tools refuse nonlocal addresses or mixed keys. The migration
runner skips an already-recorded version. On a fresh stack, prepare/start applies
the copied migration; the runner then skips it. The main app runs on Node22.23.0
and loopback 3100. Ctrl+C stops a foreground app; `manage.py stop` stops only the
local backend. The active .env.local remains local and Git ignored.

## Authoring workflow

1. Create a work with a title. It starts private.
2. Edit its title/introduction; upload a cover or reuse an existing image from
   that work. Save. Public works require a cover.
3. Create a numbered draft episode. Episode numbers are unique within a work.
4. Choose multiple images, then upload. On failure, retry only failed files or
   exclude one. Successful files are retained and input order is preserved.
5. Preview images; use up/down, remove, or reuse an existing file. Removal is a
   reversible detachment until saved; it is not immediate byte deletion.
6. Save a private draft, then publish the episode. Work and episode must both
   be public for anonymous reading. Edit title/number/pages using the same form.
7. Use the public list → work → episode viewer. Images scroll vertically at
   mobile width; previous/next only link public sibling episodes in number order.

Selecting another work/episode discards unsaved form edits. Save first. Optimistic
versions reject concurrent/stale saves instead of overwriting another editor.
Work/episode hard-delete is deliberately not exposed; use unpublish. The separate
confirmed cleanup action permanently deletes only old unused assets.

## Security, images and data model

One additive migration: `supabase/migrations/20261112090000_add_webtoon_publishing.sql`.
It adds webtoon_works, webtoon_episodes, webtoon_assets and
webtoon_episode_pages, typed client definitions, selection RLS, service-only
save/cleanup RPCs, and one private `webtoon-private` bucket.

Every admin API call validates an actual Auth user, current DB role admin or
super_admin, and non-suspended profile before using the existing server service
client. Role fields supplied by the browser are ignored. A raw service-role key
is not accepted as a human admin login. Ordinary/anonymous direct table mutation
and privileged RPC execution are denied at the database as well. The admin UI
also displays an access-denied screen to ordinary users.

Public routes always query with the anon client, even if a browser has an admin
session. RLS requires both the work and episode to be public. Only a published
work's current cover or images referenced by public episodes are readable.
Draft/unreferenced asset metadata remains private. Storage objects are private
and a restrictive policy prevents anon/authenticated direct access or URL signing,
even alongside more permissive policies in other buckets. Only the server reads
bytes after its authorization checks.

`/api/webtoons/media/:assetId` checks visibility, reads private bytes, rechecks
public visibility and returns image/webp with private/no-store headers. Admin
previews use bearer-authenticated fetch + revocable blob URLs. No long-lived
signed URL is exposed. Unpublishing blocks subsequent requests to old image URLs;
already-downloaded copies cannot be recalled. This privacy choice means image
traffic passes through the app server and is not publicly CDN-cached.

Uploads are one file per request, processed sequentially in a multi-file queue:
PNG/JPEG/WebP only, static image, max input 10 MiB, width4096/height30000 and
40 million pixels. Content-length and actual bounded request stream are checked.
Sharp decodes and reencodes to WebP, stripping source metadata/trailing content;
spoofed/unsupported files are rejected. Sharp0.34.5 was already installed via
Next and is now declared directly at the same version. Dependency versions did
not change; unrelated libc lock metadata was retained.

Asset objects have UUID-based immutable names. Work cover and ordered page links
are saved via transactional RPCs. Duplicate IDs, foreign-work assets, incomplete
uploads and stale versions are rejected. Existing assets may be reused in other
episodes of the same work without uploading another file. Shared references are
preserved when an episode is unpublished or a page is removed.

Failed storage writes are cleaned when possible. Otherwise the tracked uploading
row remains for later cleanup. Explicit cleanup only claims assets created over
24 hours ago with no cover/page references. It marks them deleting before byte
removal, retries storage failures later and never automatically deletes all
unpublished content. Per-work advisory transaction locks serialize attachment
and orphan claiming; deleting state prevents new attachment after claiming. No
scheduler was installed. Back up before executing permanent cleanup in production.

## Reproducible verification

```sh
sh scripts/with-project-node.sh node scripts/webtoons/check.cjs
sh scripts/with-project-node.sh node scripts/webtoons/browser-check.cjs
sh scripts/with-project-node.sh node scripts/webtoons/concurrency-check.cjs
```

Tests use only verified local services. Browser tests block nonlocal requests.

- Work/episode create and edit; private drafts; cover/page uploads and publication.
- Anonymous/non-admin API denial; fake admin fields; service-key login denial.
- Direct REST INSERT/UPDATE/DELETE and service-only RPC denial for ordinary user.
- Draft work/episode/media unavailable to anon; ordinary user cannot preview.
- Private direct Storage reads and signed-URL creation denied; admin preview works.
- SVG, fake PNG and >10MiB inputs rejected by the real server.
- Ordered page IDs survive transactional save; reuse does not upload extra bytes.
- Duplicate pages, foreign-work page IDs and stale edits rejected without partial saves.
- Unpublishing work/episode blocks old API/media URLs; shared images stay readable
  only while another public reference still exists.
- Orphan cleanup removes old detached assets, preserves referenced/recent files.
- Deterministic concurrency test queues attachment then GC under an advisory lock;
  newly referenced file survives and remains downloadable.
- Browser multi-upload injected503 → retry succeeds without reuploading successes.
- Browser preview, reorder, individual removal, reuse, reselection and publish pass.
- Ordinary-user admin screen blocked; anonymous works → episodes → reader pass.
- 375px mobile images load in saved order without horizontal overflow; prior/next
  navigation and zero page JavaScript errors confirmed. Screenshots visually checked.
- npm ci, lint (0 errors/20 existing warnings), TypeScript and normal npm run build
  pass on Node22.23.0. Build generated27 static pages with no preview or validator
  changes. Approved production public read settings were process-only; local
  .env.local stayed local, writes/paid APIs were blocked, no webtoon operation
  ran against production.

Logs, PNG fixtures and screenshots-webtoons are in the private parent workspace,
not the repository. Production deployment and production DB/Storage application
remain pending explicit user approval. See webtoons-release.md for that plan.

## PDF 확장

회차 콘텐츠 방식에서 이미지 여러 장 또는 PDF 한 개를 선택한다. PDF 한 개는
내부 세로 뷰어로 열람한다. 사용 순서·자원 상한·검증 범위는 [webtoons-pdf.md](webtoons-pdf.md),
추가 마이그레이션과 배포 전 검토는 [webtoons-release.md](webtoons-release.md)를 따른다.
기존 이미지 방식은 유지된다. 아래 PDF 확장 문서가 이미지 전용 설명의 상한을 보완한다.
