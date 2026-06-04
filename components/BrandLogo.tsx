import { brand } from "@/lib/brand";
import { cn } from "@/utils/cn";

type BrandIconProps = {
  className?: string;
};

type BrandLogoProps = {
  className?: string;
  iconClassName?: string;
  wordmarkClassName?: string;
  showWordmark?: boolean;
};

export function BrandIcon({ className }: BrandIconProps) {
  return (
    <svg
      viewBox="0 0 96 96"
      aria-hidden="true"
      className={cn("h-10 w-10 shrink-0", className)}
    >
      <defs>
        <linearGradient id="carfact-icon-red" x1="22" x2="74" y1="10" y2="86">
          <stop stopColor="#FF3B30" />
          <stop offset="1" stopColor="#E01812" />
        </linearGradient>
      </defs>
      <path
        d="M18 8h54c9.94 0 18 8.06 18 18v39c0 9.94-8.06 18-18 18H57.5L77 94V83H18C8.06 83 0 74.94 0 65V26C0 16.06 8.06 8 18 8Z"
        fill="url(#carfact-icon-red)"
      />
      <path
        d="M62.7 34.4A23.2 23.2 0 0 0 22.6 48h14.1a10.4 10.4 0 0 1 18.4-4.7l7.6-8.9Z"
        fill="white"
      />
      <path
        d="M21 51h48.2c4.2 0 7.8 3 8.6 7.1l1.1 5.4h-8.1a6.3 6.3 0 0 0-12.3 0H37.8a6.3 6.3 0 0 0-12.3 0H18.4V53.6c0-1.4 1.2-2.6 2.6-2.6Z"
        fill="white"
      />
      <path
        d="M28 45.8h35.1l-6.6 7.8H28v-7.8Z"
        fill="#FF3B30"
      />
      <circle cx="31.6" cy="65.2" r="4.8" fill="white" />
      <circle cx="64.7" cy="65.2" r="4.8" fill="white" />
    </svg>
  );
}

export function BrandLogo({
  className,
  iconClassName,
  wordmarkClassName,
  showWordmark = true,
}: BrandLogoProps) {
  return (
    <div className={cn("inline-flex items-center gap-2.5", className)}>
      <BrandIcon className={iconClassName} />
      {showWordmark ? (
        <span
          className={cn(
            "text-xl font-black tracking-[0.16em] text-white",
            wordmarkClassName
          )}
        >
          <span>CAR</span>
          <span style={{ color: brand.primary }}>FACT</span>
        </span>
      ) : null}
    </div>
  );
}
