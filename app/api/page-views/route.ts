import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

interface PageViewPayload {
  eventType?:
    | "ai_analysis_complete"
    | "login"
    | "page_view"
    | "post_view"
    | "vehicle_view"
    | "review_view"
    | "vehicle_search"
    | "review_create"
    | "sign_up";
  path?: string | null;
  referrer?: string | null;
  vehicleId?: string | null;
  reviewId?: string | null;
  sessionId?: string | null;
  visitorId?: string | null;
  recordMemberVisit?: boolean;
  userAgent?: string | null;
}

const eventTypes = new Set([
  "ai_analysis_complete",
  "login",
  "page_view",
  "post_view",
  "vehicle_view",
  "review_view",
  "vehicle_search",
  "review_create",
  "sign_up",
]);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const ipHashSalt =
  process.env.ANALYTICS_IP_HASH_SALT ??
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  "";

const getClientIp = (request: NextRequest) => {
  const forwardedFor = request.headers.get("x-forwarded-for");

  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() ?? "";
  }

  return request.headers.get("x-real-ip") ?? "";
};

const hashIp = (ip: string) => {
  if (!ip) {
    return null;
  }

  return createHash("sha256").update(ipHashSalt).update(ip).digest("hex");
};

const parseDeviceType = (userAgent: string) => {
  const normalized = userAgent.toLowerCase();

  if (/ipad|tablet|sm-t|kindle|silk/.test(normalized)) {
    return "tablet";
  }

  if (/mobi|iphone|ipod|android/.test(normalized)) {
    return "mobile";
  }

  if (/windows|macintosh|mac os x|linux|x11/.test(normalized)) {
    return "desktop";
  }

  return "unknown";
};

const parseBrowser = (userAgent: string) => {
  if (/SamsungBrowser/i.test(userAgent)) {
    return "Samsung Internet";
  }

  if (/Edg\//i.test(userAgent)) {
    return "Edge";
  }

  if (/CriOS\//i.test(userAgent)) {
    return "Chrome";
  }

  if (/Chrome\//i.test(userAgent) && !/Chromium|Edg\//i.test(userAgent)) {
    return "Chrome";
  }

  if (/Firefox\//i.test(userAgent) || /FxiOS\//i.test(userAgent)) {
    return "Firefox";
  }

  if (
    /Safari\//i.test(userAgent) &&
    !/Chrome|CriOS|Chromium|Android/i.test(userAgent)
  ) {
    return "Safari";
  }

  return "etc";
};

const parseOs = (userAgent: string) => {
  if (/iPhone|iPad|iPod/i.test(userAgent)) {
    return "iOS";
  }

  if (/Android/i.test(userAgent)) {
    return "Android";
  }

  if (/Macintosh|Mac OS X/i.test(userAgent)) {
    return "macOS";
  }

  if (/Windows/i.test(userAgent)) {
    return "Windows";
  }

  if (/Linux|X11/i.test(userAgent)) {
    return "Linux";
  }

  return "etc";
};

const normalizeEventType = (eventType: PageViewPayload["eventType"]) =>
  eventType && eventTypes.has(eventType) ? eventType : "page_view";

export async function POST(request: NextRequest) {
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ recorded: false }, { status: 503 });
  }

  let payload: PageViewPayload;

  try {
    payload = (await request.json()) as PageViewPayload;
  } catch {
    return NextResponse.json({ recorded: false }, { status: 400 });
  }

  const sessionId = payload.sessionId?.trim();
  const visitorId = payload.visitorId?.trim();

  if (!sessionId) {
    return NextResponse.json({ recorded: false }, { status: 400 });
  }

  const authorization = request.headers.get("authorization") ?? undefined;
  const userAgent =
    payload.userAgent ?? request.headers.get("user-agent") ?? "";
  const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: authorization ? { Authorization: authorization } : {},
    },
    auth: {
      persistSession: false,
    },
  });

  const { data, error } = await supabase.rpc("record_page_view", {
    target_vehicle_id: payload.vehicleId ?? null,
    target_review_id: payload.reviewId ?? null,
    view_session_id: sessionId,
    view_visitor_id: visitorId || sessionId,
    view_ip_hash: hashIp(getClientIp(request)),
    view_user_agent: null,
    view_device_type: parseDeviceType(userAgent),
    view_browser: parseBrowser(userAgent),
    view_os: parseOs(userAgent),
    view_referrer: payload.referrer ?? request.headers.get("referer"),
    view_path: payload.path ?? null,
    view_event_type: normalizeEventType(payload.eventType),
  });

  if (error) {
    return NextResponse.json(
      { recorded: false, message: error.message },
      { status: 500 },
    );
  }

  const { data: memberVisitRecorded } = payload.recordMemberVisit
    ? await supabase.rpc("record_member_daily_visit", {
        throttle_minutes: 30,
      })
    : { data: false };

  return NextResponse.json({
    recorded: Boolean(data),
    memberVisitRecorded: Boolean(memberVisitRecorded),
  });
}
