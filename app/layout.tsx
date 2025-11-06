import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { LayoutWrapper } from "@/components/layout-wrapper";
import { KBarWrapper } from "@/components/kbar-wrapper";
import { ToastProvider } from "@/components/toast-provider";

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
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} bg-background`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <ToastProvider>
            <LayoutWrapper>{children}</LayoutWrapper>
            <KBarWrapper />
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
