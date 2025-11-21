"use client";

import { memo, useMemo, useRef, useEffect, useState, useCallback } from "react";
import { cn } from "@/lib/utils";

interface VirtualListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  itemHeight?: number;
  overscan?: number;
  className?: string;
  containerHeight?: number;
  getItemKey?: (item: T, index: number) => string | number;
}

/**
 * VirtualList - Component for efficiently rendering large lists
 * Only renders visible items plus a buffer (overscan) for smooth scrolling
 * 
 * @example
 * <VirtualList
 *   items={transactions}
 *   itemHeight={80}
 *   renderItem={(tx) => <TransactionCard transaction={tx} />}
 * />
 */
export const VirtualList = memo(function VirtualList<T>({
  items,
  renderItem,
  itemHeight = 80,
  overscan = 5,
  className,
  containerHeight,
  getItemKey = (_, index) => index,
}: VirtualListProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeightState, setContainerHeightState] = useState(containerHeight || 600);

  // Calculate visible range
  const visibleRange = useMemo(() => {
    const start = Math.floor(scrollTop / itemHeight);
    const end = Math.ceil((scrollTop + containerHeightState) / itemHeight);
    
    return {
      start: Math.max(0, start - overscan),
      end: Math.min(items.length, end + overscan),
    };
  }, [scrollTop, containerHeightState, itemHeight, overscan, items.length]);

  // Get visible items
  const visibleItems = useMemo(() => {
    return items.slice(visibleRange.start, visibleRange.end).map((item, index) => ({
      item,
      index: visibleRange.start + index,
    }));
  }, [items, visibleRange.start, visibleRange.end]);

  // Total height of all items
  const totalHeight = items.length * itemHeight;

  // Offset for visible items
  const offsetY = visibleRange.start * itemHeight;

  // Handle scroll
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  // Update container height on resize
  useEffect(() => {
    if (containerHeight) {
      setContainerHeightState(containerHeight);
      return;
    }

    const updateHeight = () => {
      if (containerRef.current) {
        setContainerHeightState(containerRef.current.clientHeight);
      }
    };

    updateHeight();
    window.addEventListener("resize", updateHeight);
    return () => window.removeEventListener("resize", updateHeight);
  }, [containerHeight]);

  return (
    <div
      ref={containerRef}
      className={cn("overflow-auto", className)}
      style={{ height: containerHeight || "100%" }}
      onScroll={handleScroll}
    >
      <div style={{ height: totalHeight, position: "relative" }}>
        <div
          style={{
            transform: `translateY(${offsetY}px)`,
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
          }}
        >
          {visibleItems.map(({ item, index }) => (
            <div
              key={getItemKey(item, index)}
              style={{ height: itemHeight }}
            >
              {renderItem(item, index)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}) as <T>(props: VirtualListProps<T>) => React.JSX.Element;

