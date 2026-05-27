This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Security Basics

### Environment Variables

Create `.env.local` for local secrets and keep it out of git. The repository `.gitignore` already excludes `.env*`, including `.env.local`.

Do not hard-code API keys, database keys, service role keys, JWT secrets, webhook secrets, or admin tokens in application code. Use environment variables instead:

```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
APP_SECRET=
```

Only expose values with `NEXT_PUBLIC_` when they are safe for browsers. Server-only secrets must not be imported into client components.

### Input Handling

- Vehicle plate numbers are sanitized before routing/storage.
- Mileage accepts digits only and is capped before storage.
- Review content is trimmed, control characters and angle brackets are removed, and validation runs before saving.
- Reviews must be at least 5 characters and no more than 500 characters.
- Profanity, abusive, or hateful terms are blocked through `data/bannedWords.ts` and `utils/reviewValidation.ts`.
- Existing local/mock reviews that fail validation are filtered before display.
- User content must be rendered as React text, never with `dangerouslySetInnerHTML` or manual `innerHTML`.

### Supabase Authorization Draft

Planned tables and access boundaries:

- `users`: users can read and update only their own profile. Admins can read all profiles for moderation.
- `vehicles`: authenticated users can create vehicles they submit. Public reads can be allowed for non-sensitive vehicle report data. Updates should be limited to the creator or trusted admin role.
- `reviews`: authenticated users can create reviews under rate limits and validation. Users can edit/delete their own reviews. Admins can hide or remove abusive reviews.
- `reports`: public read for generated report summaries when no private user data is included. Writes should be server-only through trusted report generation code.
- `admin_actions`: admin-only read/write audit log. Normal users must have no access.

Initial Row Level Security direction:

- Enable RLS on all tables.
- Prefer `auth.uid()` ownership checks for user-created rows.
- Keep service role keys server-only.
- Store moderation actions in `admin_actions` with actor, target, action, reason, and timestamp.
- Mirror client validation on the server before insert/update.
