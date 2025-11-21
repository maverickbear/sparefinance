"use client";

import { Users, User } from "lucide-react";

export function HouseholdMockup() {
  return (
    <div className="relative w-full h-full flex items-center justify-center">
      <div className="w-full max-w-[300px] space-y-3">
        {/* Household Header */}
        <div className="bg-card  rounded-xl p-4 ">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">Smith Household</p>
              <p className="text-xs text-muted-foreground">2 members</p>
            </div>
          </div>
          
          {/* Members */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                <User className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium">John Doe</p>
                <p className="text-xs text-muted-foreground">Owner</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                <User className="w-4 h-4 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium">Jane Doe</p>
                <p className="text-xs text-muted-foreground">Member</p>
              </div>
            </div>
          </div>
        </div>

        {/* Shared Accounts */}
        <div className="bg-card  rounded-xl p-3 ">
          <p className="text-xs font-semibold mb-2 text-muted-foreground">Shared Accounts</p>
          <div className="flex items-center justify-between">
            <p className="text-sm">Joint Checking</p>
            <p className="text-sm font-semibold">$12,500</p>
          </div>
        </div>
      </div>
    </div>
  );
}

