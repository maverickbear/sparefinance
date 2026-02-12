/**
 * Sanity client for the Spare Finance app.
 * Infrastructure layer – used by sanity-blog.repository only.
 */

import { createClient } from "next-sanity";

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ?? "";
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET ?? "production";

let client: ReturnType<typeof createClient> | null = null;

/**
 * Returns a Sanity client instance. Only use when Sanity is configured (projectId set).
 */
export function getSanityClient(): ReturnType<typeof createClient> {
  if (!client) {
    if (!projectId) {
      throw new Error("NEXT_PUBLIC_SANITY_PROJECT_ID is not set");
    }
    client = createClient({
      projectId,
      dataset,
      apiVersion: "2024-01-01",
      useCdn: true,
    });
  }
  return client;
}

export function isSanityConfigured(): boolean {
  return Boolean(projectId);
}
