"use client";

import dynamic from "next/dynamic";

const StudioClient = dynamic(
  () => import("./studio-client").then((m) => m.StudioClient),
  { ssr: false }
);

export function StudioLoader() {
  return <StudioClient />;
}
