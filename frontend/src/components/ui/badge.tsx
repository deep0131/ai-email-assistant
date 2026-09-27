import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-1 focus:ring-ring",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-white text-zinc-950 shadow hover:bg-zinc-200",
        secondary:
          "border-zinc-700 bg-zinc-800 text-zinc-200 hover:bg-zinc-700",
        destructive:
          "border-red-800 bg-red-950/60 text-red-200 hover:bg-red-900/80",
        outline:
          "border-zinc-700 text-zinc-300",
        success:
          "border-emerald-800/60 bg-emerald-950/40 text-emerald-300",
        warning:
          "border-amber-800/60 bg-amber-950/40 text-amber-300",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export type BadgeProps = React.HTMLAttributes<HTMLDivElement> &
  VariantProps<typeof badgeVariants>;

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
