"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { isLocalSandbox } from "@/lib/local/sandbox";

export default function LocalTestClient() {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  if (!isLocalSandbox()) return <main>로컬 테스트 환경에서만 사용할 수 있습니다.</main>;

  async function authenticate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !isLocalSandbox()) return;
    setBusy(true);
    try {
      const form = new FormData(event.currentTarget);
      const email = String(form.get("email") ?? "");
      const password = String(form.get("password") ?? "");
      const create = (event.nativeEvent as SubmitEvent).submitter?.getAttribute("value") === "signup";
      const { error } = create
        ? await supabase.auth.signUp({ email, password })
        : await supabase.auth.signInWithPassword({ email, password });
      setMessage(error ? "로그인 실패: 입력값과 로컬 Auth 상태를 확인하세요." : "로컬 로그인 완료");
    } catch {
      setMessage("로컬 Auth에 연결하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="mx-auto max-w-lg space-y-5 p-8">
    <h1 className="text-2xl font-bold">로컬 테스트 로그인</h1>
    <p>별도 로컬 DB·Auth·Storage만 사용합니다. 실제 회원정보를 입력하지 마세요.</p>
    <form onSubmit={authenticate} className="space-y-3">
      <label className="block">테스트 이메일<input className="block w-full rounded border p-2" name="email" type="email" required autoComplete="username" /></label>
      <label className="block">테스트 비밀번호<input className="block w-full rounded border p-2" name="password" type="password" minLength={8} required autoComplete="current-password" /></label>
      <button className="rounded border p-2" disabled={busy} name="action" value="login">로그인</button>{" "}
      <button className="rounded border p-2" disabled={busy} name="action" value="signup">테스트 계정 만들기</button>
    </form>
    <p role="status">{message}</p>
    <button className="rounded border p-2" onClick={async () => { await supabase?.auth.signOut(); setMessage("로그아웃 완료"); }}>로그아웃</button>
    <p><Link href="/car/123가4567">합성 테스트 차량 보기</Link></p>
    <p><Link href="/car/123가4567/review">테스트 후기 작성</Link></p>
    <p>소셜 OAuth 대신 로컬 이메일·비밀번호 Auth를 사용합니다.</p>
  </main>;
}
