---
title: "Figma 링크 하나로 AI가 디자인을 코드에 옮기는 원리"
description: "Figma 파일이 안에서 어떤 노드 트리로 되어 있는지, Figma MCP가 그걸 어떤 형태로 AI에게 넘기는지, 그리고 받은 웹 코드를 Android 코드로 옮길 때 자주 틀렸던 부분을 정리했습니다."
pubDate: 2026-10-13T09:00:00Z
category: ai-lab
tags: ["figma", "mcp", "claude-code", "android", "design-system"]
aiPreview: "Figma 파일은 frame, text, instance로 이루어진 노드 트리이고, 링크의 node-id가 그중 한 노드를 가리킵니다. 노드에는 크기와 위치 말고도 디자인 토큰(Variables), 디자이너 메모(Annotation), Component 설명이 붙어 있습니다. Figma MCP의 get_metadata는 트리 구조를, get_design_context는 React·Tailwind 참고 코드와 스크린샷, 에셋 URL을 돌려줍니다. AI는 여기서 수치와 토큰 이름만 가져와 프로젝트의 리소스와 컴포넌트에 연결합니다. padding 합산, 아이콘 대조, 공유 리소스 수정, 폰트 대체처럼 반복해서 틀리는 지점은 Skill로 고정해 두고 있습니다."
---

요즘 디자인 반영 작업은 대부분 Figma 링크를 AI에게 넘기는 것으로 시작합니다.
링크 하나만 줬는데 간격, 폰트, 색상 토큰까지 맞춰서 코드를 고쳐 오니 편하긴 합니다.
그런데 AI가 그 링크에서 정확히 무엇을 읽어 오는지는 막상 설명하기 어려웠습니다.
Figma 파일이 안에서 어떻게 생겼는지, Figma MCP가 그걸 어떤 형태로 넘겨주는지 정리해봅니다.

## Figma 파일은 노드 트리입니다

화면에서는 그림처럼 보이지만 Figma 파일의 실체는 노드(Node)들의 트리입니다.
HTML의 DOM이나 Android의 View 계층과 비슷하게 모든 요소가 부모와 자식으로 이어져 있습니다.

노드마다 고유 ID가 있습니다.
Figma 링크 끝에 붙는 `node-id=1234-5678`이 바로 그 ID이고 API에서는 `1234:5678`처럼 콜론으로 씁니다.

예를 들어 홈 화면에 붙는 D-day 위젯 디자인 하나를 열어보면 이런 구조입니다.

```
instance "Home Screen Widget / Date Countdown"  190×190
└ frame "Container"
  ├ frame "Background"
  └ frame "Content"  (padding 16)
    ├ frame "Header"
    │ ├ frame "Leading"
    │ │ ├ text "2024.10.10"
    │ │ └ text "디데이 이름"
    │ └ frame "Trailing"
    │   └ instance "Icon"
    └ frame "Countdown"
      └ text "D-100"
```

자주 보게 되는 노드 타입은 세 가지입니다.

- `frame`: 다른 노드를 담는 박스입니다. Auto Layout을 켜면 방향, padding, gap을 가지게 되고 Android의 LinearLayout이나 Compose의 Column, Row와 거의 같은 역할을 합니다.
- `text`: 글자입니다. 폰트, 크기, line height, 색을 가집니다.
- `instance`: 디자인 시스템에 정의된 Component를 가져다 쓴 복사본입니다. 원본 Component를 고치면 모든 instance에 같이 반영됩니다.

instance 안쪽 노드는 ID 모양이 조금 다릅니다.
`I1234:5678;6133:12671`처럼 생겼는데, "instance 1234:5678 안에 있는, 원본 Component의 6133:12671 노드"라는 뜻입니다.
같은 버튼 Component를 화면 열 곳에 써도 각각의 자식을 구분할 수 있는 이유입니다.

## 좌표 말고 붙어 있는 정보들

