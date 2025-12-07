"use client";

import { useEffect, useRef, useState, useImperativeHandle, forwardRef } from "react";

declare global {
  interface Window {
    turnstile?: {
      ready?: (callback: () => void) => void;
      render: (
        element: HTMLElement | string,
        options: {
          sitekey: string;
          callback?: (token: string) => void;
          "error-callback"?: (errorCode?: string) => void;
          "expired-callback"?: () => void;
          theme?: "light" | "dark" | "auto";
          size?: "normal" | "compact" | "flexible";
        }
      ) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
      getResponse?: (widgetId: string) => string | undefined;
    };
  }
}

export interface TurnstileWidgetRef {
  getToken: () => string | null;
  reset: () => void;
}

interface TurnstileWidgetProps {
  siteKey: string;
  onTokenChange?: (token: string | null) => void;
  theme?: "light" | "dark" | "auto";
  size?: "normal" | "compact";
}

export const TurnstileWidget = forwardRef<TurnstileWidgetRef, TurnstileWidgetProps>(
  ({ siteKey, onTokenChange, theme = "auto", size = "normal" }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const widgetIdRef = useRef<string | null>(null);
    const tokenRef = useRef<string | null>(null);
    const [isLoaded, setIsLoaded] = useState(false);
    const [isError, setIsError] = useState(false);

    // Load Turnstile script
    useEffect(() => {
      if (typeof window === "undefined") return;

      // Check if script is already loaded
      if (window.turnstile) {
        setIsLoaded(true);
        return;
      }

      // Check if script is already in the DOM (check for both explicit and implicit versions)
      const existingScript = document.querySelector(
        'script[src*="challenges.cloudflare.com/turnstile/v0/api.js"]'
      ) as HTMLScriptElement | null;

      if (existingScript) {
        // Script already exists, check if it's loaded
        if (window.turnstile) {
          setIsLoaded(true);
          return;
        }
        
        // Wait for it to load if it's still loading
        if (existingScript.dataset.loaded !== "true") {
          const handleLoad = () => {
            setIsLoaded(true);
            existingScript.dataset.loaded = "true";
            existingScript.removeEventListener("load", handleLoad);
          };
          existingScript.addEventListener("load", handleLoad);
          
          // Also check periodically in case the event already fired
          const checkInterval = setInterval(() => {
            if (window.turnstile) {
              setIsLoaded(true);
              existingScript.dataset.loaded = "true";
              clearInterval(checkInterval);
            }
          }, 100);
          
          // Clear interval after 5 seconds
          setTimeout(() => clearInterval(checkInterval), 5000);
        }
        return;
      }

      // Wait for DOM to be ready
      const loadScript = () => {
        // Load the script with explicit rendering mode (required for programmatic control)
        // Note: Do NOT use async/defer when using turnstile.ready() - it causes errors
        const script = document.createElement("script");
        script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
        script.crossOrigin = "anonymous";

        script.onload = () => {
          setIsLoaded(true);
          script.dataset.loaded = "true";
        };

        script.onerror = (error) => {
          setIsError(true);
          console.error("Failed to load Cloudflare Turnstile script", error);
        };

        // Try to add to head first, fallback to body
        const target = document.head || document.body;
        if (target) {
          target.appendChild(script);
        } else {
          // If neither head nor body is available, wait a bit and try again
          setTimeout(() => {
            const retryTarget = document.head || document.body;
            if (retryTarget) {
              retryTarget.appendChild(script);
            } else {
              setIsError(true);
              console.error("DOM not ready for Turnstile script injection");
            }
          }, 100);
        }
      };

      // Ensure DOM is ready
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", loadScript);
      } else {
        // DOM is already ready
        loadScript();
      }
    }, []);

    // Render widget when script is loaded
    useEffect(() => {
      if (!isLoaded || !window.turnstile || !containerRef.current || !siteKey) {
        return;
      }

      // Don't render if already rendered
      if (widgetIdRef.current) {
        return;
      }

      // Validate site key format (basic check)
      if (siteKey.length < 10) {
        console.warn("[Turnstile] Site key appears to be invalid (too short)");
      }

      // Render widget directly when script is loaded
      // Note: We don't use turnstile.ready() because we control script loading manually
      // and the script is loaded without async/defer to avoid conflicts
      try {
        const id = window.turnstile!.render(containerRef.current!, {
          sitekey: siteKey,
          theme,
          size,
          callback: (token: string) => {
            tokenRef.current = token;
            onTokenChange?.(token);
            setIsError(false);
          },
          "error-callback": (errorCode?: string) => {
            tokenRef.current = null;
            setIsError(true);
            onTokenChange?.(null);
            
            // Map error codes to user-friendly messages
            if (errorCode === "110200") {
              const currentDomain = typeof window !== "undefined" ? window.location.hostname : "unknown";
              console.error(
                `[Turnstile] Error 110200: Domain "${currentDomain}" is not authorized for this site key.\n` +
                `To fix this:\n` +
                `1. Go to Cloudflare Dashboard > Turnstile\n` +
                `2. Select your widget\n` +
                `3. Add "${currentDomain}" to the allowed domains list\n` +
                `4. Wait a few minutes for changes to propagate`
              );
            } else if (errorCode) {
              console.error(
                `[Turnstile] Error code: ${errorCode}\n` +
                `See https://developers.cloudflare.com/turnstile/troubleshooting/client-side-errors/error-codes/ for details.`
              );
            } else {
              console.error("[Turnstile] Unknown error occurred");
            }
          },
          "expired-callback": () => {
            tokenRef.current = null;
            onTokenChange?.(null);
          },
        });

        widgetIdRef.current = id;
        setIsError(false);
      } catch (error) {
        console.error("Error rendering Turnstile widget:", error);
        setIsError(true);
      }
    }, [isLoaded, siteKey, theme, size, onTokenChange]);

    // Cleanup widget on unmount
    useEffect(() => {
      return () => {
        if (widgetIdRef.current && window.turnstile) {
          try {
            window.turnstile.remove(widgetIdRef.current);
          } catch (error) {
            console.error("Error removing Turnstile widget:", error);
          }
        }
      };
    }, []);

    // Expose methods via ref
    useImperativeHandle(ref, () => ({
      getToken: () => {
        // Try to get token from Turnstile API if available
        if (widgetIdRef.current && window.turnstile?.getResponse) {
          const currentToken = window.turnstile.getResponse(widgetIdRef.current);
          if (currentToken) {
            return currentToken;
          }
        }
        return tokenRef.current;
      },
      reset: () => {
        if (widgetIdRef.current && window.turnstile) {
          try {
            window.turnstile.reset(widgetIdRef.current);
            tokenRef.current = null;
            onTokenChange?.(null);
          } catch (error) {
            console.error("Error resetting Turnstile widget:", error);
          }
        }
      },
    }));

    if (!siteKey) {
      return null;
    }

    if (isError) {
      // In development, show more detailed error message
      const isDevelopment = process.env.NODE_ENV === "development";
      return (
        <div className="text-sm text-muted-foreground space-y-1">
          <p>Security verification unavailable.</p>
          {isDevelopment && (
            <p className="text-xs text-destructive">
              Check: 1) Site key is valid, 2) Domain is authorized in Cloudflare, 3) CSP allows challenges.cloudflare.com
            </p>
          )}
        </div>
      );
    }

    return (
      <div className="flex justify-center">
        <div ref={containerRef} className="turnstile-widget" />
      </div>
    );
  }
);

TurnstileWidget.displayName = "TurnstileWidget";

