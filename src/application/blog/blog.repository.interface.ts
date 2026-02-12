/**
 * Blog repository interface – used by BlogService to abstract data source
 * (Sanity vs static). Implementations live in infrastructure or application.
 */

export interface IBlogRepository {
  getAllPosts(): Promise<unknown[]>;
  getPostBySlug(slug: string): Promise<unknown | null>;
  getAllSlugs(): Promise<string[]>;
}
