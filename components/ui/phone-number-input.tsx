"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { componentSizes, DEFAULT_SIZE } from "@/lib/design-system/sizes";

const phoneNumberInputVariants = cva(
  "flex w-full items-center border border-input bg-background ring-offset-background transition-colors hover:border-ring active:border-ring focus-within:outline-none disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-input",
  {
    variants: {
      size: {
        tiny: cn(
          componentSizes.input.tiny.height,
          componentSizes.input.tiny.rounded
        ),
        small: cn(
          componentSizes.input.small.height,
          componentSizes.input.small.rounded
        ),
        medium: cn(
          componentSizes.input.medium.height,
          componentSizes.input.medium.rounded
        ),
        large: cn(
          componentSizes.input.large.height,
          componentSizes.input.large.rounded
        ),
      },
    },
    defaultVariants: {
      size: DEFAULT_SIZE,
    },
  }
);

type Country = "US" | "CA";

export interface PhoneNumberInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size" | "type" | "value" | "onChange">,
    VariantProps<typeof phoneNumberInputVariants> {
  value?: string;
  onChange?: (value: string) => void;
  defaultCountry?: Country;
}

// Format phone number as (XXX) XXX-XXXX
function formatPhoneNumber(value: string): string {
  // Remove all non-digits
  let digits = value.replace(/\D/g, "");
  
  // If user typed 11 digits starting with 1, remove the leading 1 (country code)
  // This handles cases where user pastes +1XXXXXXXXXX or 1XXXXXXXXXX
  if (digits.length === 11 && digits.startsWith("1")) {
    digits = digits.slice(1);
  }
  
  // Limit to 10 digits (US/CA format)
  const limitedDigits = digits.slice(0, 10);
  
  // Format based on length
  if (limitedDigits.length === 0) return "";
  if (limitedDigits.length <= 3) return `(${limitedDigits}`;
  if (limitedDigits.length <= 6) {
    return `(${limitedDigits.slice(0, 3)}) ${limitedDigits.slice(3)}`;
  }
  return `(${limitedDigits.slice(0, 3)}) ${limitedDigits.slice(3, 6)}-${limitedDigits.slice(6)}`;
}

// Convert formatted phone to E164 format (+1XXXXXXXXXX)
// Both US and CA use +1, so country parameter is not needed
function toE164(formattedValue: string): string {
  const digits = formattedValue.replace(/\D/g, "");
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  return "";
}

// Extract digits from E164 or formatted string
function extractDigits(value: string): string {
  let digits = value.replace(/\D/g, "");
  
  // If value has 11 digits starting with 1, remove the leading 1 (country code)
  // This handles cases where value is +1XXXXXXXXXX or 1XXXXXXXXXX
  if (digits.length === 11 && digits.startsWith("1")) {
    digits = digits.slice(1);
  }
  
  return digits.slice(0, 10);
}

