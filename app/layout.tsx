import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { LayoutWrapperClient } from "@/components/layout-wrapper-client";
import { KBarWrapper } from "@/components/kbar-wrapper";
import { ToastProvider } from "@/components/toast-provider";
import { StripeProvider } from "@/components/stripe-provider";
import { ServiceWorkerRegister } from "./sw-register";
import { BreakpointLogger } from "@/components/breakpoint-logger";
import { CookieConsentBanner } from "@/components/cookie/CookieConsentBanner";
import { SpeedInsightsWrapper } from "@/components/speed-insights-wrapper";
import { GoogleTag } from "@/components/common/google-tag";
import { AuthProvider } from "@/contexts/auth-context";
// PlanLimitsProvider removed - SubscriptionProvider in protected layout handles this

const inter = Inter({ 
  subsets: ["latin"],
  display: "swap", // Show fallback font immediately, swap when loaded
  fallback: ["system-ui", "arial"],
  adjustFontFallback: true,
  preload: true, // Enable preloading for better performance
  variable: "--font-inter", // CSS variable for better optimization
});

export const metadata: Metadata = {
  title: "Spare Finance - Personal Finance",
  description: "Track expenses, budgets, and investments",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: "/icon.svg",
    apple: "/apple-touch-icon.png",
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Spare Finance",
  },
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "default",
    "apple-mobile-web-app-title": "Spare Finance",
  },
};

export const viewport: Viewport = {
  themeColor: "#94DD78", // Using primary-500 from colors.ts
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning data-scroll-behavior="smooth">
      <head>
        <link rel="dns-prefetch" href="https://fonts.googleapis.com" />
        <link rel="dns-prefetch" href="https://fonts.gstatic.com" />
        <link rel="preconnect" href="https://fonts.googleapis.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://api.stripe.com" />
        <link rel="preconnect" href="https://js.stripe.com" />
      </head>
      <body className={`${inter.className} bg-background text-foreground`}>
        <GoogleTag />
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          disableTransitionOnChange
        >
          <StripeProvider>
          <ToastProvider>
            <AuthProvider>
              <BreakpointLogger />
              <LayoutWrapperClient>{children}</LayoutWrapperClient>
              <KBarWrapper />
              <ServiceWorkerRegister />
              <CookieConsentBanner />
              <SpeedInsightsWrapper />
            </AuthProvider>
          </ToastProvider>
          </StripeProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
