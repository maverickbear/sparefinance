/**
 * Domain types for blog (personal finance content).
 * Pure TypeScript types with no external dependencies.
 */

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
  body: string;
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
