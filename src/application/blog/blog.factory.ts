/**
 * Blog factory – dependency injection for BlogService.
 */

import { BlogService } from "./blog.service";

let blogServiceInstance: BlogService | null = null;

export function makeBlogService(): BlogService {
  if (!blogServiceInstance) {
    blogServiceInstance = new BlogService();
  }
  return blogServiceInstance;
}
