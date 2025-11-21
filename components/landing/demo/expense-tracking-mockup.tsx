"use client";

export function ExpenseTrackingMockup() {
  return (
    <div className="relative w-full h-full flex items-center justify-center">
      {/* Credit Card */}
      <div className="relative w-full max-w-[280px]">
        <div className="bg-gradient-to-br from-primary via-primary/90 to-primary/80 rounded-2xl p-5 text-white shadow-xl">
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="text-xs opacity-80 mb-1">Spare Finance</p>
              <p className="text-sm font-semibold">Card</p>
            </div>
            <div className="w-7 h-7 bg-white/20 rounded-lg"></div>
          </div>
          <div className="mb-4">
            <p className="text-2xl font-bold mb-1">$2,736.15</p>
            <p className="text-xs opacity-80">.... 5318</p>
          </div>
          <div className="flex gap-2">
            <div className="w-7 h-7 bg-white/20 rounded-full"></div>
            <div className="w-7 h-7 bg-white/20 rounded-full"></div>
            <div className="w-7 h-7 bg-white/20 rounded-full"></div>
            <div className="w-7 h-7 bg-white/20 rounded-full"></div>
            <div className="w-7 h-7 bg-white/20 rounded-full"></div>
          </div>
        </div>
        
        {/* Connected Icons */}
        <div className="absolute -top-4 -right-4 w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center border-2 border-dashed border-primary/30">
          <div className="w-6 h-6 bg-primary/20 rounded"></div>
        </div>
        <div className="absolute top-1/2 -right-8 w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center border-2 border-dashed border-primary/30">
          <div className="w-5 h-5 bg-primary/20 rounded"></div>
        </div>
        <div className="absolute -bottom-4 -right-4 w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center border-2 border-dashed border-primary/30">
          <div className="w-5 h-5 bg-primary/20 rounded"></div>
        </div>
      </div>
    </div>
  );
}

