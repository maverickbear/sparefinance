"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface DollarAmountInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type" | "size"> {
  value?: number | string;
  onChange?: (value: number | undefined) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  size?: "tiny" | "small" | "medium" | "large";
}

/**
 * Formats a number to display with commas and 2 decimal places
 * Examples: 1.00, 10.00, 100.00, 1,000.00, 100,000.00, 1,000,000.00
 */
function formatDisplayValue(value: number | string | undefined | null): string {
  if (value === null || value === undefined || value === "") {
    return "";
  }

  const numValue = typeof value === "string" ? parseFloat(value) : Number(value);

  if (isNaN(numValue) || !isFinite(numValue)) {
    return "";
  }

  // Format with commas for thousands and 2 decimal places (including 0.00)
  return numValue.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Formats only the integer part with commas (for real-time formatting while typing)
 * Examples: 1 → "1", 10 → "10", 100 → "100", 1000 → "1,000", 10000 → "10,000"
 */
function formatIntegerPart(value: string): string {
  if (!value || value === "" || value === ".") {
    return "";
  }

  // Handle negative sign
  const isNegative = value.startsWith("-");
  const valueWithoutSign = isNegative ? value.slice(1) : value;

  // Split by decimal point
  const parts = valueWithoutSign.split(".");
  const integerPart = parts[0] || "";
  const decimalPart = parts[1] || "";

  if (integerPart === "" || integerPart === "-") {
    return value; // Return as is if no integer part
  }

  // Format integer part with commas
  const integerNum = parseInt(integerPart, 10);
  if (isNaN(integerNum)) {
    return value;
  }

  const formattedInteger = integerNum.toLocaleString("en-US");
  const sign = isNegative ? "-" : "";

  // Reconstruct with decimal part if present
  if (decimalPart !== "") {
    return `${sign}${formattedInteger}.${decimalPart}`;
  }

  return `${sign}${formattedInteger}`;
}

/**
 * Parses a formatted string back to a number
 * Removes $, commas and whitespace, then parses the number
 */
function parseInputValue(value: string): number | undefined {
  // Remove $, commas and whitespace
  const cleaned = value.replace(/\$/g, "").replace(/,/g, "").trim();

  if (cleaned === "" || cleaned === ".") {
    return undefined;
  }

  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? undefined : parsed;
}

/**
 * Dollar amount input component that only accepts numbers
 * and formats them with $ prefix, commas and 2 decimal places
 */
export const DollarAmountInput = React.forwardRef<HTMLInputElement, DollarAmountInputProps>(
  ({ value, onChange, onBlur, className, placeholder = "$ 0.00", ...props }, ref) => {
    const [displayValue, setDisplayValue] = React.useState<string>(() => {
      const formatted = formatDisplayValue(value);
      if (formatted !== "") {
        return `$ ${formatted}`;
      } else if (value === 0 || value === "0") {
        return "$ 0.00";
      }
      return "";
    });
    const inputRef = React.useRef<HTMLInputElement>(null);
    const [isFocused, setIsFocused] = React.useState(false);

    // Update display value when value prop changes (only when not focused)
    React.useEffect(() => {
      if (!isFocused) {
        const formatted = formatDisplayValue(value);
        if (formatted !== "") {
          // formatted can be "0.00" when value is 0, which is a valid string
          setDisplayValue(`$ ${formatted}`);
        } else if (value === 0 || value === "0") {
          // Explicitly handle 0 value
          setDisplayValue("$ 0.00");
        } else {
          // Only set to empty if not focused, to allow placeholder to show
          setDisplayValue("");
        }
      }
    }, [value, isFocused]);

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(true);
      // If empty, add "$ " prefix when focused
      if (!displayValue || displayValue === "" || displayValue.trim() === "") {
        setDisplayValue("$ ");
        setTimeout(() => {
          if (inputRef.current) {
            inputRef.current.setSelectionRange(2, 2);
          }
        }, 0);
      }
      props.onFocus?.(e);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const inputValue = e.target.value;
      const cursorPosition = e.target.selectionStart || 0;

      // Always ensure "$ " prefix is present when user is typing
      if (!inputValue.startsWith("$ ")) {
        // If user tries to delete "$ ", restore it
        if (inputValue === "" || inputValue === "$" || inputValue.trim() === "") {
          setDisplayValue("$ ");
          onChange?.(undefined);
          // Reset cursor to after "$ "
          setTimeout(() => {
            if (inputRef.current) {
              inputRef.current.setSelectionRange(2, 2);
            }
          }, 0);
          return;
        }
        // If "$ " is missing, add it back
        const cleaned = inputValue.replace(/\$/g, "").replace(/,/g, "").trim();
        if (cleaned === "" || cleaned === ".") {
          setDisplayValue("$ ");
          onChange?.(undefined);
          setTimeout(() => {
            if (inputRef.current) {
              inputRef.current.setSelectionRange(2, 2);
            }
          }, 0);
          return;
        }
        // Reconstruct with "$ " prefix
        const parsed = parseFloat(cleaned);
        if (!isNaN(parsed)) {
          const formatted = formatDisplayValue(parsed);
          setDisplayValue(`$ ${formatted}`);
          onChange?.(parsed);
          setTimeout(() => {
            if (inputRef.current) {
              inputRef.current.setSelectionRange(`$ ${formatted}`.length, `$ ${formatted}`.length);
            }
          }, 0);
        } else {
          setDisplayValue(`$ ${cleaned}`);
          setTimeout(() => {
            if (inputRef.current) {
              inputRef.current.setSelectionRange(`$ ${cleaned}`.length, `$ ${cleaned}`.length);
            }
          }, 0);
        }
        return;
      }

      // Remove "$ " prefix for validation
      const valueWithoutPrefix = inputValue.slice(2); // Remove "$ "
      const cleaned = valueWithoutPrefix.replace(/,/g, "").trim();
      
      // Allow digits, single decimal point, and optional negative sign
      const validPattern = /^-?\d*\.?\d*$/;

      if (!validPattern.test(cleaned)) {
        return; // Don't update if invalid
      }

      // Parse the cleaned value
      const parsed = parseInputValue(inputValue);
      
      // Explicitly handle "0" case - parseFloat("0") returns 0, which is valid
      const isZero = cleaned === "0" || cleaned === "-0" || parsed === 0;

      // Format in real-time: format integer part with commas while typing
      if (cleaned !== "") {
        // Handle decimal point: add '.00' automatically, but replace with user input if they type
        const parts = cleaned.split(".");
        const hasDecimal = parts.length === 2;
        const integerPart = parts[0] || "";
        const decimalPart = parts[1] || "";
        
        // Check if user just typed '.' (has decimal point but no decimal digits yet)
        if (hasDecimal && decimalPart === "" && integerPart !== "" && integerPart !== "-") {
          // Add '.00' automatically
          const valueWithCents = `${integerPart}.00`;
          const formatted = formatIntegerPart(valueWithCents);
          setDisplayValue(`$ ${formatted}`);
          
          // Position cursor after the decimal point (before the first 0)
          setTimeout(() => {
            if (inputRef.current) {
              const decimalPos = formatted.indexOf(".");
              if (decimalPos !== -1) {
                inputRef.current.setSelectionRange(decimalPos + 3, decimalPos + 3); // +3 for "$ " and position after "."
              }
            }
          }, 0);
          
          // Parse and send the numeric value
          const parsedWithCents = parseFloat(valueWithCents);
          if (!isNaN(parsedWithCents) && isFinite(parsedWithCents)) {
            onChange?.(parsedWithCents);
          }
          return;
        }
        
        // If user has decimal part, format it properly (limit to 2 decimal places)
        // This replaces the '.00' with whatever the user types
        if (hasDecimal && decimalPart !== "") {
          // Limit decimal part to 2 digits - use what user typed
          const limitedDecimalPart = decimalPart.slice(0, 2);
          const valueToFormat = `${integerPart}.${limitedDecimalPart}`;
          const formatted = formatIntegerPart(valueToFormat);
          setDisplayValue(`$ ${formatted}`);
          
          // Calculate cursor position
          const cursorInCleaned = Math.max(0, cursorPosition - 2);
          const cleanedBeforeCursor = cleaned.slice(0, Math.min(cursorInCleaned, cleaned.length));
          const digitCountBeforeCursor = cleanedBeforeCursor.replace(/[^\d]/g, "").length;
          const hasDecimalBeforeCursor = cleanedBeforeCursor.includes(".");
          
          // Find position in formatted string
          let newCursorPos = 2;
          let digitCount = 0;
          let foundPosition = false;
          
          for (let i = 0; i < formatted.length; i++) {
            const char = formatted[i];
            if (/\d/.test(char)) {
              digitCount++;
              if (digitCount > digitCountBeforeCursor) {
                newCursorPos = i + 2;
                foundPosition = true;
                break;
              }
              newCursorPos = i + 3;
            } else if (char === ".") {
              if (hasDecimalBeforeCursor && digitCount === digitCountBeforeCursor) {
                newCursorPos = i + 2;
                foundPosition = true;
                break;
              }
              newCursorPos = i + 3;
            } else if (char === ",") {
              newCursorPos = i + 3;
            }
          }
          
          if (cursorPosition >= inputValue.length || !foundPosition) {
            newCursorPos = formatted.length + 2;
          }
          
          setTimeout(() => {
            if (inputRef.current) {
              const pos = Math.min(Math.max(2, newCursorPos), formatted.length + 2);
              inputRef.current.setSelectionRange(pos, pos);
            }
          }, 0);
          
          // Parse and send the numeric value
          const parsed = parseFloat(valueToFormat);
          if (!isNaN(parsed) && isFinite(parsed)) {
            onChange?.(parsed);
          }
          return;
        }
        
        // Format the integer part with commas in real-time
        const formatted = formatIntegerPart(cleaned);
        setDisplayValue(`$ ${formatted}`);
        
        // Calculate cursor position after formatting
        // Get the position in the cleaned value (without "$ " prefix)
        const cursorInCleaned = Math.max(0, cursorPosition - 2);
        
        // Count how many digits (and decimal point) are before the cursor in cleaned value
        const cleanedBeforeCursor = cleaned.slice(0, Math.min(cursorInCleaned, cleaned.length));
        const digitCountBeforeCursor = cleanedBeforeCursor.replace(/[^\d]/g, "").length;
        const hasDecimalBeforeCursor = cleanedBeforeCursor.includes(".");
        
        // Find the corresponding position in the formatted string
        let newCursorPos = 2; // Start after "$ "
        let digitCount = 0;
        let foundPosition = false;
        
        for (let i = 0; i < formatted.length; i++) {
          const char = formatted[i];
          if (/\d/.test(char)) {
            digitCount++;
            // If we've passed the digit count, position cursor here
            if (digitCount > digitCountBeforeCursor) {
              newCursorPos = i + 2; // +2 for "$ "
              foundPosition = true;
              break;
            }
            // Update position to after this digit
            newCursorPos = i + 3; // +3 for "$ " and position after digit
          } else if (char === ".") {
            // If cursor was at or before decimal point
            if (hasDecimalBeforeCursor && digitCount === digitCountBeforeCursor) {
              newCursorPos = i + 2; // +2 for "$ "
              foundPosition = true;
              break;
            }
            newCursorPos = i + 3; // +3 for "$ " and position after decimal
          } else if (char === ",") {
            // Commas don't affect digit count, just update position
            newCursorPos = i + 3; // +3 for "$ " and position after comma
          }
        }
        
        // If cursor was at the end of input, keep it at the end
        if (cursorPosition >= inputValue.length || !foundPosition) {
          newCursorPos = formatted.length + 2;
        }
        
        // Set cursor position after state update
        setTimeout(() => {
          if (inputRef.current) {
            const pos = Math.min(Math.max(2, newCursorPos), formatted.length + 2);
            inputRef.current.setSelectionRange(pos, pos);
          }
        }, 0);
        
        // Parse and send the numeric value for form validation (including 0)
        if (isZero) {
          // Explicitly handle "0" case to ensure it's sent as a value
          onChange?.(0);
        } else if (parsed !== undefined && !isNaN(parsed) && isFinite(parsed)) {
          onChange?.(parsed);
        }
      } else {
        setDisplayValue("$ ");
        onChange?.(undefined);
      }
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(false);
      // Ensure final format on blur
      const parsed = parseInputValue(displayValue);
      // Check if the value is 0 (including "0", "0.0", "0.00", etc.)
      const isZeroValue = parsed === 0 || displayValue.replace(/\$/g, "").replace(/,/g, "").trim() === "0";
      
      if (parsed !== undefined || isZeroValue) {
        // If parsed is 0 or the display value represents 0, format and send 0
        const valueToFormat = parsed !== undefined ? parsed : 0;
        const formatted = formatDisplayValue(valueToFormat);
        setDisplayValue(`$ ${formatted}`);
        // Send raw number without formatting (including 0.00)
        onChange?.(valueToFormat);
      } else {
        setDisplayValue("");
        // Send undefined when empty
        onChange?.(undefined);
      }
      onBlur?.(e);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      const input = e.currentTarget;
      const cursorPosition = input.selectionStart || 0;
      const selectionEnd = input.selectionEnd || 0;

      // Prevent deleting "$ " prefix
      if (cursorPosition <= 2 && selectionEnd <= 2) {
        if (e.key === "Backspace" || e.key === "Delete") {
          e.preventDefault();
          // Move cursor to after "$ "
          setTimeout(() => {
            if (inputRef.current) {
              inputRef.current.setSelectionRange(2, 2);
            }
          }, 0);
          return;
        }
      }

      // Prevent arrow keys from moving cursor before "$ "
      if (e.key === "ArrowLeft" && cursorPosition <= 2) {
        e.preventDefault();
        input.setSelectionRange(2, 2);
        return;
      }

      // Prevent Home key from moving cursor before "$ "
      if (e.key === "Home") {
        e.preventDefault();
        input.setSelectionRange(2, 2);
        return;
      }
    };

    const handleSelect = (e: React.SyntheticEvent<HTMLInputElement>) => {
      const input = e.currentTarget;
      const selectionStart = input.selectionStart || 0;
      const selectionEnd = input.selectionEnd || 0;

      // If selection includes "$ ", adjust it
      if (selectionStart < 2 || selectionEnd < 2) {
        const newStart = Math.max(2, selectionStart);
        const newEnd = Math.max(2, selectionEnd);
        setTimeout(() => {
          if (inputRef.current) {
            inputRef.current.setSelectionRange(newStart, newEnd);
          }
        }, 0);
      }
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
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        onSelect={handleSelect}
        placeholder={placeholder}
        className={cn(className)}
        {...props}
      />
    );
  }
);

DollarAmountInput.displayName = "DollarAmountInput";

