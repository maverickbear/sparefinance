"use client";

import { ReactNode } from "react";
import { SimplifiedCard } from "./simplified-card";

interface FlowNodeProps {
  label: string;
  value: string | ReactNode;
  subtitle?: string;
  pill?: {
    text: string;
    variant?: "default" | "positive" | "warning" | "negative";
  };
}

export function FlowNode({ label, value, subtitle, pill }: FlowNodeProps) {
  return (
    <SimplifiedCard
      label={label}
      value={value}
      subtitle={subtitle}
      pill={pill}
      className="min-h-[84px] p-3"
    />
  );
}

