import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-[#E37439]/12 text-[#E37439] border border-[#E37439]/25",
        secondary:
          "border-transparent bg-[#4E5964]/12 text-[#4E5964] border border-[#4E5964]/20",
        destructive:
          "border-transparent bg-[#D64545]/12 text-[#D64545] border border-[#D64545]/25",
        outline: "text-[#4E5964] border-[#DBDBDB]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends
    React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
