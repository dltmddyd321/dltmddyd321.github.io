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

## 정리

- Figma 파일은 frame, text, instance로 이루어진 노드 트리이고 링크의 `node-id`가 그중 한 노드를 가리킵니다.
- 노드에는 크기와 위치 외에 Variables(토큰), Annotation, Component description이 붙어 있습니다.
- Figma MCP의 `get_metadata`는 트리 구조를, `get_design_context`는 참고 코드와 스크린샷, 에셋 URL을 돌려줍니다.
- 참고 코드는 React와 Tailwind라서 그대로 쓰지 않고 수치와 토큰 이름만 가져와 프로젝트의 리소스와 컴포넌트에 연결합니다.
- padding 합산, 아이콘 대조, 공유 리소스 수정, 폰트 대체처럼 반복해서 틀리는 지점은 Skill로 고정해 두는 편이 낫습니다.
