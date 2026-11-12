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

## 2026-11-12 — admin webtoon upload and public reading

Read AGENTS/WORKLOG and searched local source, history and remote branches first.
Existing dev/carfact-webtoon-chatgpt-20261112 was fetched and is still c9a1267
with no webtoon diff/schema. Reused Auth/profile roles, server Supabase helper,
admin navigation and local-isolation tooling; did not overwrite prior work.

Added private-work/episode authoring, title/introduction/cover/publication,
multi-file retry queue, previews, order/removal/reuse, transactional draft/public
save and optimistic edit versions. Public list→episode list→vertical mobile
reader, prior/next and home/admin entry links added. Four tables + read RLS +
service-only RPCs + private bucket/restrictive storage policy are in one new
additive migration. Human admin token/current role/suspension checked for every
admin API. No client writes/direct Storage read/signing allowed. Images are
bounded, decoded/reencoded WebP; privacy proxy rechecks visibility/no-store.
Old unreferenced files use explicit admin GC, with per-work transaction locks
and deleting-state claims to prevent concurrent attachment/file-loss races.

Applied only to verified local DB/Storage. Created separate synthetic local
admin; no production member/data/file copy. API/RLS/Storage privacy and mutation
negative tests, invalid/oversized images, order/reuse/conflict/foreign-ID checks,
unpublish revocation and orphan retention pass. Deterministic concurrent attach
then GC test preserves the newly referenced object. Browser multi-upload forced
503→retry, preview/reorder/remove/reuse/reselect/save/publish and ordinary-user
block pass. Anonymous reading at375px and previous/next pass, page errors0.
Screenshots visually checked. npm ci, lint0 errors/20 old warnings, TypeScript and
normal Node22 npm run build passed (27 static pages, no preview/validator bypass).
Sharp existing0.34.5 is now direct dependency, versions unchanged; original libc
metadata retained. Local developer app/backend restored and kept running.

Read-only operating check: Git still ahead1/lock modified; no explicit Nginx
body-size directive. Production needs an approved narrow upload-limit change
in addition to the new DB/Storage migration. No deployment, Nginx/PM2 operation,
production DB/Storage mutation occurred. docs/webtoons.md describes local use,
security/tests/limits; docs/webtoons-release.md contains gated DB/Storage changes,
backup/deployment/non-destructive code rollback and disaster-recovery plan.

## 2026-11-12 회차별 PDF 업로드·가상화 뷰어

기존 이미지 웹툰356d86f 기준 구현을 확장했다. 회차 이미지/PDF 배타 선택,
50MiB·1~200페이지 PDF 서버 검증(암호화/손상 거부), 실제 XHR 진행률/재시도,
관리자 미리보기·임시저장·공개 취소·같은 작품 파일 재사용을 추가했다.
PDF.js6.5.438과 같은 설치 패키지의 worker/fonts/cmaps/wasm을 로컬 제공한다.
주변 최대5페이지 캔버스/각150만 픽셀, 멀어진 캔버스·page cleanup 및 문서 worker
해제, 고정 페이지 슬롯, 모바일 버튼/두 손가락 확대, 현재/전체, 브라우저 이어보기.
다운로드 버튼은 없으며 저장 완전 차단을 주장하지 않는다. 파일 자체는 전체 다운로드다.

20261112100000 PDF migration은 로컬에만 적용했다. 기존4테이블 중2개 확장,
asset 읽기 RLS·회차 RPC 교체·표지 MIME·PDF GC 참조 보호 및 private bucket의
50MiB/PDF 허용을 추가한다. 서버의 실제 Auth/관리자 검증과 no-store 재검증 프록시,
직접 Storage 차단은 동일하다. 운영 관련 작업은 실행하지 않았다.

