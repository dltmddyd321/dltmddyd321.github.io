---
title: "OpenAI DevDay 2026 정리 - 일을 맡아서 하는 ChatGPT"
description: "9월 29일 열린 OpenAI DevDay 2026의 주요 발표를 정리했습니다. 24시간 일하는 에이전트 Dots, GPT-6.1 Sol, Ultrafast와 Pro 500, ChatGPT Space와 플러그인, 클라우드로 옮겨 간 Codex, Agents API와 Private Intelligence까지 다룹니다."
pubDate: 2026-10-02T01:40:00Z
category: insight
tags: ["AI", "OpenAI", "DevDay", "ChatGPT", "Codex"]
aiPreview: "OpenAI DevDay 2026은 ChatGPT가 대화 상대를 넘어 일을 맡아서 하는 방향을 보여 줬습니다. 대화 사이에도 일을 이어가는 에이전트 Dots, Astra에 가까운 성능을 1/5 가격에 내는 GPT-6.1 Sol, 초당 300토큰까지 빨라지는 Ultrafast와 Pro 500 플랜, 팀과 에이전트가 함께 쓰는 ChatGPT Space와 앱째로 들어가는 플러그인, 클라우드 전용이 된 Codex, Agents API 확장과 데이터를 보관하지 않는 Private Intelligence를 정리했습니다. 기사마다 다르게 보도된 가격과 사용 한도는 따로 표시했고, 글에 넣은 카드뉴스는 Claude로 만들었습니다."
---

9월 29일 샌프란시스코에서 OpenAI DevDay 2026이 열렸습니다.
발표가 20개를 넘었는데, 하나로 묶으면 ChatGPT가 대화 상대를 넘어 일을 맡아서 하는 쪽으로 가고 있다는 내용이었습니다.
주요 발표를 정리해봅니다.

![01 표지](/uploads/1790904630557-devday2026-01-main.png)

공식 리캡 페이지는 한국어판과 영문판 모두 접속이 막혀서 9to5Mac, Engadget 같은 매체 기사를 모아 정리했습니다.
ChatGPT 주간 사용자는 12억 명이라고 밝혔습니다.

## Dots

ChatGPT 안에서 24시간 돌아가는 에이전트입니다.
대화할 때만 일하는 게 아니라, 대화와 대화 사이에도 목표를 향해 작업을 이어갑니다.

![02 Dots](/uploads/1790904630557-devday2026-02-dots.png)

GPT-6 Astra 모델로 동작하고 전용 컴퓨터와 브라우저를 쓰며 4,000개 넘는 앱과 연결됩니다.
쓸수록 사용자의 선호와 기준을 배우고 Slack으로 일을 넘기거나 음성으로 대화할 수도 있습니다.
발표 당일부터 일부 사용자에게 먼저 풀렸습니다.

Pro와 Business Premium에는 Dot이 1개 기본 제공되고 더 필요하면 따로 사야 합니다.
Dot과의 대화는 ChatGPT 사용량에 포함되지 않습니다.
9to5Mac은 Pro 플랜에 사용 제한 없이 포함된다고 써서 기사마다 설명이 조금 다릅니다.

## GPT-6.1 Sol

GPT-6 Sol이 나온 지 1주일 만에 나온 후속 모델입니다.

![03 GPT-6.1 Sol](/uploads/1790904630557-devday2026-03-sol.png)

에이전트 코딩, 컴퓨터 사용, 전문 업무에서 GPT-6 Astra에 거의 맞먹는 성능을 내면서 가격은 Astra 토큰 가격의 1/5입니다.
캐시된 입력은 100만 토큰당 $0.10으로, 일반 입력보다 95%, GPT-6 Sol보다 50% 저렴합니다.

## Ultrafast와 Pro 500

Ultrafast는 요금제가 아니라 속도 옵션입니다.
Codex에서는 최대 8배 빠른 초당 300토큰, API에서는 최대 6배 빨라집니다.
지금은 GPT-6 Astra에서 쓸 수 있고 GPT-6.1 Sol용은 곧 나올 예정입니다.

![04 Ultrafast](/uploads/1790904630557-devday2026-04-ultrafast.png)

