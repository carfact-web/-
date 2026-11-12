export function isLocalSandbox() {
  if (process.env.NODE_ENV !== "development" || process.env.NEXT_PUBLIC_LOCAL_SANDBOX !== "1") return false;
  try {
    const url = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "");
    return url.protocol === "http:" && ["127.0.0.1", "localhost"].includes(url.hostname);
  } catch {
    return false;
  }
}
