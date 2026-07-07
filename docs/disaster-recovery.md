# Disaster Recovery

1. Enable KOTSA Emergency Stop.
2. Restrict Hetzner firewall.
3. Preserve server and database evidence.
4. Rotate KOTSA, Supabase, Telegram, deploy, and SSH credentials.
5. Restore Supabase data to staging first.
6. Rebuild the server from a trusted commit.
7. Reapply secrets outside the repository.
8. Run build, health checks, and a controlled KOTSA test.
9. Disable Emergency Stop only after verification.
