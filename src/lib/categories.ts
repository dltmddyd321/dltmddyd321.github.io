export const CATEGORIES = {
  insight: { label: '기술 인사이트', short: 'insight' },
  'dev-log': { label: '개발 구현 과정', short: 'dev-log' },
  archive: { label: '코딩 아카이브', short: 'archive' },
  'ai-news': { label: 'AI 기술 · 뉴스', short: 'ai-news' },
} as const;

export type CategoryKey = keyof typeof CATEGORIES;

export function categoryLabel(key: string): string {
  return CATEGORIES[key as CategoryKey]?.label ?? key;
}
