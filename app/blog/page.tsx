import { makeBlogService } from "@/src/application/blog/blog.factory";
import { BlogListWithFilters } from "@/components/blog/blog-list-with-filters";
import { BlogListStructuredData } from "@/components/blog/blog-structured-data";

/** Revalidate blog list periodically so production shows fresh content after deploy. */
export const revalidate = 60;

export default async function BlogPage() {
  const blogService = makeBlogService();
  const [posts, allTags] = await Promise.all([
    blogService.getAllPosts(),
    blogService.getAllTags(),
  ]);

  return (
    <>
      <BlogListStructuredData posts={posts} />
      <BlogListWithFilters posts={posts} allTags={allTags} />
    </>
  );
}
