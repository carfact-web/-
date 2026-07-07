# Incident Response

1. Classify severity: warning, high, or critical.
2. Record request IDs, IPs, endpoints, and timestamps.
3. Use Emergency Stop for KOTSA exposure or unstable upstream behavior.
4. Block attacking IPs in the dashboard and at Hetzner/Cloudflare when needed.
5. Rotate exposed secrets.
6. Review `security_alert_logs` and `kotsa_api_audit_logs`.
7. Write a short post-incident report.

Never include API keys, certificate passwords, private keys, or raw vehicle
numbers in incident notes.
