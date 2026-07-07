# Backup Guide

## Database

- Verify Supabase PITR or scheduled backups in the Supabase dashboard.
- Track the last verification time in the admin Health dashboard.
- Test restore to a staging project before production restore.

## Storage

- Export important buckets or confirm provider backup policy.
- Record the last storage backup verification time.

## Certificates

- Keep KOTSA certificate and private key backups outside the repository.
- Encrypt offline backups.
- Confirm restore path and file permissions.