노드에는 위치와 크기 말고도 구현에 중요한 정보가 더 붙어 있습니다.

Variables는 디자인 토큰입니다.
색이나 간격을 `#080A0C`, `16`처럼 숫자로 박지 않고 `color/label/default`, `spacing/16` 같은 이름에 연결해 둡니다.
다크 모드나 테마가 바뀌면 이름은 그대로 두고 값만 바뀌는 구조입니다.

Annotation은 디자이너가 개발자에게 남기는 메모입니다.
위 위젯의 날짜 텍스트에는 "테마를 바꾸면 이 색은 테마의 label subtle 색을 따른다"는 Annotation이 붙어 있었습니다.
스크린샷만 봐서는 절대 알 수 없는 정보입니다.

Component description은 Component 자체에 달린 설명입니다.
사용 조건이나 플랫폼(Android 전용 등)이 적혀 있는 경우가 많습니다.

## Figma MCP가 하는 일

MCP(Model Context Protocol)는 AI가 외부 도구를 호출할 수 있게 해주는 규약입니다.
Figma가 공식 MCP 서버를 제공하고 Claude Code 같은 에이전트는 이 서버의 도구를 함수처럼 부릅니다.

AI는 디자인을 눈으로 보고 따라 그리지 않습니다.
링크에서 file key와 node ID를 뽑아 MCP 도구를 호출하고 구조화된 데이터를 받아서 읽습니다.

주로 쓰는 도구는 두 개입니다.

`get_metadata`는 위에서 본 노드 트리를 XML로 돌려줍니다.
노드 ID, 타입, 이름, 위치, 크기만 들어 있어서 화면 전체 구조를 훑거나 어느 노드를 자세히 볼지 고를 때 씁니다.

```xml
<instance id="1234:5678" name="Home Screen Widget / Date Countdown" width="190" height="190">
  <frame id="I1234:5678;6133:12668" name="Content" width="190" height="190">
    <frame id="I1234:5678;6133:12669" name="Header" x="16" y="16" width="158" height="40">
    ...
```

`get_design_context`가 실제 구현에 쓰는 도구입니다.
응답에는 세 가지가 함께 옵니다.

먼저 React와 Tailwind로 된 참고 코드가 옵니다.
노드 트리를 웹 코드로 옮긴 것인데, 여기에 토큰 이름과 실제 값, Annotation이 같이 들어 있습니다.

```tsx
<p
  className="text-[length:var(--font-size/24,24px)]
             leading-[var(--font-line-height/32,32px)]
             text-[color:var(--color/label/default,#080a0c)]"
  data-theme-annotations="theme-label-default"
>
  D-100
</p>
```

`var(--color/label/default,#080a0c)` 한 줄에서 토큰 이름과 기본값을 동시에 알 수 있습니다.
`data-theme-annotations`는 디자이너가 남긴 Annotation이 속성으로 따라온 것입니다.

다음으로 해당 노드의 스크린샷이 옵니다.
코드를 다 고친 뒤 결과와 비교하는 기준으로 씁니다.

마지막으로 아이콘이나 이미지 같은 에셋의 다운로드 URL이 옵니다.
이 URL은 일정 기간이 지나면 만료되기 때문에, 필요하면 바로 받아서 프로젝트에 넣어야 합니다.

## 웹 코드를 Android 코드로 옮기는 과정

받은 코드는 React지만 우리 앱은 Android입니다.
그래서 이 응답은 그대로 붙여넣는 코드가 아니라 "정확한 수치가 적힌 설계도"로 읽어야 합니다.

옮기는 과정은 대략 이렇습니다.

- Tailwind의 `flex flex-col`은 세로 방향 LinearLayout이나 Column으로, `justify-between`은 위아래로 밀어내는 배치로 바꿉니다.
- `p-[16px]`, `gap-[8px]`은 그대로 `16dp`, `8dp`가 됩니다.
- `color/label/default` 같은 토큰은 하드코딩하지 않고 프로젝트에 있는 같은 이름의 색상 리소스나 테마 속성에 연결합니다.
- `instance "Icon"`은 새로 그리지 않고 프로젝트에 이미 있는 drawable 중 같은 아이콘을 찾아 씁니다.

