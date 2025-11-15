"use client";

import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney } from "@/components/common/money";
import { TrendingUp, TrendingDown, Wallet, BarChart3 } from "lucide-react";
import { PortfolioSummary } from "@/lib/api/portfolio";
import { cn } from "@/lib/utils";

interface PortfolioSummaryCardsProps {
  summary: PortfolioSummary;
}

export function PortfolioSummaryCards({ summary }: PortfolioSummaryCardsProps) {
  const carouselRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  // Handle scroll for carousel indicators
  useEffect(() => {
    const carousel = carouselRef.current;
    if (!carousel) return;

    const handleScroll = () => {
      const scrollLeft = carousel.scrollLeft;
      const firstCard = carousel.querySelector('.snap-start') as HTMLElement;
      if (!firstCard) return;
      
      const cardWidth = firstCard.offsetWidth;
      const gap = 16; // 1rem = 16px (gap-4)
      const totalCardWidth = cardWidth + gap;
      const newIndex = Math.round(scrollLeft / totalCardWidth);
      setActiveIndex(Math.min(Math.max(newIndex, 0), 3)); // 4 cards total (0-3)
    };

    carousel.addEventListener('scroll', handleScroll);
    handleScroll();
    return () => carousel.removeEventListener('scroll', handleScroll);
  }, []);

  const cards = [
    {
      id: 'totalValue',
      title: 'Total Portfolio Value',
      icon: Wallet,
      iconColor: 'text-blue-600 dark:text-blue-500',
      value: summary.totalValue,
      valueColor: summary.totalValue >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400',
      change: null,
    },
    {
      id: 'dayChange',
      title: 'Day Change',
      icon: summary.dayChange >= 0 ? TrendingUp : TrendingDown,
      iconColor: summary.dayChange >= 0 ? 'text-green-600 dark:text-green-500' : 'text-red-600 dark:text-red-500',
      value: summary.dayChange,
      valueColor: summary.dayChange >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400',
      change: (
        <div
          className={cn(
            "text-xs mt-1",
            summary.dayChangePercent >= 0
              ? "text-green-600 dark:text-green-400"
              : "text-red-600 dark:text-red-400"
          )}
        >
          {summary.dayChangePercent >= 0 ? "+" : ""}{summary.dayChangePercent.toFixed(2)}%
        </div>
      ),
    },
    {
      id: 'totalReturn',
      title: 'Total Return',
      icon: summary.totalReturn >= 0 ? TrendingUp : TrendingDown,
      iconColor: summary.totalReturn >= 0 ? 'text-green-600 dark:text-green-500' : 'text-red-600 dark:text-red-500',
      value: summary.totalReturn,
      valueColor: summary.totalReturn >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400',
      change: (
        <div
          className={cn(
            "text-xs mt-1",
            summary.totalReturnPercent >= 0
              ? "text-green-600 dark:text-green-400"
              : "text-red-600 dark:text-red-400"
          )}
        >
          {summary.totalReturnPercent >= 0 ? "+" : ""}{summary.totalReturnPercent.toFixed(2)}%
        </div>
      ),
    },
    {
      id: 'holdings',
      title: 'Holdings',
      icon: BarChart3,
      iconColor: 'text-blue-600 dark:text-blue-500',
      value: summary.holdingsCount,
      valueColor: 'text-foreground',
      change: (
        <div className="text-xs mt-1 text-muted-foreground">
          Total positions
        </div>
      ),
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Portfolio Summary</CardTitle>
      </CardHeader>
      <CardContent className="!pt-0 md:!pt-0">
        {/* Mobile Carousel */}
        <div className="md:hidden">
          <div
            ref={carouselRef}
            className="flex gap-4 overflow-x-auto scrollbar-hide scroll-smooth snap-x snap-mandatory pb-2 -mx-4 px-4"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {cards.map((card) => {
              const Icon = card.icon;
              return (
                <div
                  key={card.id}
                  className="flex-shrink-0 w-[calc(100vw-6rem)] snap-start flex flex-col p-4 border rounded-lg"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <Icon className={cn("h-5 w-5", card.iconColor)} />
                    <div>
                      <div className="font-semibold text-xs md:text-sm">{card.title}</div>
                    </div>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <div className={cn("font-semibold", card.valueColor)}>
                      {card.id === 'holdings' ? card.value : formatMoney(card.value)}
                    </div>
                    {card.change}
                  </div>
                </div>
              );
            })}
          </div>
          {/* Carousel Indicators */}
          <div className="flex justify-center gap-2 mt-3">
            {cards.map((_, index) => (
              <button
                key={index}
                onClick={() => {
                  const carousel = carouselRef.current;
                  if (carousel) {
                    const firstCard = carousel.querySelector('.snap-start') as HTMLElement;
                    if (!firstCard) return;
                    
                    const cardWidth = firstCard.offsetWidth;
                    const gap = 16; // 1rem = 16px (gap-4)
                    const totalCardWidth = cardWidth + gap;
                    carousel.scrollTo({ left: index * totalCardWidth, behavior: 'smooth' });
                  }
                }}
                className={cn(
                  "h-2 rounded-full transition-all",
                  activeIndex === index
                    ? "w-6 bg-primary"
                    : "w-2 bg-muted-foreground/30"
                )}
                aria-label={`Go to card ${index + 1}`}
              />
            ))}
          </div>
        </div>

        {/* Desktop Grid */}
        <div className="hidden md:grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {cards.map((card) => {
            const Icon = card.icon;
            return (
              <div key={card.id} className="flex flex-col p-4 border rounded-lg">
                <div className="flex items-center gap-3 mb-3">
                  <Icon className={cn("h-5 w-5", card.iconColor)} />
                  <div>
                    <div className="font-semibold text-xs md:text-sm">{card.title}</div>
                  </div>
                </div>
                <div className="flex items-baseline gap-2">
                  <div className={cn("font-semibold", card.valueColor)}>
                    {card.id === 'holdings' ? card.value : formatMoney(card.value)}
                  </div>
                  {card.change}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

