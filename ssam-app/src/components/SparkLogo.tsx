import React from "react";
import { cn } from "@/lib/utils";
import { SPARK225_ASSETS } from "@/lib/brandAssets";

interface SparkLogoProps {
  className?: string;
  variant?: "symbol" | "full" | "white" | "auto";
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  alt?: string;
}

/**
 * Size mapping:
 * - symbol: height/width based (square mark). md = 36px (collapsed sidebar).
 * - full/white: width based (auto height). md = 150px (expanded sidebar), lg = 220px (login).
 */
const SIZE_CONFIGS = {
  xs: { symbol: "h-5 w-5", full: "w-[120px]" },
  sm: { symbol: "h-7 w-7", full: "w-[140px]" },
  md: { symbol: "h-9 w-9", full: "w-[150px]" },
  lg: { symbol: "h-12 w-12", full: "w-[220px]" },
  xl: { symbol: "h-16 w-16", full: "w-[260px]" },
};

/**
 * Spark225 Official Brand Logo Component:
 * - variant "symbol": The signature 'S' mark with orange/gold gradient (collapsed sidebar, favicons, chips)
 * - variant "full": Full logo with dark/gray text (light cards, white panels)
 * - variant "white": Full logo with white text (navy #0E1E2A backgrounds like sidebar and login panel)
 * - variant "auto": Uses dark text by default, switches to white in dark mode
 */
export const SparkLogo: React.FC<SparkLogoProps> = ({
  className,
  variant = "white",
  size = "md",
  alt = "Spark225 Consulting Firm",
}) => {
  const sizeClasses = SIZE_CONFIGS[size];

  if (variant === "symbol") {
    return (
      <img
        src={SPARK225_ASSETS.symbol}
        alt={alt}
        className={cn(sizeClasses.symbol, "object-contain shrink-0", className)}
      />
    );
  }

  if (variant === "white") {
    return (
      <img
        src={SPARK225_ASSETS.logoWhite}
        alt={alt}
        className={cn(
          sizeClasses.full,
          "h-auto object-contain shrink-0",
          className,
        )}
      />
    );
  }

  if (variant === "full") {
    return (
      <img
        src={SPARK225_ASSETS.logo}
        alt={alt}
        className={cn(
          sizeClasses.full,
          "h-auto object-contain shrink-0",
          className,
        )}
      />
    );
  }

  // Auto variant (switches with dark mode)
  return (
    <>
      <img
        src={SPARK225_ASSETS.logo}
        alt={alt}
        className={cn(
          sizeClasses.full,
          "h-auto object-contain shrink-0 dark:hidden",
          className,
        )}
      />
      <img
        src={SPARK225_ASSETS.logoWhite}
        alt={alt}
        className={cn(
          sizeClasses.full,
          "h-auto object-contain shrink-0 hidden dark:block",
          className,
        )}
      />
    </>
  );
};

export const SparkLogoMark: React.FC<{
  className?: string;
  size?: "xs" | "sm" | "md" | "lg";
}> = ({ className = "h-8 w-auto", size = "md" }) => {
  return <SparkLogo variant="symbol" size={size} className={className} />;
};

export const SparkStar: React.FC<{ className?: string }> = ({
  className = "h-3.5 w-3.5",
}) => (
  <span
    aria-hidden="true"
    className={cn(
      "inline-block rounded-full bg-primary/20 p-0.5 text-primary align-middle",
      className,
    )}
  >
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-full w-full">
      <path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z" />
    </svg>
  </span>
);

export default SparkLogo;
