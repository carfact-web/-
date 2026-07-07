# Deployment Checklist

## Local Verification

1. `npm run lint`
2. `npx tsc --noEmit`
3. `npm run build`
4. `git diff --check`
5. Secret scan
6. Confirm `public/` contains no `.env`, `.der`, `.key`, `.p12`, or `.pfx`.

## Supabase

1. Confirm Supabase backup/PITR status.
2. Apply migration:
   ```bash
   supabase db push --linked
   ```
3. Verify tables:
   - `kotsa_api_audit_logs`
   - `security_alert_logs`
   - `security_blocked_ips`
   - `kotsa_query_limit_policies`
   - `kotsa_operation_settings`
   - `admin_known_ips`
4. Verify RLS policies and admin read access.

## Hetzner

1. Enter server-only environment variables.
2. Upload KOTSA certificate and private key outside the repo.
3. Confirm file permissions:
   ```bash
   chmod 600 /root/carfact-secrets/kotsa/signCert_kotsa.der
   chmod 600 /root/carfact-secrets/kotsa/signPri.key
   ```
4. Deploy:
   ```bash
   ssh -i ~/.ssh/robin_carfact_deploy root@95.217.167.210 "cd /root/carfact && git pull && npm install && npm run build && pm2 restart carfact && pm2 save"
   ```
5. Check logs:
   ```bash
   pm2 logs carfact --lines 30
   ```
6. Verify `https://carfact.kr` with cache bypass.
7. Check Health Dashboard.
8. Confirm KOTSA Emergency Stop is OFF.
9. Test Telegram alert delivery.
10. Run one controlled KOTSA API test.

## Rollback

1. Turn on Emergency Stop if KOTSA is affected.
2. Revert to the previous Git commit.
3. Rebuild and restart PM2.
4. If DB migration must be rolled back, restore from Supabase backup or apply a
   reviewed down migration.
