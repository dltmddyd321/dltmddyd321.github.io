/**
 * Display labels are English to match the nav and the terminal tone. The Korean
 * `description` is not rendered on the page — it only feeds each category page's
 * meta description, so the pages don't all share one description in search
 * results. Key order here is the nav order.
 */
export const CATEGORIES = {
  insight: {
    label: 'Insight',
    description: '개념을 파고들어 정리한 기술 인사이트',
  },
  'dev-log': {
    label: 'Dev Log',
    description: '기능을 만들며 겪은 문제와 해결 과정',
  },
  algorithm: {
    label: 'Algorithm',
    description: '알고리즘 기본기와 코딩테스트 풀이 기록',
  },
  read: {
    label: 'Read',
    description: '읽은 기술 서적의 정리와 후기',
  },
  archive: {
    label: 'Archive',
    description: '다시 꺼내 쓸 코드와 설정 스니펫 모음',
  },
  'ai-lab': {
    label: 'AI Lab',
    description: 'AI 도구를 실제로 써보고 남긴 활용기',
  },
} as const;

export type CategoryKey = keyof typeof CATEGORIES;

export const CATEGORY_KEYS = Object.keys(CATEGORIES) as CategoryKey[];

export function categoryLabel(key: string): string {
  return CATEGORIES[key as CategoryKey]?.label ?? key;
}

export function categoryDescription(key: string): string {
  return CATEGORIES[key as CategoryKey]?.description ?? '';
}