const PhoneNumberInput = React.forwardRef<HTMLInputElement, PhoneNumberInputProps>(
  (
    {
      className,
      size,
      value,
      onChange,
      defaultCountry = "US",
      placeholder,
      disabled,
      required,
      ...props
    },
    ref
  ) => {
    const [selectedCountry, setSelectedCountry] = React.useState<Country>(defaultCountry);
    const [displayValue, setDisplayValue] = React.useState<string>("");
    const inputRef = React.useRef<HTMLInputElement>(null);

    // Sync external value to display value
    React.useEffect(() => {
      if (value) {
        // Extract digits from E164 format (+1XXXXXXXXXX) or formatted string
        const digits = extractDigits(value);
        setDisplayValue(formatPhoneNumber(digits));
      } else {
        setDisplayValue("");
      }
    }, [value]);

    // Auto-detect country from timezone on mount
    React.useEffect(() => {
      if (defaultCountry) {
        setSelectedCountry(defaultCountry);
        return;
      }

      try {
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const timezoneToCountry: Record<string, Country> = {
          "America/New_York": "US",
          "America/Los_Angeles": "US",
          "America/Chicago": "US",
          "America/Denver": "US",
          "America/Phoenix": "US",
          "America/Anchorage": "US",
          "America/Detroit": "US",
          "America/Indianapolis": "US",
          "America/Louisville": "US",
          "America/Menominee": "US",
          "America/Montreal": "CA",
          "America/Toronto": "CA",
          "America/Vancouver": "CA",
          "America/Winnipeg": "CA",
          "America/Halifax": "CA",
          "America/St_Johns": "CA",
          "America/Edmonton": "CA",
          "America/Regina": "CA",
          "America/Yellowknife": "CA",
          "America/Whitehorse": "CA",
          "America/Dawson": "CA",
          "America/Inuvik": "CA",
          "America/Glace_Bay": "CA",
          "America/Goose_Bay": "CA",
          "America/Blanc-Sablon": "CA",
          "America/Moncton": "CA",
          "America/Nipigon": "CA",
          "America/Thunder_Bay": "CA",
          "America/Iqaluit": "CA",
          "America/Pangnirtung": "CA",
          "America/Resolute": "CA",
          "America/Cambridge_Bay": "CA",
        };

        const country = timezoneToCountry[timezone];
        if (country) {
          setSelectedCountry(country);
        }
      } catch (error) {
        // Fallback to US
        console.warn("Could not detect country from timezone:", error);
      }
    }, [defaultCountry]);

    const handleInputChange = React.useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const inputValue = e.target.value;
        
        // Only allow digits and formatting characters
        let digits = inputValue.replace(/\D/g, "");
        
        // If user typed 11 digits starting with 1, remove the leading 1 (country code)
        if (digits.length === 11 && digits.startsWith("1")) {
          digits = digits.slice(1);
        }
        
        // Limit to 10 digits
        const limitedDigits = digits.slice(0, 10);
        
        // Format the display value
        const formatted = formatPhoneNumber(limitedDigits);
        setDisplayValue(formatted);
        
        // Only call onChange when we have exactly 10 digits
        if (limitedDigits.length === 10) {
          const e164Value = toE164(formatted);
          onChange?.(e164Value);
        } else if (limitedDigits.length === 0) {
          // Also call onChange with empty string when cleared
          onChange?.("");
        }
      },
      [onChange]
    );

    const handleKeyDown = React.useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
      // Allow: backspace, delete, tab, escape, enter, home, end, arrow keys
      if (
        ["Backspace", "Delete", "Tab", "Escape", "Enter", "Home", "End", "ArrowLeft", "ArrowRight"].includes(
          e.key
        )
      ) {
        return;
      }
      
      // Allow Ctrl/Cmd + A, C, V, X
      if ((e.ctrlKey || e.metaKey) && ["a", "c", "v", "x"].includes(e.key.toLowerCase())) {
        return;
      }
      
      // Only allow digits
      if (!/^\d$/.test(e.key)) {
        e.preventDefault();
      }
    }, []);

    const handlePaste = React.useCallback((e: React.ClipboardEvent<HTMLInputElement>) => {
      e.preventDefault();
      const pastedText = e.clipboardData.getData("text");
      let digits = pastedText.replace(/\D/g, "");
      
      // If pasted text has 11 digits starting with 1, remove the leading 1 (country code)
      if (digits.length === 11 && digits.startsWith("1")) {
        digits = digits.slice(1);
      }
      
      const limitedDigits = digits.slice(0, 10);
      const formatted = formatPhoneNumber(limitedDigits);
      setDisplayValue(formatted);
      
      // Only call onChange when we have exactly 10 digits
      if (limitedDigits.length === 10) {
        const e164Value = toE164(formatted);
        onChange?.(e164Value);
      }
    }, [onChange]);

    const handleCountryChange = React.useCallback(
      (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newCountry = e.target.value as Country;
        setSelectedCountry(newCountry);
        
        // Update the value with new country code if we have digits
        if (displayValue) {
          const digits = extractDigits(displayValue);
          const formatted = formatPhoneNumber(digits);
          const e164Value = toE164(formatted);
          onChange?.(e164Value);
        }
      },
      [displayValue, onChange]
    );

    const inputSizeClasses = React.useMemo(() => {
      switch (size) {
        case "tiny":
          return {
            text: componentSizes.input.tiny.text,
            paddingX: componentSizes.input.tiny.paddingX,
            paddingY: componentSizes.input.tiny.paddingY,
          };
        case "small":
          return {
            text: componentSizes.input.small.text,
            paddingX: componentSizes.input.small.paddingX,
            paddingY: componentSizes.input.small.paddingY,
          };
        case "large":
          return {
            text: componentSizes.input.large.text,
            paddingX: componentSizes.input.large.paddingX,
            paddingY: componentSizes.input.large.paddingY,
          };
        default:
          return {
            text: componentSizes.input.medium.text,
            paddingX: componentSizes.input.medium.paddingX,
            paddingY: componentSizes.input.medium.paddingY,
          };
      }
    }, [size]);

    // Combine refs
    const combinedRef = React.useCallback(
      (node: HTMLInputElement) => {
        inputRef.current = node;
        if (typeof ref === "function") {
          ref(node);
        } else if (ref) {
          ref.current = node;
        }
      },
      [ref]
    );

    return (
      <div
        className={cn(
          phoneNumberInputVariants({ size, className }),
          "flex items-center gap-2"
        )}
      >
        {/* Country selector */}
        <select
          value={selectedCountry}
          onChange={handleCountryChange}
          disabled={disabled}
          className={cn(
            "flex items-center gap-1 border-0 bg-transparent outline-none cursor-pointer",
            "focus:outline-none",
            inputSizeClasses.text,
            "px-2"
          )}
          aria-label="Country code"
        >
          <option value="US">🇺🇸</option>
          <option value="CA">🇨🇦</option>
        </select>

        {/* Phone input */}
        <input
          ref={combinedRef}
          type="text"
          inputMode="tel"
          value={displayValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          disabled={disabled}
          required={required}
          placeholder={placeholder || "(XXX) XXX-XXXX"}
          autoComplete="tel"
          className={cn(
            "flex-1 border-0 outline-none bg-transparent",
            "focus:ring-0 focus-visible:ring-0",
            "placeholder:text-muted-foreground",
            inputSizeClasses.text,
            "pr-4"
          )}
          {...props}
        />
      </div>
    );
  }
);

PhoneNumberInput.displayName = "PhoneNumberInput";

export { PhoneNumberInput };
