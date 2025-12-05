"use client";

import { Shield, Lock, CheckCircle2 } from "lucide-react";

export function SecurityMockup() {
  return (
    <div className="relative w-full h-full flex items-center justify-center">
      <div className="w-full max-w-[280px] space-y-3">
        {/* Security Badge */}
        <div className="bg-card border border-border rounded-xl p-6 text-center">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-green-600" />
          </div>
          <p className="text-sm font-semibold mb-1">256-bit Encryption</p>
          <p className="text-xs text-muted-foreground">Bank-level security</p>
        </div>

        {/* Security Features */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="w-4 h-4 text-green-600" />
            <span className="text-muted-foreground">SOC 2 Type 2 Certified</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="w-4 h-4 text-green-600" />
            <span className="text-muted-foreground">Row Level Security</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="w-4 h-4 text-green-600" />
            <span className="text-muted-foreground">No Credential Storage</span>
          </div>
        </div>
      </div>
    </div>
  );
}

