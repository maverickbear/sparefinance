"use client";

import dynamic from "next/dynamic";

// Dynamically import LayoutWrapper with SSR disabled to prevent prerender errors
// This component uses browser-only APIs (window, pathname) that aren't available during build
const LayoutWrapper = dynamic(
  () => import("./layout-wrapper").then((mod) => mod.LayoutWrapper),
  { ssr: false }
);

export function LayoutWrapperClient({ children }: { children: React.ReactNode }) {
  return <LayoutWrapper>{children}</LayoutWrapper>;
}

