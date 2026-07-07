# Fail2Ban Runbook

## Target Policies

- SSH login failure: 5 failures, 24 hour ban.
- Admin login/API failure: `/api/admin`, 5 failures, 24 hour ban.
- KOTSA admin/API failure: `/api/kotsa/admin`, 5 failures, 24 hour ban.

## Suggested Jails

- `sshd`
- `carfact-admin`
- `carfact-kotsa-admin`

## Operations

1. Check status: `fail2ban-client status`.
2. Check jail: `fail2ban-client status sshd`.
3. Unban: `fail2ban-client set <jail> unbanip <ip>`.
4. Add manual app block in the admin KOTSA Health dashboard when needed.

## Dashboard

Fail2Ban events should be mirrored to `security_alert_logs` as
`fail2ban_block` when log forwarding is enabled.
