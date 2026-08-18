/**
 * List-row thumbnail: the first real content image in a post's raw markdown
 * body, if any. Only matches markdown images and raw <img> tags — link-preview
 * cards use a CSS background-image, and video/mermaid embeds have neither, so
 * both are correctly ignored rather than mistaken for the post's thumbnail.
 */
export function firstImage(markdown: string | undefined): string | undefined {
  if (!markdown) return undefined;
  const match = markdown.match(/!\[[^\]]*\]\(([^)\s]+)\)|<img[^>]*\ssrc=["']([^"']+)["']/i);
  return match?.[1] ?? match?.[2];
}
