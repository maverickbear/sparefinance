"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, Lock, Eye, CheckCircle2 } from "lucide-react";

export function SecurityDemo() {
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
      className="pointer-events-none"
      style={{
        transform: `translateY(${parallaxOffset * 0.2}px)`,
        opacity: isVisible ? 1 : 0.3,
        transition: "transform 0.1s ease-out, opacity 0.3s ease-out",
      }}
    >
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-3 bg-primary/10 rounded-[12px]">
                  <Shield className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>Bank-Level Encryption</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Your financial data is encrypted with industry-leading security standards. We use the same technology banks trust to protect your information.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-3 bg-primary/10 rounded-[12px]">
                  <Lock className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>Secure Authentication</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Multi-factor authentication and secure session management ensure only you can access your account.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-3 bg-primary/10 rounded-[12px]">
                  <Eye className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>Privacy First</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Your financial information is private and secure. We never share your data with third parties without your explicit consent.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-3 bg-primary/10 rounded-[12px]">
                  <CheckCircle2 className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>Compliance & Audits</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Regular security audits and compliance with financial data protection regulations ensure your data is always safe.
              </p>
            </CardContent>
          </Card>
        </div>
    </div>
  );
}