함께 나온 Pro 500 플랜은 Plus 사용량의 25배를 주고 Ultrafast가 포함됩니다.
여러 매체가 월 $500라고 보도했지만 OpenAI가 월 가격을 공식 발표하지 않았다는 기사도 있어서 공식 페이지에서 다시 확인이 필요합니다.

## ChatGPT Space와 플러그인

ChatGPT Space는 팀과 Dots가 함께 쓰는 협업 공간입니다.
pages라는 인터랙티브 문서에 차트, 이미지, 체크리스트, 대시보드를 넣을 수 있고 협업 슬라이드는 몇 주 안에 추가될 예정입니다.

![05 ChatGPT Space와 플러그인](/uploads/1790904630557-devday2026-05-workspace.png)

플러그인은 ChatGPT와 Codex 안에 에디터, 대시보드, 작업 공간 같은 앱 하나를 통째로 넣을 수 있게 바뀌었습니다.
사이드바, 인터랙티브 패널, 파일 뷰어를 지원하고 Plugin Creator라는 도구와 새 제출 절차가 나왔습니다.
대화 중에 알맞은 플러그인을 추천해 주도록 추천과 검색 순위도 손봤습니다.

## Codex

이제 클라우드에서만 돌아가므로 내 컴퓨터를 켜 두지 않아도 됩니다.
팀이 같이 쓰는 개발 환경을 저장해 두고 다시 쓸 수 있습니다.

![06 Codex](/uploads/1790904630557-devday2026-06-codex.png)

음성으로 작업을 시작할 수 있고 CLI가 개편되면서 여러 작업을 한 번에 맡기는 `/agents` 화면이 생겼습니다.
코드 리뷰는 ChatGPT 데스크톱에서 GitHub, GitLab과 연동됩니다.
Security Cloud는 저장소를 필요할 때나 정해진 일정에 따라 스캔하고 수정안까지 자동으로 준비해 줍니다.

## API와 개인정보 보호

Agents API에는 컴퓨터 사용, 멀티 에이전트, 도구 검색, 컨텍스트 압축이 추가됐습니다.
Decisions API는 며칠 안에 더 많은 사용자에게 열립니다.

![07 API와 프라이버시](/uploads/1790904630557-devday2026-07-api.png)

OpenAI Private Intelligence는 프리뷰로 나왔습니다.
데이터를 보관하지 않고(Zero Data Retention), 자동 안전 검토 내용도 OpenAI 직원이 볼 수 없게 합니다.
기밀 컴퓨팅을 쓰는 Private Inference는 2026년 가을에 나올 예정입니다.

Sign in with ChatGPT도 발표됐습니다.
Notion 같은 외부 앱에 ChatGPT 계정으로 로그인하고 ChatGPT 사용량을 그 앱에서도 쓰는 방식입니다.

![08 마무리](/uploads/1790904630557-devday2026-08-outro.png)

## 카드뉴스는 Claude로 만들었습니다

글에 넣은 카드뉴스는 Claude Code 한 세션에서 만들었습니다.
먼저 요약을 맡긴 뒤 같은 대화에서 카드뉴스로 바꿔 달라고 했습니다.

```text
https://openai.com/ko-KR/index/devday-2026-recap/
Chat GPT DevDay가 진행되었는데, 그에 대한 중요한 요약 사항들을 정리해줘
```

```text
이걸 우주 배경으로 한 인스타 카드 뉴스로 정리 가능해?
```

Claude가 Artifact 디자인 캔버스에 1080×1350 보드를 8개 깔고 장마다 HTML로 그렸고 PNG는 Chrome headless로 뽑았습니다.
처음 표지 제목은 "20개 넘는 발표, 꼭 알아야 할 6가지"였는데, 숫자로 압축한 티가 나서 다시 써 달라고 해서 지금 제목이 됐습니다.
인스타 스토리에 올릴 1080×1920 요약본도 따로 부탁했습니다.

![스토리 요약](/uploads/1790904630557-devday2026-00-story.png)

## 출처

- [DevDay 2026 Recap | OpenAI](https://openai.com/index/devday-2026-recap/)
- [9to5Mac](https://9to5mac.com/2026/09/29/openai-teases-20-announcements-at-devday-watch-live/)
- [Engadget](https://www.engadget.com/2271985/openai-dev-day-live-blog-chatgpt-news/)
- [AI Agents Library](https://www.aiagentslibrary.com/blog/openai-devday-2026/)
