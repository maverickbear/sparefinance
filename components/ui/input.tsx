import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";
import { componentSizes, DEFAULT_SIZE, type ComponentSize } from "@/lib/design-system/sizes";

const inputVariants = cva(
  "flex w-full border border-input bg-background ring-offset-background file:border-0 file:bg-transparent file:font-medium placeholder:text-muted-foreground transition-colors hover:border-ring active:border-ring focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-input",
  {
    variants: {
      size: {
        tiny: cn(
          componentSizes.input.tiny.height,
          componentSizes.input.tiny.paddingX,
          componentSizes.input.tiny.paddingY,
          componentSizes.input.tiny.text,
          componentSizes.input.tiny.rounded,
          "file:text-xs"
        ),
        small: cn(
          componentSizes.input.small.height,
          componentSizes.input.small.paddingX,
          componentSizes.input.small.paddingY,
          componentSizes.input.small.text,
          componentSizes.input.small.rounded,
          "file:text-sm"
        ),
        medium: cn(
          componentSizes.input.medium.height,
          componentSizes.input.medium.paddingX,
          componentSizes.input.medium.paddingY,
          componentSizes.input.medium.text,
          componentSizes.input.medium.rounded,
          "file:text-base"
        ),
        large: cn(
          componentSizes.input.large.height,
          componentSizes.input.large.paddingX,
          componentSizes.input.large.paddingY,
          componentSizes.input.large.text,
          componentSizes.input.large.rounded,
          "file:text-lg"
        ),
      },
    },
    defaultVariants: {
      size: DEFAULT_SIZE,
    },
  }
);

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size">,
    VariantProps<typeof inputVariants> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, size, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(inputVariants({ size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input, inputVariants };

