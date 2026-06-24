import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  findVehicleIssueKeywordDefinition,
  normalizeVehicleIssueKeyword,
} from "@/utils/vehicleIssueKeywords";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

type AiCandidateStatus = "reviewing" | "applied" | "excluded";

interface AiCandidateRequest {
  candidateKey?: string;
  keyword?: string;
  relatedModels?: string[];
  source?: string;
  status?: AiCandidateStatus;
  targetBrand?: string;
  targetGeneration?: string;
  targetModel?: string;
}

const jsonError = (message: string, status = 400) =>
  NextResponse.json({ error: message }, { status });

const getApiErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;

    if (typeof message === "string" && message.trim()) {
      return message;
    }
  }

  return fallback;
};

const getBearerToken = (request: Request) => {
  const authorization = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(authorization);

  return match?.[1] ?? "";
};

const getClients = () => {
  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return null;
  }

  return {
    auth: createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false },
    }),
    admin: createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false },
    }),
  };
};

const assertAdmin = async (request: Request) => {
  const clients = getClients();

  if (!clients) {
    throw new Error("Supabase server configuration is missing.");
  }

  const token = getBearerToken(request);

  if (!token) {
    return { clients, error: jsonError("로그인이 필요합니다.", 401) };
  }

  if (token === supabaseServiceRoleKey) {
    return { clients, userId: null };
  }

  const { data: userData, error: userError } = await clients.auth.auth.getUser(
    token,
  );

  if (userError || !userData.user) {
    return { clients, error: jsonError("로그인 세션을 확인하지 못했습니다.", 401) };
  }

  const { data: profile, error: profileError } = await clients.admin
    .from("user_profiles")
    .select("role")
    .eq("id", userData.user.id)
    .maybeSingle();

  if (profileError) {
    throw profileError;
  }

  if (profile?.role !== "admin" && profile?.role !== "super_admin") {
    return { clients, error: jsonError("관리자 권한이 필요합니다.", 403) };
  }

  return { clients, userId: userData.user.id };
};

const normalizeStatus = (value: unknown): AiCandidateStatus => {
  if (value === "applied" || value === "excluded" || value === "reviewing") {
    return value;
  }

  return "reviewing";
};

const fromTable = (client: unknown, table: string) =>
  // The generated Supabase schema type does not include the newer admin/inspection tables yet.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ((client as { from: unknown }).from as (tableName: string) => any)(table);

const upsertCandidateStatus = async (
  admin: unknown,
  input: Required<Pick<AiCandidateRequest, "candidateKey" | "keyword">> &
    Pick<AiCandidateRequest, "relatedModels" | "source"> & {
      status: AiCandidateStatus;
      userId: string | null;
    },
) => {
  const { error } = await fromTable(admin, "ai_data_candidate_statuses").upsert(
    {
      candidate_key: input.candidateKey,
      candidate_keyword: input.keyword,
      source: input.source ?? "review",
      related_models: input.relatedModels ?? [],
      status: input.status,
      updated_by: input.userId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "candidate_key" },
  );

  if (error) {
    throw error;
  }
};

const getProfileSummary = (model: string, keyword: string) =>
  `${model}는 최근 후기 본문에서 '${keyword}' 관련 언급이 반복되어 출고 전 확인 항목 보강이 권장됩니다.`;

