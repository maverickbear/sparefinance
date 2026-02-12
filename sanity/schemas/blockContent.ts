/**
 * Portable Text (block content) schema for post body.
 * Includes blockquote so Studio can resolve "text block style blockquote" for existing content.
 */

import { defineArrayMember, defineType, type PortableTextPluginsProps } from "sanity";

export const blockContentType = defineType({
  name: "blockContent",
  title: "Block Content",
  type: "array",
  of: [
    defineArrayMember({
      type: "block",
      styles: [
        { title: "Normal", value: "normal" },
        { title: "H1", value: "h1" },
        { title: "H2", value: "h2" },
        { title: "H3", value: "h3" },
        { title: "H4", value: "h4" },
        { title: "H5", value: "h5" },
        { title: "H6", value: "h6" },
        { title: "Quote", value: "blockquote" },
      ],
    }),
    {
      type: "image",
      options: { hotspot: true },
      fields: [{ name: "alt", type: "string", title: "Alt text" }],
    },
  ],
  components: {
    portableText: {
      plugins: (props: PortableTextPluginsProps) =>
        props.renderDefault({
          ...props,
          plugins: {
            ...props.plugins,
            markdown: {
              ...(typeof props.plugins.markdown === "object" && props.plugins.markdown !== null
                ? props.plugins.markdown
                : {}),
              blockquoteStyle: () => "blockquote" as const,
            } as PortableTextPluginsProps["plugins"]["markdown"],
          },
        }),
    },
  },
});
