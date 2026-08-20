import { getCollection } from 'astro:content';
import tistory from '../data/tistory-archive.json';
import keyflow from '../data/keyflow-archive.json';

export const SOURCE_LABELS: Record<string, string> = {
  tistory: 'Tistory',
  keyflow: 'KeyFlow',
};

type PostEntry = Awaited<ReturnType<typeof getCollection<'posts'>>>[number];

export type FeedItem =
  | { kind: 'post'; sortKey: number; post: PostEntry }
  | {
      kind: 'external';
      sortKey: number;
      entry: { title: string; url: string; date: string; source: string };
    };

/**
 * One feed, two shapes: full rows for this blog's posts, compact link rows for
 * anything published elsewhere. Shared by the home page and /posts so the two
 * can't drift apart.
 *
 * `sortKey` normalises the two date formats to a timestamp — truncating to the
 * day made same-day posts tie, and a stable sort then fell back to filename
 * order rather than newest-first.
 */
export async function buildFeed(): Promise<FeedItem[]> {
  const posts = await getCollection('posts', ({ data }) => !data.draft);

  return [
    ...posts.map(
      (post): FeedItem => ({ kind: 'post', sortKey: post.data.pubDate.valueOf(), post }),
    ),
    ...[
      ...tistory.map((entry) => ({ ...entry, source: 'tistory' })),
      ...keyflow.map((entry) => ({ ...entry, source: 'keyflow' })),
    ].map(
      (entry): FeedItem => ({
        kind: 'external',
        sortKey: new Date(entry.date.replaceAll('.', '-')).valueOf(),
        entry,
      }),
    ),
  ].sort((a, b) => b.sortKey - a.sortKey);
}

export const PAGE_SIZE = 30;

export interface FeedPage {
  items: FeedItem[];
  current: number;
  last: number;
  total: number;
  /** 1-based index of the first item on this page. */
  start: number;
  prevUrl: string | undefined;
  nextUrl: string | undefined;
}

/**
 * Slices the feed for one page. Page 1 lives at `/posts` rather than
 * `/posts/page/1`, so the same content isn't served from two URLs.
 */
export function feedPage(items: FeedItem[], current: number): FeedPage {
  const last = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const from = (current - 1) * PAGE_SIZE;
  const pageUrl = (n: number) => (n === 1 ? '/posts' : `/posts/page/${n}`);

  return {
    items: items.slice(from, from + PAGE_SIZE),
    current,
    last,
    total: items.length,
    start: from + 1,
    prevUrl: current > 1 ? pageUrl(current - 1) : undefined,
    nextUrl: current < last ? pageUrl(current + 1) : undefined,
  };
}
