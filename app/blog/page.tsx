import { makeBlogService } from "@/src/application/blog/blog.factory";
import { BlogListWithFilters } from "@/components/blog/blog-list-with-filters";
import { BlogListStructuredData } from "@/components/blog/blog-structured-data";
import { BookOpen } from "lucide-react";

export default function BlogPage() {
  const blogService = makeBlogService();
  const posts = blogService.getAllPosts();
  const allTags = blogService.getAllTags();

  return (
    <div className="max-w-6xl mx-auto">
      <BlogListStructuredData posts={posts} />
      <header className="text-center mb-10 md:mb-14">
        <div className="flex items-center justify-center gap-3 mb-3">
          <BookOpen className="h-9 w-9 md:h-10 md:w-10 text-primary shrink-0" aria-hidden />
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">
            Blog
          </h1>
        </div>
        <p className="text-muted-foreground text-sm md:text-base max-w-xl mx-auto">
          Dicas e guias práticos sobre finanças pessoais: orçamento, controle de
          gastos, economia e paz financeira.
        </p>
      </header>
      <BlogListWithFilters posts={posts} allTags={allTags} />
    </div>
  );
}
