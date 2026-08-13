// @ts-check
import { readdirSync, readFileSync } from 'node:fs';
import { defineConfig } from 'astro/config';

import sitemap from '@astrojs/sitemap';

/**
 * Category pages are always generated (the nav links to all four), but an empty
 * one is thin content — it renders with `noindex`. Listing a noindex page in the
 * sitemap makes Search Console report "Submitted URL marked noindex", so keep the
 * two in sync by dropping empty categories here too.
 */
function categoriesWithPosts() {
  const dir = new URL('./src/content/posts/', import.meta.url);
  const found = new Set();
  for (const file of readdirSync(dir)) {
    if (!file.endsWith('.md')) continue;
    const raw = readFileSync(new URL(file, dir), 'utf-8');
    const frontmatter = raw.split('---')[1] ?? '';
    if (/^draft:\s*true\s*$/m.test(frontmatter)) continue;
    const category = frontmatter.match(/^category:\s*(\S+)\s*$/m)?.[1];
    if (category) found.add(category);
  }
  return found;
}

const activeCategories = categoriesWithPosts();

// https://astro.build/config
export default defineConfig({
  site: 'https://dltmddyd321.github.io',
  // The archive page outgrew its old Tistory-only name once KeyFlow posts were
  // added. It was already in the submitted sitemap, so keep the old path working.
  redirects: {
    '/tistory': '/archives',
  },
  integrations: [
    sitemap({
      filter: (page) => {
        const path = new URL(page).pathname;
        // /search is an empty shell (results render client-side) — nothing to index.
        if (path.startsWith('/search')) return false;
        // The redirect stub shouldn't compete with its destination.
        if (path.startsWith('/tistory')) return false;
        const category = path.match(/^\/category\/([^/]+)\/?$/)?.[1];
        if (category) return activeCategories.has(category);
        return true;
      },
    }),
  ],
});