검증: Node22.23.0 npm ci 성공, lint0 errors/20 기존 warnings, tsc --noEmit 성공,
일반 npm run build EXIT0(환경 검증 우회/preview 없음). 승인된 공개 sitemap 읽기와
Google Fonts만 허용하는 기존 빌드 설정을 사용했으며 운영 쓰기/유료 API 차단 유지.
로컬 .env.local은 로컬 값/ignored 상태를 유지했다. 설치 후 로컬 앱을 다시 실행했다.
기존 이미지 API/RLS/Storage/순서/공개 취소/GC 회귀 통과.
합성30/40/60페이지 한글 PDF 성공, 손상/암호화/201페이지/크기초과/비관리자 거부,
비공개 media 차단·관리자 preview·공개 및 취소·혼합 콘텐츠 거부 확인.
Chrome390×844 한글 시각 확인, 페이지1→10→20→끝 순서, 최대5캔버스,
버튼/합성 두 손가락 이벤트 확대, 처음부터, 새로고침 이어보기 통과.
관리자 업로드503→파일유지 재시도→preview→비공개 저장→공개 UI 통과, JS 오류0.
메모리 측정 범위/상한 근거/실기기 미검증 사항은 docs/webtoons-pdf.md에 기록했다.
실제 사용자의 PDF 및 실제 iOS/Android 기기, 최악 복잡도 PDF 부하/서버 전체RSS는
아직 검증하지 않았다. 합성 텍스트 파일 성능을 실제 스캔 작품 성능으로 일반화하지 않는다.

npm audit19건(critical1 포함)은 기존 Next/Sharp 등 갱신 검토로 남긴다. 새 PDF
패키지는 보고 목록에 없으며 범위를 넘는 일괄 의존성 변경은 하지 않았다.
운영 적용 정확한 SQL/RPC/RLS/Storage 목록·Nginx12m/52m 근거·실제 백업 확보 및
격리 복구 검증·별도 release 배포·비파괴 롤백을 docs/webtoons-release.md에 보완했다.
운영 백업 확보/복원은 아직 하지 않았고 실제 운영 데이터는 로컬에 복제하지 않았다.
마지막 UI 검토에서 저장/공개 버튼을 긴 PDF 미리보기 위로 이동했다. 이후 기존
이미지 전체 브라우저 흐름(재시도/정렬/제거/재사용/모바일/이전다음)과 PDF 브라우저
흐름을 재실행해 모두 통과했다. 오래된 참조 PDF는 GC claim에서 보존되고 참조 없는
PDF만 대상으로 잡히는 테스트도 통과했다. 공개/비공개 PDF의 일반 사용자 접근과
실제 페이지 번호까지 추가 확인했다. 변경 파일의 로컬/운영 참조값·테스트 비밀번호
검사 및 Git 제외 확인 통과. 최종 일반 빌드 후 앱과 로컬 백엔드를 유지한다.

## 2026-11-12 — Windows laptop preparation (not a completed runtime verification)

Separate laptop branch dev/carfact-windows-2026-11-12 based on exact remote
PDF commit dd6e2665034a0ead891165181ecca7b04b9358e7. Mac mini unpushed changes
and running work remain unverified. No shared-branch edits or push, no production
server access, no production credentials/member data used.

Project-local official checksum-verified Windows Node22.23.0/npm10.9.8 and npm ci
completed; Supabase CLI3.1.0/pg installed outside Git. Native Supabase does not
support Windows; the Windows CLI exposes Docker commands instead of Mac native
flags. User approved Docker Desktop/WSL installation; installed both and enabled
VirtualMachinePlatform + Microsoft-Windows-Subsystem-Linux with NoRestart.
Windows returned RestartNeeded=True. No automatic reboot or backend start.

Added a PowerShell Node wrapper, separate Windows doctor/SQL preparation/guarded
app entry point, preserving existing Mac wrapper/manage.py. Reused the nine-table
local bootstrap and two shims in a separate Windows backend directory; no SQL
applied. Fixed seed's hardcoded repo/.env.local path; browser checks now resolve
installed Windows Chrome/Edge while preserving Mac Chrome. See docs/local-windows.md.

