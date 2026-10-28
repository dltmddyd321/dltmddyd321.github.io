---
title: "Cloudflare security-audit-skill 노트"
description: "코딩 에이전트를 보안 감사자로 만드는 Cloudflare의 security-audit-skill을 설치하고 구조와 원칙을 짧게 정리했습니다."
pubDate: 2026-10-28T02:40:00Z
category: ai-lab
tags: ["security", "agent", "claude-code", "skill"]
aiPreview: "Cloudflare가 공개한 security-audit-skill은 정찰, 커버리지 기반 탐색, 후보 검증, 구조화 출력, 독립 재검증, 보고서의 여섯 단계로 에이전트가 보안 감사를 하게 만듭니다. 찾은 에이전트와 검증하는 에이전트를 분리하고, 확신이 없는 결과는 needs_validation으로 남기는 설계가 눈에 띕니다. 모바일 앱의 딥링크, WebView, exported 컴포넌트도 다루지만 토큰 비용이 커서 보안 경계에 닿는 작업 때만 범위를 좁혀 돌리기로 했습니다."
---

Cloudflare가 공개한 [security-audit-skill](https://github.com/cloudflare/security-audit-skill)을 설치해 봤습니다. 코딩 에이전트에 붙이면 에이전트가 보안 감사를 하도록 만드는 스킬입니다. Cloudflare가 [Build your own vulnerability harness](https://blog.cloudflare.com/build-your-own-vulnerability-harness)에서 소개한 취약점 탐지 하네스가 이 스킬에서 시작됐고 저장소에 올라온 건 그 하네스의 단일 저장소용 출발점입니다.

## 여섯 단계

감사는 여섯 단계로 진행됩니다.

1. **정찰**: 아키텍처, 신뢰 경계, 입력 지점을 정리해 `architecture.md`와 `coverage-ledger.json`을 만듭니다.
2. **커버리지 기반 탐색**: ledger의 단위마다 서로 격리된 hunter 에이전트를 붙이고 빠진 곳은 critic 에이전트가 찾습니다.
3. **후보 검증**: 찾은 후보를 새 verifier 에이전트에게 넘겨 반박해 보게 합니다.
4. **구조화 출력**: 결과를 `confirmed`, `needs_validation`, `rejected`로 나눠 `findings.json`에 쓰고 스키마로 검사합니다.
5. **독립 재검증**: 최종 기록의 근거를 또 다른 에이전트가 다시 확인합니다.
6. **보고서**: 검증된 기록만으로 `REPORT.md` 같은 문서를 만듭니다.

## 눈에 띈 원칙

README의 설계 원칙 중 몇 개가 마음에 들었습니다.

- 찾은 에이전트와 검증하는 에이전트가 절대 같지 않습니다.
- 심각도는 체크리스트 위반이 아니라 발생 가능성과 영향으로 매깁니다.
- 앞단에서 이미 막히는 공격이라면 뒷단 방어가 없어도 취약점이 아니라 hardening 메모로 남깁니다.
- 대상 코드를 실행하려면 네트워크가 막힌 OS 수준 샌드박스가 있어야 하고 없으면 실행하지 않고 `needs_validation`으로 둡니다.
- 한 번 돌리면 반복 실행으로 찾은 전체 취약점의 절반 정도만 나왔다고 합니다. 그래서 실행 결과가 누적되도록 설계했습니다.

AI가 그럴듯한 취약점을 만들어내는 문제를 구조로 막으려는 게 보입니다. 확신이 없는 건 확신이 없다고 남기게 되어 있습니다.

## 모바일 앱에 쓸 만한가

공격 유형 문서가 영역별로 나뉘어 있는데, 그중 `DESKTOP-MOBILE-AND-LOCAL-IPC.md`가 딥링크, WebView, exported 컴포넌트 같은 Android 앱의 주요 공격면을 다룹니다. 서명이나 릴리스 설정은 `SUPPLY-CHAIN-AND-RELEASE.md`에서 봅니다. 모바일 앱에도 바로 쓸 수 있는 범위입니다.

다만 전체 감사는 에이전트를 여러 개 병렬로 띄우는 구조라 토큰을 많이 씁니다. 그래서 저는 매번 돌리지 않기로 했습니다. 딥링크나 App Link 처리, 토큰, 결제, 서명 설정처럼 보안 경계에 닿는 작업을 했을 때만 에이전트가 범위를 좁힌 감사를 제안하게 하고 실행은 제가 승인할 때만 합니다.

설치는 한 줄입니다.

```bash
npx skills add https://github.com/cloudflare/security-audit-skill \
  --skill security-audit \
  --global
```

아직 실제 감사를 끝까지 돌려보지는 않았습니다. 돌려보면 결과를 따로 정리하겠습니다.
