---
title: "Composio — AI 에이전트가 Gmail·Jira·드라이브를 쓰게 해 주는 연결 레이어"
description: "AI 에이전트에게 외부 앱 권한을 대신 쥐여 주는 Composio가 무엇인지 정리하고, 이걸로 만든 두 가지 자동화(아침 메일·Jira 요약, 번역 시트 → strings.xml 정리)를 소개합니다."
pubDate: 2026-10-14T05:40:00Z
category: ai-lab
tags: ["composio", "claude-code", "automation", "gmail", "jira", "android"]
aiPreview: "Composio는 Gmail·Jira·Google Drive 같은 앱의 로그인과 API 호출을 대신 맡아, AI 에이전트가 명령 한 줄로 외부 앱을 쓰게 해 주는 연결 서비스입니다. 설치와 계정 연결, 도구 찾기·실행 방법을 정리하고, 이걸로 만든 두 가지 결과물을 소개합니다. 하나는 매일 아침 내 Jira 이슈 현황과 메일 속 할 일을 한 통으로 보내 주는 요약 메일이고, 다른 하나는 번역 시트의 새 문구를 strings.xml에 바로 붙일 수 있는 형태로 정리해 주는 도구입니다. 세 서비스가 Composio를 중심으로 어떻게 엮였는지는 구조도로 보여 줍니다."
---

메일함을 열면 대부분 Jira 알림입니다. 이슈가 배정됐다, 누가 댓글을 달았다, 누가 나를 멘션했다. 같은 이슈 하나에 알림이 세 통씩 오기도 합니다. 정작 알고 싶은 건 "오늘 뭘 먼저 해야 하나"인데, 그걸 알려면 메일을 다 열어 보고 Jira에도 들어가 봐야 합니다.

번역도 비슷합니다. 다국어 문구는 구글 시트로 관리되는데, 새 행이 추가되면 그걸 보고 `strings.xml` 네 개(영어·한국어·일본어·중국어)에 손으로 옮겨야 합니다. 시트에는 키 이름이 없어서 한국어 문구로 기존 키를 하나하나 찾아야 하고요.

둘 다 "여러 앱을 오가며 같은 일을 반복한다"는 점이 같습니다. 이번에 Composio를 써서 이 두 가지를 자동화해 봤습니다.

## Composio가 뭔가

한 줄로 말하면 **AI 에이전트가 외부 앱을 쓸 수 있게 해 주는 연결 서비스**입니다.

Gmail API를 직접 쓰려면 꽤 많은 준비가 필요합니다. 클라우드 콘솔에서 프로젝트를 만들고, API를 켜고, OAuth 동의 화면과 클라이언트를 설정하고, 토큰이 만료되면 갱신하는 코드도 짜야 합니다. Jira를 붙이면 Jira대로, Slack을 붙이면 Slack대로 이 과정을 또 해야 합니다.

Composio는 이 부분을 대신 맡습니다. 각 앱에 한 번 로그인해 두면 토큰은 Composio 쪽에서 보관하고 갱신합니다. 앱마다 제각각인 API는 `GMAIL_FETCH_EMAILS`, `JIRA_GET_ISSUE` 같은 이름(slug)을 가진 **도구(tool)** 로 정리돼 있어서, 어느 앱이든 같은 방식으로 호출할 수 있습니다.

알아 두면 좋은 용어는 네 가지입니다.

- **Toolkit:** 앱 단위 묶음. `gmail`, `jira`, `googledrive`, `github` 같은 것
- **Tool:** 실제로 호출하는 기능 하나. `GMAIL_SEND_EMAIL`처럼 대문자 slug로 부름
- **Connected account:** 내 계정과 toolkit을 연결해 둔 것. 토큰이 여기에 묶임
- **Trigger:** 앱에서 일어난 이벤트(새 메일 등)를 받아 보는 기능

CLI, SDK, MCP 서버 형태로 제공되는데, 이번에는 터미널에서 바로 쓸 수 있는 CLI를 썼습니다.

## 사용 방법

설치는 스크립트 하나입니다.

```bash
curl -fsSL https://composio.dev/install | sh
composio login
```

`curl | sh`는 받은 스크립트를 바로 실행하는 방식이라, 저는 먼저 파일로 받아서 열어 봤습니다. HTTPS 주소만 허용하고 체크섬을 확인하며, 셸 설정 파일에는 PATH 한 줄만 추가하는 평범한 설치 스크립트였습니다. `composio login`은 브라우저로 대시보드에 로그인하면 끝납니다.

앱 연결은 `link`로 합니다.