Base Windows lint passed with 0 errors/20 existing warnings and tsc passed.
SQL/config preparation passed; app startup without verified local state refused.
No DB/Auth/Storage integration or 30/40-page browser test has yet run here.
Post-reboot Docker local binding/config/status adapter, private-file ACLs,
synthetic fixture generation and full isolation/image/PDF regression remain.
Do not interpret preparation scripts or installed Docker as a working sandbox.

Additional Windows preparation checks passed: in-memory synthetic endpoint/key/
flag negative checks, installed browser resolution, repeatable SQL preparation
including PDF migration without creating .env.local, and actual PDF validator
worker acceptance of synthetic30/40/60-page PDFs plus201-page/corrupt rejection.
These are parser-only checks, not Korean rendering/upload/browser/backend tests.

## 2026-11-12 — Windows runtime verified after reboot

Docker Linux engine/named-pipe context, eager local stack and all published
loopback bindings verified after the user rebooted. CLI experimental stack status
already matches verify.cjs; no fabricated adapter or relaxed gate. Mac scripts
remain unchanged. Windows manager implements scoped prepare/doctor/start/status/
seed/app/stop and restricted private-file ACLs. Existing51 migrations applied
locally; generated only synthetic users/vehicle/images/PDFs. CRLF VM-check fix.
Local Auth/review CRUD/RLS/Storage, image API/browser/concurrency regression and
Korean30/40/60-page PDF API plus30/40-page browser suites passed, zero JS errors.
Actual mobile hardware/complex scanned-PDF load remains unverified.

## 2026-11-12 — latest webtoon home card and optional promotion popup

Kept laptop branch dev/carfact-windows-2026-11-12 based on dd6e266. Remote shared
branch still dd6e266 at start; Mac mini unpushed changes remain unknown. Reused
admin Auth/role/suspension checks, webtoon APIs, Sharp and local isolation tools.

Added published_at transition trigger (historical fallback=updated_at), latest
public image/PDF episode card at home bottom, default-disabled singleton promotion
settings in existing admin UI, KST start/end inputs, publication-filtered public
RPC, separate360x480-max reencoded cover proxy with pre/post visibility checks.
No private Storage permissions broadened. Only new promotion migration applied
to the verified local DB. Public cancellation/deletion disables selected campaign;
republishing does not reactivate it. Open UI polls15s/focus/path and fails closed.
Nonmodal popup<=48dvh, named dialog, keyboard/ESC/focus restoration, watch-now,
close/session suppression and KST-date today-hide. See docs/webtoons-promotion.md.

Local synthetic API/browser suite verifies publication sorting (edits do not
reorder), image/PDF selection, no-public-content hiding, admin UI save, private/
deleted/unpublished rejection, expiry/future schedule, cancellation auto-stop,
derivative cover bounds/private direct-read denial, KST midnight/US timezone,
navigation/reload suppression, today-hide and actual viewer navigation.
Normal npm run build passed (compile, TypeScript,27 static pages), no preview or
validator changes. Process-only test alias rewrites only three existing sitemap
SELECTs to real synthetic local DB, with writes/other external APIs denied, font
assets allowed; .env.local unchanged and local flags off in build. Verification
.next is not deployable. Local development app restored on127.0.0.1:3100.
Lint0 errors/20 existing warnings. Screenshots/state outside Git. No production
server access/deployment/DB/Storage/Nginx mutation and no production data copied.

## 2026-11-12 — real admin navigation and server-gated editor

Retained the laptop development branch. Kept the previous requested English label
change CARFACT ORIGINAL without changing styles or the Korean heading.
Moved the existing lower dashboard webtoon shortcut into the actual admin nav as
웹툰 관리. Reused useAuth admin/readiness checks and hid it for suspended profiles.
Local yellow banner remains behind the unchanged development/private/public flag
and loopback server gate; its admin shortcut now uses the same role-aware link.

