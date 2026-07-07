# Uptime Monitoring

## UptimeRobot

- Monitor `https://carfact.kr` every 5 minutes.
- Configure Telegram or email alerts.
- UptimeRobot does not use OpenAI tokens.
- Expected traffic is only a small HTTP request every check interval.

## Endpoint Choice

Use the homepage for public monitoring.

Review carefully before monitoring:

- `/api/kotsa/status`: public but reveals maintenance state.
- `/api/admin/health`: do not expose without authentication.

Avoid monitoring endpoints that require secrets or produce noisy audit logs.
