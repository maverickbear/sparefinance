"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

const RadioGroupContext = React.createContext<{
  value?: string;
  onValueChange?: (value: string) => void;
}>({});

export interface RadioGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: string;
  onValueChange?: (value: string) => void;
}

const RadioGroup = React.forwardRef<HTMLDivElement, RadioGroupProps>(
  ({ className, value, onValueChange, ...props }, ref) => {
    return (
      <RadioGroupContext.Provider value={{ value, onValueChange }}>
        <div
          ref={ref}
          className={cn("space-y-2", className)}
          role="radiogroup"
          {...props}
        />
      </RadioGroupContext.Provider>
    );
  }
);
RadioGroup.displayName = "RadioGroup";

export interface RadioGroupItemProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  value: string;
}

const RadioGroupItem = React.forwardRef<HTMLInputElement, RadioGroupItemProps>(
  ({ className, value: itemValue, ...props }, ref) => {
    const context = React.useContext(RadioGroupContext);
    const isChecked = context.value === itemValue;

    return (
      <input
        type="radio"
        ref={ref}
        value={itemValue}
        checked={isChecked}
        onChange={() => context.onValueChange?.(itemValue)}
        className={cn(
          "h-4 w-4 border-input text-primary focus:ring-2 focus:ring-ring focus:ring-offset-2 cursor-pointer",
          className
        )}
        {...props}
      />
    );
  }
);
RadioGroupItem.displayName = "RadioGroupItem";

export { RadioGroup, RadioGroupItem };

