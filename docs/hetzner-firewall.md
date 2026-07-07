# Hetzner Firewall Runbook

## Policy

- Allow TCP 22 from trusted admin IPs only.
- Allow TCP 80 and 443 from the public internet or Cloudflare ranges.
- Drop all other inbound traffic.
- Keep outbound traffic open for package updates, Supabase, Telegram, and KOTSA.

## Change Procedure

1. Record current rules and the reason for change.
2. Apply the smallest rule change possible.
3. Verify SSH, HTTP, and HTTPS.
4. Record the change in the security timeline.

## Emergency Procedure

1. Enable KOTSA Emergency Stop.
2. Restrict SSH to trusted admin IPs.
3. Temporarily block all inbound HTTP/HTTPS if active exploitation is suspected.
4. Snapshot the server before destructive recovery work.

## Recovery

1. Restore HTTP/HTTPS only after the app has been verified.
2. Confirm `pm2 status`, Nginx, and TLS.
3. Review security alerts and blocked IPs.
