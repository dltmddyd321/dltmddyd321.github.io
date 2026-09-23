---
title: "티켓 링크 하나로 크래시 원인까지 — 사내 Slack 에이전트 만들기"
description: "고객 지원 티켓 링크에 자동으로 크래시 검색 결과를 붙여주는 단순 자동화에서, 실제 크래시 데이터를 읽고 진단까지 써주는 에이전트로 넘어간 과정을 정리했습니다."
pubDate: 2026-09-22T06:30:00Z
category: ai-lab
tags: ["claude-code", "slack", "zendesk", "firebase", "automation"]
aiPreview: "고객 지원 티켓 링크가 올라올 때마다 사용자 ID를 복사해 크래시 리포팅 콘솔에서 검색하는 반복 업무를, Slack Link Unfurl 기능으로 자동화했습니다. 여기까지는 정규식과 REST API 호출뿐인 순수 자동화였는데, 한 단계 더 나아가 실제 크래시 데이터를 BigQuery로 읽고 티켓 문의 내용과 대조해 진단 문장을 만드는 에이전트로 확장했습니다. 그 과정에서 필요한 GCP/Slack 권한 조건들과, 판단이 필요한 지점과 필요 없는 지점을 어떻게 나눴는지를 정리했습니다."
---

사내에는 "이슈문의" 계열 채널이 몇 개 있습니다. 고객 지원 티켓 시스템(Zendesk)에서 티켓이 생기면, 담당자가 그 링크를 채널에 공유하면서 도움을 요청합니다. 그런데 링크만 봐서는 뭐가 문제인지 알 수가 없습니다. 실제 원인을 보려면 그 사용자의 크래시 로그를 봐야 하는데, 절차가 매번 똑같습니다. 티켓을 열어서 사용자 식별자(User ID)를 확인하고 크래시 리포팅 콘솔(Firebase Crashlytics)로 가서 그 값을 검색합니다. 별로 어려운 일은 아니지만, 하루에도 몇 번씩 반복하다 보면 그 자체가 업무 시간을 갉아먹습니다.

이 반복을 없애기로 했습니다. 처음엔 그냥 링크에 검색 결과를 붙여주는 봇으로 시작했고, 나중엔 실제 크래시 데이터를 읽고 진단까지 써주는 에이전트로 넘어갔습니다. 그 과정을 정리합니다.

## 1단계: API 호출만으로 끝나는 자동화

첫 버전은 AI가 하나도 안 들어갑니다. Slack의 Link Unfurl 기능을 썼습니다.

동작은 이렇습니다. 누군가 채널에 티켓 링크를 붙여넣으면, Slack이 그 도메인이 우리 앱의 unfurl 대상으로 등록돼 있는 걸 보고 `link_shared` 이벤트를 우리 서버로 보냅니다. 서버는 그 이벤트에서 티켓 번호를 뽑아 Zendesk API로 티켓을 조회하고 커스텀 필드 중 User ID 값을 꺼냅니다. 그 값으로 Crashlytics 콘솔 검색 URL을 문자열로 조립해서 Slack의 `chat.unfurl` API로 원래 메시지 밑에 카드 형태로 붙여줍니다.

여기까지는 판단이랄 게 없습니다. 정규식으로 링크를 걸러내고 REST API 두 번 호출하고 템플릿에 값을 끼워 넣는 게 전부입니다. 대신 빠르고 거의 공짜입니다.

이 단계에서 미리 알아야 할 조건들이 있습니다.

