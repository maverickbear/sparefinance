/**
 * Blog Service
 * Business logic for reading and exposing blog posts (no DB).
 */

import type { BlogPost, BlogPostListItem } from "@/src/domain/blog/blog.types";
import { blogPostSchema } from "@/src/domain/blog/blog.validations";
import { BLOG_POSTS } from "./posts.data";

export class BlogService {
  /**
   * Returns all posts for list view, newest first.
   */
  getAllPosts(): BlogPostListItem[] {
    const list = BLOG_POSTS.map((post) => {
      const parsed = blogPostSchema.safeParse(post);
      if (!parsed.success) {
        throw new Error(`Invalid blog post "${post.slug}": ${parsed.error.message}`);
      }
      const p = parsed.data;
      return {
        slug: p.slug,
        title: p.title,
        description: p.description,
        datePublished: p.datePublished,
        dateModified: p.dateModified,
        author: p.author,
        authorAvatar: p.authorAvatar,
        image: p.image,
        tags: p.tags,
      } satisfies BlogPostListItem;
    });
    return list.sort(
      (a, b) => new Date(b.datePublished).getTime() - new Date(a.datePublished).getTime()
    );
  }

  /**
   * Returns a single post by slug, or null if not found.
   */
  getPostBySlug(slug: string): BlogPost | null {
    const raw = BLOG_POSTS.find((p) => p.slug === slug);
    if (!raw) return null;
    const parsed = blogPostSchema.safeParse(raw);
    if (!parsed.success) {
      return null;
    }
    return parsed.data as BlogPost;
  }

  /**
   * Returns all slugs for static generation.
   */
  getAllSlugs(): string[] {
    return BLOG_POSTS.map((p) => p.slug);
  }

  /**
   * Returns all unique tags from posts (sorted).
   */
  getAllTags(): string[] {
    const set = new Set<string>();
    for (const post of BLOG_POSTS) {
      for (const tag of post.tags ?? []) {
        set.add(tag);
      }
    }
    return Array.from(set).sort();
  }
}
