/**
 * Static blog repository – reads from in-memory posts data.
 * Used when Sanity is not configured.
 */

import type { IBlogRepository } from "./blog.repository.interface";
import { BLOG_POSTS } from "./posts.data";

export const staticBlogRepository: IBlogRepository = {
  async getAllPosts() {
    return Promise.resolve([...BLOG_POSTS]);
  },

  async getPostBySlug(slug: string) {
    const post = BLOG_POSTS.find((p) => p.slug === slug) ?? null;
    return Promise.resolve(post);
  },

  async getAllSlugs() {
    return Promise.resolve(BLOG_POSTS.map((p) => p.slug));
  },
};
