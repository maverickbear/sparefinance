"use client";

import { useEffect, useRef, useState } from "react";
import { formatMoney } from "./money";

interface AnimatedNumberProps {
  value: number;
  format?: "money" | "number" | "percent";
  duration?: number;
  className?: string;
  decimals?: number;
}

/**
 * Component that animates number changes smoothly
 * Only animates when the value actually changes
 */
export function AnimatedNumber({
  value,
  format = "money",
  duration = 800,
  className = "",
  decimals = 2,
}: AnimatedNumberProps) {
  const [displayValue, setDisplayValue] = useState(value);
  const [isAnimating, setIsAnimating] = useState(false);
  const previousValueRef = useRef(value);
  const animationFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const startValueRef = useRef(value);

  useEffect(() => {
    // Only animate if value actually changed
    if (value === previousValueRef.current) {
      return;
    }

    const startValue = previousValueRef.current;
    const endValue = value;
    const difference = endValue - startValue;

    // If difference is very small, update immediately without animation
    if (Math.abs(difference) < 0.01) {
      setDisplayValue(endValue);
      previousValueRef.current = endValue;
      return;
    }

    // Start animation
    setIsAnimating(true);
    startValueRef.current = startValue;
    startTimeRef.current = null;

    const animate = (currentTime: number) => {
      if (startTimeRef.current === null) {
        startTimeRef.current = currentTime;
      }

      const elapsed = currentTime - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);

      // Easing function (ease-out)
      const easeOut = 1 - Math.pow(1 - progress, 3);

      const currentValue = startValue + difference * easeOut;
      setDisplayValue(currentValue);

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(animate);
      } else {
        // Animation complete
        setDisplayValue(endValue);
        setIsAnimating(false);
        previousValueRef.current = endValue;
      }
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [value, duration]);

  // Format the display value
  const formattedValue = (() => {
    if (format === "money") {
      return formatMoney(displayValue);
    } else if (format === "percent") {
      return `${displayValue.toFixed(decimals)}%`;
    } else {
      return displayValue.toFixed(decimals);
    }
  })();

  return (
    <span
      className={`transition-opacity duration-200 ${isAnimating ? "opacity-90" : "opacity-100"} ${className}`}
    >
      {formattedValue}
    </span>
  );
}

