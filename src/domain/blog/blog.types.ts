/**
 * Domain types for blog (personal finance content).
 * Pure TypeScript types with no external dependencies.
 */

/**
 * Raw Portable Text blocks from Sanity (same shape as @portabletext/types).
 * Typed loosely in domain to avoid external deps; cast to PortableTextBlock[] in UI.
 */
export type BlogPostBodyBlock = unknown;

export interface BlogPost {
  slug: string;
  title: string;
  description: string;
  datePublished: string;
  dateModified?: string;
  author: string;
  authorAvatar?: string;
  image?: {
    src: string;
    alt: string;
    width?: number;
    height?: number;
  };
  tags?: string[];
  keywords?: string[];
  /** Plain text body (used for meta, list, fallback). */
  body: string;
  /** Raw Portable Text blocks for rich rendering on detail page. When present, use instead of body. */
  bodyBlocks?: BlogPostBodyBlock[];
}

export interface BlogPostListItem {
  slug: string;
  title: string;
  description: string;
  datePublished: string;
  dateModified?: string;
  author: string;
  authorAvatar?: string;
  image?: {
    src: string;
    alt: string;
    width?: number;
    height?: number;
  };
  tags?: string[];
}
