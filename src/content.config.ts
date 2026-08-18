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
     * Short teaser Claude writes when it authors a post directly (not a form
     * field in /write) — rendered as a distinct "AI Preview" banner, separate
     * from the human-written `description` lede.
     */
    aiPreview: z.string().optional(),
  }),
});

export const collections = { posts };
