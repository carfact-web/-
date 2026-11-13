import { NextResponse } from "next/server";
import { failure, NO_STORE, requireWebtoonAdmin, WebtoonError } from "@/lib/server/webtoons/core";
export const dynamic = "force-dynamic";
const cookieName = "carfact_webtoon_admin";
function sameOrigin(request: Request) {
 const internal = new URL(request.url);
 const host = request.headers.get("host") || internal.host;
 const forwardedProtocol = request.headers.get("x-forwarded-proto");
 const protocol = forwardedProtocol === "https" || forwardedProtocol === "http" ? forwardedProtocol + ":" : internal.protocol;
 // A fresh authority prevents Next's internal listener port surviving a portless public Host.
 const expected = new URL(`${protocol}//${host}`);
 if (request.headers.get("origin") !== expected.origin) throw new WebtoonError("같은 서비스에서 다시 접속해주세요.", 403);
}
function response(token: string) {
 const result = NextResponse.json({ ok: true }, { headers: NO_STORE });
 result.cookies.set(cookieName, token, { httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", path: "/admin/webtoons", maxAge: token ? 300 : 0 });
 return result;
}
export async function POST(request: Request) {
 try {
  sameOrigin(request); await requireWebtoonAdmin(request);
  return response(request.headers.get("authorization")!.replace(/^Bearer\s+/i, ""));
 } catch (error) { return failure(error); }
}
export async function DELETE(request: Request) {
 try { sameOrigin(request); return response(""); } catch (error) { return failure(error); }
}
