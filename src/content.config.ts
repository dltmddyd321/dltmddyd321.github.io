import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';
import { CATEGORY_KEYS, type CategoryKey } from './lib/categories';

const posts = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/posts' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    // Derived from CATEGORIES so adding one there is the only edit needed.
    category: z.enum(CATEGORY_KEYS as [CategoryKey, ...CategoryKey[]]),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
    /**
     * Short teaser Claude writes, rendered as a distinct "AI Preview" banner
     * separate from the human-written `description` lede.
     *
     * Every post gets one. It is not a /write form field — Claude fills it in
     * by reading the post, including for posts authored through /write, so a
     * post published without it is backfilled rather than left blank.
     *
     * Start with the substance. The banner is already labelled "AI Preview",
     * so lead-ins like "핵심만 보면 —" only restate the label.
     */
    aiPreview: z.string().optional(),
  }),
});

/**
 * Short, gist-like jottings that don't warrant a full post — deliberately just
 * body text and a timestamp: no title, category, tags, or comments. Rendered
 * as terminal blocks on /notes and surfaced (3 most recent) in the sidebar.
 */
const notes = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/notes' }),
  schema: z.object({
    pubDate: z.coerce.date(),
    draft: z.boolean().default(false),
  }),
});

export const collections = { posts, notes };
