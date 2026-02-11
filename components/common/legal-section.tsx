import { type ReactNode } from "react";

interface LegalSectionProps {
  title: string;
  children: ReactNode;
}

const SECTION_CLASS =
  "rounded-lg border border-border bg-card text-card-foreground shadow-sm";
const HEADER_CLASS = "px-6 py-4 sm:px-6 sm:py-5 border-b border-border";
const TITLE_CLASS = "text-lg font-semibold leading-tight";
const CONTENT_CLASS =
  "px-6 py-4 sm:px-6 sm:py-5 space-y-4 text-sm text-muted-foreground [&_ul]:list-disc [&_ul]:list-inside [&_ul]:space-y-2 [&_ul]:ml-4 [&_ul_ul]:ml-6 [&_ul_ul]:mt-2 [&_li]:leading-relaxed [&_h3]:font-semibold [&_h3]:mb-2 [&_h3]:text-foreground [&_a]:text-foreground [&_a]:underline [&_a]:underline-offset-4 hover:[&_a]:text-primary [&_div]:space-y-4";

/**
 * Semantic section for legal pages (Terms, Privacy). Consistent typography and spacing.
 */
export function LegalSection({ title, children }: LegalSectionProps) {
  return (
    <section className={SECTION_CLASS}>
      <div className={HEADER_CLASS}>
        <h2 className={TITLE_CLASS}>{title}</h2>
      </div>
      <div className={CONTENT_CLASS}>{children}</div>
    </section>
  );
}
