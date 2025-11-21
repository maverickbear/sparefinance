"use client";

import { useEffect } from "react";

/**
 * Service Worker Registration Component
 * Registers the service worker for caching static assets
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      process.env.NODE_ENV === "production"
    ) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => {
          console.log("Service Worker registered:", registration.scope);
        })
        .catch((error) => {
          console.warn("Service Worker registration failed:", error);
        });
    }
  }, []);

  return null;
}

