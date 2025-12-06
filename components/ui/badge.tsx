import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";
import { componentSizes, DEFAULT_SIZE, type ComponentSize } from "@/lib/design-system/sizes";

const badgeVariants = cva(
  "inline-flex items-center border font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground",
      },
      size: {
        tiny: cn(
          componentSizes.badge.tiny.paddingX,
          componentSizes.badge.tiny.paddingY,
          componentSizes.badge.tiny.text,
          componentSizes.badge.tiny.rounded
        ),
        small: cn(
          componentSizes.badge.small.paddingX,
          componentSizes.badge.small.paddingY,
          componentSizes.badge.small.text,
          componentSizes.badge.small.rounded
        ),
        medium: cn(
          componentSizes.badge.medium.paddingX,
          componentSizes.badge.medium.paddingY,
          componentSizes.badge.medium.text,
          componentSizes.badge.medium.rounded
        ),
        large: cn(
          componentSizes.badge.large.paddingX,
          componentSizes.badge.large.paddingY,
          componentSizes.badge.large.text,
          componentSizes.badge.large.rounded
        ),
      },
    },
    defaultVariants: {
      variant: "default",
      size: DEFAULT_SIZE,
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, size, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant, size }), className)} {...props} />
  );
}

export { Badge, badgeVariants };