const applyCandidateToVehicleInspectionDb = async (
  admin: unknown,
  input: Required<Pick<AiCandidateRequest, "keyword" | "targetBrand" | "targetModel">> &
    Pick<AiCandidateRequest, "targetGeneration">,
) => {
  const definition = findVehicleIssueKeywordDefinition(input.keyword);
  const inspectionTitle =
    definition?.inspectionTitle ?? `${input.keyword} 확인`;
  const relatedParts = definition?.relatedParts ?? [input.keyword];
  const generation = input.targetGeneration?.trim();
  const { data: existingProfile, error: profileReadError } = await fromTable(
    admin,
    "vehicle_inspection_profiles",
  )
    .select("id,generations,summary")
    .eq("manufacturer", input.targetBrand)
    .eq("model", input.targetModel)
    .maybeSingle();

  if (profileReadError) {
    throw profileReadError;
  }

  let profileId = existingProfile?.id as string | undefined;

  if (!profileId) {
    const { data: createdProfile, error: createProfileError } = await fromTable(
      admin,
      "vehicle_inspection_profiles",
    )
      .insert({
        manufacturer: input.targetBrand,
        model: input.targetModel,
        generations: generation ? [generation] : [],
        summary: getProfileSummary(input.targetModel, input.keyword),
      })
      .select("id")
      .single();

    if (createProfileError) {
      throw createProfileError;
    }

    profileId = createdProfile.id as string;
  } else {
    const generations = Array.isArray(existingProfile.generations)
      ? (existingProfile.generations as string[])
      : [];
    const nextGenerations =
      generation && !generations.includes(generation)
        ? [...generations, generation]
        : generations;
    const summary = String(existingProfile.summary ?? "");
    const nextSummary = summary.includes(input.keyword)
      ? summary
      : summary + " " + getProfileSummary(input.targetModel, input.keyword);

    const { error: updateProfileError } = await fromTable(
      admin,
      "vehicle_inspection_profiles",
    )
      .update({
        generations: nextGenerations,
        summary: nextSummary.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", profileId);

    if (updateProfileError) {
      throw updateProfileError;
    }
  }

  const { data: existingItems, error: itemReadError } = await fromTable(
    admin,
    "vehicle_inspection_items",
  )
    .select("display_order")
    .eq("profile_id", profileId);

  if (itemReadError) {
    throw itemReadError;
  }

  const nextDisplayOrder =
    Math.max(
      0,
      ...(existingItems ?? []).map((item: { display_order?: unknown }) =>
        Number(item.display_order ?? 0),
      ),
    ) +
    1;
  const { error: itemError } = await fromTable(admin, "vehicle_inspection_items")
    .upsert(
      {
        profile_id: profileId,
        title: inspectionTitle,
        symptoms: [
          `후기 본문에서 '${input.keyword}' 관련 언급 반복`,
          "동일 이슈가 누적되어 출고 전 확인 필요",
        ],
        related_parts: relatedParts,
        importance: "중",
        estimated_repair_cost: "현장 확인",
        ai_summary: `최근 후기 본문에서 '${input.keyword}' 언급이 반복됩니다. 출고 전 ${inspectionTitle}을 우선 확인해보세요.`,
        display_order: nextDisplayOrder,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "profile_id,title" },
    );

  if (itemError) {
    throw itemError;
  }

  return { inspectionTitle, profileId };
};

export async function GET(request: Request) {
  try {
    const authResult = await assertAdmin(request);

    if ("error" in authResult && authResult.error) {
      return authResult.error;
    }

    const { data, error } = await fromTable(
      authResult.clients.admin,
      "ai_data_candidate_statuses",
    )
      .select("candidate_key,candidate_keyword,source,related_models,status,updated_at");

    if (error) {
      throw error;
    }

    return NextResponse.json({ statuses: data ?? [] });
  } catch (error) {
    return jsonError(
      getApiErrorMessage(error, "AI 추천 상태를 불러오지 못했습니다."),
      500,
    );
  }
}

export async function POST(request: Request) {
  try {
    const authResult = await assertAdmin(request);

    if ("error" in authResult && authResult.error) {
      return authResult.error;
    }

    const body = (await request.json()) as AiCandidateRequest;
    const candidateKey = body.candidateKey?.trim();
    const keyword = body.keyword?.trim();
    const status = normalizeStatus(body.status);

    if (!candidateKey || !keyword) {
      return jsonError("추천 항목 정보가 필요합니다.");
    }

    const normalizedKeyword = normalizeVehicleIssueKeyword(keyword);
    const definition = findVehicleIssueKeywordDefinition(keyword);

    if (!definition || !normalizedKeyword) {
      return jsonError("대표 키워드로 반영할 수 없는 항목입니다.");
    }

    let applied: Awaited<ReturnType<typeof applyCandidateToVehicleInspectionDb>> | null =
      null;

    if (status === "applied") {
      const targetBrand = body.targetBrand?.trim();
      const targetModel = body.targetModel?.trim();

      if (!targetBrand || !targetModel) {
        return jsonError("차량 DB에 반영할 브랜드와 모델 정보가 필요합니다.");
      }

      applied = await applyCandidateToVehicleInspectionDb(
        authResult.clients.admin,
        {
          keyword,
          targetBrand,
          targetGeneration: body.targetGeneration,
          targetModel,
        },
      );
    }

    await upsertCandidateStatus(authResult.clients.admin, {
      candidateKey,
      keyword,
      relatedModels: body.relatedModels,
      source: body.source,
      status,
      userId: authResult.userId,
    });

    return NextResponse.json({ applied, status });
  } catch (error) {
    return jsonError(
      getApiErrorMessage(error, "AI 추천 상태를 변경하지 못했습니다."),
      500,
    );
  }
}