- Slack 쪽: 앱에 `links:read`, `links:write` 봇 스코프가 있어야 하고 App Unfurl Domains에 대상 도메인을 등록해야 `link_shared` 이벤트가 옵니다. 워크스페이스 설정에 따라 앱 설치 자체가 관리자 승인 대상일 수 있습니다.
- 서버(웹훅 수신처) 쪽: 서버리스 함수(2세대 Cloud Functions 기준)로 배포하려면 그 프로젝트에 결제 계정이 연결돼 있어야 하고 빌드에 필요한 API들(Cloud Build, Cloud Run, Artifact Registry, Eventarc)이 활성화돼 있어야 합니다. 그리고 배포하는 계정 본인에게 `iam.serviceAccountUser` 권한이 있어야 합니다 — 프로젝트에 넓은 `Editor` 권한이 있어도 이 권한은 별도로 필요합니다. 함수가 빌드될 때 대신 쓰는 서비스 계정을 "내가 이 계정을 대신 써도 된다"고 명시적으로 허락받아야 하는 구조이기 때문입니다.
- 시크릿 관리 쪽: Secret Manager에 값을 등록하는 것과 그 값을 읽는 것은 별개 권한입니다. `Editor` 역할은 시크릿을 만들고 관리할 순 있어도 실제 값을 읽는 권한(`secretmanager.versions.access`)은 기본으로 갖고 있지 않습니다. 배포 시 시크릿을 함수의 환경변수로 주입하려면, 함수가 실행에 쓰는 서비스 계정에 그 시크릿에 대한 접근 권한을 별도로 부여해야 합니다.
- Slack 서명 검증은 필수입니다. 함수는 외부에서 인증 없이 호출 가능한 상태로 열어둬야 하는데(Slack이 GCP 계정으로 인증하는 게 아니라서), 대신 요청에 실린 Slack 서명을 매번 검증해서 신뢰할 수 없는 호출은 아무 작업도 하지 않고 즉시 걸러냅니다.

이 조건들만 맞으면 배포 자체는 어렵지 않습니다. 실제로 걸리는 부분은 대부분 권한 쪽입니다.

## 2단계: 에이전트로 넘어가기

링크만 주는 걸로도 충분히 만족스러웠지만, 한 발 더 나가보기로 했습니다. 링크를 누르고 들어가서 검색하고 목록을 훑어보는 것도 결국 사람이 하는 일입니다. 그 대신 크래시 목록을 미리 읽어서 "지금 이런 문제들이 있고, 티켓 문의 내용이랑 가장 관련 있어 보이는 건 이거다"까지 판단해서 알려주면 그 단계도 줄어듭니다.

이때부터 진짜 AI가 들어갑니다. 구조는 이렇게 바뀝니다.

1. Crashlytics의 크래시 데이터를 BigQuery로 내보내도록 연동합니다. 링크만 만들 땐 필요 없었지만, 실제 크래시 목록을 코드가 읽으려면 구조화된 데이터가 필요합니다.
2. 함수는 이제 1단계처럼 링크만 조립하는 대신, 그 User ID로 최근 크래시 목록(예외 종류, 발생 횟수, 앱 버전)을 BigQuery에서 쿼리합니다.
3. 그 목록과 티켓의 문의 내용(자연어)을 LLM에 같이 넘깁니다. LLM은 "이 사용자가 최근 겪은 예외들 중 어떤 게 이 문의와 관련 있어 보이는가"를 판단해서 짧은 진단 문장을 만듭니다.
4. 그 진단을 스레드 답장으로 채널에 남깁니다.

여기서 추가로 필요한 조건이 하나 더 생깁니다. Crashlytics를 BigQuery로 내보내려면 그 Firebase 프로젝트가 종량제(Blaze) 요금제여야 합니다. 무료 요금제(Spark) 프로젝트에서는 애초에 이 연동 자체가 뜨지 않습니다. 이미 결제가 활성화된 프로젝트라면 상관없지만, 사이드 프로젝트처럼 결제를 안 걸어둔 프로젝트에서 시도하면 이 지점에서 막힙니다.

구조도 하나 바꿔야 했습니다. 1단계는 이벤트를 받고 몇 초 안에 응답을 끝냈는데, BigQuery 쿼리와 LLM 호출까지 더하면 Slack이 이벤트 처리 완료로 인정해주는 시간(3초 안팎)을 넘길 수 있습니다. 그래서 두 단계로 쪼갰습니다. 링크 미리보기는 지금처럼 즉시 붙이고, AI 진단은 비동기로 처리해서 준비되는 대로 스레드에 따로 남기는 식입니다. 사용자 입장에선 링크 밑에 카드가 먼저 뜨고 몇 초 뒤에 봇의 분석 답글이 이어서 달리는 것처럼 보입니다.

