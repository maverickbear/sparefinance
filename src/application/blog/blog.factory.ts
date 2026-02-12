/**
 * Blog factory – dependency injection for BlogService.
 * Uses Sanity when configured, otherwise static posts.
 */

import { isSanityConfigured } from "@/src/infrastructure/external/sanity/sanity-client";
import { BlogService } from "./blog.service";
import { sanityBlogRepositoryAdapter } from "./sanity-blog-repository.adapter";
import { staticBlogRepository } from "./static-blog.repository";

let blogServiceInstance: BlogService | null = null;

export function makeBlogService(): BlogService {
  if (!blogServiceInstance) {
    const repo = isSanityConfigured() ? sanityBlogRepositoryAdapter : staticBlogRepository;
    blogServiceInstance = new BlogService(repo);
  }
  return blogServiceInstance;
}
