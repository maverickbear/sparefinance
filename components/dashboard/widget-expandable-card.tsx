"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SimplifiedCard } from "@/app/(protected)/dashboard/components/simplified-card";
import { FlowNode } from "@/app/(protected)/dashboard/components/flow-node";
import { cn } from "@/lib/utils";

interface WidgetExpandableCardProps {
  label: string;
  value: string | React.ReactNode;
  subtitle?: string;
  pill?: {
    text: string;
    variant?: "default" | "positive" | "warning" | "negative";
  };
  expandedContent: React.ReactNode;
  title: string;
  description?: string;
  variant?: "card" | "flow";
  className?: string;
  modalWidth?: string;
}

export function WidgetExpandableCard({
  label,
  value,
  subtitle,
  pill,
  expandedContent,
  title,
  description,
  variant = "card",
  className,
  modalWidth,
}: WidgetExpandableCardProps) {
  const [isOpen, setIsOpen] = useState(false);

  const CardComponent = variant === "flow" ? FlowNode : SimplifiedCard;

  return (
    <>
      <div
        onClick={() => setIsOpen(true)}
        className={cn("cursor-pointer transition-opacity hover:opacity-80", className)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setIsOpen(true);
          }
        }}
        aria-label={`View details for ${label}`}
      >
        <CardComponent
          label={label}
          value={value}
          subtitle={subtitle}
          pill={pill}
        />
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent
          className={cn(
            modalWidth === "60%" ? "sm:w-[60%]" : !modalWidth && "sm:max-w-4xl",
            "max-h-[90vh] overflow-y-auto"
          )}
          style={modalWidth && modalWidth !== "60%" ? { "--modal-width": modalWidth } as React.CSSProperties & { "--modal-width": string } : undefined}
        >
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description && (
              <p className="text-sm text-muted-foreground mt-1">{description}</p>
            )}
          </DialogHeader>
          <div className="mt-4">{expandedContent}</div>
        </DialogContent>
      </Dialog>
    </>
  );
}

