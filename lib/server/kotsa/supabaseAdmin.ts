import { createClient } from "@supabase/supabase-js";
import {
  getClientIpFromRequest,
  isRequestIpBlocked,
  recordAdminAccessFailure,
  recordAdminAccessSuccess,
} from "@/lib/server/kotsa/securityMonitor";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const getSupabaseAdminClients = () => {
  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return null;
  }

  return {
    admin: createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false },
    }),
    auth: createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false },
    }),
  };
};

const getBearerToken = (request: Request) => {
  const authorization = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(authorization);

  return match?.[1] ?? "";
};

export const resolveOptionalUserId = async (request: Request) => {
  const token = getBearerToken(request);

  if (!token) {
    return { userId: null };
  }

  const clients = getSupabaseAdminClients();

  if (!clients) {
    return { userId: null };
  }

  if (token === supabaseServiceRoleKey) {
    return { userId: null };
  }

  const { data, error } = await clients.auth.auth.getUser(token);

  if (error || !data.user) {
    return { error: "로그인 세션을 확인하지 못했습니다." };
  }

  return { userId: data.user.id };
};

export const resolveOptionalAdminUser = async (request: Request) => {
  const token = getBearerToken(request);

  if (!token) {
    return { isAdmin: false, userId: null };
  }

  const clients = getSupabaseAdminClients();

  if (!clients || token === supabaseServiceRoleKey) {
    return { isAdmin: false, userId: null };
  }

  const { data, error } = await clients.auth.auth.getUser(token);

  if (error || !data.user) {
    return { isAdmin: false, userId: null };
  }

  const { data: profile } = await clients.admin
    .from("user_profiles")
    .select("role")
    .eq("id", data.user.id)
    .maybeSingle();

  return {
    isAdmin: profile?.role === "admin" || profile?.role === "super_admin",
    userId: data.user.id,
  };
};

export const resolveKotsaAuthenticatedUser = async (request: Request) => {
  const token = getBearerToken(request);
  const requestIp = getClientIpFromRequest(request);

  if (await isRequestIpBlocked(requestIp)) {
    return { error: "차단된 IP입니다.", status: 403 };
  }

  if (!token) {
    return { error: "로그인이 필요합니다.", status: 401 };
  }

  const clients = getSupabaseAdminClients();

  if (!clients) {
    return { error: "Supabase server configuration is missing.", status: 503 };
  }

  const { data: userData, error: userError } =
    await clients.auth.auth.getUser(token);

  if (userError || !userData.user) {
    return { error: "로그인 세션을 확인하지 못했습니다.", status: 401 };
  }

  const { data: profile, error: profileError } = await clients.admin
    .from("user_profiles")
    .select("role,is_verified_dealer")
    .eq("id", userData.user.id)
    .maybeSingle();

  if (profileError || !profile) {
    return { error: "회원 정보를 확인하지 못했습니다.", status: 403 };
  }

  return {
    clients,
    isAdmin: profile.role === "admin" || profile.role === "super_admin",
    isVerifiedDealer: Boolean(profile.is_verified_dealer),
    role: String(profile.role ?? "user"),
    userId: userData.user.id,
  };
};

export const assertAdminRequest = async (request: Request) => {
  const clients = getSupabaseAdminClients();
  const endpoint = new URL(request.url).pathname;
  const requestIp = getClientIpFromRequest(request);

  if (!clients) {
    return { error: "Supabase server configuration is missing.", status: 503 };
  }

  if (await isRequestIpBlocked(requestIp)) {
    await recordAdminAccessFailure({
      endpoint,
      requestIp,
      statusCode: 403,
    });
    return { error: "차단된 IP입니다.", status: 403 };
  }

  const token = getBearerToken(request);

  if (!token) {
    await recordAdminAccessFailure({
      endpoint,
      requestIp,
      statusCode: 401,
    });
    return { error: "로그인이 필요합니다.", status: 401 };
  }

  if (token === supabaseServiceRoleKey) {
    return { clients, userId: null };
  }

  const { data: userData, error: userError } =
    await clients.auth.auth.getUser(token);

  if (userError || !userData.user) {
    await recordAdminAccessFailure({
      endpoint,
      requestIp,
      statusCode: 401,
    });
    return { error: "로그인 세션을 확인하지 못했습니다.", status: 401 };
  }

  const { data: profile, error: profileError } = await clients.admin
    .from("user_profiles")
    .select("role")
    .eq("id", userData.user.id)
    .maybeSingle();

  if (profileError) {
    await recordAdminAccessFailure({
      endpoint,
      requestIp,
      statusCode: 500,
      userId: userData.user.id,
    });
    return { error: "관리자 권한 확인에 실패했습니다.", status: 500 };
  }

  if (profile?.role !== "admin" && profile?.role !== "super_admin") {
    await recordAdminAccessFailure({
      endpoint,
      requestIp,
      statusCode: 403,
      userId: userData.user.id,
    });
    return { error: "관리자 권한이 필요합니다.", status: 403 };
  }

  await recordAdminAccessSuccess({
    endpoint,
    requestIp,
    userId: userData.user.id,
  });

  return { clients, userId: userData.user.id };
};
