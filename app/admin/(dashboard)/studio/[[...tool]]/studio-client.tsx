"use client";

/**
 * Client-only Sanity Studio. Loaded with ssr: false to avoid
 * createContext / React mismatch in the server bundle.
 *
 * Wrapped in StyleSheetManager to filter unknown props (items, disableTransition)
 * that Sanity Studio's styled-components pass to the DOM and trigger React warnings.
 */

import { NextStudio } from "next-sanity/studio";
import { StyleSheetManager } from "styled-components";
import config from "@/sanity.config";

const SANITY_STUDIO_FILTERED_PROPS = ["items", "disableTransition"];

function shouldForwardProp(prop: string): boolean {
  return !SANITY_STUDIO_FILTERED_PROPS.includes(prop);
}

export function StudioClient() {
  return (
    <StyleSheetManager shouldForwardProp={shouldForwardProp}>
      <NextStudio config={config} />
    </StyleSheetManager>
  );
}