```bash
composio link gmail
composio connections list   # 연결된 계정과 상태 확인
```

쓸 도구 이름을 모르면 `search`로 찾고, 입력값은 `--get-schema`로 확인한 뒤 `execute`로 실행합니다.

```bash
composio search "search jira issues with jql" --toolkits jira
composio execute JIRA_SEARCH_FOR_ISSUES_USING_JQL_GET --get-schema
composio execute GMAIL_FETCH_EMAILS -d '{ max_results: 5 }'
```

실제로 써 보면서 알게 된 점이 몇 가지 있습니다.

- **입력값 검증이 엄격합니다.** Jira API 문서대로 `maxResults`를 넣었더니 "`max_results`를 쓰라"며 바로 거절했습니다. 추측하지 말고 `--get-schema`부터 보는 게 빠릅니다.
- **결과가 크면 파일로 떨어집니다.** 메일 5통만 가져와도 19만 바이트가 넘었는데, 이때는 결과 대신 `storedInFile: true`와 파일 경로가 옵니다. 스크립트에서는 두 경우를 모두 처리해야 합니다.
- **toolkit은 생각보다 잘게 나뉩니다.** Google Drive는 연결돼 있었지만 Google Sheets는 별도 toolkit이라 시트를 바로 읽을 수 없었습니다. 그래서 Drive의 "파일 내보내기" 도구로 시트를 xlsx로 받아서 직접 읽었습니다.
- **권한 범위를 확인해야 합니다.** 로그인 직후 GitHub에서 "서드파티 앱에 repo, workflow 권한이 승인됐다"는 보안 알림이 왔습니다. Composio에 GitHub 계정으로 로그인하면서 붙은 권한인데, 메일 요약에는 필요 없는 범위입니다. 연결할 때마다 어떤 권한이 붙는지 한 번씩 봐 두는 게 좋습니다.

## 전체 구조

본론에 들어가기 전에 전체 그림부터 보겠습니다. 스크립트는 두 개이고, 둘 다 외부 앱에 직접 접근하지 않습니다. Gmail, Jira, Google Drive 세 서비스와의 연결은 모두 Composio 하나를 거칩니다. 요약을 쓰는 Claude는 Composio와 아예 연결되지 않습니다.

