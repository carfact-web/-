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
        <VerifiedDealerMark />
      ) : null}
    </span>
  );
}

function VerifiedDealerMark() {
  return (
    <svg
      aria-label="인증딜러"
      className="h-[14px] w-[14px] shrink-0 sm:h-4 sm:w-4"
      role="img"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>인증딜러</title>
      <path
        d="M12 1.5 14.1 4l3.12-.92 1.1 3.06 3.18.72-.72 3.18 2.72 1.96-2.72 1.96.72 3.18-3.18.72-1.1 3.06-3.12-.92L12 22.5 9.9 20l-3.12.92-1.1-3.06-3.18-.72.72-3.18L.5 12l2.72-1.96-.72-3.18 3.18-.72 1.1-3.06L9.9 4 12 1.5Z"
        fill="#1DA1F2"
      />
      <path
        d="m9.8 15.55-3.1-3.1 1.35-1.35 1.75 1.74 5.93-5.93 1.35 1.35-7.28 7.29Z"
        fill="#FFFFFF"
      />
    </svg>
  );
}
