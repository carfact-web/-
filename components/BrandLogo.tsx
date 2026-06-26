import { cn } from "@/utils/cn";

type BrandIconProps = {
  className?: string;
};

type BrandLogoProps = {
  className?: string;
  iconClassName?: string;
  textClassName?: string;
};

export function BrandIcon({ className }: BrandIconProps) {
  return (
    <img
      src="/brand/carfact-header-icon.png"
      alt=""
      aria-hidden="true"
      className={cn("h-10 w-10 shrink-0", className)}
      width={512}
      height={512}
      decoding="async"
      loading="lazy"
    />
  );
}

export function BrandLogo({
  className,
  iconClassName,
  textClassName,
}: BrandLogoProps) {
  return (
    <div
      className={cn("inline-flex items-center gap-2.5", className)}
      aria-label="CARFACT"
    >
      <BrandIcon className={cn("h-full w-auto", iconClassName)} />
      <span
        className={cn(
          "flex items-center text-[1.55rem] font-black leading-none tracking-[0.04em] sm:text-[1.75rem]",
          textClassName,
        )}
      >
        <span className="text-white">CAR</span>
        <span className="text-[#FF3B30]">FACT</span>
      </span>
    </div>
  );
}
