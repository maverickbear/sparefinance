import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { LayoutWrapper } from "@/components/layout-wrapper";
import { KBarWrapper } from "@/components/kbar-wrapper";
import { ToastProvider } from "@/components/toast-provider";
import { StripeProvider } from "@/components/stripe-provider";
import { PlaidLinkProvider } from "@/components/banking/plaid-link-context";
import { ServiceWorkerRegister } from "./sw-register";
// PlanLimitsProvider removed - SubscriptionProvider in protected layout handles this

const inter = Inter({ 
  subsets: ["latin"],
  display: "swap",
  fallback: ["system-ui", "arial"],
  adjustFontFallback: true,
  preload: false, // Disable preloading to avoid network issues
});

export const metadata: Metadata = {
  title: "Spare Finance - Personal Finance",
  description: "Track expenses, budgets, and investments",
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
    apple: "/icon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning data-scroll-behavior="smooth">
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
            <LayoutWrapper>{children}</LayoutWrapper>
            <KBarWrapper />
            <ServiceWorkerRegister />
          </ToastProvider>
          </PlaidLinkProvider>
          </StripeProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
