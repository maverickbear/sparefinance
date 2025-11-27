import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { LayoutWrapper } from "@/components/layout-wrapper";
import { KBarWrapper } from "@/components/kbar-wrapper";
import { ToastProvider } from "@/components/toast-provider";
import { StripeProvider } from "@/components/stripe-provider";
import { PlaidLinkProvider } from "@/components/banking/plaid-link-context";
import { ServiceWorkerRegister } from "./sw-register";
import { BreakpointLogger } from "@/components/breakpoint-logger";
import { CookieConsentBanner } from "@/components/cookie/CookieConsentBanner";
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
};

export const viewport: Viewport = {
  themeColor: "#4A4AF2",
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
        {/* Resource hints for external domains - improve connection speed */}
        {/* DNS prefetch for faster connections */}
        <link rel="dns-prefetch" href="https://fonts.googleapis.com" />
        <link rel="dns-prefetch" href="https://fonts.gstatic.com" />
        <link rel="preconnect" href="https://fonts.googleapis.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://api.stripe.com" />
        <link rel="preconnect" href="https://js.stripe.com" />
        <link rel="preconnect" href="https://cdn.plaid.com" />
        {/* PWA Meta Tags */}
        <meta name="theme-color" content="#4A4AF2" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Spare Finance" />
        {/* Viewport is now handled by viewport export above */}
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      </head>
      <body className={`${inter.className} bg-background text-foreground`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          disableTransitionOnChange
        >
          <StripeProvider>
          <PlaidLinkProvider>
          <ToastProvider>
            <BreakpointLogger />
            <LayoutWrapper>{children}</LayoutWrapper>
            <KBarWrapper />
            <ServiceWorkerRegister />
            <CookieConsentBanner />
          </ToastProvider>
          </PlaidLinkProvider>
          </StripeProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
