"use client";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { webtoonRequest, mediaUrl } from "@/lib/webtoons/client";
import { PdfViewer } from "./PdfViewer";
import { AdminImage } from "./AdminImage";
import type {
  WebtoonUploadDraft,
  WebtoonAsset,
  WebtoonWork,
} from "@/types/webtoon";
import type { DraftData, DraftFile } from "@/lib/webtoons/draft";
const LegacyEditor = dynamic(() => import("./LegacyWebtoonEditor"));
const storagePrefix = "carfact.webtoon.draft.v1";
const button = "rounded-lg border px-4 py-2 font-bold disabled:opacity-40";
const input = "block w-full rounded-lg border p-3";
const endpoint = "/api/admin/webtoons/drafts";
function draftData(d: WebtoonUploadDraft) {
  return d.data as unknown as DraftData;
}
function emptyData(): DraftData {
  return {
    jobs: [],
    pageIds: [],
    pdfAssetId: null,
    coverAssetId: null,
    coverUploadId: crypto.randomUUID(),
    title: "",
    popup: false,
    message: "",
    startsAt: "",
    endsAt: "",
  };
}
async function upload(
  workId: string,
  id: string,
  file: File,
  onProgress: (percent: number) => void,
  onProcessing: () => void,
) {
  const { data } = supabase
    ? await supabase.auth.getSession()
    : { data: { session: null } };
  return new Promise<WebtoonAsset>((resolve, reject) => {
    const xhr = new XMLHttpRequest(),
      form = new FormData();
    form.set("workId", workId);
    form.set("file", file);
    xhr.open(
      "POST",
      file.type === "application/pdf"
        ? "/api/admin/webtoons/pdf-upload"
        : "/api/admin/webtoons/upload",
    );
    xhr.setRequestHeader(
      "Authorization",
      "Bearer " + (data.session?.access_token ?? ""),
    );
    xhr.setRequestHeader("X-Upload-Id", id);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable)
        onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.upload.onload = onProcessing;
    xhr.onload = () => {
      let result;
      try {
        result = JSON.parse(xhr.responseText);
      } catch {
        reject(
          Error(
            `서버 응답 오류 (${xhr.status}). 업로드 제한이나 연결 상태를 확인하고 재시도해주세요.`,
          ),
        );
        return;
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve(result);
      else reject(Error(result.error || `업로드 실패 (${xhr.status})`));
    };
    xhr.onerror = () =>
      reject(
        Error(
          "네트워크 연결이 끊겼습니다. 다시 시도하면 완료된 파일을 재사용합니다.",
        ),
      );
    xhr.timeout = 120000;
    xhr.ontimeout = () =>
      reject(
        Error(
          "서버 처리 대기 시간이 초과됐습니다. 같은 파일로 재시도해주세요.",
        ),
      );
    xhr.send(form);
  });
}
async function pdfCover(asset: WebtoonAsset) {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/api/webtoons/pdfjs/6.5.438/worker";
  const { data } = supabase
    ? await supabase.auth.getSession()
    : { data: { session: null } };
  const task = pdfjs.getDocument({
    url: mediaUrl(asset.id),
    httpHeaders: { Authorization: "Bearer " + data.session?.access_token },
    cMapUrl: "/api/webtoons/pdfjs/6.5.438/cmaps/",
    cMapPacked: true,
    standardFontDataUrl: "/api/webtoons/pdfjs/6.5.438/standard_fonts/",
    wasmUrl: "/api/webtoons/pdfjs/6.5.438/wasm/",
    enableXfa: false,
  });
  const canvas = document.createElement("canvas");
  try {
    const doc = await task.promise,
      page = await doc.getPage(1),
      base = page.getViewport({ scale: 1 }),
      viewport = page.getViewport({ scale: Math.min(1, 1200 / base.width) });
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    if (canvas.width * canvas.height > 4000000)
      throw Error(
        "표지 크기가 너무 큽니다. 추가 설정에서 표지를 선택해주세요.",
      );
    const context = canvas.getContext("2d");
    if (!context) throw Error("표지를 생성할 수 없습니다.");
    await page.render({
      canvas,
      canvasContext: context,
      viewport,
      annotationMode: 0,
    }).promise;
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(Error("표지 생성 실패"))),
        "image/webp",
        0.92,
      ),
    );
    return new File([blob], "cover.webp", { type: "image/webp" });
  } finally {
    canvas.width = 0;
    canvas.height = 0;
    await task.destroy();
  }
}
function DraftFileList({
  jobs,
  busy,
  onMove,
}: {
  jobs: DraftFile[];
  busy: boolean;
  onMove: (index: number, direction: number) => Promise<void>;
}) {
  return (
    <ol className="space-y-2" aria-label="업로드 파일 순서">
      {jobs.map((job, i) => (
        <li
          key={job.id}
          className="flex flex-wrap items-center gap-2 rounded border bg-white p-3"
        >
          <span className="min-w-0 flex-1 break-all">
            {i + 1}. {job.name} · {job.asset ? "완료" : "대기"}
          </span>
          {job.type !== "application/pdf"
            ? [-1, 1].map((direction) => (
                <button
                  className={button}
                  key={direction}
                  disabled={
                    busy || i + direction < 0 || i + direction >= jobs.length
                  }
                  aria-label={`${i + 1}번째 이미지 ${direction < 0 ? "위로" : "아래로"}`}
                  onClick={() => void onMove(i, direction)}
                >
                  {direction < 0 ? "↑" : "↓"}
                </button>
              ))
            : null}
        </li>
      ))}
    </ol>
  );
}
export default function WebtoonAdminEditor() {
  const auth = useAuth();
  return <FileFirstComposer key={`${auth.user?.id ?? "anonymous"}:${auth.isAdmin}`} auth={auth} />;
}
function FileFirstComposer({auth}: {auth: ReturnType<typeof useAuth>}) {
  const { isAdmin, isAuthReady, isProfileReady, user } = auth;
  const router = useRouter();
  const storageKey = `${storagePrefix}:${user?.id ?? "anonymous"}`;
  const [draft, setDraft] = useState<WebtoonUploadDraft | null>(null),
    [data, setData] = useState<DraftData | null>(null),
    [works, setWorks] = useState<WebtoonWork[]>([]),
    [series, setSeries] = useState(""),
    [number, setNumber] = useState("");
  const [busy, setBusy] = useState(false),
    [stage, setStage] = useState("파일을 선택해주세요"),
    [progress, setProgress] = useState(0),
    [error, setError] = useState(""),
    [legacy, setLegacy] = useState(false);
  const files = useRef(new Map<string, File>()),
    current = useRef<WebtoonUploadDraft | null>(null);
  const apply = (d: WebtoonUploadDraft) => {
    current.current = d;
    setDraft(d);
    const value = draftData(d);
    setData(value);
  };
  const edit = (changes: Partial<DraftData>) => {
    setData((value) => {
      if (!value) return value;
      const next = { ...value, ...changes };
      return next;
    });
  };
  useEffect(() => {
    if (!isAdmin) return;
    let alive = true;
    webtoonRequest<{ works: WebtoonWork[] }>("/api/admin/webtoons")
      .then((r) => {
        if (alive)
          setWorks(r.works.filter((w) => w.published && w.cover_asset_id));
      })
      .catch(() => {});
    const id = localStorage.getItem(storageKey);
    if (id)
      webtoonRequest<WebtoonUploadDraft>(
        endpoint + "?id=" + encodeURIComponent(id),
      )
        .then((d) => {
          if (alive && d.status === "editing") {
            current.current = d;
            setDraft(d);
            const value = draftData(d);
            setData(value);
            setStage(
              value.ready
                ? "미리보기 준비 완료"
                : "임시 업로드를 복구했습니다. 미완료 파일은 다시 선택해주세요.",
            );
          }
        })
        .catch(() => {
          if (alive)
            setError(
              "이전 임시 업로드를 불러오지 못했습니다. 연결 상태를 확인해주세요.",
            );
        });
    return () => {
      alive = false;
    };
  }, [isAdmin, storageKey]);
  async function save(value: DraftData) {
    const d = current.current;
    if (!d) throw Error("임시 업로드가 없습니다.");
    const saved = await webtoonRequest<WebtoonUploadDraft>(endpoint, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: d.id, version: d.version, data: value }),
    });
    apply(saved);
    return saved;
  }
  async function select(inputFiles: File[]) {
    if (busy) return;
    setError("");
    setBusy(true);
    try {
      const selected = inputFiles.sort((a, b) =>
        a.name.localeCompare(b.name, "ko", { numeric: true }),
      );
      if (!selected.length) return;
      const pdf = selected.some(
        (f) => /\.pdf$/i.test(f.name) || f.type === "application/pdf",
      );
      if ((pdf && selected.length !== 1) || selected.length > 100)
        throw Error("PDF 한 개 또는 이미지 최대 100장을 선택해주세요.");
      for (const file of selected)
        if (
          !file.size ||
          file.size > (pdf ? 50 : 10) * 1048576 ||
          (!pdf && !/^image\/(png|jpeg|webp)$/.test(file.type))
        )
          throw Error(
            "PDF는 50MiB, PNG·JPEG·WebP 이미지는 장당 10MiB 이하입니다.",
          );
      let d = current.current,
        value = data;
      if (!d) {
        const id = localStorage.getItem(storageKey) || crypto.randomUUID();
        localStorage.setItem(storageKey, id);
        d = await webtoonRequest<WebtoonUploadDraft>(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id,
            workId: series || null,
            number: number ? Number(number) : null,
          }),
        });
        current.current = d;
        value = emptyData();
      }
      if (!value) value = emptyData();
      const jobs: DraftFile[] = [];
      for (const file of selected) {
        const sha256 = Array.from(
          new Uint8Array(
            await crypto.subtle.digest("SHA-256", await file.arrayBuffer()),
          ),
        )
          .map((n) => n.toString(16).padStart(2, "0"))
          .join("");
        const old = value.jobs.find((j) => j.sha256 === sha256);
        const job = old ?? {
          id: crypto.randomUUID(),
          name: file.name,
          size: file.size,
          sha256,
          type: pdf ? "application/pdf" : file.type,
        };
        files.current.set(
          job.id,
          pdf && file.type !== "application/pdf"
            ? new File([file], file.name, { type: "application/pdf" })
            : file,
        );
        jobs.push(job);
      }
      if (new Set(jobs.map((j) => j.id)).size !== jobs.length)
        throw Error("같은 파일을 중복 선택했습니다. 중복 파일을 제외해주세요.");
      if (
        value.jobs.length &&
        jobs.some((j) => !value!.jobs.some((old) => old.id === j.id))
      )
        throw Error(
          "기존 임시 업로드와 다른 파일입니다. 먼저 취소하고 새로 시작해주세요.",
        );
      await save({ ...value, jobs: value.jobs.length ? value.jobs : jobs });
      setStage("파일 선택 완료 · 업로드를 시작해주세요");
    } catch (e) {
      setError(e instanceof Error ? e.message : "파일 선택 실패");
    } finally {
      setBusy(false);
    }
  }
  async function process() {
    if (!current.current || !data) return;
    setBusy(true);
    setError("");
    try {
      let value = { ...data, jobs: data.jobs.map((j) => ({ ...j })) };
      for (let i = 0; i < value.jobs.length; i++) {
        const job = value.jobs[i];
        if (job.asset) continue;
        const file = files.current.get(job.id);
        if (!file)
          throw Error(
            `${job.name} 파일을 다시 선택해주세요. 완료된 파일은 다시 업로드하지 않습니다.`,
          );
        setStage(`업로드 중 · ${i + 1}/${value.jobs.length}`);
        setProgress(0);
        job.asset = await upload(
          current.current!.work_id,
          job.id,
          file,
          setProgress,
          () => setStage(`최적화 중 · ${i + 1}/${value.jobs.length}`),
        );
        value = {
          ...value,
          pdfAssetId: job.type === "application/pdf" ? job.asset.id : null,
          pageIds: value.jobs
            .filter((j) => j.type !== "application/pdf" && j.asset)
            .map((j) => j.asset!.id),
        };
        await save(value);
      }
      if (!value.coverAssetId) {
        setStage("최적화 중 · 첫 페이지 표지 생성");
        const first = value.jobs[0];
        const cover =
          first.type === "application/pdf"
            ? await pdfCover(first.asset!)
            : files.current.get(first.id);
        if (!cover)
          throw Error("표지를 생성하려면 첫 이미지 파일을 다시 선택해주세요.");
        const asset = await upload(
          current.current!.work_id,
          value.coverUploadId,
          cover,
          setProgress,
          () => setStage("최적화 중 · 표지 저장"),
        );
        value = { ...value, coverAssetId: asset.id };
        await save(value);
      }
      setProgress(100);
      setStage("미리보기 준비 완료");
    } catch (e) {
      setError(e instanceof Error ? e.message : "처리 실패");
    } finally {
      setBusy(false);
    }
  }
  async function move(index: number, direction: number) {
    if (!data || busy) return;
    const jobs = [...data.jobs];
    [jobs[index], jobs[index + direction]] = [
      jobs[index + direction],
      jobs[index],
    ];
    setBusy(true);
    try {
      await save({
        ...data,
        jobs,
        pageIds: jobs.filter((j) => j.asset).map((j) => j.asset!.id),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "순서 저장 실패");
    } finally {
      setBusy(false);
    }
  }
  async function publish() {
    if (!data || !draft) return;
    setBusy(true);
    setStage("게시 중");
    setError("");
    try {
      const saved = await save(data),
        promotion = data.popup
          ? await webtoonRequest<{ settings: { version: number } }>(
              "/api/admin/webtoons/promotion",
            )
          : null;
      const published = await webtoonRequest<WebtoonUploadDraft>(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: saved.id,
          version: saved.version,
          publish: true,
          title: data.title,
          popup: data.popup,
          message: data.message,
          startsAt: data.startsAt,
          endsAt: data.endsAt,
          promotionVersion: promotion?.settings.version,
        }),
      });
      localStorage.removeItem(storageKey);
      router.push(
        `/webtoons/${published.work_id}/episodes/${published.episode_id}`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "게시 실패");
    } finally {
      setBusy(false);
    }
  }
  if (!isAuthReady || !isProfileReady)
    return <main className="p-8">관리자 권한을 확인하고 있습니다.</main>;
  if (!isAdmin || !user)
    return <main className="p-8">관리자 로그인이 필요합니다.</main>;
  const pdf = data?.jobs.find((j) => j.type === "application/pdf")?.asset;
  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-8 text-zinc-950">
      <div className="mx-auto max-w-4xl space-y-6">
        <header>
          <h1 className="text-3xl font-black">웹툰 업로드</h1>
          <p className="mt-2">
            파일 선택 → 업로드·최적화 → 미리보기 → 제목 입력 → 게시하기
          </p>
          <Link href="/admin" className="underline">
            관리자 홈
          </Link>
        </header>
        <section
          aria-label="파일 업로드"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            void select(Array.from(e.dataTransfer.files));
          }}
          className="rounded-2xl border-2 border-dashed border-blue-400 bg-white p-8 text-center"
        >
          <label className="block font-bold">
            PDF 한 개 또는 이미지 여러 장 선택
            <input
              className="mt-4 block w-full"
              type="file"
              accept="application/pdf,.pdf,image/png,image/jpeg,image/webp"
              multiple
              disabled={busy}
              onChange={(e) => {
                void select(Array.from(e.target.files ?? []));
                e.target.value = "";
              }}
            />
          </label>
          <p className="mt-3 text-sm">
            여기에 파일을 끌어 놓으세요. PDF 최대 50MiB · 200페이지 · 암호화 PDF
            미지원
            <br />
            이미지 최대 100장 · 장당 10MiB · 파일명 자연 정렬
          </p>
        </section>
        {error ? (
          <p
            role="alert"
            className="rounded border border-red-400 p-4 text-red-800"
          >
            {stage} 단계: {error}
          </p>
        ) : null}
        <div role="status" aria-live="polite">
          {stage}
          {busy ? (
            <progress
              className="block w-full"
              max={100}
              value={stage.startsWith("업로드 중") ? progress : undefined}
            />
          ) : null}
        </div>
        {data ? (
          <>
            <DraftFileList jobs={data.jobs} busy={busy} onMove={move} />
            <button
              className={button + " bg-blue-700 text-white"}
              disabled={busy || !data.jobs.length}
              onClick={() => void process()}
            >
              {error ? "실패 단계 재시도" : "업로드·최적화"}
            </button>
          </>
        ) : null}
        {data?.ready ? (
          <section className="space-y-4 rounded-2xl bg-white p-5">
            <h2 className="text-xl font-bold">미리보기</h2>
            <p className="text-sm">
              게시 전에는 관리자만 볼 수 있습니다. PDF는 원본을 보관하고
              글자·그림을 다시 압축하지 않는 별도 열람용 PDF를 생성합니다.
            </p>
            {pdf?.page_count && pdf.page_sizes ? (
              <PdfViewer
                preview
                pdf={{
                  id: pdf.id,
                  page_count: pdf.page_count,
                  page_sizes: pdf.page_sizes,
                }}
              />
            ) : (
              <div className="mx-auto w-full max-w-3xl">
                {data.pageIds.map((id, i) => (
                  <AdminImage
                    fullSize
                    key={id}
                    id={id}
                    alt={`${i + 1}페이지 미리보기`}
                  />
                ))}
              </div>
            )}
            <label className="block font-bold">
              게시물 제목
              <input
                className={input}
                maxLength={120}
                value={data.title}
                onChange={(e) => edit({ title: e.target.value })}
                disabled={busy}
              />
            </label>
            <label className="flex gap-2">
              <input
                type="checkbox"
                checked={data.popup}
                onChange={(e) => edit({ popup: e.target.checked })}
                disabled={busy}
              />
              이 웹툰을 팝업으로 알리기
            </label>
            <p className="text-sm">
              팝업을 선택하면 현재 팝업을 이 게시물로 교체합니다. 기본 노출
              기간은 게시 후 7일입니다.
            </p>
            <button
              className={button}
              disabled={busy}
              onClick={() => {
                setBusy(true);
                void save(data)
                  .then(() => setStage("임시저장 완료"))
                  .catch((e) => setError(e.message))
                  .finally(() => setBusy(false));
              }}
            >
              임시저장
            </button>
            <button
              className={button + " ml-2 bg-zinc-950 text-white"}
              disabled={busy || !data.title.trim() || !data.ready}
              onClick={() => void publish()}
            >
              게시하기
            </button>
          </section>
        ) : null}
        {draft ? (
          <button
            className={button}
            disabled={busy}
            onClick={() => {
              if (
                !window.confirm(
                  "임시 업로드를 취소할까요? 기존 게시물은 유지됩니다.",
                )
              )
                return;
              setBusy(true);
              void webtoonRequest(endpoint, {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: draft.id }),
              })
                .then(() => {
                  localStorage.removeItem(storageKey);
                  current.current = null;
                  setDraft(null);
                  setData(null);
                  files.current.clear();
                  setStage("임시 업로드를 취소했습니다.");
                })
                .catch((e) => setError(e.message))
                .finally(() => setBusy(false));
            }}
          >
            취소 및 임시 파일 정리
          </button>
        ) : null}
        <details className="rounded-xl border bg-white p-4">
          <summary className="cursor-pointer font-bold">추가 설정</summary>
          <div className="mt-4 space-y-4">
            <label className="block">
              연재 선택
              <select
                className={input}
                value={series}
                disabled={busy || !!draft}
                onChange={(e) => setSeries(e.target.value)}
              >
                <option value="">새 게시물로 만들기</option>
                {works.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.title}
                  </option>
                ))}
              </select>
            </label>
            <label>
              회차 번호
              <input
                className={input}
                type="number"
                min={1}
                max={99999}
                value={number}
                disabled={busy || !!draft}
                onChange={(e) => setNumber(e.target.value)}
              />
            </label>
            {data ? (
              <>
                <label>
                  팝업 안내 문구
                  <input
                    className={input}
                    maxLength={280}
                    value={data.message}
                    onChange={(e) => edit({ message: e.target.value })}
                  />
                </label>
                <label>
                  시작 시간
                  <input
                    type="datetime-local"
                    className={input}
                    value={data.startsAt}
                    onChange={(e) => edit({ startsAt: e.target.value })}
                  />
                </label>
                <label>
                  종료 시간
                  <input
                    type="datetime-local"
                    className={input}
                    value={data.endsAt}
                    onChange={(e) => edit({ endsAt: e.target.value })}
                  />
                </label>
                <label>
                  표지 교체 (선택)
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    disabled={busy}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file || !draft) return;
                      setBusy(true);
                      const id = crypto.randomUUID();
                      void upload(draft.work_id, id, file, setProgress, () =>
                        setStage("최적화 중 · 표지"),
                      )
                        .then((asset) =>
                          save({ ...data, coverAssetId: asset.id }),
                        )
                        .catch((e) => setError(e.message))
                        .finally(() => setBusy(false));
                    }}
                  />
                </label>
              </>
            ) : null}
          </div>
        </details>
        <details
          onToggle={(e) => setLegacy(e.currentTarget.open)}
          className="rounded-xl border p-4"
        >
          <summary className="cursor-pointer font-bold">
            기존 작품·회차 관리 및 홍보 설정
          </summary>
          {legacy ? <LegacyEditor /> : null}
        </details>
      </div>
    </main>
  );
}
