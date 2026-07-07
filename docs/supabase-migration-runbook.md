# Supabase Migration Runbook

## Order

1. Confirm Supabase backup or PITR.
2. Apply existing migrations in timestamp order.
3. Apply `20260707050000_add_kotsa_api_audit_logs.sql`.

This migration creates or extends:

- `kotsa_api_audit_logs`
- `security_alert_logs`
- `security_blocked_ips`
- `kotsa_query_limit_policies`
- `kotsa_operation_settings`
- `admin_known_ips`

## Pre-Apply Checks

```sql
select to_regclass('public.kotsa_api_audit_logs');
select to_regclass('public.security_alert_logs');
select to_regclass('public.security_blocked_ips');
```

## Apply

```bash
supabase db push --linked
```

## Post-Apply Checks

```sql
select column_name from information_schema.columns
where table_schema = 'public'
  and table_name = 'kotsa_api_audit_logs';

select tablename, policyname from pg_policies
where schemaname = 'public'
  and tablename in (
    'kotsa_api_audit_logs',
    'security_alert_logs',
    'security_blocked_ips',
    'kotsa_query_limit_policies',
    'kotsa_operation_settings',
    'admin_known_ips'
  );
```

Verify admin UI can read logs and policies after deployment.