<figure style="margin: 32px 0; overflow-x: auto;">
<svg viewBox="0 0 720 470" role="img" aria-labelledby="composio-arch-title composio-arch-desc" style="display: block; width: 100%; min-width: 560px; height: auto; font-family: var(--font-sans);">
  <title id="composio-arch-title">Composio를 중심으로 한 자동화 구조</title>
  <desc id="composio-arch-desc">아침 요약 스크립트와 번역 시트 스크립트가 Composio를 통해 Gmail, Jira, Google Drive를 호출한다. 요약용 Claude는 도구 없이 아침 요약 스크립트와만 연결된다.</desc>
  <defs>
    <marker id="ca-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M0,0 L10,5 L0,10 Z" style="fill: var(--text-muted);"/>
    </marker>
    <marker id="ca-arrow-accent" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M0,0 L10,5 L0,10 Z" style="fill: var(--accent);"/>
    </marker>
  </defs>
  <!-- column labels -->
  <text x="120" y="22" text-anchor="middle" style="fill: var(--text-muted); font-size: 12px; letter-spacing: 0.08em;">내 맥 (스크립트)</text>
  <text x="360" y="22" text-anchor="middle" style="fill: var(--text-muted); font-size: 12px; letter-spacing: 0.08em;">연결 레이어</text>
  <text x="600" y="22" text-anchor="middle" style="fill: var(--text-muted); font-size: 12px; letter-spacing: 0.08em;">외부 서비스</text>
  <!-- script A: morning digest -->
  <text x="30" y="52" style="fill: var(--text-muted); font-size: 11px;">launchd · 매일 08:30</text>
  <rect x="20" y="60" width="200" height="84" rx="10" style="fill: var(--surface-2); stroke: var(--border); stroke-width: 1.5;"/>
  <text x="120" y="92" text-anchor="middle" style="fill: var(--text); font-size: 15px; font-weight: 700;">아침 메일·Jira 요약</text>
  <text x="120" y="114" text-anchor="middle" style="fill: var(--text-muted); font-size: 12px;">메일 가져오기 → 이슈 조회</text>
  <text x="120" y="131" text-anchor="middle" style="fill: var(--text-muted); font-size: 12px;">→ 요약 → 나에게 발송</text>
  <!-- Claude (no tools) -->
  <rect x="40" y="182" width="160" height="58" rx="10" style="fill: none; stroke: var(--text-muted); stroke-width: 1.2; stroke-dasharray: 5 4;"/>
  <text x="120" y="206" text-anchor="middle" style="fill: var(--text); font-size: 14px; font-weight: 700;">Claude (claude -p)</text>
  <text x="120" y="226" text-anchor="middle" style="fill: var(--text-muted); font-size: 12px;">도구 없음 · 글만 씀</text>
  <line x1="120" y1="146" x2="120" y2="178" style="stroke: var(--text-muted); stroke-width: 1.2; stroke-dasharray: 5 4;" marker-end="url(#ca-arrow)" marker-start="url(#ca-arrow)"/>
  <text x="128" y="166" style="fill: var(--text-muted); font-size: 11px;">메일 목록 ↔ 요약문</text>
  <!-- script B: translation sheet -->
  <text x="30" y="290" style="fill: var(--text-muted); font-size: 11px;">요청할 때 실행</text>
  <rect x="20" y="298" width="200" height="84" rx="10" style="fill: var(--surface-2); stroke: var(--border); stroke-width: 1.5;"/>
  <text x="120" y="330" text-anchor="middle" style="fill: var(--text); font-size: 15px; font-weight: 700;">번역 시트 정리</text>
  <text x="120" y="352" text-anchor="middle" style="fill: var(--text-muted); font-size: 12px;">시트 내려받기 → 변경 행 비교</text>
  <text x="120" y="369" text-anchor="middle" style="fill: var(--text-muted); font-size: 12px;">→ strings.xml 스니펫 발송</text>
  <!-- Composio hub -->
  <rect x="270" y="90" width="180" height="260" rx="14" style="fill: var(--accent-soft); stroke: var(--accent); stroke-width: 2;"/>
  <text x="360" y="130" text-anchor="middle" style="fill: var(--accent); font-size: 20px; font-weight: 800;">Composio</text>
  <line x1="292" y1="146" x2="428" y2="146" style="stroke: var(--accent-line); stroke-width: 1;"/>
  <text x="360" y="174" text-anchor="middle" style="fill: var(--text); font-size: 13px;">계정 토큰 보관·갱신</text>
  <text x="360" y="198" text-anchor="middle" style="fill: var(--text); font-size: 13px;">앱 API를 도구(slug)로 통일</text>
  <text x="360" y="222" text-anchor="middle" style="fill: var(--text); font-size: 13px;">입력값 스키마 검증</text>
  <rect x="292" y="250" width="136" height="70" rx="8" style="fill: var(--surface); stroke: var(--accent-line); stroke-width: 1;"/>
  <text x="360" y="272" text-anchor="middle" style="fill: var(--text-muted); font-family: var(--font-mono); font-size: 11px;">composio link</text>
  <text x="360" y="290" text-anchor="middle" style="fill: var(--text-muted); font-family: var(--font-mono); font-size: 11px;">composio search</text>
  <text x="360" y="308" text-anchor="middle" style="fill: var(--text-muted); font-family: var(--font-mono); font-size: 11px;">composio execute</text>
  <!-- scripts -> Composio -->
  <path d="M222,102 C246,102 246,150 266,150" style="fill: none; stroke: var(--accent); stroke-width: 1.8;" marker-end="url(#ca-arrow-accent)"/>
  <path d="M222,340 C246,340 246,290 266,290" style="fill: none; stroke: var(--accent); stroke-width: 1.8;" marker-end="url(#ca-arrow-accent)"/>
  <!-- apps -->
  <rect x="500" y="50" width="200" height="86" rx="10" style="fill: var(--surface-2); stroke: var(--border); stroke-width: 1.5;"/>
  <text x="600" y="80" text-anchor="middle" style="fill: var(--text); font-size: 15px; font-weight: 700;">Gmail</text>
  <text x="600" y="102" text-anchor="middle" style="fill: var(--text-muted); font-family: var(--font-mono); font-size: 10.5px;">GMAIL_FETCH_EMAILS</text>
  <text x="600" y="119" text-anchor="middle" style="fill: var(--text-muted); font-family: var(--font-mono); font-size: 10.5px;">GMAIL_SEND_EMAIL</text>
  <rect x="500" y="177" width="200" height="86" rx="10" style="fill: var(--surface-2); stroke: var(--border); stroke-width: 1.5;"/>
  <text x="600" y="207" text-anchor="middle" style="fill: var(--text); font-size: 15px; font-weight: 700;">Jira</text>
  <text x="600" y="229" text-anchor="middle" style="fill: var(--text-muted); font-family: var(--font-mono); font-size: 10.5px;">JIRA_SEARCH_..._JQL_GET</text>
  <text x="600" y="246" text-anchor="middle" style="fill: var(--text-muted); font-family: var(--font-mono); font-size: 10.5px;">JIRA_SEARCH_APPROXIMATE_COUNT</text>
  <rect x="500" y="304" width="200" height="86" rx="10" style="fill: var(--surface-2); stroke: var(--border); stroke-width: 1.5;"/>
  <text x="600" y="334" text-anchor="middle" style="fill: var(--text); font-size: 15px; font-weight: 700;">Google Drive</text>
  <text x="600" y="356" text-anchor="middle" style="fill: var(--text-muted); font-family: var(--font-mono); font-size: 10px;">GOOGLEDRIVE_GET_FILE_METADATA</text>
  <text x="600" y="373" text-anchor="middle" style="fill: var(--text-muted); font-family: var(--font-mono); font-size: 10.5px;">GOOGLEDRIVE_EXPORT_…_FILE</text>
  <!-- Composio -> apps -->
  <line x1="452" y1="140" x2="496" y2="93" style="stroke: var(--text-muted); stroke-width: 1.5;" marker-end="url(#ca-arrow)"/>
  <line x1="452" y1="220" x2="496" y2="220" style="stroke: var(--text-muted); stroke-width: 1.5;" marker-end="url(#ca-arrow)"/>
  <line x1="452" y1="300" x2="496" y2="347" style="stroke: var(--text-muted); stroke-width: 1.5;" marker-end="url(#ca-arrow)"/>
  <!-- who uses what -->
  <text x="474" y="156" text-anchor="middle" style="fill: var(--text-muted); font-size: 10px;">A·B</text>
  <text x="474" y="212" text-anchor="middle" style="fill: var(--text-muted); font-size: 10px;">A</text>
  <text x="474" y="316" text-anchor="middle" style="fill: var(--text-muted); font-size: 10px;">B</text>
  <!-- legend -->
  <line x1="20" y1="428" x2="52" y2="428" style="stroke: var(--accent); stroke-width: 1.8;"/>
  <text x="60" y="432" style="fill: var(--text-muted); font-size: 12px;">스크립트 → Composio 명령 호출</text>
  <line x1="250" y1="428" x2="282" y2="428" style="stroke: var(--text-muted); stroke-width: 1.5;"/>
  <text x="290" y="432" style="fill: var(--text-muted); font-size: 12px;">Composio → 앱 API (내 계정 토큰으로)</text>
  <line x1="520" y1="428" x2="552" y2="428" style="stroke: var(--text-muted); stroke-width: 1.2; stroke-dasharray: 5 4;"/>
  <text x="560" y="432" style="fill: var(--text-muted); font-size: 12px;">Composio를 거치지 않음</text>
  <text x="20" y="456" style="fill: var(--text-muted); font-size: 11px;">A = 아침 요약, B = 번역 시트 정리 · 결과 메일은 둘 다 Gmail 발송 도구로 나에게 보냄</text>
