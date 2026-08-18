# dltmddyd321.log

[![Visit Blog](https://img.shields.io/badge/Win--Dev_Log-바로가기-e0a458?style=for-the-badge)](https://dltmddyd321.github.io)

이승용의 개발 인사이트 · 구현 과정 · 코딩 아카이브 · AI 뉴스 기록 블로그.
[Astro](https://astro.build) Content Collections 기반 정적 사이트이며, `main` 브랜치 push 시 GitHub Actions가 자동으로 `https://dltmddyd321.github.io`에 배포합니다.

## 글 작성하기

`src/content/posts/`에 Markdown 파일을 추가하면 됩니다.

```md
---
title: 글 제목
description: 목록/RSS에 노출될 한 줄 요약
pubDate: 2026-08-05
category: insight # insight | dev-log | algorithm | read | archive | ai-lab
tags: [kotlin, coroutine]
---

본문 내용...
```

- `draft: true`를 추가하면 배포에서 제외됩니다.
- 카테고리 6종: `insight`(Insight), `dev-log`(Dev_Log), `algorithm`(Algorithm), `read`(Read), `archive`(Archive), `ai-lab`(AI_Lab).
  추가·수정은 `src/lib/categories.ts` 한 곳만 고치면 nav·스키마·카테고리 페이지가 따라옵니다.

## 로컬 개발

| Command           | Action                              |
| :----------------- | :----------------------------------- |
| `npm install`       | 의존성 설치                          |
| `npm run dev`       | `localhost:4321`에서 개발 서버 실행   |
| `npm run build`     | `./dist/`로 프로덕션 빌드            |
| `npm run preview`   | 빌드 결과 로컬 프리뷰                |

## 구조

```
src/
├── content/posts/       # 글 (Markdown)
├── content.config.ts    # posts 컬렉션 스키마
├── layouts/              # BaseLayout, PostLayout
├── components/           # PostRow 등
└── pages/
    ├── index.astro        # 홈 (전체 글 목록)
    ├── about.astro         # 경력/프로젝트/자기소개
    ├── posts/[...slug].astro
    ├── category/[category].astro
    └── rss.xml.js
```
