/**
 * Blog Service
 * Business logic for reading and exposing blog posts (Sanity or static source).
 */

import type { BlogPost, BlogPostListItem } from "@/src/domain/blog/blog.types";
import { blogPostSchema } from "@/src/domain/blog/blog.validations";
import type { IBlogRepository } from "./blog.repository.interface";

export class BlogService {
  constructor(private readonly repo: IBlogRepository) {}

  /**
   * Returns all posts for list view, newest first.
   */
  async getAllPosts(): Promise<BlogPostListItem[]> {
    const rawList = await this.repo.getAllPosts();
    const list = rawList.map((raw) => {
      const parsed = blogPostSchema.safeParse(raw);
      if (!parsed.success) {
        throw new Error(`Invalid blog post: ${parsed.error.message}`);
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
  async getPostBySlug(slug: string): Promise<BlogPost | null> {
    const raw = await this.repo.getPostBySlug(slug);
    if (!raw) return null;
    const parsed = blogPostSchema.safeParse(raw);
    if (!parsed.success) return null;
    return parsed.data as BlogPost;
  }

  /**
   * Returns all slugs for static generation.
   */
  async getAllSlugs(): Promise<string[]> {
    return this.repo.getAllSlugs();
  }

  /**
   * Returns all unique tags from posts (sorted).
   */
  async getAllTags(): Promise<string[]> {
    const posts = await this.getAllPosts();
    const set = new Set<string>();
    for (const post of posts) {
      for (const tag of post.tags ?? []) {
        set.add(tag);
      }
    }
    return Array.from(set).sort();
  }
}
