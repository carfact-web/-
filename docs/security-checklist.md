# Security Checklist

- Cloudflare proxy enabled and `TRUST_CLOUDFLARE=true`.
- Hetzner firewall allows only SSH, HTTP, and HTTPS.
- SSH password login disabled.
- Root login disabled or tightly restricted.
- Fail2Ban installed and active.
- Supabase PITR verified.
- KOTSA certificate valid and key permissions are `0600`.
- Telegram security alerts configured.
- Emergency Stop tested.
- Audit export tested.
- Backup timestamps checked within 24 hours.
