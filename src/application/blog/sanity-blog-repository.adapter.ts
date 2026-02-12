/**
 * Adapter that implements IBlogRepository using Sanity infrastructure.
 * Application layer – delegates to infrastructure sanity-blog.repository.
 */

import type { IBlogRepository } from "./blog.repository.interface";
import {
  sanityFetchAllPosts,
  sanityFetchAllSlugs,
  sanityFetchPostBySlug,
} from "@/src/infrastructure/external/sanity/sanity-blog.repository";

export const sanityBlogRepositoryAdapter: IBlogRepository = {
  async getAllPosts() {
    return sanityFetchAllPosts();
  },

  async getPostBySlug(slug: string) {
    return sanityFetchPostBySlug(slug);
  },

  async getAllSlugs() {
    return sanityFetchAllSlugs();
  },
};
