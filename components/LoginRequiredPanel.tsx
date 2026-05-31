"use client";

import { AuthLoginPanel } from "@/components/AuthLoginPanel";

interface LoginRequiredPanelProps {
  onGoogleLogin: () => void;
  onKakaoLogin: () => void;
}

export function LoginRequiredPanel({
  onGoogleLogin,
  onKakaoLogin,
}: LoginRequiredPanelProps) {
  return (
    <AuthLoginPanel
      onGoogleLogin={onGoogleLogin}
      onKakaoLogin={onKakaoLogin}
    />
  );
}
