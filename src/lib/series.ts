import { getCollection } from 'astro:content';

/**
 * Series are declared here, like categories, so a post can only join a series
 * that exists — a typo in frontmatter fails the build instead of quietly
 * creating a one-post series. Key order here is the /series page order.
 *
 * A post joins with two frontmatter fields:
 *   series: pleos-connect
 *   seriesOrder: 1
 *
 * Only published posts are listed — the series grows as parts are written,
 * without announcing parts that don't exist yet.
 */
export const SERIES = {
  'pleos-connect': {
    title: 'Pleos Connect로 차량용 앱 만들기',
    description:
      '현대자동차그룹의 차량용 인포테인먼트 플랫폼 Pleos Connect를 소개하고, SDK를 직접 써 보며 구현한 내용을 정리한 시리즈',
  },
} as const satisfies Record<string, { title: string; description: string }>;

export type SeriesKey = keyof typeof SERIES;

export const SERIES_KEYS = Object.keys(SERIES) as SeriesKey[];

export function seriesTitle(key: string): string {
  return SERIES[key as SeriesKey]?.title ?? key;
}

/** One published part of a series, numbered in reading order. */
export interface SeriesPart {
  order: number;
  title: string;
  slug: string;
  post: Awaited<ReturnType<typeof getCollection<'posts'>>>[number];
}

export interface SeriesOutline {
  key: SeriesKey;
  title: string;
  description: string;
  /** Published parts in reading order — what the outline lists and prev/next walks. */
  parts: SeriesPart[];
}

/**
 * A series' table of contents: its published posts ordered by `seriesOrder`,
 * then by date for posts without one, so forgetting the number never hides a
 * post. Part numbers are each post's `seriesOrder` when set, else its position.
 */
export async function seriesOutline(key: SeriesKey): Promise<SeriesOutline> {
  const def = SERIES[key];
  const posts = (
    await getCollection('posts', ({ data }) => !data.draft && data.series === key)
  ).sort(
    (a, b) =>
      (a.data.seriesOrder ?? Number.MAX_SAFE_INTEGER) - (b.data.seriesOrder ?? Number.MAX_SAFE_INTEGER) ||
      a.data.pubDate.valueOf() - b.data.pubDate.valueOf(),
  );

  return {
    key,
    title: def.title,
    description: def.description,
    parts: posts.map((post, index) => ({
      order: post.data.seriesOrder ?? index + 1,
      title: post.data.title,
      slug: post.id,
      post,
    })),
  };
}
