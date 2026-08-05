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

**Secondary accent: 없음.** 카테고리 4종을 색상이 아니라 라벨(칩)로 구분하므로 별도 보조
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

- `BaseLayout` — 헤더(로고/nav), 터미널풍 status line, footer
- `PostLayout` — 포스트 헤더 + 사이드바(날짜/카테고리/태그) + 본문 2컬럼 그리드
- `PostRow` — 목록/카테고리 페이지 공용 글 목록 행
- 페이지: `/`(목록), `/posts/[slug]`, `/category/[category]`, `/about`, `/tistory`, `/rss.xml`

### `/tistory` — 예전 글 아카이브

이 블로그 이전에 [Tistory(yongdragon9819.tistory.com)](https://yongdragon9819.tistory.com)에 쓴
글 302편의 색인 페이지. 전체 마이그레이션 대신, 제목·날짜·원문 링크만 정적 데이터
(`src/data/tistory-archive.json`)로 만들어 연도별로 그룹핑해 보여주고 클릭 시 Tistory 원문으로
이동한다. 데이터는 Tistory `/category?page=N` 목록 페이지의 JSON-LD(`ListItem`) 구조화 데이터를
빌드 시점에 한 번 수집해 만든 정적 스냅샷이며, 이후 새 글이 이 블로그로 이어지므로 주기적 재수집은
필요 없다. 302개 목록은 `$ grep -i` 스타일의 클라이언트 사이드 텍스트 검색(바닐라 JS)으로
탐색성을 보완했다.

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
- 댓글/검색/다국어/커스텀 도메인은 1차 범위 밖 — 필요 시 후속 논의

## Verification run

- `npm run build` — 성공 (7 페이지 생성)
- 로컬 프리뷰(`npm run dev`)로 `/`, `/posts/blog-launch`, `/about`, `/category/dev-log` 브라우저
  렌더링 확인 — 데스크톱(1200px)과 모바일(375px) 두 뷰포트 모두 확인, 375px에서 가로 스크롤
  없음(scrollWidth === clientWidth) 확인
- 폰트 로드 확인: `document.fonts`에서 `Pretendard Variable` status `loaded` 확인
- 색상 대비 계산: 위 표 참고, 전부 AA 통과
- 미검증/리스크: 코드 하이라이팅이 들어간 실제 포스트에서의 `pre`/`code` 가독성(현재는 샘플
  포스트에 코드 블록 없음), 스크린리더 대상 접근성 점검, 실기기(비-에뮬레이션) 렌더링은
  아직 실행하지 않음
