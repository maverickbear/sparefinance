"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/components/common/money";
import { Edit } from "lucide-react";

// Mock data
const mockAccounts = [
  {
    id: "1",
    name: "RRSP",
    totalValue: 28450,
    monthlyContributions: 1500,
    totalDividends: 1250,
    initialBalance: 20000,
  },
  {
    id: "2",
    name: "FHSA",
    totalValue: 12780,
    monthlyContributions: 800,
    totalDividends: 450,
    initialBalance: 10000,
  },
  {
    id: "3",
    name: "Crypto",
    totalValue: 4000,
    monthlyContributions: 500,
    totalDividends: 0,
    initialBalance: 3000,
  },
];

export function InvestmentsDemo() {
  const [scrollY, setScrollY] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const windowHeight = window.innerHeight;
        const elementTop = rect.top;
        const elementBottom = rect.bottom;
        
        const isInViewport = elementTop < windowHeight && elementBottom > 0;
        setIsVisible(isInViewport);

        if (isInViewport) {
          const scrollProgress = Math.max(
            0,
            Math.min(1, (windowHeight - elementTop) / (windowHeight + rect.height))
          );
          setScrollY(scrollProgress);
        }
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const parallaxOffset = (scrollY - 0.5) * 200;

  return (
    <div 
      ref={containerRef}
      className="relative w-full h-[500px] flex items-center justify-center pointer-events-none"
    >
      {/* First Widget - Behind (Crypto) */}
      <div 
        className="absolute w-[88%] max-w-sm transform -rotate-2 z-0 transition-transform duration-100 ease-out"
        style={{
          transform: `translate(${15 + parallaxOffset * 0.3}px, ${15 - parallaxOffset * 0.2}px) rotate(-2deg)`,
          opacity: isVisible ? 0.95 : 0.3,
        }}
      >
        <Card className="transition-all">
          {(() => {
            const account = mockAccounts[2];
            return (
              <>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{account.name}</CardTitle>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Total Value</div>
                    <div className="text-2xl font-bold">{formatMoney(account.totalValue)}</div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">This Month</div>
                      <div className="font-medium">{formatMoney(account.monthlyContributions)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Dividends</div>
                      <div className="font-medium text-green-600 dark:text-green-400">
                        {formatMoney(account.totalDividends)}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </>
            );
          })()}
        </Card>
      </div>

      {/* Second Widget - Middle (FHSA) */}
      <div 
        className="absolute w-[92%] max-w-sm transform rotate-1 z-10 shadow-lg transition-transform duration-100 ease-out"
        style={{
          transform: `translate(${-8 - parallaxOffset * 0.2}px, ${8 + parallaxOffset * 0.25}px) rotate(1deg)`,
          opacity: isVisible ? 1 : 0.3,
        }}
      >
        <Card className="transition-all">
          {(() => {
            const account = mockAccounts[1];
            return (
              <>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{account.name}</CardTitle>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Total Value</div>
                    <div className="text-2xl font-bold">{formatMoney(account.totalValue)}</div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">This Month</div>
                      <div className="font-medium">{formatMoney(account.monthlyContributions)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Dividends</div>
                      <div className="font-medium text-green-600 dark:text-green-400">
                        {formatMoney(account.totalDividends)}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </>
            );
          })()}
        </Card>
      </div>

      {/* Third Widget - In Front (RRSP) */}
      <div 
        className="absolute w-[95%] max-w-md transform rotate-1.5 z-20 shadow-2xl transition-transform duration-100 ease-out"
        style={{
          transform: `translate(${-12 - parallaxOffset * 0.4}px, ${-12 + parallaxOffset * 0.3}px) rotate(1.5deg)`,
          opacity: isVisible ? 1 : 0.3,
        }}
      >
        <Card className="transition-all">
          {(() => {
            const account = mockAccounts[0];
            return (
              <>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{account.name}</CardTitle>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Total Value</div>
                    <div className="text-2xl font-bold">{formatMoney(account.totalValue)}</div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">This Month</div>
                      <div className="font-medium">{formatMoney(account.monthlyContributions)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Dividends</div>
                      <div className="font-medium text-green-600 dark:text-green-400">
                        {formatMoney(account.totalDividends)}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </>
            );
          })()}
        </Card>
      </div>
    </div>
  );
}

