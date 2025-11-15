import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { LayoutWrapper } from "@/components/layout-wrapper";
import { KBarWrapper } from "@/components/kbar-wrapper";
import { ToastProvider } from "@/components/toast-provider";
import { SubscriptionProvider } from "@/contexts/subscription-context";
import { PlanLimitsProvider } from "@/contexts/plan-limits-context";

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
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} bg-white dark:bg-background`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <ToastProvider>
            <SubscriptionProvider>
              <PlanLimitsProvider>
                <LayoutWrapper>{children}</LayoutWrapper>
                <KBarWrapper />
              </PlanLimitsProvider>
            </SubscriptionProvider>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
