# Hetzner Snapshot And Backup

## Snapshot Policy

- Frequency: once per day.
- Retention: 7 days.
- Take an extra snapshot before major security or deployment changes.

## Restore Procedure

1. Enable KOTSA Emergency Stop.
2. Snapshot the current server if incident analysis is needed.
3. Restore the selected snapshot to a new server first.
4. Verify SSH, Nginx, PM2, environment variables, and certificate paths.
5. Switch DNS or Cloudflare origin only after smoke tests.

## Secret Backup Warning

KOTSA certificates, private keys, `.env` files, and service role keys must be
backed up separately in encrypted storage. Do not put them in Git or `public/`.
