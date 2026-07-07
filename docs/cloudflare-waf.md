# Cloudflare WAF

## DNS And SSL

- Enable DNS proxy for `carfact.kr` and `www.carfact.kr`.
- Use SSL/TLS mode: Full (strict).
- Keep origin certificate renewal documented.

## Recommended Security Features

- Enable Bot Fight Mode.
- Enable Cloudflare Managed Rules.
- Add rate limit rules for high-risk paths.
- Review WAF events daily during rollout.

## Suggested Rate Limits

- `/api/kotsa/*`: strict per-IP rate limit, challenge or block abnormal spikes.
- `/api/admin/*`: allow trusted countries/IPs where possible, challenge others.
- `/admin`: challenge or restrict to trusted admins.

## Client IP Handling

The app trusts `CF-Connecting-IP` only when:

```env
TRUST_CLOUDFLARE=true
```

Fallback order:

1. `CF-Connecting-IP`
2. `X-Forwarded-For`
3. `X-Real-IP`

Never log API keys, private keys, certificate passwords, or raw vehicle numbers
in Cloudflare rules, notes, or alerts.
