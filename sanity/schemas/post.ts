/**
 * Sanity schema for blog posts (personal finance content).
 * Maps to domain BlogPost via infrastructure sanity-blog.repository.
 */

import { defineField, defineType } from "sanity";

export const postType = defineType({
  name: "post",
  title: "Blog Post",
  type: "document",
  fields: [
    defineField({
      name: "title",
      title: "Title",
      type: "string",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "slug",
      title: "Slug",
      type: "slug",
      options: { source: "title", maxLength: 96 },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "description",
      title: "Description",
      type: "text",
      rows: 2,
      validation: (rule) => rule.required().max(500),
    }),
    defineField({
      name: "datePublished",
      title: "Date published",
      type: "date",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "dateModified",
      title: "Date modified",
      type: "date",
    }),
    defineField({
      name: "author",
      title: "Author",
      type: "string",
      validation: (rule) => rule.required().max(100),
    }),
    defineField({
      name: "authorAvatar",
      title: "Author avatar URL",
      type: "url",
    }),
    defineField({
      name: "mainImage",
      title: "Main image",
      type: "image",
      options: { hotspot: true },
      fields: [
        { name: "alt", type: "string", title: "Alt text", validation: (rule) => rule.required() },
      ],
    }),
    defineField({
      name: "tags",
      title: "Tags",
      type: "array",
      of: [{ type: "string" }],
      options: { layout: "tags" },
    }),
    defineField({
      name: "keywords",
      title: "Keywords (SEO)",
      type: "array",
      of: [{ type: "string" }],
    }),
    defineField({
      name: "body",
      title: "Body",
      type: "blockContent",
      validation: (rule) => rule.required(),
    }),
  ],
  preview: {
    select: { title: "title", datePublished: "datePublished" },
    prepare({ title, datePublished }) {
      return {
        title: title ?? "Untitled",
        subtitle: datePublished ? new Date(datePublished).toLocaleDateString() : "",
      };
    },
  },
});
