import {
  dbError,
  failure,
  integer,
  NO_STORE,
  publicDb,
  requireWebtoonAdmin,
  title,
  uuid,
  WEBTOON_BUCKET,
  WebtoonError,
} from "@/lib/server/webtoons/core";
import type { Json } from "@/types/supabase";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function context(request: Request) {
  const db = await requireWebtoonAdmin(request);
  // Bearer auth is required independently of the same-origin check.
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  const proto =
    request.headers.get("x-forwarded-proto") ||
    new URL(request.url).protocol.slice(0, -1);
  if (origin && (!host || origin !== `${proto}://${host}`))
    throw new WebtoonError("같은 서비스에서 다시 접속해주세요.", 403);
  const token = request.headers
    .get("authorization")!
    .replace(/^Bearer\s+/i, "");
  const auth = await publicDb().auth.getUser(token);
  if (auth.error || !auth.data.user)
    throw new WebtoonError("관리자 로그인이 필요합니다.", 401);
  return { db, owner: auth.data.user.id };
}
export async function GET(request: Request) {
  try {
    const { db, owner } = await context(request),
      id = uuid(new URL(request.url).searchParams.get("id"));
    const result = await db
      .from("webtoon_upload_drafts")
      .select("*")
      .eq("id", id)
      .eq("owner_id", owner)
      .maybeSingle();
    dbError(result.error);
    if (!result.data)
      throw new WebtoonError("임시 업로드를 찾을 수 없습니다.", 404);
    return Response.json(result.data, { headers: NO_STORE });
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: Request) {
  try {
    const { db, owner } = await context(request),
      body = await request.json();
    const result = await db.rpc("webtoon_start_upload", {
      p_id: uuid(body.id),
      p_owner: owner,
      p_work: body.workId ? uuid(body.workId) : null,
      p_number: body.number ? integer(body.number) : null,
    });
    dbError(result.error);
    return Response.json(result.data, { headers: NO_STORE });
  } catch (e) {
    return failure(e);
  }
}
export async function PATCH(request: Request) {
  try {
    const { db, owner } = await context(request),
      body = await request.json(),
      id = uuid(body.id),
      version = integer(body.version);
    const current = await db
      .from("webtoon_upload_drafts")
      .select("*")
      .eq("id", id)
      .eq("owner_id", owner)
      .single();
    dbError(current.error);
    if (body.publish && current.data?.status === "published")
      return Response.json(current.data, { headers: NO_STORE });
    if (!current.data || current.data.status !== "editing")
      throw new WebtoonError("편집 가능한 임시 업로드가 아닙니다.", 409);
    if (body.publish) {
      const popup = body.popup === true,
        now = new Date();
      const start = body.startsAt ? new Date(body.startsAt) : now,
        end = body.endsAt
          ? new Date(body.endsAt)
          : new Date(now.getTime() + 7 * 86400000);
      if (!Number.isFinite(+start) || !Number.isFinite(+end))
        throw new WebtoonError("팝업 일정을 확인해주세요.");
      const result = await db.rpc("webtoon_publish_upload", {
        p_id: id,
        p_owner: owner,
        p_version: version,
        p_title: title(body.title),
        p_popup: popup,
        p_message:
          typeof body.message === "string" && body.message.trim()
            ? body.message.trim()
            : title(body.title),
        p_start: popup ? start.toISOString() : null,
        p_end: popup ? end.toISOString() : null,
        p_promotion_version: popup ? integer(body.promotionVersion) : 1,
      });
      dbError(result.error);
      return Response.json(result.data, { headers: NO_STORE });
    }
    const data = body.data;
    if (
      !data ||
      typeof data !== "object" ||
      Array.isArray(data) ||
      JSON.stringify(data).length > 65536
    )
      throw new WebtoonError("임시저장 내용을 확인해주세요.");
    // Never trust a client-supplied ready flag. Assets must belong to this work.
    const ids = [
      data.coverAssetId,
      data.pdfAssetId,
      ...(Array.isArray(data.pageIds) ? data.pageIds : []),
    ]
      .filter(Boolean)
      .map(uuid);
    if (ids.length > 102)
      throw new WebtoonError("이미지는 100장 이내로 선택해주세요.");
    const unique = [...new Set(ids)];
    const assets = unique.length
      ? await db
          .from("webtoon_assets")
          .select("id,mime,state")
          .eq("work_id", current.data.work_id)
          .in("id", unique)
      : { data: [], error: null };
    dbError(assets.error);
    if (
      assets.data?.length !== unique.length ||
      assets.data?.some((a) => a.state !== "ready")
    )
      throw new WebtoonError("완료된 업로드만 임시저장할 수 있습니다.");
    const cover = assets.data?.find((a) => a.id === data.coverAssetId),
      pdf = assets.data?.find((a) => a.id === data.pdfAssetId);
    if (
      (cover && cover.mime !== "image/webp") ||
      (pdf && pdf.mime !== "application/pdf")
    )
      throw new WebtoonError("파일 형식을 확인해주세요.");
    const jobs = Array.isArray(data.jobs) ? data.jobs : [];
    const completed =
      jobs.length > 0 &&
      jobs.every(
        (job: { id?: string; asset?: { id?: string } }) =>
          job.id && job.asset?.id === job.id && unique.includes(job.id),
      );
    const imageIds = Array.isArray(data.pageIds) ? data.pageIds : [];
    const validImages =
      !pdf &&
      imageIds.length === jobs.length &&
      new Set(imageIds).size === imageIds.length &&
      imageIds.every((id: string) =>
        assets.data?.some((a) => a.id === id && a.mime === "image/webp"),
      );
    data.ready = Boolean(
      cover &&
        completed &&
        ((pdf &&
          jobs.length === 1 &&
          jobs[0].id === pdf.id &&
          imageIds.length === 0) ||
          validImages),
    );
    const result = await db
      .from("webtoon_upload_drafts")
      .update({
        data: data as Json,
        version: version + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("owner_id", owner)
      .eq("status", "editing")
      .eq("version", version)
      .select()
      .maybeSingle();
    dbError(result.error);
    if (!result.data)
      throw new WebtoonError(
        "다른 변경이 먼저 저장됐습니다. 새로고침해주세요.",
        409,
      );
    return Response.json(result.data, { headers: NO_STORE });
  } catch (e) {
    return failure(e);
  }
}

export async function DELETE(request: Request) {
  try {
    const { db, owner } = await context(request),
      body = await request.json();
    const claimed = await db.rpc("webtoon_cancel_upload", {
      p_id: uuid(body.id),
      p_owner: owner,
    });
    dbError(claimed.error);
    for (const asset of claimed.data ?? []) {
      const keys =
        asset.mime === "application/pdf"
          ? [
              asset.object_key,
              asset.object_key.replace(/\.pdf$/, ".original.pdf"),
            ]
          : [asset.object_key];
      const removed = await db.storage.from(WEBTOON_BUCKET).remove(keys);
      dbError(removed.error);
      const deleted = await db
        .from("webtoon_assets")
        .delete()
        .eq("id", asset.id)
        .eq("state", "deleting");
      dbError(deleted.error);
    }
    // A failure before asset insertion can leave only an original object. Remove
    // those known draft keys too, but never touch an existing asset's key here.
    const draft = await db
      .from("webtoon_upload_drafts")
      .select("work_id,data")
      .eq("id", body.id)
      .eq("owner_id", owner)
      .single();
    dbError(draft.error);
    if (draft.data) {
      const data = draft.data.data as unknown as {
        jobs?: { id: string }[];
        coverUploadId?: string;
      };
      const ids = [
        ...(data.jobs ?? []).map((j) => uuid(j.id)),
        ...(data.coverUploadId ? [uuid(data.coverUploadId)] : []),
      ];
      for (const id of ids) {
        const exists = await db
          .from("webtoon_assets")
          .select("id")
          .eq("id", id)
          .maybeSingle();
        dbError(exists.error);
        if (exists.data) continue;
        const prefix = `${draft.data.work_id}/${id}`;
        const result = await db.storage
          .from(WEBTOON_BUCKET)
          .remove([
            prefix + ".original.pdf",
            prefix + ".pdf",
            prefix + ".webp",
          ]);
        dbError(result.error);
      }
    }
    return Response.json({ cancelled: true }, { headers: NO_STORE });
  } catch (e) {
    return failure(e);
  }
}
