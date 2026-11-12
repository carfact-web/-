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