</svg>
<figcaption style="margin-top: 10px; font-size: 13px; color: var(--text-muted); text-align: center;">두 스크립트는 앱 API를 직접 부르지 않고 Composio 명령만 호출합니다. 앱별 로그인과 토큰은 Composio가 맡습니다.</figcaption>
</figure>

## 만든 것 1: 아침 메일·Jira 요약

매일 아침 8시 30분에 요약 메일 한 통이 옵니다. 내게 배정된 Jira 이슈 현황과, 지난 24시간 동안 받은 메일 중 할 일과 참고할 것을 한 번에 보여 줍니다.

| 단계 | 쓰는 것 | Composio 도구 |
| --- | --- | --- |
| 받은편지함 가져오기 | Gmail | `GMAIL_FETCH_EMAILS` |
| 내 이슈 조회 | Jira | `JIRA_SEARCH_FOR_ISSUES_USING_JQL_GET`, `JIRA_SEARCH_APPROXIMATE_COUNT` |
| 메일 요약 | Claude (`claude -p`) | 없음 |
| 나에게 발송 | Gmail | `GMAIL_SEND_EMAIL` |

받는 메일은 이런 모양입니다. (구조를 보여 주기 위한 가상 예시입니다.)

```text
[Jira 내 이슈]
재작업 필요 (1건)
- APP-1234 설정 화면 색상이 다크 모드에서 바뀌지 않음
진행 중 (0건)
테스트 대기 18건

[메일]
오늘은 APP-1234 재작업 건부터 챙기세요.

[할 일]
- APP-1234 ... 디자이너가 수정 범위를 댓글로 요청 (10/13 18:17) [재작업 필요]
[참고]
- APP-1230 ... 오늘 아침 배정됐지만 이미 완료 처리됨 (10/14 09:12) [완료]
- 테스트 빌드 6.x 배포 알림 (10/13 17:22)
```

