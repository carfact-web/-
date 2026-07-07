# Server Hardening

- Disable SSH password authentication.
- Prefer non-root deploy user where practical.
- Restrict SSH by firewall.
- Enable Fail2Ban.
- Use PM2 or systemd restart policy.
- Consider systemd hardening: `NoNewPrivileges`, `PrivateTmp`,
  `ProtectSystem`, and `ReadWritePaths` for app directories.
- Enable logrotate for application and Nginx logs.
- Monitor disk, inode, memory, OOM, and CPU pressure.
- Keep secrets outside Git and outside `public/`.
