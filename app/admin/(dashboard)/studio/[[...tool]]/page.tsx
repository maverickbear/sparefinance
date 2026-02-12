/**
 * Sanity Studio – embedded at /admin/studio (admin-only).
 * Set NEXT_PUBLIC_SANITY_PROJECT_ID and NEXT_PUBLIC_SANITY_DATASET in .env.local to use.
 * Uses StudioLoader (client-only) to avoid React/cache config conflicts.
 */

import { StudioLoader } from "./studio-loader";
import {
  metadata as studioMetadata,
  viewport as studioViewport,
} from "next-sanity/studio";
import type { Metadata, Viewport } from "next";

export const metadata: Metadata = studioMetadata;
export const viewport: Viewport = studioViewport as Viewport;

export default function StudioPage() {
  return <StudioLoader />;
}
