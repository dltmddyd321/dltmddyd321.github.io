---
title: "Claude Code 사용 중, 한글 깨지는 현상 발생"
description: "Claude Code를 사용할 때, 간혹 한글이 깨지는 현상에 대해 아주 간단한 해결 방안을 정리해봅니다."
pubDate: 2026-08-24T08:21:02Z
category: ai-lab
tags: ["LLM", "AI", "Claude"]
---

![dddd.png](/uploads/1787559419290-dddd.png)

가끔 클로드 코드로 작업하다 보면 위와 같이 한글이 깨지는 경우가 있습니다.

클로드 코드(Claude Code)의 CLI 출력 스트리밍 과정에서 UTF-8 한글(3바이트) 멀티바이트 토큰이 비트 단위로 깨지거나 디코딩이 어긋나서 발생하는 현상입니다.

## 해결 방안 1.

이런 문제 방지하기 위해서 CLAUDE.md가 존재하는 것이기도 하죠.

# Language & Output Rules
- Always respond in clear, natural Korean.
- Ensure all Korean responses are fully formed and grammatically correct UTF-8 strings without token corruption.

위와 같이 명시해주고 나서는 확실히 줄어든 것을 확인할 수 있었습니다.

## 해결 방안 2.

터미널 환경변수 UTF-8 인코딩 고정
CLI 셸(~/.zshrc 또는 ~/.bashrc)에서 UTF-8 로케일이 비어있거나 불일치할 때 자주 발생합니다.

`# ~/.zshrc 에 추가
export LANG=ko_KR.UTF-8
export LC_ALL=ko_KR.UTF-8`
