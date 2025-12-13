import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";
import { componentSizes, DEFAULT_SIZE, type ButtonSize } from "@/lib/design-system/sizes";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 lg:min-h-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        "destructive-light":
          "bg-destructive/10 dark:bg-destructive/20 text-destructive dark:text-sentiment-negative hover:bg-destructive/15 dark:hover:bg-destructive/30",
        outline:
          "border border-input bg-background hover:bg-secondary hover:text-secondary-foreground hover:border-secondary",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-secondary hover:text-secondary-foreground",
        link: "text-foreground underline-offset-4 hover:underline",
      },
      size: {
        tiny: cn(
          componentSizes.button.tiny.height,
          componentSizes.button.tiny.paddingX,
          componentSizes.button.tiny.paddingY,
          componentSizes.button.tiny.text,
          componentSizes.button.tiny.rounded,
          "min-h-[44px] lg:min-h-0"
        ),
        small: cn(
          componentSizes.button.small.height,
          componentSizes.button.small.paddingX,
          componentSizes.button.small.paddingY,
          componentSizes.button.small.text,
          componentSizes.button.small.rounded,
          "min-h-[44px] lg:min-h-0"
        ),
        medium: cn(
          componentSizes.button.medium.height,
          componentSizes.button.medium.paddingX,
          componentSizes.button.medium.paddingY,
          componentSizes.button.medium.text,
          componentSizes.button.medium.rounded,
          "min-h-[44px] lg:min-h-0"
        ),
        large: cn(
          componentSizes.button.large.height,
          componentSizes.button.large.paddingX,
          componentSizes.button.large.paddingY,
          componentSizes.button.large.text,
          componentSizes.button.large.rounded,
          "min-h-[44px] lg:min-h-0"
        ),
        icon: cn(
          componentSizes.button.icon.medium.height,
          componentSizes.button.icon.medium.width,
          componentSizes.button.icon.medium.text,
          componentSizes.button.icon.medium.rounded,
          "min-h-[44px] min-w-[44px] lg:min-h-0 lg:min-w-0"
        ),
      },
    },
    defaultVariants: {
      variant: "default",
      size: DEFAULT_SIZE,
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };

