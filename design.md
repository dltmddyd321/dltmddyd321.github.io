# design.md — dltmddyd321.log

## Product

이승용의 개발 인사이트 · 구현 과정 · 코딩 아카이브 · AI 뉴스를 기록하는 개인 기술 블로그.
기존 1페이지 포트폴리오(dltmddyd321.github.io)를 대체한다. 콘텐츠는 필자 1인이 Markdown으로
직접 작성하는 정적 아카이브이며, 폼 제출·로그인·대시보드 등 앱 상호작용은 없다.

## Audience & scope (assumption)

대상 독자는 (1) 필자 본인의 미래 참고용, (2) Android/모바일 개발 커뮤니티, (3) 이력서를 함께
보는 채용 관계자로 가정한다. 이 가정에 따라 정보 밀도가 높은 레퍼런스/저널 톤을 우선하고,
전환율을 노리는 마케팅형 UI(히어로 CTA, 뉴스레터 구독 등)는 넣지 않는다.

## Visual direction

**Primary style: Fusion — Editorial x Terminal** ([webstylebook.com](https://webstylebook.com/pages/fusion-editorial-terminal) 레퍼런스)

선택 이유: 이 블로그는 "레퍼런스/매뉴얼처럼 읽히면서 기술적 질감이 있는" 콘텐츠(코드, 구현
로그, 기술 노트)가 핵심이라 정확히 이 스타일의 `bestFor`(technical docs, dev logs)와 일치한다.
일반 SaaS 랜딩이나 포트폴리오형 미니멀 스타일은 콘텐츠 아카이브 용도에 맞지 않아 제외했다.

**Secondary accent: 없음.** 카테고리를 색상이 아니라 라벨(칩)로 구분하므로 별도 보조
스타일 없이 accent 1색(amber)만 사용한다.

## Typography

원래 스타일 레퍼런스는 "세리프 헤드라인 + 모노스페이스 라벨 + 가독성 있는 산세리프 본문"이다.
그러나 한국어 콘텐츠 비중이 100%인 이 블로그에 서구 세리프(Georgia/Palatino류)를 적용하면
한글은 시스템 세리프(바탕체 계열)로 폴백되어 "궁서체"처럼 예스럽고 전통 문서 같은 인상을
준다 — 에디토리얼이 아니라 옛스러움으로 읽힌다. 이는 실제 렌더링 확인 후 수정한 사항이다.

**결정: 세리프 헤드라인 대신 자체 호스팅한 Pretendard Variable을 전체 서체로 쓰고, "에디토리얼
헤비함"은 서체 모양이 아니라 폰트 굵기(weight)로 표현한다.**

- `--font-sans`: `'Pretendard Variable', Pretendard, -apple-system, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif` — 헤드라인(weight 800)과 본문(weight 400) 공용
- `--font-mono`: `ui-monospace, 'SF Mono', 'JetBrains Mono', Menlo, Consolas, monospace` — 터미널풍 상태줄, 메타 정보(날짜/카테고리), 코드
- 폰트 파일은 `public/fonts/PretendardVariable.woff2` 1개(가변 폰트, weight 45–920 커버)로 자체 호스팅 — 외부 CDN 요청 없음

## Color tokens

| Token | Value | 용도 |
| --- | --- | --- |
| `--bg` | `#0b0c0a` | 페이지 배경 |
| `--surface` | `#131410` | 카드/패널 |
| `--surface-2` | `#1a1c16` | 인라인 코드 배경 |
| `--border` | `#2a2c24` | 구분선, 카드 테두리, 배경 격자 |
| `--text` | `#ece9df` | 본문 텍스트 |
| `--text-muted` | `#8f9285` | 보조 텍스트, 메타 |
| `--accent` | `#e0a458` | 링크, 칩, 강조 |

**대비 검증(WCAG AA, 본문 텍스트 ≥4.5:1 기준):**

| 조합 | 대비율 | 결과 |
| --- | --- | --- |
| text / bg | 16.14 | PASS |
| text-muted / bg | 6.18 | PASS |
| accent / bg | 8.98 | PASS |
| text / surface | 15.23 | PASS |
| text-muted / surface | 5.83 | PASS |

## Layout & spacing

- `--max-width: 960px`, 좌우 padding 24px (모바일 ≤720px: 16px)
- 섹션 수직 padding 40px, 섹션 간 1px `--border` 구분선 (카드를 겹쳐 쌓지 않음)
- 카드/패널은 섹션당 1레벨만 사용 — 카드 안에 카드를 넣지 않는다
- radius: 카드/코드블록 8–14px, 칩(chip)은 999px pill

## Motion

명시적 모션 시스템 없음. hover 시 밑줄/색상 전환(0.15–0.2s) 정도만 사용하며, 별도의 등장
애니메이션은 넣지 않았다 — 콘텐츠 우선 블로그에서 모션은 읽기를 방해할 위험이 더 크다고
판단. `prefers-reduced-motion` 관련 이슈는 애초에 트랜지션이 최소라 별도 대응 불필요.

## Component inventory

- `BaseLayout` — 헤더(로고/nav), 터미널풍 status line, footer, 선택적 사이드바
- `Sidebar` — 프로필 카드 + 태그 위젯 + 예전 글 카운트 (목록 페이지 전용)
- `PostLayout` — 포스트 헤더 + 사이드바(날짜/카테고리/태그) + 본문 2컬럼 그리드
- `PostRow` — 목록/카테고리 페이지 공용 글 목록 행
- 페이지: `/`(목록), `/posts/[slug]`, `/category/[category]`, `/tag/[tag]`, `/tags`, `/search`,
  `/about`, `/tistory`, `/rss.xml`

### 정보 구조 — nav는 계층, 나머지는 사이드바

nav에 카테고리·태그·About이 뒤섞여 있으면 "무엇이 글의 분류인지"가 흐려진다. 그래서 역할을
분리했다.

- **헤더 nav** = Posts + 카테고리 5종. 글의 분류 계층만 남긴다. 현재 위치는 accent 밑줄과
  `aria-current="page"`로 표시한다
- **사이드바** = 프로필 카드(간단 소개 + About 링크), 태그 위젯, 예전 글 아카이브 카운트.
  네이버 블로그처럼 본문 옆에 붙어 "훑어보는" 용도
- **푸터** = About / Tags / 예전 글 / Search + 외부 프로필. 사이드바가 없는 읽기 페이지에서도
  이 페이지들에 닿을 수 있어야 해서 넣었다 (nav에서 뺀 뒤 글 페이지가 막다른 길이 되는 걸 발견해
  추가한 것)

**사이드바는 목록 페이지에만** 붙인다(홈, 카테고리, 태그) — `BaseLayout`의 `withSidebar` prop.
글 페이지는 이미 왼쪽에 메타 레일(날짜/카테고리/태그)이 있어서 사이드바까지 붙이면 960px 안에서
본문이 460px대로 좁아진다. 롱폼 가독성이 우선이라 읽기 페이지(글, About)는 전체 폭을 유지한다.

**태그 위젯**은 글 수 기준 정렬로 12개까지 보여주고, 넘치면 `더보기 +N` 버튼으로 펼친다
(`aria-expanded` 토글, 펼치면 라벨이 `접기`로 바뀜). 전체 목록은 `/tags`로 연결한다.

레이아웃은 860px 이하에서 1단으로 스택되고 sticky도 해제된다 — 그 아래로는 2단을 유지하면 양쪽
다 읽기 어려운 폭이 된다.

### 카테고리

**단일 소스: `src/lib/categories.ts`.** 여기에 항목을 추가하면 nav, 콘텐츠 스키마의 enum,
카테고리 페이지, 사이트맵이 전부 따라온다 (nav는 `CATEGORY_KEYS`를 순회해 렌더링하고, 스키마는
`z.enum(CATEGORY_KEYS)`로 파생시킨다). 객체의 키 순서가 곧 nav 순서다.

| slug | 라벨 | 설명 |
| --- | --- | --- |
| `insight` | Insight | 개념을 파고들어 정리한 기술 인사이트 |
| `dev-log` | Dev Log | 기능을 만들며 겪은 문제와 해결 과정 |
| `algorithm` | Algorithm | 알고리즘 기본기와 코딩테스트 풀이 기록 |
| `archive` | Archive | 다시 꺼내 쓸 코드와 설정 스니펫 모음 |
| `ai-lab` | AI Lab | AI 도구를 실제로 써보고 남긴 활용기 |

**표기 규칙**: 화면에 보이는 라벨은 영문으로 통일했다 — nav가 이미 영문이었는데 카테고리 페이지
제목만 한글이라 섞여 있었고, 터미널 톤과도 영문이 맞는다. 대신 한국어 독자와 검색 유입을 위해
카테고리마다 한글 `description`을 두고, 카테고리 페이지 부제목과 meta description에 쓴다.

`ai-news`(AI 기술·뉴스)는 성격을 "직접 써본 활용기"로 좁히면서 `ai-lab`(AI Lab)으로 slug까지
바꿨다. 해당 카테고리에 글이 없었고 색인도 되기 전이라 리다이렉트는 불필요했다.

카테고리는 글당 1개(스키마 enum으로 고정 — 오타나 없는 값이면 빌드 실패), 태그는 자유 어휘다.

### 태그

`posts` 컬렉션의 기존 `tags` 필드를 실제로 연결했다. `PostRow`(목록)와 `PostLayout` 사이드바에서
태그가 `/tag/[tag]`로 링크되고, `/tags`는 전체 태그를 글 수 기준으로 정렬해 보여주는 인덱스다.
카테고리(4종 고정)와 달리 태그는 자유 어휘라 별도 스키마 enum 없이 문자열 그대로 사용한다.

### 검색 — Pagefind

빌드 시점에 정적으로 색인하는 [Pagefind](https://pagefind.app)를 붙였다. 제목만 찾는 게 아니라
본문 전체를 검색해야 실용적이라고 판단해, `/tistory`처럼 클라이언트 사이드 문자열 매칭 대신
이 방식을 택했다.

- `package.json`의 `postbuild` 스크립트(`pagefind --site dist`)가 `astro build` 직후 자동 실행되어
  `dist/pagefind/`에 색인을 만든다 (npm이 `build` 실행 시 `postbuild`를 자동으로 이어서 실행하는
  라이프사이클 훅을 사용 — CI 워크플로우 수정 불필요)
- `PostLayout`의 `<article>`에 `data-pagefind-body`를 달아 **포스트 본문만** 색인 대상으로
  한정했다 (nav, about, tistory 아카이브 302개 링크 같은 노이즈 제외). 사이드바는
  `data-pagefind-ignore`로 제외
- `/search` 페이지는 Pagefind의 저수준 JS API(`pagefind.search()`)를 직접 호출해 터미널 톤에
  맞춘 커스텀 결과 UI를 그린다 (Pagefind 기본 제공 UI 위젯은 쓰지 않음)
- **주의 — Vite 빌드 이슈**: `import('/pagefind/pagefind.js')`를 그냥 쓰면 Vite가
  `@vite-ignore`를 붙여도 여전히 프리로드 헬퍼로 감싸면서 `__VITE_PRELOAD__` 참조 오류를 낸다
  (해당 파일은 `postbuild`가 끝나야 생기므로 Vite가 정적 분석할 수 없는데, 그 사실과 무관하게
  래핑만 실행되는 Vite의 알려진 동작). `new Function('specifier', 'return import(specifier)')`로
  import 호출을 문자열 함수 본문 안에 숨겨 Vite의 정적 분석 자체를 우회해서 해결했다
  (`src/pages/search.astro`)
- **주의 — Astro 스코프드 스타일**: 검색 결과 DOM은 `innerHTML`로 런타임에 삽입되므로 Astro가
  붙이는 `data-astro-cid-*` 스코프 속성이 적용되지 않는다. 결과 관련 스타일(`.result`, `mark`
  하이라이트 등)은 반드시 `<style is:global>` 블록에 둬야 한다 — 처음엔 일반 스코프드
  `<style>`에 넣었다가 브라우저 기본 `<mark>` 노란색이 그대로 나오는 걸 보고 발견/수정했다
- `npm run dev`에서는 색인이 없어 검색이 "프로덕션 빌드에서만 생성됩니다" 안내만 뜬다 — 로컬
  검증은 `npm run build && npm run preview`로 한다

### `/tistory` — 예전 글 아카이브

이 블로그 이전에 [Tistory(yongdragon9819.tistory.com)](https://yongdragon9819.tistory.com)에 쓴
글 302편의 색인 페이지. 전체 마이그레이션 대신, 제목·날짜·원문 링크만 정적 데이터
(`src/data/tistory-archive.json`)로 만들어 연도별로 그룹핑해 보여주고 클릭 시 Tistory 원문으로
이동한다. 데이터는 Tistory `/category?page=N` 목록 페이지의 JSON-LD(`ListItem`) 구조화 데이터를
빌드 시점에 한 번 수집해 만든 정적 스냅샷이며, 이후 새 글이 이 블로그로 이어지므로 주기적 재수집은
필요 없다. 302개 목록은 `$ grep -i` 스타일의 클라이언트 사이드 텍스트 검색(바닐라 JS)으로
탐색성을 보완했다.

## SEO (검색 유입)

기술적 SEO만 담당한다 — 순위·유입의 크기는 결국 콘텐츠가 결정하고, 새 도메인은 색인에 몇 주
이상 걸린다는 전제를 깔고 "크롤러가 제대로 읽고 색인할 수 있는 상태"를 목표로 했다.

- **사이트 정체성 단일화**: `src/lib/site.ts`의 `SITE` 상수(사이트명, 설명, 저자, OG 이미지)를
  레이아웃·RSS·구조화 데이터가 공유한다. 사이트명은 검색 노출을 고려해 `dltmddyd321`(계정 ID)
  대신 **"이승용 개발 블로그"**로 바꿨다 — 사람이 검색할 법한 단어로 제목이 잡히도록.
- **`<head>` 메타**(`BaseLayout.astro`): 페이지별 `<title>`/`description`, `canonical`,
  Open Graph, Twitter Card(`summary_large_image`), 포스트의 `article:published_time`·`article:tag`
- **중복 description 제거**: 모든 페이지가 같은 설명을 쓰면 감점이라, 카테고리/태그/아카이브/
  About 각각에 글 수·주제가 들어간 고유 설명을 넣었다
- **구조화 데이터(JSON-LD)**: 포스트 `BlogPosting`, 홈 `Blog`, About `Person`(경력/기술 스택/
  GitHub·Tistory `sameAs` 포함 — 이름 검색 대응)
- **사이트맵**: `@astrojs/sitemap`. `robots.txt`에서 사이트맵 위치를 알린다
- **thin content 제외**: 글이 0편인 카테고리는 `noindex`, `/search`는 결과가 클라이언트에서만
  그려지는 빈 껍데기라 `noindex` + `robots.txt` Disallow.
  **주의**: noindex 페이지를 사이트맵에 남기면 Search Console이 "Submitted URL marked noindex"로
  경고하므로, `astro.config.mjs`의 sitemap `filter`가 동일 기준으로 제외해 둘을 동기화한다
  (빈 카테고리 판별을 위해 config에서 `src/content/posts/`의 frontmatter를 직접 읽는다)
- **OG 이미지**: `public/og-image.png` (1200×630). 링크 공유 시 클릭률에 영향이 커서 사이트 톤에
  맞춘 정적 이미지를 만들어 넣었다
- **외부 프로필 연결**: GitHub·YouTube·Instagram·이전 Tistory 블로그를 `SITE.links`에 모아
  푸터에 노출하고, 같은 목록을 `SAME_AS`로 재사용해 schema.org `sameAs`에 넣었다 — 검색엔진이
  흩어진 프로필을 같은 인물로 묶는 데 쓰는 신호다

### 배포 후 남은 수동 작업 (사람이 해야 함)

기술적 준비는 끝났지만, 아래는 계정 소유자 인증이 필요해 코드로 대신할 수 없다.

1. [Google Search Console](https://search.google.com/search-console) 등록 → 소유권 확인 →
   `https://dltmddyd321.github.io/sitemap-index.xml` 제출
2. [네이버 서치어드바이저](https://searchadvisor.naver.com) 등록 + 사이트맵 제출 (국내 유입에는
   네이버 색인이 특히 중요)
3. 기존 Tistory 블로그(302편)에서 새 블로그로 링크를 걸어두면 크롤러 발견이 빨라진다

## Responsive rules

- 720px 이하: `.wrap` padding 축소, `nav` 항목 간격 축소, `about` hero/프로젝트 그리드 1열,
  `PostLayout` 사이드바가 본문 위로 이동(가로 flex-wrap)
- 모든 그리드는 `auto-fill`/`minmax` 또는 명시적 breakpoint 전환만 사용 — 고정 px 그리드로
  좁은 화면에서 가로 스크롤이 생기지 않도록 함

## Anti-pattern self-check

- 제네릭 SaaS 랜딩 아님 — 홈은 바로 글 목록
- 히어로에 스톡 이미지/장식 패널 없음 — 카피(kicker + h1)만, 버튼/CTA 없음
- 헤드라인 "기록하고, 다시 꺼내 쓰는 개발 노트."는 이 블로그의 실제 목적(재사용을 위한 기록)을
  말한 문장 — AI 특유의 "감성 조각 + 이탤릭 강조 단어" 캐던스 아님
- 플레이스홀더/가짜 카피 없음 — About 페이지는 실제 경력·프로젝트·성과 데이터 그대로 이전
- 중첩 카드 없음 — About의 성과 카드는 섹션당 1레벨
- 칩은 전부 구체적 정보(카테고리명, 기술 스택명, 날짜)를 담음 — "AI-powered"류 장식 배지 없음

## Assumptions

- 다크 테마 전용으로 시작 (라이트 토글, accent 컬러 선택 UI는 1차 범위 제외)
- 콘텐츠 관리: Markdown 파일 직접 작성, 별도 CMS 없음
- 배포: GitHub Pages + GitHub Actions (기존 legacy 브랜치 서빙 방식에서 전환)
- 댓글/다국어/커스텀 도메인은 1차 범위 밖 — 필요 시 후속 논의 (태그, 검색은 구현 완료)

## Verification run

- `npm run build` — 성공, `postbuild`(Pagefind 색인)까지 정상 실행
- 로컬 프리뷰로 `/`, `/posts/blog-launch`, `/about`, `/category/dev-log`, `/tags`, `/tag/astro`,
  `/search`, `/tistory` 브라우저 렌더링 확인 — 데스크톱(1200px)과 모바일(375px) 두 뷰포트 모두
  확인, 모든 페이지에서 가로 스크롤 없음(scrollWidth === clientWidth) 확인
- 검색: `npm run build && npm run preview`로 "Markdown" 검색 시 실제 결과 1건, 하이라이트·볼드
  타이틀 등 스타일 정상 적용 확인. `npm run dev`(색인 없음)에서는 안내 메시지로 정상 대체됨 확인
- 사이드바: 태그 `더보기` 토글은 임시로 임계값을 12→1로 낮춰 빌드해 실제 클릭으로 펼침/접힘,
  라벨 전환(`더보기 +N` ↔ `접기`), `aria-expanded` 변화까지 확인한 뒤 임계값을 되돌렸다
  (글이 1편뿐이라 태그가 2개여서 기본 상태로는 버튼이 렌더링되지 않음). 목록/글/About 페이지의
  사이드바 유무와 860px 스택 전환, 390px 가로 스크롤 없음도 확인
- SEO: 빌드 산출물에서 직접 검증 — 사이트맵 URL 목록(빈 카테고리·`/search` 제외 확인), 페이지별
  canonical이 서로 다름, meta description이 페이지마다 고유함, 빈 카테고리에만 `noindex` 적용,
  JSON-LD 3종(`BlogPosting`/`Blog`/`Person`)이 유효한 JSON으로 파싱되는지 확인. OG 이미지는
  1200×630 렌더링 결과를 눈으로 확인
- 폰트 로드 확인: `document.fonts`에서 `Pretendard Variable` status `loaded` 확인
- 색상 대비 계산: 위 표 참고, 전부 AA 통과
- 미검증/리스크: 코드 하이라이팅이 들어간 실제 포스트에서의 `pre`/`code` 가독성(현재는 샘플
  포스트에 코드 블록 없음), 스크린리더 대상 접근성 점검, 실기기(비-에뮬레이션) 렌더링, 글이
  많아졌을 때 Pagefind 다국어(한국어 stemming 미지원) 검색 품질은 아직 검증하지 않음