AI는 이 단계에서 Figma 응답만 보지 않습니다.
프로젝트 코드를 같이 검색해서 이미 있는 컴포넌트, 색상 리소스, 아이콘을 먼저 찾고 없을 때만 새로 만듭니다.
이걸 빠뜨리면 디자인은 똑같은데 프로젝트 규칙과는 따로 노는 코드가 나옵니다.

## 실제로 자주 틀렸던 부분

몇 달 동안 이 방식으로 작업하면서 반복해서 틀린 지점이 있었습니다.

부모와 자식 padding 합산을 놓치는 경우가 가장 많았습니다.
Header 아래에 padding 10, Content 위에 padding 10이 있으면 실제 간격은 20인데, 한쪽만 보고 10으로 넣는 식입니다.
트리를 위로 따라 올라가면서 모든 조상의 padding을 더해야 맞습니다.

아이콘 이름만 보고 고르는 것도 문제였습니다.
Figma의 `Info Filled`와 프로젝트의 `icon_info`가 이름은 비슷해도 모양이 다를 수 있습니다.
SVG path를 열어서 실제 모양을 비교해야 합니다.

여러 화면이 같이 쓰는 drawable을 이번 화면 디자인에 맞춰 고쳐버리는 실수도 있었습니다.
고치기 전에 그 리소스를 쓰는 곳이 몇 군데인지 먼저 찾아보고 여러 곳이면 이 화면 전용으로 새로 만드는 게 안전합니다.

폰트 굵기가 프로젝트에 없는 경우도 있습니다.
Figma는 Medium을 쓰는데 앱 폰트 리소스에 Medium이 없으면, 앱이 원래 쓰던 대체 규칙(예를 들어 Regular)을 따라야 합니다.

이런 실수는 AI 모델이 좋아진다고 저절로 없어지지 않았습니다.
그래서 틀렸던 사례를 그대로 규칙으로 적어 Figma 구현용 Skill로 만들어 두고 작업할 때마다 그 Skill을 먼저 읽게 하고 있습니다.

## Figma 구현 Skill 구성

Claude Code의 Skill은 마크다운 파일 하나입니다.
`~/.claude/skills/figma-implement/SKILL.md`에 두면 어느 프로젝트, 어느 브랜치에서든 불러올 수 있습니다.
처음에는 프로젝트 안에 뒀는데 브랜치마다 파일을 따로 머지해야 해서 개인 전역 위치로 옮겼습니다.

맨 위 frontmatter의 `description`이 언제 이 Skill을 쓸지 정합니다.
"Figma 반영해줘", "이거랑 똑같이 맞춰줘" 같은 요청이 들어오면 AI가 이 설명을 보고 Skill을 먼저 불러옵니다.

```markdown
---
name: figma-implement
description: Figma 노드 링크 또는 디자인 스크린샷을 받아 앱에 픽셀 단위로 정확하게 반영한다.
  사용자가 Figma 링크를 주며 "이 디자인 구현해줘", "Figma 반영해줘"라고 하거나,
  스크린샷을 주며 "이거랑 똑같이 맞춰줘"라고 요청할 때 사용한다.
  간격/폰트/색상을 추측하지 않고, 공유 리소스는 함부로 고치지 않는다.
---

## 목적
디자인이 유일한 진실 원천이고, 눈대중으로 "비슷하게" 맞추는 건 실패다.
```

본문은 입력 경로, 구현 규칙, 보고 형식 세 덩어리로 나눴습니다.

입력 경로는 두 가지입니다.
Figma 링크가 오면 `get_design_context`로 스펙을 받아 수치를 그대로 씁니다.
스크린샷만 오면 정확한 수치를 알 수 없으니 같은 화면에서 이미 쓰는 값을 재사용하고, 추정값으로 넣었다는 사실을 반드시 보고하게 했습니다.

