# Carfact Security Incident Response

This document is for emergency response. Do not paste secrets, vehicle numbers,
private keys, or certificate passwords into tickets, chat, logs, screenshots, or
Git commits.

## Immediate Containment

1. Turn on KOTSA Emergency Stop in the admin KOTSA health panel.
2. Block clearly malicious IPs in the admin security block list.
3. If server compromise is suspected, block inbound traffic at Hetzner firewall
   before rotating secrets.
4. Preserve logs before restarting services.
5. Record the incident time window, impacted endpoints, request IDs, and IPs.

## KOTSA_API_KEY Exposure

1. Turn on KOTSA Emergency Stop.
2. Remove the exposed key from the server environment.
3. Request key revocation and reissue through the KOTSA/Car365 channel.
4. Update `KOTSA_API_KEY` only in the server environment.
5. Restart the Next.js/PM2 service.
6. Confirm that GitHub, frontend bundles, and logs do not contain the key.
7. Turn off Emergency Stop after a successful server-only smoke test.

## signPri.key Exposure

1. Turn on KOTSA Emergency Stop.
2. Treat every signed request as untrusted from the exposure time.
3. Remove the private key from the server.
4. Request certificate/key revocation and reissue.
5. Install the new key under `/root/carfact-secrets/kotsa/`.
6. Set file permissions to `0600`.
7. Update `KOTSA_CERT_PATH`, `KOTSA_PRIVATE_KEY_PATH`, and
   `KOTSA_PRIVATE_KEY_PASSWORD` only in the server environment.
8. Restart the service and verify certificate status in admin health.

## Supabase Service Role Key Exposure

1. Turn on KOTSA Emergency Stop.
2. Rotate the Supabase service role key in Supabase dashboard.
3. Replace `SUPABASE_SERVICE_ROLE_KEY` only in server environment variables.
4. Restart the service.
5. Review `security_alert_logs`, `kotsa_api_audit_logs`, admin actions, and RLS
   policies for suspicious activity.
6. Revoke unknown sessions if needed.

## Server Compromise Suspected

1. Turn on Hetzner firewall deny rules for public inbound traffic.
2. Keep SSH open only from a trusted admin IP if console access is not needed.
3. Snapshot the server for forensic review.
4. Stop the PM2 `carfact` process.
5. Rotate KOTSA, Supabase, Telegram, deploy, and SSH credentials.
6. Rebuild from a trusted Git commit on a clean server if root compromise is
   plausible.
7. Restore only verified data and server-side secret files.

## Hetzner Stop/Firewall Order

1. Apply firewall restrictions first.
2. Verify the site is no longer publicly reachable.
3. Stop PM2 service.
4. If compromise is active, power off the server from Hetzner console.
5. Preserve snapshots before deleting or rebuilding anything.

## Reissue And Apply New Keys

1. Put new secrets outside the project directory.
2. Set key/certificate file permissions to `0600`.
3. Update server environment variables.
4. Run build validation.
5. Restart PM2.
6. Check admin KOTSA health, certificate status, and Telegram alert delivery.
7. Perform one controlled KOTSA test request with a permitted account.

## Supabase Backup And Restore

Important tables:

- `auth.users`
- `public.reviews`
- `public.vehicles`
- `public.kotsa_api_audit_logs`
- `public.kotsa_query_limit_policies`
- `public.security_alert_logs`

Backup status must be verified in the Supabase dashboard because this project
does not store Supabase management API credentials. Confirm scheduled backups
or point-in-time recovery for the production project, then update
`kotsa_operation_settings.supabase_backup_last_checked_at`.

Restore procedure:

1. Identify the restore point before the incident.
2. Export current suspicious logs for investigation.
3. Restore to a staging project first.
4. Validate row counts and RLS policies.
5. Promote restored data to production only after application smoke tests.
