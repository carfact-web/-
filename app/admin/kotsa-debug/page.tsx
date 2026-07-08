"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/utils/cn";

type RequestMode = "full" | "minimal";
type ContentTypeMode = "charset" | "plain";

interface DebugResponse {
  diagnostics: {
    encryption: {
      base64Length: number;
      derPackageOk: boolean;
      derSummary: {
        objectCount: number;
        objects: Array<{
          byteLength: number;
          index: number;
          length: number;
          tag: string;
          tagName: string;
        }>;
        sequenceLength: number;
        sequenceTag: string;
        totalLength: number;
      } | null;
      requestSha256: string;
      success: boolean;
    };
    http: {
      accept: string;
      contentLength: number;
      contentType: string;
      endpoint: string;
      host: string;
      method: string;
      responseTimeMs: number;
      status: number;
      tls: boolean;
    };
    request: {
      fieldKeys: string[];
      linkInfoCd: string;
      mode: RequestMode;
      plainJsonByteLength: number;
      plainJsonMasked: string;
      plainJsonSha256: string;
      vehicleAssertions: {
        byteLength: number;
        hasMaskCharacter: boolean;
        hasPercentEncodingCharacter: boolean;
        hasWhitespace: boolean;
        isNfc: boolean;
        isNfd: boolean;
        stringLength: number;
      };
      vehicleNumberMasked: string;
      vhclNoExists: boolean;
    };
    response: {
      bodyLength: number;
      decryptError: string | null;
      decryptOk: boolean;
      decryptedJsonMasked: string | null;
      headers: {
        connection: string | null;
        contentLength: string | null;
        contentType: string | null;
        date: string | null;
        hubResult: string | null;
        hubResultCode: string | null;
        server: string | null;
        transactionId: string | null;
        transferEncoding: string | null;
      };
    };
    raw: {
      httpRequestSummary: {
        accept: string;
        bodyHasTrailingNewline: boolean;
        bodyLength: number;
        bodyShape: string;
        contentLength: number;
        contentType: string;
        finalBodyLastChar: string;
        method: string;
        transferEncoding: string | null;
        url: string;
      };
      httpResponseSummary: {
        connection: string | null;
        contentLength: string | null;
        contentType: string | null;
        date: string | null;
        hubResult: string | null;
        hubResultCode: string | null;
        server: string | null;
        transactionId: string | null;
        transferEncoding: string | null;
      };
    };
    structure: {
      dataExists: boolean;
      dataLength: number | null;
      dataType: string;
      fields: {
        atmbNmExists: boolean;
        frstRegYmdExists: boolean;
        linkRsltCd: unknown;
        linkRsltDtl: unknown;
        prcsImprtyRsnCd: unknown;
        prcsImprtyRsnDtls: unknown;
        recordExists: boolean;
        recordLength: number;
        usgSeNmExists: boolean;
        vhrnoExists: boolean;
      };
      firstRowKeys: string[];
    };
  };
}

const pageClassName = "min-h-screen bg-zinc-50 px-4 py-6 text-zinc-950 sm:px-6";
const shellClassName = "mx-auto grid w-full max-w-6xl gap-4";
const cardClassName =
  "rounded-lg border border-zinc-200 bg-white p-4 shadow-sm shadow-zinc-200/60";
const inputClassName =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-950 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-500/20";
const buttonClassName =
  "inline-flex items-center justify-center rounded-lg border border-zinc-900 bg-zinc-950 px-4 py-2 text-sm font-black text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50";
const secondaryButtonClassName =
  "inline-flex items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-black text-zinc-800 transition hover:border-zinc-500 hover:bg-zinc-100";
const labelClassName = "text-xs font-black uppercase text-zinc-500";
const valueClassName = "mt-1 break-all text-sm font-bold text-zinc-900";

const boolText = (value: boolean) => (value ? "성공" : "실패");
const existsText = (value: boolean) => (value ? "존재" : "없음");

const codeBlockClassName =
  "mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded-lg border border-zinc-200 bg-zinc-950 p-3 text-xs font-semibold text-zinc-50";

function Field({
  label,
  value,
}: {
  label: string;
  value: boolean | number | string | null | undefined | unknown;
}) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
      <p className={labelClassName}>{label}</p>
      <p className={valueClassName}>
        {value === null || value === undefined ? "null" : String(value)}
      </p>
    </div>
  );
}