Split /admin/webtoons into a dynamic server page and the reused client editor.
Menu entry exchanges the existing human Bearer session, after requireWebtoonAdmin
Auth/role/suspension validation, for a5-minute scoped HttpOnly/SameSite strict
cookie (Secure in production). Actual Host/proxy protocol Origin checking denies
cross-origin session creation. Page access repeats the real server check; no
cookie/invalid/ordinary/suspended user returns404 without editor payload. APIs
still independently require Bearer Auth and do not accept this page cookie.
Logout and local synthetic account switching clear the page cookie. No new auth
provider, production account, DB migration, Storage permission or Nginx change.

Local synthetic admin/ordinary/anonymous tests passed for actual desktop/mobile
menu visibility/navigation, direct URL and every webtoon API denial, forged role/
service key/cookie, Origin, cookie scope/HttpOnly, admin reload, live suspension
revocation and logout removal; JS errors0. Image and30/40-page PDF browser suites
passed after updating entry through the role-aware link. Existing isolation and
production feature gates passed. See docs/webtoons-admin-access.md.

Final normal npm run build passed compile/TypeScript/26 static pages; admin
webtoon page is now dynamic. A temporary127.0.0.1:3101 production-mode server
served home200 without yellow banner/test/admin links, and returned404 for
anonymous/forged-role admin page and local-test even with local flags supplied.
The temporary server was stopped. Lint0 errors/20 existing warnings. No production
connection, server deployment, DB/Storage/Nginx mutation or new migration.

## 2026-11-13 KST — Mac mini deployment preparation handoff

Read AGENTS, WORKLOG and release/access/promotion/PDF documents. Original Mac
repo remained dev/carfact-2026-11-12@dd6e266, clean and no unpushed commits.
ls-remote/fetch reverified main c9a1267, Mac dd6e266 and laptop f989cad; laptop
is two commits ahead by ancestry. No pull/reset or overwrite. Created separate
release/webtoon-review-2026-11-13 worktree based on exact laptop HEAD.
Reproduced the absent laptop-only PDF guide simplification and concentrated
technical detail in docs/webtoons-pdf.md; parser/limits/dependencies unchanged.
Targeted PdfUpload ESLint and diff check passed. Existing passing runtime/build
suites were not repeated for this copy/document-only change.

Read-only SSH confirmed operating main2e14443+dirty lockfile(0+/108-), same
lock hash as preserved branch, PM2 root/npm start online, Nginx→3000 without
upload limit, pm2-root unit absent. Existing preservation checksums and incremental
bundles verify. No production install/build/restart/config change. Source/config
left intact; metadata/hash records are not a complete operational backup.
Supabase GET-only checks from server: profile required columns200; five webtoon
tables404/PGRST205 and no webtoon RPC/catalog; bucket list200 with no webtoon-private.
Migration history406/PGRST106, not exposed: direct catalog/history verification
remains pending. Keys were neither printed nor copied. No operational data read.

Production-only npm audit (no package changes) reports6 vulnerable packages:
critical1/high4/moderate1. Official Next/Sharp advisories reviewed; deployed and
candidate Next16.2.6/Sharp0.34.5 fall in reported ranges. Security remediation and
appropriate regression/build remain a release gate, not completed by this audit.
Actual DB/Storage/server backup and isolated restoration remain unverified.
Tracked test tooling and runtime local-fixture imports require production-artifact
exclusion review; inactive local gates alone do not prove code physically absent.
No laptop real PDF or member data imported. No test artifact deployed.

docs/webtoons-preflight-2026-11-13.md records exact source/production status,
all3 migration hashes, private Storage/Nginx scope, security findings, artifact
and backup gates, approval/release/rollback sequence. Read-only catalog SQL is
prepared in docs/sql/webtoon-preflight-readonly.sql and was not run in production.
The legacy dirty-dir pull/broad db push checklist is explicitly superseded.
Final release-review branch SHA is recorded in the completion report; it is a
review candidate pending the documented gates and user final approval.
