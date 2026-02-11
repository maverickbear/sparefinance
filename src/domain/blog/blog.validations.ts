/**
 * Blog domain validations (Zod schemas for frontmatter/post data).
 */

import { z } from "zod";

const blogPostImageSchema = z.object({
  src: z.string().min(1),
  alt: z.string().min(1),
  width: z.number().positive().optional(),
  height: z.number().positive().optional(),
});

export const blogPostSchema = z.object({
  slug: z.string().min(1, "Slug is required").regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric and hyphens only"),
  title: z.string().min(1, "Title is required").max(200, "Title must be less than 200 characters"),
  description: z.string().min(1, "Description is required").max(500, "Description must be less than 500 characters"),
  datePublished: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  dateModified: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
  author: z.string().min(1, "Author is required").max(100),
  authorAvatar: z.string().url().optional(),
  image: blogPostImageSchema.optional(),
  tags: z.array(z.string().min(1).max(30)).max(10).optional(),
  keywords: z.array(z.string().max(50)).max(20).optional(),
  body: z.string().min(1, "Body is required"),
});

export type BlogPostInput = z.infer<typeof blogPostSchema>;