function Section({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  return (
    <section className={cardClassName}>
      <h2 className="text-base font-black">{title}</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {children}
      </div>
    </section>
  );
}

export default function KotsaDebugPage() {
  const { isAdmin, isAuthReady, isProfileReady, session } = useAuth();
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [requestMode, setRequestMode] = useState<RequestMode>("minimal");
  const [contentTypeMode, setContentTypeMode] =
    useState<ContentTypeMode>("plain");
  const [nfcNormalize, setNfcNormalize] = useState(true);
  const [data, setData] = useState<DebugResponse | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const canAccess = isAuthReady && isProfileReady && isAdmin;
  const diagnostics = data?.diagnostics ?? null;

  const runTest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!session?.access_token || isLoading) {
      return;
    }

    setError("");
    setData(null);
    setIsLoading(true);

    try {
      const response = await fetch("/api/admin/kotsa-debug-test", {
        body: JSON.stringify({
          contentTypeMode,
          nfcNormalize,
          requestMode,
          vehicleNumber,
        }),
        cache: "no-store",
        headers: {
          Authorization: "Bearer " + session.access_token,
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as
        | DebugResponse
        | { error?: string }
        | null;

      if (!response.ok || !payload || !("diagnostics" in payload)) {
        setError(
          payload && "error" in payload && payload.error
            ? payload.error
            : "KOTSA debug test failed.",
        );
        return;
      }

      setData(payload);
    } catch {
      setError("KOTSA debug test failed.");
    } finally {
      setIsLoading(false);
    }
  };

  if (!isAuthReady || !isProfileReady) {
    return (
      <main className={pageClassName}>
        <div className={shellClassName}>
          <section className={cardClassName}>관리자 권한을 확인하고 있습니다.</section>
        </div>
      </main>
    );
  }

  if (!canAccess) {
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
            <p className="text-xs font-black text-red-600">KOTSA Debug</p>
            <h1 className="mt-1 text-2xl font-black">KOTSA 직접 호출 계측기</h1>
            <p className="mt-1 text-sm font-semibold text-zinc-500">
              후기, 리포트, 자동저장, 캐시, 쿼터와 분리해 호출 단계만 확인합니다.
            </p>
          </div>
          <Link className={secondaryButtonClassName} href="/admin">
            관리자 대시보드
          </Link>
        </header>

        <form className={cardClassName} onSubmit={(event) => void runTest(event)}>
          <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
            <label className="block">
              <span className={labelClassName}>차량번호</span>
              <input
                className={cn(inputClassName, "mt-1")}
                value={vehicleNumber}
                onChange={(event) => setVehicleNumber(event.target.value)}
                placeholder="차량번호 입력"
              />
            </label>
            <button
              className={buttonClassName}
              disabled={isLoading || !vehicleNumber.trim()}
              type="submit"
            >
              {isLoading ? "호출 중" : "KOTSA 직접 호출 테스트"}
            </button>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm font-bold">
              <input
                checked={requestMode === "minimal"}
                onChange={() => setRequestMode("minimal")}
                type="radio"
              />
              최소 요청
            </label>
            <label className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm font-bold">
              <input
                checked={requestMode === "full"}
                onChange={() => setRequestMode("full")}
                type="radio"
              />
              전체 요청
            </label>
            <label className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm font-bold">
              <input
                checked={contentTypeMode === "charset"}
                onChange={(event) =>
                  setContentTypeMode(event.target.checked ? "charset" : "plain")
                }
                type="checkbox"
              />
              charset 포함
            </label>
            <label className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm font-bold">
              <input
                checked={nfcNormalize}
                onChange={(event) => setNfcNormalize(event.target.checked)}
                type="checkbox"
              />
              NFC normalize
            </label>
          </div>

          {error ? (
            <p className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">
              {error}
            </p>
          ) : null}
        </form>

        {diagnostics ? (
          <>
            <Section title="요청 생성 상태">
              <Field label="JSON 생성" value="성공" />
              <Field
                label="요청 JSON 필드"
                value={diagnostics.request.fieldKeys.join(", ")}
              />
              <Field label="linkInfoCd" value={diagnostics.request.linkInfoCd} />
              <Field
                label="vhclNo"
                value={existsText(diagnostics.request.vhclNoExists)}
              />
              <Field
                label="차량번호"
                value={diagnostics.request.vehicleNumberMasked}
              />
              <Field
                label="마스킹 문자 포함"
                value={diagnostics.request.vehicleAssertions.hasMaskCharacter}
              />
              <Field
                label="URL 인코딩 문자 포함"
                value={
                  diagnostics.request.vehicleAssertions.hasPercentEncodingCharacter
                }
              />
              <Field
                label="공백 포함"
                value={diagnostics.request.vehicleAssertions.hasWhitespace}
              />
            </Section>

            <Section title="암호화 상태">
              <Field
                label="암호화"
                value={boolText(diagnostics.encryption.success)}
              />
              <Field
                label="Base64 길이"
                value={diagnostics.encryption.base64Length}
              />
              <Field
                label="Request SHA256"
                value={diagnostics.encryption.requestSha256}
              />
              <Field
                label="DER package"
                value={boolText(diagnostics.encryption.derPackageOk)}
              />
            </Section>

            <Section title="HTTP 연결 상태">
              <Field label="endpoint" value={diagnostics.http.endpoint} />
              <Field label="method" value={diagnostics.http.method} />
              <Field label="HTTP status" value={diagnostics.http.status} />
              <Field
                label="response time"
                value={diagnostics.http.responseTimeMs + "ms"}
              />
              <Field label="TLS" value={boolText(diagnostics.http.tls)} />
              <Field label="Host" value={diagnostics.http.host} />
              <Field label="Content-Type" value={diagnostics.http.contentType} />
              <Field label="Accept" value={diagnostics.http.accept} />
              <Field
                label="Content-Length"
                value={diagnostics.http.contentLength}
              />
            </Section>

            <Section title="응답 상태">
              <Field
                label="hub_result"
                value={diagnostics.response.headers.hubResult}
              />
              <Field
                label="hub_result_code"
                value={diagnostics.response.headers.hubResultCode}
              />
              <Field
                label="response body length"
                value={diagnostics.response.bodyLength}
              />
              <Field
                label="response decrypt"
                value={boolText(diagnostics.response.decryptOk)}
              />
              <Field
                label="transaction_id"
                value={diagnostics.response.headers.transactionId}
              />
              <Field label="decrypt error" value={diagnostics.response.decryptError} />
            </Section>

            <Section title="복호화 후 JSON">
              <Field
                label="linkRsltCd"
                value={diagnostics.structure.fields.linkRsltCd}
              />
              <Field
                label="linkRsltDtl"
                value={diagnostics.structure.fields.linkRsltDtl}
              />
              <Field
                label="prcsImprtyRsnCd"
                value={diagnostics.structure.fields.prcsImprtyRsnCd}
              />
              <Field
                label="prcsImprtyRsnDtls"
                value={diagnostics.structure.fields.prcsImprtyRsnDtls}
              />
              <Field
                label="vhrno"
                value={existsText(diagnostics.structure.fields.vhrnoExists)}
              />
              <Field
                label="atmbNm"
                value={existsText(diagnostics.structure.fields.atmbNmExists)}
              />
              <Field
                label="usgSeNm"
                value={existsText(diagnostics.structure.fields.usgSeNmExists)}
              />
              <Field
                label="frstRegYmd"
                value={existsText(diagnostics.structure.fields.frstRegYmdExists)}
              />
              <Field
                label="record"
                value={existsText(diagnostics.structure.fields.recordExists)}
              />
              <Field
                label="record length"
                value={diagnostics.structure.fields.recordLength}
              />
            </Section>

            <Section title="원본 응답 구조">
              <Field label="data" value={existsText(diagnostics.structure.dataExists)} />
              <Field label="data type" value={diagnostics.structure.dataType} />
              <Field label="data length" value={diagnostics.structure.dataLength} />
              <Field
                label="data[0] keys"
                value={diagnostics.structure.firstRowKeys.join(", ")}
              />
            </Section>

            <section className={cardClassName}>
              <h2 className="text-base font-black">Raw View</h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <Field
                  label="Plain JSON SHA256"
                  value={diagnostics.request.plainJsonSha256}
                />
                <Field
                  label="Plain JSON byte length"
                  value={diagnostics.request.plainJsonByteLength}
                />
                <Field
                  label="Base64 length"
                  value={diagnostics.encryption.base64Length}
                />
                <Field
                  label="DER object count"
                  value={diagnostics.encryption.derSummary?.objectCount}
                />
                <Field
                  label="DER object lengths"
                  value={diagnostics.encryption.derSummary?.objects
                    .map((object) => `${object.index}:${object.length}`)
                    .join(", ")}
                />
                <Field
                  label="prcsImprtyRsnCd / DtIs"
                  value={`${diagnostics.structure.fields.prcsImprtyRsnCd ?? "null"} / ${
                    diagnostics.structure.fields.prcsImprtyRsnDtls ?? "null"
                  }`}
                />
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <div>
                  <p className={labelClassName}>Plain JSON masked</p>
                  <pre className={codeBlockClassName}>
                    {diagnostics.request.plainJsonMasked}
                  </pre>
                </div>
                <div>
                  <p className={labelClassName}>DER objects</p>
                  <pre className={codeBlockClassName}>
                    {JSON.stringify(diagnostics.encryption.derSummary, null, 2)}
                  </pre>
                </div>
                <div>
                  <p className={labelClassName}>HTTP request summary</p>
                  <pre className={codeBlockClassName}>
                    {JSON.stringify(diagnostics.raw.httpRequestSummary, null, 2)}
                  </pre>
                </div>
                <div>
                  <p className={labelClassName}>HTTP response summary</p>
                  <pre className={codeBlockClassName}>
                    {JSON.stringify(diagnostics.raw.httpResponseSummary, null, 2)}
                  </pre>
                </div>
                <div>
                  <p className={labelClassName}>Decrypted JSON masked</p>
                  <pre className={codeBlockClassName}>
                    {diagnostics.response.decryptedJsonMasked ?? "null"}
                  </pre>
                </div>
                <div>
                  <p className={labelClassName}>response data[0] key list</p>
                  <pre className={codeBlockClassName}>
                    {diagnostics.structure.firstRowKeys.join("\n")}
                  </pre>
                </div>
              </div>
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}
