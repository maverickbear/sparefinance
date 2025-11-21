"use client";

import { Repeat, Check } from "lucide-react";

export function SubscriptionsMockup() {
  return (
    <div className="relative w-full h-full flex items-center justify-center">
      <div className="w-full max-w-[280px] space-y-2">
        {/* Subscription Item */}
        <div className="bg-card  rounded-lg p-3 ">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-blue-100 flex items-center justify-center">
                <Repeat className="w-3 h-3 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-semibold">Netflix</p>
                <p className="text-xs text-muted-foreground">Monthly</p>
              </div>
            </div>
            <p className="text-sm font-bold">$9.99</p>
          </div>
        </div>

        {/* Another Subscription */}
        <div className="bg-card  rounded-lg p-3 ">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-green-100 flex items-center justify-center">
                <Repeat className="w-3 h-3 text-green-600" />
              </div>
              <div>
                <p className="text-sm font-semibold">Spotify</p>
                <p className="text-xs text-muted-foreground">Monthly</p>
              </div>
            </div>
            <p className="text-sm font-bold">$4.99</p>
          </div>
        </div>

        {/* Another Subscription */}
        <div className="bg-card  rounded-lg p-3 ">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-purple-100 flex items-center justify-center">
                <Repeat className="w-3 h-3 text-purple-600" />
              </div>
              <div>
                <p className="text-sm font-semibold">Gym Membership</p>
                <p className="text-xs text-muted-foreground">Monthly</p>
              </div>
            </div>
            <p className="text-sm font-bold">$79.00</p>
          </div>
        </div>
      </div>
    </div>
  );
}

