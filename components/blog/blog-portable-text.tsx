"use client";

/**
 * Renders Sanity Portable Text (block content) with semantic HTML and prose styling.
 * Supports headings (h1–h6), blockquote, lists, bold/italic/code, and inline images.
 */

import type { PortableTextBlock } from "@portabletext/types";
import { PortableText } from "@portabletext/react";
import type { PortableTextComponents } from "@portabletext/react";
import Image from "next/image";

const blockComponents: PortableTextComponents = {
  block: {
    h1: ({ children }) => (
      <h1 className="mt-8 mb-4 text-2xl font-bold tracking-tight text-foreground sm:text-3xl first:mt-0">
        {children}
      </h1>
    ),
    h2: ({ children }) => (
      <h2 className="mt-8 mb-3 text-xl font-semibold tracking-tight text-foreground sm:text-2xl first:mt-0">
        {children}
      </h2>
    ),
    h3: ({ children }) => (
      <h3 className="mt-6 mb-2 text-lg font-semibold text-foreground first:mt-0">
        {children}
      </h3>
    ),
    h4: ({ children }) => (
      <h4 className="mt-4 mb-2 text-base font-semibold text-foreground first:mt-0">
        {children}
      </h4>
    ),
    h5: ({ children }) => (
      <h5 className="mt-4 mb-2 text-sm font-semibold text-foreground first:mt-0">
        {children}
      </h5>
    ),
    h6: ({ children }) => (
      <h6 className="mt-3 mb-2 text-sm font-medium text-foreground first:mt-0">
        {children}
      </h6>
    ),
    blockquote: ({ children }) => (
      <blockquote className="my-4 border-l-4 border-border pl-4 italic text-muted-foreground">
        {children}
      </blockquote>
    ),
    normal: ({ children }) => (
      <p className="mb-4 leading-relaxed text-muted-foreground last:mb-0">{children}</p>
    ),
  },
  list: {
    bullet: ({ children }) => (
      <ul className="my-4 list-disc space-y-2 pl-6 text-muted-foreground">{children}</ul>
    ),
    number: ({ children }) => (
      <ol className="my-4 list-decimal space-y-2 pl-6 text-muted-foreground">{children}</ol>
    ),
  },
  listItem: {
    bullet: ({ children }) => <li className="leading-relaxed">{children}</li>,
    number: ({ children }) => <li className="leading-relaxed">{children}</li>,
  },
  marks: {
    strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
    em: ({ children }) => <em className="italic">{children}</em>,
    code: ({ children }) => (
      <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm">{children}</code>
    ),
  },
  types: {
    image: ({ value }) => {
      const asset = value?.asset as { url?: string } | undefined;
      const src = asset?.url ?? (value as { url?: string })?.url;
      const alt = (value as { alt?: string })?.alt ?? "";
      if (!src || typeof src !== "string") return null;
      return (
        <figure className="my-6">
          <div className="relative aspect-video w-full overflow-hidden rounded-md bg-muted">
            <Image
              src={src}
              alt={alt}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 65ch"
            />
          </div>
          {alt ? (
            <figcaption className="mt-2 text-center text-sm text-muted-foreground">{alt}</figcaption>
          ) : null}
        </figure>
      );
    },
  },
};

interface BlogPortableTextProps {
  value: PortableTextBlock[] | unknown[];
}

export function BlogPortableText({ value }: BlogPortableTextProps) {
  const blocks = value as PortableTextBlock[];
  if (!blocks?.length) return null;
  return (
    <PortableText
      value={blocks}
      components={blockComponents}
      onMissingComponent={false}
    />
  );
}
