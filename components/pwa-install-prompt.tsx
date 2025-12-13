"use client";

import { useState, useEffect } from "react";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useBreakpoint } from "@/hooks/use-breakpoint";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * PWA Install Prompt Component
 * 
 * Shows a custom install prompt for Progressive Web Apps.
 * Only displays on mobile devices and when the app is installable.
 */
export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const breakpoint = useBreakpoint();
  
  // Check if app is already installed
  useEffect(() => {
    // Check if running in standalone mode (already installed)
    if (typeof window !== "undefined") {
      const isStandalone = 
        (window.matchMedia("(display-mode: standalone)").matches) ||
        ((window.navigator as any).standalone === true) ||
        document.referrer.includes("android-app://");
      
      setIsInstalled(isStandalone);
      
      // Check if already dismissed (stored in localStorage)
      const dismissed = localStorage.getItem("pwa-install-dismissed");
      if (dismissed) {
        const dismissedTime = parseInt(dismissed, 10);
        const daysSinceDismissed = (Date.now() - dismissedTime) / (1000 * 60 * 60 * 24);
        // Show again after 7 days
        if (daysSinceDismissed < 7) {
          return;
        }
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isInstalled) return;

    // Only show on mobile devices (below lg breakpoint = 1024px)
    const isMobile = !breakpoint || breakpoint === "xs" || breakpoint === "sm" || breakpoint === "md";
    if (!isMobile) return;

    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent the default browser install prompt
      e.preventDefault();
      // Store the event for later use
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsVisible(true);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsVisible(false);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, [breakpoint, isInstalled]);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    // Show the install prompt
    await deferredPrompt.prompt();

    // Wait for user response
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === "accepted") {
      setIsVisible(false);
      setDeferredPrompt(null);
    } else {
      // User dismissed, remember for 7 days
      localStorage.setItem("pwa-install-dismissed", Date.now().toString());
      setIsVisible(false);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem("pwa-install-dismissed", Date.now().toString());
    setIsVisible(false);
  };

  if (!isVisible || isInstalled) {
    return null;
  }

  return (
    <div
      className={cn(
        "fixed bottom-20 left-0 right-0 z-50 px-4 pb-4 lg:hidden",
        "animate-in slide-in-from-bottom-5 fade-in-0 duration-300"
      )}
    >
      <div className="mx-auto max-w-md rounded-lg border bg-card p-4 shadow-lg">
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-foreground">
              Install Spare Finance
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Add to your home screen for quick access and a better experience
            </p>
          </div>
          <button
            onClick={handleDismiss}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Dismiss install prompt"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-4 flex gap-2">
          <Button
            onClick={handleInstall}
            size="medium"
            className="flex-1"
          >
            <Download className="h-4 w-4 mr-2" />
            Install
          </Button>
          <Button
            onClick={handleDismiss}
            variant="outline"
            size="medium"
          >
            Not Now
          </Button>
        </div>
      </div>
    </div>
  );
}

