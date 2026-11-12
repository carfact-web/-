# Local schema and policy comparison

Reviewed 2026-11-12. This comparison is against the SQL in the production
checkout, **not a live production database catalog audit**. A read-only SSH hash
comparison confirmed that production `/root/carfact/supabase/schema.sql` and its
48 migration files match the original files in this development branch. No
production rows, Auth users, Storage objects, system catalogs or settings were
queried or copied for this review. Local pg_policies metadata was inspected.
Actual deployed production schema drift remains unverified.

| Area | Shared repository behavior | Local-specific difference / limitation |
| --- | --- | --- |
| Base tables | Nine public table definitions extracted from schema.sql, with the same types, constraints and references | Table-only bootstrap instead of applying the entire newer snapshot before older migrations; community_posts includes nullable legacy author_id to allow historical SQL to replay |
| Incremental schema | All 48 source migrations applied in timestamp order | Generated copies add DROP before redefining set_review_helpful_count(uuid,integer) and public_get_recent_home_reviews(integer); this addresses incompatible historical return types. Original files untouched |
| Review edit/delete RPCs | Latest update_review and hide_review definitions, author/admin authorization and application soft delete | Used with synthetic users and rows only; no production parity claim beyond source definitions |
| Review SELECT | Visible reviews use is_hidden=false; authors can also SELECT their own authored reviews | Same source predicates in the local catalog; a hidden row is absent from anonymous/public results, but the author can still access their own hidden row |
| Review INSERT | Authenticated authorship is required | Local policy is stricter: TO authenticated and auth.uid()=author_id; snapshot source also permits author_id IS NULL. Anonymous insertion and other-user edit/delete negative tests passed |
| Vehicles | Public SELECT and verified-dealer INSERT/UPDATE policies from the final migration | Public SELECT and RLS enablement restored by local bootstrap supplement. Test vehicle provisioned by local privileged seed, not dealer registration |
| User profiles | Own-id SELECT/INSERT/UPDATE predicates and source role/nickname protection triggers | Explicit TO authenticated on local own-profile policies; no public profile access. Local seed provisions only an ordinary synthetic user |
| Vehicle master | Public read predicate from snapshot | No production master catalog imported; fixture bypasses live candidate matching |
| Review reports | Table and RLS enabled | No local review_reports INSERT policy was restored from the snapshot. Reporting UI is not covered and is denied by default |
| Community tables | Incremental community policies and functions replayed | Local community_posts retains legacy compatibility column; community functionality not exercised by this review |
| Review image bucket | review-images is a public bucket with public reads | Local uploads require authenticated role (snapshot source allows public upload). Local-only owner_id=auth.uid()::text DELETE policy was added; other-user deletion denied. Upload policy is bucket-scoped, not a review-ownership check |
| Community image bucket | Source migration policies: public read, authenticated upload, owner update/delete | Applied unchanged from copied migrations; community upload/edit UI not tested |
| Auth | Real Supabase Auth and JWT/session verification | Local email/password signup with confirmation disabled; local test mail inbox. Google/Kakao providers are not configured. No real member data or production signing key |
| Storage runtime | Real Supabase Storage, SQL RLS and bucket APIs | Local filesystem/state only; no remote S3 credentials or production files |
| Backend services | PostgreSQL, Auth, REST, Storage are real services | Experimental CLI 3.1.0 native runtime, local Studio/Mail; no Realtime, Functions, Analytics or Pooler. Not the production managed-service topology |
| Data | Same application CRUD/RPC paths | Invented plate 123가4567, invented users and reviews; no real data import |
| Vehicle lookup | Same application request/response entry points | Local development-only authenticated fixture; never contacts paid providers |

The extra RLS and Storage policies are in
`scripts/local-sandbox/security-and-fixture.sql` and are applied only after
loopback validation. They must not be pushed to a hosted database. Local success
does not certify production authorization policies or production schema state.

## Final review evidence

- General Node22 production build: normal environment precheck, compile,
  TypeScript and 24 static pages passed. No preview or validator change.
- Build process received only the previously approved production public URL/anon
  variables from a private reference, with local sandbox flags disabled and the
  service-role key empty. Active local .env.local was not replaced. Font reads
  and existing sitemap SELECTs were allowed; writes/paid APIs were blocked.
  The build could reuse the existing sitemap fetch cache; fresh SELECTs were
  not required in this run.
- In a separate local production process, /local-test returned HTTP 404, also
  with flags in query parameters. Vehicle fixture was not activated by flags
  in query/body/header/cookie (HTTP 401).
- Server-only gate requires NODE_ENV=development, CARFACT_LOCAL_SANDBOX=1,
  public local flag and loopback URL. A client cannot supply the private flag.
- Local endpoint validator checks DB, REST, Auth, Storage and every advertised
  service URL, app/stack origin consistency, endpoint overrides and exact match
  of app public/server keys to the active local stack.
- Negative tests reject remote Auth/Storage/DB, inherited remote Auth URL,
  mismatched keys, missing private flag and hosted app URL. Actual app launcher
  also exits before starting for remote app/Auth URLs or mismatched server key.
- No production deployment, configuration, process, DB or Storage change.
