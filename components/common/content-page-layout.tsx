"use client";

import { type ReactNode } from "react";
import { LandingHeader } from "@/components/landing/landing-header";
import { SimpleFooter } from "@/components/common/simple-footer";

const MAIN_TOP_PADDING = "pt-16 md:pt-[4.5rem]";

export interface ContentPageHeroProps {
  icon: ReactNode;
  title: string;
  subtitle?: string;
}

interface ContentPageLayoutProps {
  children: ReactNode;
  hero?: ContentPageHeroProps;
}

/**
 * Layout for public content pages (Terms, Privacy, FAQ).
 * Provides consistent header, main area with safe top padding for fixed nav, and footer.
 */
export function ContentPageLayout({ children, hero }: ContentPageLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <LandingHeader />
      <main
        className={`flex-1 w-full container mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 md:py-12 ${MAIN_TOP_PADDING}`}
      >
        <div className="max-w-4xl mx-auto">
          {hero && (
            <header className="text-center mb-8 sm:mb-10 md:mb-12">
              <div className="flex items-center justify-center gap-3 mb-3 sm:mb-4">
                {hero.icon}
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-foreground">
                  {hero.title}
                </h1>
              </div>
              {hero.subtitle && (
                <p className="text-sm sm:text-base text-muted-foreground">
                  {hero.subtitle}
                </p>
              )}
            </header>
          )}
          {children}
        </div>
      </main>
      <SimpleFooter />
    </div>
  );
}
