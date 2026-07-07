"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/utils/cn";

type PreflightStatus = "ERROR" | "OK" | "UNKNOWN" | "WARNING";

interface PreflightCheck {
  guide: string;
  key: string;
  message: string;
  status: PreflightStatus;
  title: string;
}

interface PreflightResponse {
  checkedAt: string;
  checks: PreflightCheck[];
  score: number;
}

const pageClassName = "min-h-screen bg-zinc-50 px-4 py-6 text-zinc-950 sm:px-6";
const shellClassName = "mx-auto grid w-full max-w-5xl gap-4";
const cardClassName =
  "rounded-lg border border-zinc-200 bg-white p-4 shadow-sm shadow-zinc-200/60";
const buttonClassName =
  "inline-flex items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-black text-zinc-800 transition hover:border-zinc-500 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50";

const statusClassName: Record<PreflightStatus, string> = {
  ERROR: "border-red-200 bg-red-50 text-red-700",
  OK: "border-blue-200 bg-blue-50 text-blue-700",
  UNKNOWN: "border-zinc-200 bg-zinc-50 text-zinc-600",
  WARNING: "border-orange-200 bg-orange-50 text-orange-700",
};

const fetchPreflight = async (accessToken: string) => {
  const response = await fetch("/api/admin/preflight", {
    headers: {
      Authorization: "Bearer " + accessToken,
    },
  });

  if (!response.ok) {
    throw new Error("preflight request failed");
  }

  return (await response.json()) as PreflightResponse;
};

export default function AdminPreflightPage() {
  const { isAdmin, isAuthReady, isProfileReady, session } = useAuth();
  const accessToken = session?.access_token ?? "";
  const [data, setData] = useState<PreflightResponse | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const canAccess = isAuthReady && isProfileReady && isAdmin;

  const loadPreflight = async () => {
    if (!accessToken) {
      return;
    }

    setError("");
    setIsLoading(true);

    try {
      setData(await fetchPreflight(accessToken));
    } catch {
      setError("운영 준비 점검 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!canAccess || !accessToken) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setError("");
      setIsLoading(true);
      fetchPreflight(accessToken)
        .then((payload) => setData(payload))
        .catch(() => setError("운영 준비 점검 중 오류가 발생했습니다."))
        .finally(() => setIsLoading(false));
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [accessToken, canAccess]);

  const summary = useMemo(() => {
    const checks = data?.checks ?? [];

    return {
      error: checks.filter((check) => check.status === "ERROR").length,
      ok: checks.filter((check) => check.status === "OK").length,
      unknown: checks.filter((check) => check.status === "UNKNOWN").length,
      warning: checks.filter((check) => check.status === "WARNING").length,
    };
  }, [data?.checks]);

  if (!isAuthReady || !isProfileReady) {
    return (
      <main className={pageClassName}>
        <div className={shellClassName}>
          <section className={cardClassName}>관리자 권한을 확인하고 있습니다.</section>
        </div>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className={pageClassName}>
        <div className={shellClassName}>
          <section className={cardClassName}>관리자 권한이 필요합니다.</section>
        </div>
      </main>
    );
  }

  return (
    <main className={pageClassName}>
      <div className={shellClassName}>
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-black text-[#2563EB]">Pre-flight Check</p>
            <h1 className="mt-1 text-2xl font-black">운영 준비 점검</h1>
            <p className="mt-1 text-sm font-semibold text-zinc-500">
              KOTSA 실제 API 호출 없이 운영 반영 전 필수 조건만 확인합니다.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link className={buttonClassName} href="/admin">
              관리자 대시보드
            </Link>
            <button
              type="button"
              className={buttonClassName}
              disabled={isLoading}
              onClick={() => void loadPreflight()}
            >
              {isLoading ? "점검 중" : "새로고침/재점검"}
            </button>
          </div>
        </header>

        <section className={cardClassName}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-black text-zinc-500">운영 준비도</p>
              <p className="mt-1 text-4xl font-black">
                {(data?.score ?? 0).toLocaleString()}
                <span className="text-base text-zinc-400"> /100</span>
              </p>
            </div>
            <div className="grid grid-cols-4 gap-2 text-center text-xs font-black">
              <span className="rounded-lg bg-blue-50 px-3 py-2 text-blue-700">
                OK {summary.ok}
              </span>
              <span className="rounded-lg bg-orange-50 px-3 py-2 text-orange-700">
                WARN {summary.warning}
              </span>
              <span className="rounded-lg bg-red-50 px-3 py-2 text-red-700">
                ERR {summary.error}
              </span>
              <span className="rounded-lg bg-zinc-100 px-3 py-2 text-zinc-600">
                UNK {summary.unknown}
              </span>
            </div>
          </div>
          {data?.checkedAt ? (
            <p className="mt-3 text-xs font-semibold text-zinc-400">
              마지막 점검: {new Date(data.checkedAt).toLocaleString("ko-KR")}
            </p>
          ) : null}
          {error ? <p className="mt-3 text-sm font-bold text-red-600">{error}</p> : null}
        </section>

        <section className="grid gap-3">
          {(data?.checks ?? []).map((check) => (
            <article className={cardClassName} key={check.key}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <h2 className="text-sm font-black">{check.title}</h2>
                  <p className="mt-1 text-sm font-semibold text-zinc-500">
                    {check.message}
                  </p>
                </div>
                <span
                  className={cn(
                    "inline-flex shrink-0 rounded-full border px-3 py-1 text-xs font-black",
                    statusClassName[check.status],
                  )}
                >
                  {check.status}
                </span>
              </div>
              <Link
                className="mt-3 inline-flex text-xs font-black text-[#2563EB] hover:underline"
                href={check.guide}
              >
                해결 가이드
              </Link>
            </article>
          ))}
          {!data && !isLoading ? (
            <section className={cardClassName}>점검 결과가 없습니다.</section>
          ) : null}
        </section>
      </div>
    </main>
  );
}
