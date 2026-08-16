export const SITE = {
  url: 'https://dltmddyd321.github.io',
  /**
   * Shown in <title>, og:site_name, RSS, and structured data. Short and in
   * English on purpose — the Korean full name read too narrowly once the blog
   * grew past Android/Kotlin into algorithms, reading notes, and AI. "Win-Dev"
   * also matches the author's existing handle across Tistory and KeyFlow.
   */
  name: 'Win-Dev Log',
  description:
    'Android 개발자 이승용의 기술 블로그. Kotlin, Jetpack Compose, Coroutine 등 실무에서 얻은 기술 인사이트와 구현 과정, 알고리즘 풀이, 코딩 아카이브, AI 활용기를 기록합니다.',
  author: '이승용',
  locale: 'ko_KR',
  ogImage: '/og-image.png',
  /** Rendered in the footer and used as schema.org `sameAs` for identity linking. */
  links: [
    { label: 'github', url: 'https://github.com/dltmddyd321' },
    { label: 'youtube', url: 'https://www.youtube.com/@seungyong2477' },
    { label: 'instagram', url: 'https://www.instagram.com/wi.life_7/' },
    { label: 'tistory', url: 'https://yongdragon9819.tistory.com' },
  ],
} as const;

/** Profile URLs for schema.org `sameAs`. */
export const SAME_AS = SITE.links.map((link) => link.url);
