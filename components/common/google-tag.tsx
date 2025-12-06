"use client";

import Script from "next/script";
import { useEffect, useState } from "react";

export function GoogleTag() {
  const [googleTagId, setGoogleTagId] = useState<string | null>(null);

  useEffect(() => {
    // Fetch Google Tag ID on client side to avoid prerendering issues
    async function fetchGoogleTagId() {
      try {
        const response = await fetch("/api/seo-settings/public");
        if (response.ok) {
          const data = await response.json();
          // The API returns seoSettings directly or nested
          const seoSettings = data?.seoSettings || data;
          if (seoSettings?.googleTagId) {
            setGoogleTagId(seoSettings.googleTagId);
          }
        }
      } catch (error) {
        // Silently fail - Google Tag is not critical
        console.error("Error fetching Google Tag ID:", error);
      }
    }

    fetchGoogleTagId();
  }, []);

  if (!googleTagId) {
    return null;
  }

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${googleTagId}`}
        strategy="afterInteractive"
      />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${googleTagId}');
        `}
      </Script>
    </>
  );
}