메일함을 열어 Jira 알림을 하나씩 확인하던 일이 이 메일 한 통을 읽는 것으로 바뀌었습니다. 같은 이슈에 알림이 여러 통 와도 한 줄로 합쳐지고, 메일에 나온 이슈에는 지금 Jira 상태가 함께 붙습니다.

## 만든 것 2: 번역 시트 → strings.xml 정리

"번역 시트 정리해 줘"라고 하면, 구글 드라이브의 번역 시트에서 새로 생기거나 바뀐 행만 골라 안드로이드 프로젝트에 바로 붙일 수 있는 `<string>` 줄로 정리해 메일로 보내 줍니다.

| 단계 | 쓰는 것 | Composio 도구 |
| --- | --- | --- |
| 시트가 바뀌었는지 확인 | Google Drive | `GOOGLEDRIVE_GET_FILE_METADATA` |
| 시트 내려받기 | Google Drive | `GOOGLEDRIVE_EXPORT_GOOGLE_WORKSPACE_FILE` |
| 결과 발송 | Gmail | `GMAIL_SEND_EMAIL` |

결과는 로케일 4개(`values`, `values-ko`, `values-ja`, `values-zh`)별로 나뉘어 옵니다. (가상 예시입니다.)

````text
## 기존 키 값 변경 (1개)
### values/strings.xml
```xml
<string name="habit_added">Habit added</string>
```

## 신규 키 필요 (1개)
### values-ja/strings.xml
```xml
<string name="TODO_key_name">登録日</string>
```

## 번역 미확정 (1개)
- 시트 2098행: 다시 로그인 (빈 열: en, ja, zh)
````

- **기존 키 값 변경:** 한국어 문구로 프로젝트의 기존 키를 찾아, 실제 키 이름으로 채운 줄
- **신규 키 필요:** 기존 키가 없는 문구. 키 이름 자리만 비워 둡니다
- **번역 미확정:** 최종 번역이 아직 비어 있는 행

시트를 열어 바뀐 행을 찾고, 문구마다 기존 키를 검색하고, 네 파일에 옮겨 적던 일이 메일에서 복사해 붙여 넣는 것으로 줄었습니다.

## 고민한 것: 데이터가 어디를 지나가나

Composio를 쓰면 메일을 읽을 때마다 요청이 Composio 서버를 거치고, 내 계정 토큰도 그쪽에 저장됩니다. 지금 연결한 건 회사 메일과 Jira입니다.

Gmail API에 직접 연결하면 데이터가 Google과 내 맥 사이에서만 오가고, 권한도 "메일 읽기·보내기" 두 가지로 줄일 수 있습니다. 메일 요약 하나만 쓸 거라면 그쪽이 더 깔끔합니다. 다만 앱이 늘어날 때마다 이 연결 작업을 따로 해야 합니다.

저는 앞으로 여러 앱을 엮는 자동화를 계속 해 볼 생각이라 Composio를 유지하기로 했습니다. 대신 연결된 계정과 권한을 주기적으로 확인하고, 회사 계정을 외부 연동 서비스에 붙여도 되는지는 따로 확인해 둘 생각입니다. 하나 덧붙이면, 요약은 어느 방식이든 Claude가 하므로 메일 내용 일부가 AI 서비스로 가는 건 똑같습니다. Composio를 빼서 없어지는 건 중간 경로 하나뿐입니다.

## 정리

Composio가 해 준 건 "연결"입니다. 메일을 가져오고, Jira를 조회하고, 시트를 내려받고, 메일을 보내는 일을 앱마다 따로 공부하지 않고 같은 방식의 명령 한 줄로 할 수 있었습니다.

그 결과 두 가지가 생겼습니다. 매일 아침 메일함과 Jira를 대신 훑어 주는 요약 메일, 그리고 부르면 번역 시트의 새 문구를 strings.xml 형태로 정리해 주는 도구입니다. 둘 다 Gmail, Jira, Google Drive를 오가야 하는 일이었지만, 스크립트 쪽에서는 Composio 명령만 부르면 됐습니다. 다음에는 연결이 끊겨 있는 Slack을 다시 붙여서, 팀 채널 소식까지 아침 요약에 넣어 볼 생각입니다.