한 가지는 처음부터 정해두고 시작했습니다. LLM이 내놓는 진단은 항상 "AI 추정"이라고 표시하고, 원본 데이터로 확인할 수 있는 링크를 같이 붙입니다. 진단이 틀렸을 때 그 말만 믿고 엉뚱한 곳을 고치는 것보다는, 안 믿고 원본을 한 번 더 보는 게 훨씬 낫습니다.

## 실제로 이렇게 뜬다

채널에 티켓 링크를 붙이면 이런 식으로 흘러갑니다. (실제 화면이 아니라 가상 데이터로 만든 예시입니다.)

<figure style="margin: 32px 0;">
<div style="max-width: 620px; margin: 0 auto; background: #FFFFFF; border-radius: 12px; box-shadow: 0 1px 2px rgba(0,0,0,0.08), 0 10px 24px rgba(0,0,0,0.12); overflow: hidden; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1D1C1D;">
  <div style="height: 44px; display: flex; align-items: center; gap: 8px; padding: 0 18px; border-bottom: 1px solid #E8E8E8;">
    <span style="font-size: 16px; font-weight: 700; color: #616061;">#</span>
    <span style="font-size: 14px; font-weight: 700; color: #1D1C1D;">이슈문의-android</span>
  </div>
  <div style="padding: 18px; display: flex; flex-direction: column; gap: 18px;">
    <div style="display: flex; gap: 10px; align-items: flex-start;">
      <div style="width: 32px; height: 32px; border-radius: 7px; background: #2EB67D; color: #FFFFFF; flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700;">민</div>
      <div style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px;">
        <div style="display: flex; align-items: baseline; gap: 8px;">
          <span style="font-size: 14px; font-weight: 900;">김민수</span>
          <span style="font-size: 11px; color: #616061;">오후 2:14</span>
        </div>
        <div style="font-size: 14px; line-height: 1.5;">이거 고객 문의 좀 봐주세요</div>
        <a href="#" style="font-size: 14px; color: #1264A3; text-decoration: none; word-break: break-all;">https://support.example.com/agent/tickets/102384</a>
        <div style="margin-top: 6px; max-width: 360px; border: 1px solid #E8E8E8; border-left: 4px solid #F5A623; border-radius: 4px; padding: 9px 11px; display: flex; flex-direction: column; gap: 4px;">
          <span style="font-size: 14px; font-weight: 700; color: #1264A3;">Crashlytics 검색 · user id 88214</span>
          <span style="font-size: 12px; color: #616061; line-height: 1.4;">로그인 후 홈 화면 진입 시 앱이 자꾸 꺼져요</span>
          <div style="margin-top: 3px; display: flex; align-items: center; gap: 6px;">
            <div style="width: 12px; height: 12px; border-radius: 3px; background: #FFA000; flex-shrink: 0;"></div>
            <span style="font-size: 10px; letter-spacing: 0.3px; color: #868686;">CONSOLE.FIREBASE.GOOGLE.COM</span>
          </div>
        </div>
        <div style="margin-top: 4px; display: flex; align-items: center; gap: 6px;">
          <div style="width: 18px; height: 18px; border-radius: 5px; background: #4A154B; flex-shrink: 0; display: flex; align-items: center; justify-content: center;">
            <svg viewBox="0 0 24 24" width="10" height="10"><path d="M12 2 L14 10 L22 12 L14 14 L12 22 L10 14 L2 12 L10 10 Z" fill="#FFFFFF"/></svg>
          </div>
          <span style="font-size: 12px; font-weight: 700; color: #1264A3;">1개의 답글</span>
          <span style="font-size: 11px; color: #616061;">마지막 답장 1분 전</span>
        </div>
      </div>
    </div>
    <div style="display: flex; gap: 10px; align-items: flex-start;">
      <div style="width: 32px; height: 32px; border-radius: 7px; background: #4A154B; flex-shrink: 0; display: flex; align-items: center; justify-content: center;">
        <svg viewBox="0 0 24 24" width="18" height="18"><path d="M12 2 L14 10 L22 12 L14 14 L12 22 L10 14 L2 12 L10 10 Z" fill="#FFFFFF"/></svg>
      </div>
      <div style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 7px;">
        <div style="display: flex; align-items: baseline; gap: 8px;">
          <span style="font-size: 14px; font-weight: 900;">크래시 분석봇</span>
          <span style="font-size: 9px; font-weight: 700; color: #616061; background: #F2F2F2; border-radius: 3px; padding: 1px 5px;">APP</span>
          <span style="font-size: 11px; color: #616061;">오후 2:14</span>
        </div>
        <div style="font-size: 14px; line-height: 1.5;">이 user id의 최근 7일 크래시 3건을 확인했습니다.</div>
        <ul style="margin: 0; padding-left: 16px; font-size: 13px; line-height: 1.6;">
          <li>NullPointerException — HomeActivity.onResume (2건, 6.3.15)</li>
          <li>OutOfMemoryError — CalendarView.render (1건, 6.3.14)</li>
        </ul>
        <div style="font-size: 14px; line-height: 1.5;">티켓 문의(&ldquo;홈 화면 진입 시 꺼짐&rdquo;)와 가장 관련 있어 보이는 건 HomeActivity.onResume의 NPE입니다. 6.3.15 업데이트 이후 발생.</div>
        <div style="display: flex; gap: 7px; align-items: flex-start; background: #FFF8E6; border: 1px solid #F5D48A; border-radius: 6px; padding: 9px 11px;">
          <svg viewBox="0 0 24 24" width="14" height="14" style="flex-shrink: 0; margin-top: 2px;">
            <path d="M12 3 L22 20 L2 20 Z" fill="none" stroke="#B7791F" stroke-width="2" stroke-linejoin="round"/>
            <line x1="12" y1="9" x2="12" y2="14" stroke="#B7791F" stroke-width="2" stroke-linecap="round"/>
            <circle cx="12" cy="17" r="1" fill="#B7791F"/>
          </svg>
          <div style="display: flex; flex-direction: column; gap: 3px;">
            <span style="font-size: 12px; color: #7A5B12; line-height: 1.5;">AI 추정입니다 — 정확한 원인은 Crashlytics 원본에서 직접 확인하세요.</span>
            <a href="#" style="font-size: 12px; font-weight: 700; color: #1264A3; text-decoration: underline;">Firebase Console에서 보기 →</a>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
