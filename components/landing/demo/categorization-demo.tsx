"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/components/common/money";
import { cn } from "@/lib/utils";

// Mock data for categorized transactions
const mockTransactions = [
  {
    id: "1",
    description: "Starbucks Coffee",
    amount: 5.50,
    category: "Food & Dining",
    confidence: 95,
    status: "auto" as const,
  },
  {
    id: "2",
    description: "Uber Ride",
    amount: 12.75,
    category: "Transportation",
    confidence: 98,
    status: "auto" as const,
  },
  {
    id: "3",
    description: "Amazon Purchase",
    amount: 89.99,
    category: "Shopping",
    confidence: 92,
    status: "auto" as const,
  },
  {
    id: "4",
    description: "Netflix Subscription",
    amount: 15.99,
    category: "Entertainment",
    confidence: 99,
    status: "auto" as const,
  },
];

export function CategorizationDemo() {
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

  const parallaxOffset = (scrollY - 0.5) * 150;

  return (
    <div 
      ref={containerRef}
      className="space-y-4 pointer-events-none"
      style={{
        transform: `translateY(${-parallaxOffset * 0.3}px)`,
        opacity: isVisible ? 1 : 0.3,
        transition: "transform 0.1s ease-out, opacity 0.3s ease-out",
      }}
    >
      {mockTransactions.map((transaction) => (
        <Card key={transaction.id}>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <CardTitle className="text-lg mb-2">
                  {transaction.description}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="bg-primary/10 text-primary">
                    {transaction.category}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {transaction.confidence}% confidence
                  </Badge>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold">{formatMoney(transaction.amount)}</span>
              <span className="text-xs text-muted-foreground">Auto-categorized</span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

