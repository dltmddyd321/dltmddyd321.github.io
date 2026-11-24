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
 * `planned` lists every part's working title in order, so readers can see
 * where the series is going before later parts are published. A published
 * post's own title always wins over its planned title.
 */
export const SERIES = {
  'pleos-connect': {
    title: 'Pleos Connect로 차량용 앱 만들기',
    description:
      '현대자동차그룹의 차량용 인포테인먼트 플랫폼 Pleos Connect를 소개하고, SDK를 직접 써 보며 구현한 내용을 정리한 시리즈',
    planned: [
      'Pleos Connect란? 플랫폼과 테스트 환경',
      '화면 구조와 반응형 UI: Driving View와 앱 영역',
      'Vehicle SDK: 차량 상태 읽기',
      '음성: STT/TTS SDK 써 보기',
      'NaviHelper와 FusedLocation: 위치와 내비 연동',
      '차량 이벤트로 동작하는 앱 만들기',
      '번외: 공모전에서 배운 것',
    ],
  },
} as const satisfies Record<string, { title: string; description: string; planned?: readonly string[] }>;

export type SeriesKey = keyof typeof SERIES;

export const SERIES_KEYS = Object.keys(SERIES) as SeriesKey[];

export function seriesTitle(key: string): string {
  return SERIES[key as SeriesKey]?.title ?? key;
}

type PostEntry = Awaited<ReturnType<typeof getCollection<'posts'>>>[number];

/** One slot in a series: a published post, or a planned part not out yet. */
export type SeriesPart =
  | { order: number; kind: 'post'; title: string; slug: string; post: PostEntry }
  | { order: number; kind: 'planned'; title: string };

export type PublishedPart = Extract<SeriesPart, { kind: 'post' }>;

export interface SeriesOutline {
  key: SeriesKey;
  title: string;
  description: string;
  parts: SeriesPart[];
  /** Published parts only, in reading order — what prev/next walks through. */
  published: PublishedPart[];
}

/**
 * Builds a series' table of contents by laying published posts over the
 * planned list. Posts without a `seriesOrder` go after the numbered ones,
 * oldest first, so forgetting the number never hides a post.
 */
export async function seriesOutline(key: SeriesKey): Promise<SeriesOutline> {
  const def = SERIES[key];
  const posts = (
    await getCollection('posts', ({ data }) => !data.draft && data.series === key)
  ).sort((a, b) => a.data.pubDate.valueOf() - b.data.pubDate.valueOf());

  const planned: readonly string[] = 'planned' in def ? def.planned : [];
  const byOrder = new Map<number, PostEntry>();
  const unnumbered: PostEntry[] = [];
  for (const post of posts) {
    const order = post.data.seriesOrder;
    if (order !== undefined && !byOrder.has(order)) byOrder.set(order, post);
    else unnumbered.push(post);
  }

  const lastOrder = Math.max(planned.length, ...byOrder.keys(), 0);
  const parts: SeriesPart[] = [];
  for (let order = 1; order <= lastOrder; order++) {
    const post = byOrder.get(order);
    if (post) parts.push({ order, kind: 'post', title: post.data.title, slug: post.id, post });
    else if (planned[order - 1]) parts.push({ order, kind: 'planned', title: planned[order - 1] });
  }
  for (const post of unnumbered) {
    parts.push({ order: lastOrder + 1 + unnumbered.indexOf(post), kind: 'post', title: post.data.title, slug: post.id, post });
  }

  return {
    key,
    title: def.title,
    description: def.description,
    parts,
    published: parts.filter((part): part is PublishedPart => part.kind === 'post'),
  };
}
