import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;

loadEnvConfig(process.cwd());

const requiredPublicEnv = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
];

const expectedProductionOrigin = "https://carfact.kr";
const missing = requiredPublicEnv.filter((key) => !process.env[key]?.trim());

if (missing.length > 0) {
  console.error(
    [
      "Missing required environment variables for the client bundle:",
      ...missing.map((key) => "- " + key),
      "",
      "Set these before running a production build. Without them, login buttons",
      "are disabled because Supabase Auth is not configured in the browser.",
    ].join("\n")
  );
  process.exit(1);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (!/^https:\/\/[^\s/]+\.supabase\.co\/?$/.test(supabaseUrl)) {
  console.error(
    "NEXT_PUBLIC_SUPABASE_URL must be a Supabase project URL, for example https://project-ref.supabase.co"
  );
  process.exit(1);
}

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.APP_URL;
if (siteUrl) {
  let origin;

  try {
    origin = new URL(siteUrl).origin;
  } catch {
    console.error("NEXT_PUBLIC_SITE_URL or APP_URL must be a valid URL.");
    process.exit(1);
  }

  if (origin !== expectedProductionOrigin) {
    console.error(
      "NEXT_PUBLIC_SITE_URL or APP_URL must resolve to " + expectedProductionOrigin + " for production builds."
    );
    process.exit(1);
  }
}
