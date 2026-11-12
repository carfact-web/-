# Webtoon production change, backup and rollback plan

**Prepared only. Nothing in this document has been executed in production.**
Deployment, DB migration, Storage policy/bucket changes and any Nginx/PM2 changes
require the user's final approval of the exact release and backup readiness.
No new external paid service or OAuth provider change is required.

## Required production changes

Apply exactly `20261112090000_add_webtoon_publishing.sql` through the approved
migration workflow, once, after checking it is not already applied. Do not push
all local reconstructed/bootstrap SQL: only this additive webtoon migration.

- Four new public tables, FK/unique/check constraints and indexes.
- Read RLS based on publication/admin state; no client mutation privileges.
- webtoon_is_admin helper and service-only work/episode save + orphan claim RPCs.
- Private webtoon-private bucket, 10MiB limit and WebP allowed MIME.
- Restrictive storage.objects policy isolating this bucket from direct client
  access/signing without changing permissions for other buckets.
- Server API routes, authoring UI, public list/reader and navigation links.
- Existing server-only SUPABASE_SERVICE_ROLE_KEY must be available to the app;
  public URL/anon variables remain the existing project settings. Never expose
  the role key under NEXT_PUBLIC or put keys in deployment commands/logs.
- Do not copy synthetic users, pictures, local .env.local, sandbox flags,
  reconstructed initial schema, local auth policies or local account files.

Read-only SSH check on 2026-11-12 found no explicit client_max_body_size in
`nginx -T`. Nginx's documented default is1m, so a normal 10MiB upload would be
rejected before reaching this route. A narrowly scoped upload location with
client_max_body_size12m must be reviewed/applied after approval; retain the
existing proxy settings, run nginx -t, then reload only under that approval.
No Nginx configuration was changed. Request/asset caching must not override the
media endpoint's private/no-store policy. Do not enable public bucket/CDN URLs.
Source: https://nginx.org/en/docs/http/ngx_http_core_module.html#client_max_body_size

## Backups and preflight — mandatory before execution

1. Recheck operating Git HEAD/branch/dirty state and preserve all local work.
   The last read-only check still showed main ahead1 with modified lockfile.
   Never reset it or git pull into that dirty operating directory. Record actual
   Git SHA, .next BUILD_ID, Node/npm, PM2 launch configuration and Nginx upstream.
2. Verify an actual Supabase database backup/PITR restore point, including roles,
   grants, functions, RLS and migration history. Test restoration to an isolated
   staging DB; do not assume a policy document means backups are running.
3. Export critical Storage object manifests and bytes to an encrypted separate
   backup and verify checksums. DB backups alone do not back up Storage bytes.
   Once this feature is live include private webtoon objects and their exact keys.
4. Snapshot/backup the server and save deployment/configuration metadata securely.
   Hetzner backup readiness was not independently confirmed here; earlier audit
   reported automated backups off/no snapshots. Any paid snapshot action needs
   approval. Keep environment/certificate recovery material encrypted/off Git.
5. Check actual production catalog/versions and dependencies (profiles.role and
   is_suspended). The live production DB schema was not queried by this work.
   Rehearse this migration and the rollback plan in staging before production.
6. Confirm disk/memory and app-proxy capacity for decoded images, Sharp native
   binaries and proxy image traffic. Uploaded originals are limited10MiB and
   40M pixels, reencoded as WebP. Validate a file above1MiB through Nginx in staging.

## Approved deployment order

1. Freeze/record the approved development commit. Create a separate clean release
   checkout on the server; keep /root/carfact and its local changes intact.
2. On the release checkout use Node22.23.0 and npm ci, lint, TypeScript and normal
   npm run build with server-managed settings. Do not copy developer env files.
3. With verified backups and specific DB/Storage approval, apply only the new
   migration transaction. It is additive and commits atomically. Confirm new
   tables/RLS/RPC grants, private bucket and restrictive policy. Keep it private.
4. Start the new release on a temporary loopback port under a separate process.
   Smoke test public empty list and real admin role checks, then a clearly
   controlled authorized upload/draft/publish/unpublish cycle. Ordinary-user and
   direct Storage/signing tests must fail. Do not invoke paid vehicle APIs.
5. Apply the approved upload body-size configuration and route traffic to the new
   release only after smoke tests, nginx -t and user go-ahead. Save the approved
   PM2 process definition. Existing root PM2 boot registration remains a separate
   unresolved operations task; do not silently alter it as part of this feature.
