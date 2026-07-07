# PM2 Deploy User Migration

## Current State

- `carfact` runs under PM2 as `root`.
- A `deploy` user can be prepared without stopping the current service.

## Safe Migration Plan

1. Create `deploy` user and install SSH public key.
2. Clone or move the app to `/home/deploy/carfact`.
3. Keep secrets outside Git.
4. Prefer `/etc/carfact/carfact.env` or `/home/deploy/.carfact-env` with `600`
   permissions.
5. Grant read access only to required KOTSA certificate files.
6. Start PM2 as `deploy` on a different temporary port.
7. Smoke test through localhost.
8. Switch Nginx upstream.
9. Stop root PM2 process only after the deploy process is healthy.
10. Run `pm2 startup` and `pm2 save` under `deploy`.

## Commands Sketch

```bash
adduser --disabled-password deploy
install -d -m 700 -o deploy -g deploy /home/deploy/.ssh
rsync -a /root/carfact/ /home/deploy/carfact/
chown -R deploy:deploy /home/deploy/carfact
su - deploy
cd /home/deploy/carfact
npm install
npm run build
pm2 start npm --name carfact -- start
pm2 save
```

Do not set `PermitRootLogin=no` until deploy user PM2 and SSH recovery have
been verified.
