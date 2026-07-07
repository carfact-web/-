# Sentry Preparation

## Environment

```env
SENTRY_DSN=
```

## Scope

- Track server errors, HTTP 500s, and unhandled exceptions.
- Keep source maps private unless release access is controlled.

## Sensitive Data Filtering

Never send:

- API keys
- Supabase service role key
- KOTSA certificate password
- Private key contents or paths
- Raw vehicle numbers
- Authorization headers
- Cookies or refresh tokens

Add `beforeSend` filtering before enabling production capture.
