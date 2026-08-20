// @ts-check
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { defineConfig } from 'astro/config';
import { visit } from 'unist-util-visit';

import sitemap from '@astrojs/sitemap';

/**
 * ```mermaid fenced code blocks would otherwise go through Shiki like any
 * other code sample, which loses the plain-text `.mermaid` structure the
 * client-side renderer (see PostLayout) looks for. Swap them for a raw HTML
 * node instead, before Shiki ever sees them — the same source still renders
 * natively as a diagram when viewed as a plain .md file on GitHub.
 */
function remarkMermaid() {
  /** @param {import('mdast').Root} tree */
  return (tree) => {
    visit(tree, 'code', (node, index, parent) => {
      if (node.lang !== 'mermaid' || !parent || typeof index !== 'number') return;
      parent.children[index] = {
        type: 'html',
        value: `<div class="mermaid">\n${node.value}\n</div>`,
      };
    });
  };
}

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

/*
 * Stamp the build once, here, before any page renders — src/lib/buildId.ts
 * reads this same variable, so the meta tag baked into each page and the
 * version.json written below always match. In CI the commit SHA makes the id
 * meaningful; locally a timestamp is enough.
 */
process.env.PUBLIC_BUILD_ID ??=
  process.env.GITHUB_SHA?.slice(0, 7) ?? String(Date.now());

/** Emits the file the client polls to detect that a new deploy has landed. */
function buildVersionFile() {
  return {
    name: 'build-version-file',
    hooks: {
      /** @param {{ dir: URL }} context */
      'astro:build:done': ({ dir }) => {
        writeFileSync(
          new URL('version.json', dir),
          JSON.stringify({ build: process.env.PUBLIC_BUILD_ID }),
        );
      },
    },
  };
}

// https://astro.build/config
export default defineConfig({
  site: 'https://dltmddyd321.github.io',
  // The archive page outgrew its old Tistory-only name once KeyFlow posts were
  // added. It was already in the submitted sitemap, so keep the old path working.
  redirects: {
    '/tistory': '/archives',
    // Published briefly under the timestamp slug that a Korean-only title
    // falls back to, before being renamed — keep the old link working.
    '/posts/post-1787111131692': '/posts/ai-rewrite-prompt',
  },
  markdown: {
    remarkPlugins: [remarkMermaid],
  },
  integrations: [
    buildVersionFile(),
    sitemap({
      filter: (page) => {
        const path = new URL(page).pathname;
        // /search is an empty shell (results render client-side) — nothing to index.
        if (path.startsWith('/search')) return false;
        // /write is the token-gated admin tool and renders `noindex`; listing a
        // noindex URL here is what trips Search Console.
        if (path.startsWith('/write')) return false;
        // Redirect stubs shouldn't compete with their destinations.
        if (path.startsWith('/tistory')) return false;
        if (path === '/posts/post-1787111131692/') return false;
        // Feed pages 2+ render `noindex` (link lists, no original content);
        // listing a noindex URL here trips Search Console.
        if (/^\/posts\/page\/\d+\/?$/.test(path)) return false;
        const category = path.match(/^\/category\/([^/]+)\/?$/)?.[1];
        if (category) return activeCategories.has(category);
        return true;
      },
    }),
  ],
});
