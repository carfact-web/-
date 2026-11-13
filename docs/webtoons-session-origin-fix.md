# Webtoon administrator session origin validation

A reverse proxy can expose HTTPS on a default public port while Next.js listens
on a different private port. Assigning a portless URL.host does not clear an
existing URL port. Reusing that URL can therefore reject the browser's valid
public Origin before administrator authentication is evaluated.

The session handler now constructs a fresh comparison origin from Host and the
same forwarded-protocol rule. It still compares Origin exactly, including
scheme, hostname and nondefault port. It does not accept a Referer fallback,
merge bare/www origins, trust a client-supplied forwarded host, or add arbitrary
allowed origins. Bearer-token verification, administrator/suspension checks and
HttpOnly/Strict/path/expiry/Secure cookie settings are unchanged. The menu's
relative request and destination paths are unchanged.

Local verification uses the actual local Auth administrator and ordinary user:

- Portless proxied hosts, matching bare/www hosts, default/custom/loopback ports.
- Real session issuance followed by the protected page's administrator check.
- External/missing/null Origin, cross-alias Origin, forwarded-host spoof and
  same-site Referer with missing/foreign Origin remain denied.
- Ordinary, anonymous and service-credential access remain denied.
- Existing desktop/mobile menu navigation, reload, suspension revocation and
  logout checks pass. No credentials or cookie values are logged.

Node HTTP transport is used for proxy regression cases because Node fetch can
replace a supplied Host header with its destination authority. Run:

```sh
sh scripts/with-project-node.sh node scripts/webtoons/session-origin-check.cjs
sh scripts/with-project-node.sh node scripts/webtoons/admin-access-check.cjs
```

Node 22.23.0 lint and TypeScript checks pass (existing lint warnings unchanged).
A normal production-source build passes without preview mode or environment
validation bypass. Its verification copy is not a deployment artifact. Local
fixture tools remain outside the production source allowlist. This fix requires
application code replacement only; no database migration, Storage policy,
OAuth configuration or proxy-header policy change is required.