```markdown
### 경로 A: Figma 노드 링크가 주어진 경우
1. get_design_context로 spacing, 폰트, 색상 토큰, radius, 아이콘을 가져온다.
   get_metadata나 get_screenshot만으로 대체하지 않는다.
2. 반환된 수치를 그대로 쓴다.
3. 부모와 자식이 각자 padding을 가진 구조를 놓치지 않는다.
   ("Header pb-10" + "Content pt-10" = 실제 간격 20dp)

### 경로 B: 스크린샷만 주어진 경우
- 현재 구현과 나란히 비교해 추가, 변경, 제거된 요소를 먼저 나눈다.
- 참조할 값이 없으면 4/8dp 그리드에 맞춰 추정하고,
  "정확한 스펙이 없어 추정값으로 반영했다"고 반드시 보고한다.
```

구현 규칙은 앞에서 말한 실수 하나당 규칙 하나입니다.
규칙마다 확인에 쓸 명령어까지 같이 적어 두면 AI가 실제로 그 명령을 돌려보고 판단합니다.

```markdown
### 색상: 프로토콜이 있으면 프로토콜, 없으면 정적 리소스
- 다크/라이트에 대응하는 런타임 색상 객체가 현재 브랜치에 실제로 있는지 먼저 확인한다.
  이전 세션 기억이나 다른 브랜치 경험으로 추측하지 않는다.
- 없으면 colors.xml에서 Figma hex와 정확히 같은 색을 찾고,
  알파가 있는 토큰은 #AARRGGBB로 환산한다.

### 공유 리소스는 함부로 고치지 않는다
grep -rl "<대상 drawable>" app/src/main/res/layout | wc -l
- 이 화면 한 곳에서만 쓰면 수정, 여러 곳이면 전용 drawable을 새로 만들고 보고한다.

### 아이콘은 이름만 보고 넘겨짚지 않는다
- 실제 svg path를 기존 drawable과 대조한다. 맞는 게 없으면 새로 그리지 말고 에셋을 요청한다.

### 폰트
- Figma가 Medium인데 폰트 리소스에 medium이 없으면 regular로 대체한다.
```

색상 규칙이 브랜치 확인부터 시작하는 이유가 있습니다.
테마 작업 브랜치에만 런타임 색상 객체가 있고 다른 브랜치에는 없는 기간이 있었습니다.
그런데 AI가 현재 브랜치에 그 객체가 있는지 확인하지 않고 작업을 진행하는 실수가 반복됐습니다.

마지막은 보고 형식입니다.
반영한 수치가 Figma 그대로인지 추정인지, 공유 리소스라서 건드리지 않은 항목이 있는지, 애매해서 보류한 항목이 무엇인지를 매번 같은 틀로 적게 했습니다.
이 보고를 보면 실기기에서 어디를 먼저 확인해야 할지 바로 알 수 있습니다.

새로 틀리는 사례가 나오면 그때그때 이 파일에 한 줄씩 더하고 있습니다.

## 정리

- Figma 파일은 frame, text, instance로 이루어진 노드 트리이고 링크의 `node-id`가 그중 한 노드를 가리킵니다.
- 노드에는 크기와 위치 외에 Variables(토큰), Annotation, Component description이 붙어 있습니다.
- Figma MCP의 `get_metadata`는 트리 구조를, `get_design_context`는 참고 코드와 스크린샷, 에셋 URL을 돌려줍니다.
- 참고 코드는 React와 Tailwind라서 그대로 쓰지 않고 수치와 토큰 이름만 가져와 프로젝트의 리소스와 컴포넌트에 연결합니다.
- padding 합산, 아이콘 대조, 공유 리소스 수정, 폰트 대체처럼 반복해서 틀리는 지점은 Skill로 고정해 두는 편이 낫습니다.
