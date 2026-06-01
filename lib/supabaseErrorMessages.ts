export type SupabaseFailurePhase = "storage-upload" | "db-insert";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const getSupabaseErrorMessage = (error: unknown) => {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (isRecord(error) && typeof error.message === "string" && error.message) {
    return error.message;
  }

  return String(error);
};

export const isRlsPolicyError = (error: unknown) => {
  if (!isRecord(error)) {
    return false;
  }

  const code = String(error.code ?? "");
  const text = [
    error.message,
    error.details,
    error.hint,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return (
    code === "42501" ||
    text.includes("row-level security") ||
    text.includes("rls") ||
    text.includes("permission denied")
  );
};

export const createSupabaseFailureError = (
  phase: SupabaseFailurePhase,
  error: unknown
) => {
  const message = getSupabaseErrorMessage(error);
  const phaseLabel =
    phase === "storage-upload"
      ? "Storage upload 실패"
      : isRlsPolicyError(error)
        ? "RLS policy 실패"
        : "DB insert 실패";

  return new Error(`${phaseLabel}: ${message}`);
};
