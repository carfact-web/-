import { cn } from "@/utils/cn";

interface VerifiedNicknameProps {
  children: string;
  className?: string;
  isVerifiedDealer?: boolean;
}

export function VerifiedNickname({
  children,
  className,
  isVerifiedDealer = false,
}: VerifiedNicknameProps) {
  return (
    <span
      className={cn(
        "inline-flex min-w-0 items-center gap-1 align-baseline",
        className
      )}
    >
      <span className="min-w-0 truncate">{children}</span>
      {isVerifiedDealer ? (
        <span
          aria-label="인증딜러"
          className={cn(
            "shrink-0 rounded-full text-[0.82em] font-extrabold leading-none text-[#1DA1F2]",
            "tracking-normal [font-family:var(--font-geist-sans),Pretendard,SUIT,Arial,sans-serif]"
          )}
        >
          dealer
        </span>
      ) : null}
    </span>
  );
}
