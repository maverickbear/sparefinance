"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface AccordionContextType {
  openValue: string | null;
  onValueChange: (value: string | null) => void;
}

const AccordionContext = React.createContext<AccordionContextType>({
  openValue: null,
  onValueChange: () => {},
});

interface AccordionProps extends React.HTMLAttributes<HTMLDivElement> {
  type?: "single" | "multiple";
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string | null) => void;
  collapsible?: boolean;
}

const Accordion = React.forwardRef<HTMLDivElement, AccordionProps>(
  ({ className, type = "single", defaultValue, value, onValueChange, collapsible = true, children, ...props }, ref) => {
    const [internalValue, setInternalValue] = React.useState<string | null>(defaultValue || null);
    const controlledValue = value !== undefined ? value : internalValue;

    const handleValueChange = React.useCallback(
      (newValue: string | null) => {
        if (type === "single") {
          const finalValue = controlledValue === newValue && collapsible ? null : newValue;
          setInternalValue(finalValue);
          onValueChange?.(finalValue);
        }
      },
      [type, controlledValue, onValueChange, collapsible]
    );

    return (
      <AccordionContext.Provider
        value={{
          openValue: controlledValue || null,
          onValueChange: handleValueChange,
        }}
      >
        <div ref={ref} className={cn("space-y-2", className)} {...props}>
          {children}
        </div>
      </AccordionContext.Provider>
    );
  }
);
Accordion.displayName = "Accordion";

interface AccordionItemProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
}

const AccordionItem = React.forwardRef<HTMLDivElement, AccordionItemProps>(
  ({ className, value, children, ...props }, ref) => {
    const context = React.useContext(AccordionContext);
    const isOpen = context.openValue === value;

    return (
      <div
        ref={ref}
        className={cn("border border-border rounded-[12px] overflow-hidden", className)}
        data-state={isOpen ? "open" : "closed"}
        {...props}
      >
        {React.Children.map(children, (child) => {
          if (React.isValidElement(child)) {
            return React.cloneElement(child, { value, isOpen } as any);
          }
          return child;
        })}
      </div>
    );
  }
);
AccordionItem.displayName = "AccordionItem";

interface AccordionTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value?: string;
  isOpen?: boolean;
}

const AccordionTrigger = React.forwardRef<HTMLButtonElement, AccordionTriggerProps>(
  ({ className, children, value, isOpen, ...props }, ref) => {
    const context = React.useContext(AccordionContext);

    const handleClick = () => {
      if (value) {
        context.onValueChange(value);
      }
    };

    return (
      <button
        ref={ref}
        type="button"
        className={cn(
          "flex w-full items-center justify-between p-6 text-left font-semibold transition-all hover:bg-muted/50",
          className
        )}
        onClick={handleClick}
        {...props}
      >
        {children}
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
            isOpen && "rotate-180"
          )}
        />
      </button>
    );
  }
);
AccordionTrigger.displayName = "AccordionTrigger";

interface AccordionContentProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: string;
  isOpen?: boolean;
}

const AccordionContent = React.forwardRef<HTMLDivElement, AccordionContentProps>(
  ({ className, children, isOpen, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "overflow-hidden text-sm transition-all",
          isOpen ? "animate-accordion-down" : "animate-accordion-up"
        )}
        style={{
          maxHeight: isOpen ? "1000px" : "0",
        }}
        {...props}
      >
        <div className={cn("p-6 pt-0 text-muted-foreground leading-relaxed", className)}>
          {children}
        </div>
      </div>
    );
  }
);
AccordionContent.displayName = "AccordionContent";

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent };

