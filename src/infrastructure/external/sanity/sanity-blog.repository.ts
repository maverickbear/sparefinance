/**
 * Sanity blog repository – fetches blog posts from Sanity and maps to domain DTOs.
 * Infrastructure layer only; no business logic.
 */

import { getSanityClient } from "./sanity-client";
import groq from "groq";

/** Raw block from Sanity Portable Text */
interface SanityBlock {
  _type?: string;
  children?: Array<{ _type?: string; text?: string }>;
}

/** DTO returned by this repository (camelCase, matches domain shape for Zod parsing) */
export interface SanityBlogPostDto {
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
  /** Raw Portable Text blocks for rich rendering (only set when fetching single post). */
  bodyBlocks?: unknown[];
}

function blockContentToPlainText(blocks: SanityBlock[] | null | undefined): string {
  if (!blocks || !Array.isArray(blocks)) return "";
  return blocks
    .map((block) => {
      const children = block.children;
      if (!children || !Array.isArray(children)) return "";
      return children.map((c) => (c && typeof c.text === "string" ? c.text : "")).join("");
    })
    .filter(Boolean)
    .join("\n\n");
}

const POST_FULL_PROJECTION = groq`{
  "slug": slug.current,
  title,
  description,
  datePublished,
  dateModified,
  author,
  authorAvatar,
  "image": mainImage {
    "src": asset->url,
    alt,
    "width": asset->metadata.dimensions.width,
    "height": asset->metadata.dimensions.height
  },
  tags,
  keywords,
  body
}`;

/** Use a client that bypasses Sanity CDN so production always gets fresh content. */
function getFreshClient() {
  return getSanityClient().withConfig({ useCdn: false });
}

export async function sanityFetchAllPosts(): Promise<SanityBlogPostDto[]> {
  const client = getFreshClient();
  const raw = await client.fetch<
    Array<Omit<SanityBlogPostDto, "body"> & { body?: SanityBlock[] }>
  >(groq`*[_type == "post"] | order(datePublished desc) ${POST_FULL_PROJECTION}`);

  return raw.map((doc) => ({
    slug: doc.slug ?? "",
    title: doc.title ?? "",
    description: doc.description ?? "",
    datePublished: doc.datePublished ?? "",
    dateModified: doc.dateModified ?? undefined,
    author: doc.author ?? "",
    authorAvatar: doc.authorAvatar ?? undefined,
    image: doc.image?.src
      ? {
          src: doc.image.src,
          alt: doc.image.alt ?? "",
          width: doc.image.width ?? undefined,
          height: doc.image.height ?? undefined,
        }
      : undefined,
    tags: doc.tags ?? undefined,
    keywords: doc.keywords ?? undefined,
    body: blockContentToPlainText(doc.body),
  }));
}

export async function sanityFetchPostBySlug(slug: string): Promise<SanityBlogPostDto | null> {
  const client = getFreshClient();
  const raw = await client.fetch<
    (Omit<SanityBlogPostDto, "body"> & { body?: SanityBlock[] }) | null
  >(groq`*[_type == "post" && slug.current == $slug][0] ${POST_FULL_PROJECTION}`, { slug });

  if (!raw) return null;

  return {
    slug: raw.slug ?? "",
    title: raw.title ?? "",
    description: raw.description ?? "",
    datePublished: raw.datePublished ?? "",
    dateModified: raw.dateModified ?? undefined,
    author: raw.author ?? "",
    authorAvatar: raw.authorAvatar ?? undefined,
    image: raw.image?.src
      ? {
          src: raw.image.src,
          alt: raw.image.alt ?? "",
          width: raw.image.width ?? undefined,
          height: raw.image.height ?? undefined,
        }
      : undefined,
    tags: raw.tags ?? undefined,
    keywords: raw.keywords ?? undefined,
    body: blockContentToPlainText(raw.body),
    bodyBlocks: raw.body && Array.isArray(raw.body) ? raw.body : undefined,
  };
}

export async function sanityFetchAllSlugs(): Promise<string[]> {
  const client = getFreshClient();
  const slugs = await client.fetch<string[]>(groq`*[_type == "post"].slug.current`);
  return Array.isArray(slugs) ? slugs : [];
}
