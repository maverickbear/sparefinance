import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { LayoutWrapperClient } from "@/components/layout-wrapper-client";
import { KBarWrapper } from "@/components/kbar-wrapper";
import { ToastProvider } from "@/components/toast-provider";
import { StripeProvider } from "@/components/stripe-provider";
import { BreakpointLogger } from "@/components/breakpoint-logger";
import { CookieConsentBanner } from "@/components/cookie/CookieConsentBanner";
import { SpeedInsightsWrapper } from "@/components/speed-insights-wrapper";
import { GoogleTag } from "@/components/common/google-tag";
import { AuthProvider } from "@/contexts/auth-context";
// PlanLimitsProvider removed - SubscriptionProvider in protected layout handles this

export const metadata: Metadata = {
  title: "Spare Finance - Personal Finance",
  description: "Track expenses, budgets, and investments",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    shortcut: "/icon.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#4FCF7D", // Using primary-500 from colors.ts
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
        <link rel="preconnect" href="https://api.fontshare.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://api.fontshare.com/v2/css?f[]=satoshi@400,500,600,700&display=swap"
        />
        <link rel="preconnect" href="https://api.stripe.com" />
        <link rel="preconnect" href="https://js.stripe.com" />
      </head>
      <body className="font-sans bg-background text-foreground">
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