6. Check public list, order, mobile reader, prior/next, upload retry and privacy
   revocation through the real proxy. Observe error rates, memory and private
   storage/egress usage. Do not log tokens, file contents or member information.

## Rollback — prefer code-only, preserve content

1. Stop new authoring/cleanup actions. If privacy is in doubt, unpublish affected
   works via the approved admin operation before rolling back. Disable any
   orphan cleanup invocation; no automatic cleanup job was installed.
2. Switch traffic back to the recorded previous known-good process/release and
   its saved proxy configuration under approval. Preserve new release logs and
   files for investigation; do not overwrite dirty operating Git changes.
3. Keep the additive tables, migration history, private bucket and restrictive
   policy. Old application code does not use them, so this rollback preserves
   uploaded content and avoids data loss. Re-test public/Storage privacy.
4. If a schema rollback is explicitly required, first export all four tables,
   relationships, roles/policies and private object bytes with checksums and
   verify an isolated restore. Prepare/review a dedicated reverse migration;
   never casually drop tables/bucket or delete storage.objects rows directly.
   Storage API byte deletion is irreversible without a verified byte backup.
5. Restore DB and Storage together with matching asset IDs/object keys if disaster
   recovery is needed. Validate private/draft access as well as published images
   in staging before switching production back. Already downloaded client copies
   cannot be recalled by unpublishing.

The ordinary rollback path is an old-code traffic switch plus preserved new
schema/data. There is no automatic destructive down migration in this change.

## PDF 포함 최종 검토: 정확한 변경 목록

기존 이미지 전용 설명에 다음을 추가/대체한다. 아래 **두 마이그레이션만 순서대로**
검토·승인 후 적용한다. 이미 적용된 migration은 재적용하지 않는다. bootstrap/seed는 제외한다.
정확한 SQL 원문은 각 migration 파일이 기준이며 운영 catalog와 충돌 여부는 승인 전 확인한다.

| 대상 | 신규/변경 내용 |
|---|---|
| webtoon_works | id UUID PK, title1~120, description≤5000, cover_asset_id FK restrict, published=false, version=1, created_at/updated_at |
| webtoon_episodes | id PK, work_id FK restrict, title1~120, number1~99999, unique(work_id,number), published/version/timestamps. PDF migration이 content_type(images/pdf, default images), pdf_asset_id FK restrict, 공개PDF 필수파일 및 image/PDF 배타 CHECK, pdf_asset_id index 추가 |
| webtoon_assets | id PK, work_id FK restrict, object_key unique, mime, width/height, bytes, state(uploading/ready/deleting), created_at. PDF migration이 width/height nullable, page_count/page_sizes JSON 추가. WebP≤10MiB 및 기존 치수검사 유지, PDF≤50MiB·1~200페이지·크기 배열 길이 일치 CHECK로 MIME/bytes CHECK 교체 |
| webtoon_episode_pages | episode_id FK cascade, asset_id FK restrict, position0~99, PK(episode_id,asset_id), unique(episode_id,position) |
| 인덱스 | episodes(work_id,number), assets(work_id,created_at), episode_pages(asset_id), PDF의 episodes(pdf_asset_id). PK/unique용 index 별도 자동 생성 |

RPC 최종 목록(모두 고정 search_path public,pg_temp):

- `webtoon_is_admin()` stable security definer: Auth uid의 user_profiles role admin/super_admin,
  not suspended. EXECUTE anon/authenticated/service_role, PUBLIC revoke.
- `webtoon_save_work(uuid,integer,text,text,uuid,boolean)` optimistic version,
  작품 advisory lock, 같은 작품 ready WebP 표지만 허용. 공개는 표지 필수.
- `webtoon_save_episode(uuid,integer,text,integer,boolean,uuid[],text,uuid)`:
  기존6인자 함수를 제거하고8인자(마지막 images/null default)로 교체. 이미지/PDF
  배타 검증, 공개에 콘텐츠 필수, 같은 작품 ready MIME, 페이지 순서 원자 저장.
- `webtoon_claim_orphans(uuid)`: 24시간 초과하고 표지/이미지/PDF 참조가 없는
  파일만 lock 후 deleting으로 claim. 신규 연결과 GC를 같은 작품 lock으로 직렬화.