<figcaption style="text-align: center; font-size: 13px; color: #888; margin-top: 10px;">실제 화면이 아닌 가상 데이터로 구성한 예시입니다.</figcaption>
</figure>

첫 카드는 1단계(unfurl)가 만들고, 그 아래 봇 답글은 2단계(에이전트)가 만듭니다. 같은 파이프라인 안에 결정론적인 부분과 AI가 판단하는 부분이 섞여 있는 셈입니다.

## 정리

이걸 "AI로 문제를 해결했다"고 부를 수 있을까요. 배포된 시스템만 놓고 보면 반은 맞고 반은 틀립니다. 링크를 붙이는 부분은 처음부터 끝까지 AI가 없습니다. 정규식과 REST API 호출뿐입니다. 진짜 판단이 들어가는 건 크래시 목록과 문의 내용을 대조해서 진단을 만드는 마지막 한 단계뿐입니다.

그런데 이 나머지를 만드는 과정 자체는 AI 없이는 훨씬 오래 걸렸을 겁니다. 코드베이스에서 필요한 값들을 찾아내고 권한 문제를 하나씩 짚어가고, 코드를 쓰고 검증하는 것까지 대화 몇 번으로 끝났습니다. 그러니 "AI가 실시간으로 판단해서 답을 준다"보다는 "반복 업무를 없애는 자동화를, AI 페어프로그래밍으로 빠르게 만들었다" 쪽이 지금 이 시스템을 더 정확하게 설명하는 말입니다. 판단이 필요한 지점에는 AI를 넣고 필요 없는 지점(링크 매칭, API 호출, 서명 검증)은 그냥 코드로 남겨두는 것 — 그 경계를 정확히 긋는 게 이번 작업에서 제일 중요했던 부분입니다.
