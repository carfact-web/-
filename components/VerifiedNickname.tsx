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
        <>
          <VerifiedDealerMark />
          <span
            className={cn(
              "shrink-0 rounded-full text-[0.82em] font-extrabold leading-none text-[#1D9BF0]",
              "tracking-normal [font-family:var(--font-geist-sans),Pretendard,SUIT,Arial,sans-serif]"
            )}
          >
            dealer
          </span>
        </>
      ) : null}
    </span>
  );
}

function VerifiedDealerMark() {
  return (
    <svg
      aria-label="인증딜러"
      className="h-[1em] w-[1em] shrink-0"
      role="img"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>인증딜러</title>
      <path
        d="M12 1.5 14.36 4l3.4-.66 1.13 3.28 3.25 1.2-1.27 3.22 1.63 3.06-3.01 1.72-.55 3.42-3.45-.22L12 22.5l-3.49-3.48-3.45.22-.55-3.42-3.01-1.72 1.63-3.06-1.27-3.22 3.25-1.2 1.13-3.28 3.4.66L12 1.5Z"
        fill="#1D9BF0"
      />
      <path
        d="m10.35 14.75-2.7-2.7 1.25-1.25 1.45 1.44 4.75-4.75 1.25 1.25-6 6.01Z"
        fill="#FFFFFF"
      />
    </svg>
  );
}
