/**
 * Next.js instrumentation – runs once when the server starts.
 * Kept as a no-op. AbortError handling in dev was removed because process.on
 * is not allowed in Edge Runtime (Next.js loads this file in both Node and Edge).
 */
export async function register() {
  // No-op. Use isAbortError() in repos to reduce AbortError noise instead.
}