- save/claim 세 RPC는 PUBLIC/anon/authenticated EXECUTE revoke, service_role만 grant.
  함수는 클라이언트의 관리자 주장 대신 서버의 실제 Auth/role 확인 뒤 호출한다.

RLS: 네 테이블 enable. 정책 이름은 `Published webtoon works`, `Published webtoon episodes`,
`Published webtoon pages`, `Published webtoon assets`이며 모두 SELECT뿐이다.
작품 공개, 부모+회차 공개, 공개 회차 페이지 및 공개 부모/회차가 참조하는 ready asset만
익명에게 허용한다. 관리자 helper는 비공개 조회를 허용한다. PDF migration은 assets
정책을 교체해 PDF 참조를 포함하고 이미지 참조는 images 회차에 한정한다.
네 테이블 anon/authenticated 전체권한 revoke 후 SELECT만 grant, service_role ALL.
클라이언트 INSERT/UPDATE/DELETE 정책은 없다.

Storage: `webtoon-private`는 계속 private. 첫 migration은10MiB/WebP, PDF migration은
**50MiB, image/webp와 application/pdf**로 갱신한다. 이미지 API 자체10MiB 제한은 유지한다.
`Webtoon objects server only`는 storage.objects의 anon/authenticated FOR ALL
**AS RESTRICTIVE**, USING/WITH CHECK bucket_id<>'webtoon-private'다. 일반 direct
다운로드/업로드/삭제/서명은 차단하고 서버가 매 요청 권한 확인 후 bytes를 전달한다.
버킷 public 전환, 공개 signed URL, CDN 캐싱은 사용하지 않는다.

## 기존 서비스 영향과 Nginx 제안

기존 회원/차량/후기 테이블·OAuth 설정은 변경하지 않는다. 공용 내비게이션에 웹툰
링크가 추가된다. 기존 image 회차는 기본 images로 남는다. 파일 트래픽은 앱을 경유해
대역폭/메모리 사용이 늘어난다. PDF 검증 worker와 정적 worker 자산 배포가 필요하다.
PDF 원본은 전체 다운로드되고 캔버스만 가상화한다. 상세 성능 한계는 webtoons-pdf.md.
새 유료 서비스는 필요 없다. Storage/egress 비용과 서버 실제 여유는 운영 전 점검 대상이다.

Nginx 제안은 정확한 두 업로드 경로만 별도 location으로 둔다:

- `location = /api/admin/webtoons/upload`: `client_max_body_size 12m;`
- `location = /api/admin/webtoons/pdf-upload`: `client_max_body_size 52m;`

이미지10MiB/PDF50MiB + 앱의 multipart64KiB 허용치보다 크고, 다른 경로의 제한은
그대로 유지하는 값이다. 52m=54,525,952 bytes, 앱 요청 상한=52,494,336 bytes.
location에는 현행 `/`와 동일한 proxy_pass, HTTP1.1, Host/X-Real-IP/
X-Forwarded-For/X-Forwarded-Proto, Upgrade/Connection/cache bypass 설정을 함께 둔다.
**전환 시 두 업로드 경로도 새 release upstream을 사용해야 한다.** 새 앱이3001인데
업로드만 옛3000으로 남기는 구성은 금지한다. 실제 설정 파일을 백업하고 nginx -t 및
승인된 reload 후 staging에서 >1MiB/허용 경계/초과413을 확인한다. 이번에는 실행하지 않았다.
기본1m 근거: https://nginx.org/en/docs/http/ngx_http_core_module.html#client_max_body_size

## 실제 백업 확보와 복구 확인: 미완료 게이트

**현재 운영 백업을 확보/복구했다고 주장하지 않는다.** 문서 준비와 로컬 합성 데이터
검증만 완료했다. 기존 조사에서 Hetzner 자동 백업 off/스냅샷 없음이 보고됐으므로
운영 승인 전에 실제 복구 가능한 산출물과 복구 리허설 결과가 필요하다.

1. 일관성 확보를 위해 승인된 작성 중지 시점 또는 DB/Storage 변경 delta를 기록한다.
   Supabase에서 실제 backup/PITR 시점·상태·복원 가능 기간·식별자를 확인하고, 정책상
   허용되는 암호화된 별도 보관소에 논리 백업/복구 자료를 확보한다. DB 연결은0600
   PGSERVICEFILE/.pgpass 등으로 전달하며 URI/비밀번호를 명령줄·로그에 넣지 않는다.
   관리형 roles/소유권 권한을 확인한 pg_dump custom-format 백업을 별도로 리허설한다.
