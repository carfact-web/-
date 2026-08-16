import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;

loadEnvConfig(process.cwd());

const requiredPublicEnv = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
];
const forbiddenPublicSecretPrefixes = ["NEXT_PUBLIC_KOTSA_"];

const expectedProductionOrigin = "https://carfact.kr";
const isVercelPreview = process.env.VERCEL_ENV === "preview";
const missing = requiredPublicEnv.filter((key) => !process.env[key]?.trim());

if (!isVercelPreview && missing.length > 0) {
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

if (isVercelPreview && missing.length > 0) {
  console.warn(
    [
      "Preview build is missing optional browser authentication variables:",
      ...missing.map((key) => "- " + key),
      "",
      "The preview will build, but Supabase login controls remain disabled.",
    ].join("\n")
  );
}

const exposedSecretKeys = Object.keys(process.env).filter((key) =>
  forbiddenPublicSecretPrefixes.some((prefix) => key.startsWith(prefix))
);

if (exposedSecretKeys.length > 0) {
  console.error(
    [
      "KOTSA secrets must never be exposed to the client bundle:",
      ...exposedSecretKeys.map((key) => "- " + key),
      "",
      "Use server-only KOTSA_* environment variables instead.",
    ].join("\n")
  );
  process.exit(1);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (
  supabaseUrl &&
  !/^https:\/\/[^\s/]+\.supabase\.co\/?$/.test(supabaseUrl)
) {
  console.error(
    "NEXT_PUBLIC_SUPABASE_URL must be a Supabase project URL, for example https://project-ref.supabase.co"
  );
  process.exit(1);
}

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.APP_URL;
if (siteUrl && !isVercelPreview) {
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
