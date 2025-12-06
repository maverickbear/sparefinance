"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface PercentageInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type" | "size"> {
  value?: number | string;
  onChange?: (value: number | undefined) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  size?: "tiny" | "small" | "medium" | "large";
}

/**
 * Formats a number to display with 2 decimal places and % suffix
 * Examples: 1.00 %, 10.00 %, 100.00 %
 */
function formatDisplayValue(value: number | string | undefined | null): string {
  if (value === null || value === undefined || value === "") {
    return "";
  }

  const numValue = typeof value === "string" ? parseFloat(value) : Number(value);

  if (isNaN(numValue) || !isFinite(numValue) || numValue === 0) {
    return "";
  }

  // Format with 2 decimal places
  return numValue.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Parses a formatted string back to a number
 * Removes % and parses the number
 */
function parseInputValue(value: string): number | undefined {
  // Remove % and whitespace
  const cleaned = value.replace(/%/g, "").trim();

  if (cleaned === "" || cleaned === ".") {
    return undefined;
  }

  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? undefined : parsed;
}

/**
 * Percentage input component that only accepts numbers
 * and formats them with % suffix and 2 decimal places
 */
export const PercentageInput = React.forwardRef<HTMLInputElement, PercentageInputProps>(
  ({ value, onChange, onBlur, className, ...props }, ref) => {
    const [displayValue, setDisplayValue] = React.useState<string>(() => {
      const formatted = formatDisplayValue(value);
      return formatted ? `${formatted} %` : "";
    });
    const inputRef = React.useRef<HTMLInputElement>(null);

    // Update display value when value prop changes
    React.useEffect(() => {
      const formatted = formatDisplayValue(value);
      setDisplayValue(formatted ? `${formatted} %` : "");
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const inputValue = e.target.value;
      const cursorPosition = e.target.selectionStart || 0;

      // Allow empty input
      if (inputValue === "" || inputValue === "%" || inputValue.trim() === "") {
        setDisplayValue("");
        onChange?.(undefined);
        return;
      }

      // Remove % and whitespace for validation
      const cleaned = inputValue.replace(/%/g, "").trim();
      const validPattern = /^-?\d*\.?\d*$/;

      if (!validPattern.test(cleaned)) {
        return; // Don't update if invalid
      }

      // Parse the cleaned value
      const parsed = parseInputValue(inputValue);

      // Format in real-time
      if (parsed !== undefined) {
        const formatted = formatDisplayValue(parsed);
        setDisplayValue(`${formatted} %`);
        
        // Calculate new cursor position
        // Count non-formatting characters (digits and decimal) before cursor in cleaned input
        const charsBeforeCursor = cleaned.slice(0, Math.min(cursorPosition, cleaned.length));
        const digitsAndDecimalBeforeCursor = charsBeforeCursor.replace(/[^\d.]/g, "").length;
        
        // Find position in formatted string (accounting for " %" suffix)
        let newCursorPos = formatted.length;
        let charsCount = 0;
        for (let i = 0; i < formatted.length; i++) {
          const char = formatted[i];
          if (/\d/.test(char) || char === ".") {
            charsCount++;
            if (charsCount >= digitsAndDecimalBeforeCursor) {
              newCursorPos = i + 1;
              break;
            }
          }
        }
        
        // Set cursor position after state update
        setTimeout(() => {
          if (inputRef.current) {
            const pos = Math.min(newCursorPos, formatted.length);
            inputRef.current.setSelectionRange(pos, pos);
          }
        }, 0);
      } else {
        // If user is typing, show what they typed with % suffix
        if (cleaned !== "") {
          setDisplayValue(`${cleaned} %`);
        } else {
          setDisplayValue("");
        }
      }

      // Call onChange with numeric value
      onChange?.(parsed);
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      // Ensure final format on blur
      const parsed = parseInputValue(displayValue);
      if (parsed !== undefined && parsed !== 0) {
        const formatted = formatDisplayValue(parsed);
        setDisplayValue(`${formatted} %`);
        onChange?.(parsed);
      } else {
        setDisplayValue("");
      }
      onBlur?.(e);
    };

    return (
      <Input
        ref={(node) => {
          inputRef.current = node;
          if (typeof ref === "function") {
            ref(node);
          } else if (ref) {
            ref.current = node;
          }
        }}
        type="text"
        inputMode="decimal"
        value={displayValue}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder="0.00 %"
        className={cn(className)}
        {...props}
      />
    );
  }
);

PercentageInput.displayName = "PercentageInput";