2. schema/data/roles/grants/functions/RLS/extension/migration history와 Auth·Storage
   관리 스키마의 사용자 정의 정책/트리거를 목록화한다. CLI 기본 db dump는 data와
   관리 스키마를 모두 포함하는 전체 백업이 아니다. 백업 크기·시간·SHA256·암호화
   키 보관 위치를 비밀값 없이 manifest로 남긴다. 역할 비밀번호 복구는 별도 절차다.
3. Storage는 모든 bucket/key를 pagination으로 재귀 목록화하고 bytes·MIME·크기·SHA256
   manifest와 함께 암호화 백업한다. DB backup만으로 객체 bytes는 복구되지 않는다.
   실패/누락0, 목록 개수/총bytes/hash 대조가 끝나야 완료로 판정한다.
4. 운영 실제 회원정보를 현재 개발 DB에 넣지 않는다. 별도 승인된 접근 제한 복구
   환경에서만 복원한다. DB restore 오류0, 테이블별 count/관계/FK/정책/함수/grants,
   Auth 검증, private 객체 checksum, 공개/비공개 및 비관리자 차단을 확인한다.
   DB asset ID/object_key와 Storage bytes가 같은 시점의 짝인지 확인하고 복구시간을 기록한다.
5. 서버 현재 HEAD `2e14443`와 미커밋 lockfile, .next BUILD_ID, Node/PM2/Nginx,
   환경/인증서 복구 자료를 암호화 보관한다. 개인키는 복사하지 않는다. GitHub main
   `c9a1267`을 현재 운영 바이너리와 동일하다고 간주하지 않는다. 유료 snapshot은 별도 승인.

근거: https://supabase.com/docs/guides/platform/backups
https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore
https://supabase.com/docs/reference/cli/supabase-db-dump

## PDF 배포와 롤백 보완

최종 보고의 정확한 개발 커밋 SHA/lockfile을 배포 대상으로 pin한다. 백업 복원 검증 →
두 SQL의 staging 리허설 → 별도 clean release checkout/npm ci/일반 build → 승인된
DB·Storage migration → 임시 loopback 프로세스 smoke → Nginx 두 업로드 location 및
전체 upstream 전환 → 공개/권한/30~40페이지 테스트 순서다. 운영 실행은 최종 승인 후다.
프로젝트 Node22.23.0과 PDF.js+worker 동일6.5.438을 확인한다.

코드 롤백은 기록된 옛 프로세스와 proxy 설정으로 전환하고 새 테이블/비공개 버킷/파일을
보존한다. PDF 지원 이전 코드로 되돌릴 때는 먼저 새 작성 중지·PDF 회차 비공개 처리
계획을 승인받는다. 이미지 전용 코드가 PDF 회차를 빈 이미지 회차로 표시할 수 있다.
6인자 RPC 호출은 새 함수 default 인자로 호환되지만구버전 코드에서 PDF 회차를 수정하면
이미지로 전환될 수 있으므로 관리자 작성 접근도 중지한다. 운영 원본 상태/dirty lock을
덮어쓰지 않는다. DB/Storage 삭제 rollback은 자동 실행하지 않는다. 재해 복구는 검증한
같은 시점 DB와 object bytes를 함께 복원하고 비공개 접근 차단을 재검증한다.

승인 검토용 SQL SHA256:

- 20261112090000_add_webtoon_publishing.sql:
  `17c6ad845d574b2491484caef938e5e100cf88c6be289c5a6b1e5f945935dfe9`
- 20261112100000_add_webtoon_pdf.sql:
  `2b3f22411bb9e369490fbfacbb566de10f9e66b0f9f5ff1452b1c3a63ca7e20d`

추가 검토 사항: 이번 npm audit 결과19건(low1/moderate9/high8/critical1).
Next16.2.6·Sharp0.34.5 등 기존 직접 의존성도 포함한다. 새 PDF 두 패키지는 감사
대상 취약점 목록에 없었다. 이번 범위에서 무차별 npm audit fix/프레임워크 갱신은
실행하지 않았으며 운영 출시 전 별도 영향 검토가 필요하다.
