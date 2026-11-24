---
title: "Pleos Connect란? 플랫폼과 테스트 환경"
description: "현대자동차그룹의 차량용 인포테인먼트 플랫폼 Pleos Connect가 무엇인지, 어떤 SDK를 제공하는지, 그리고 차 없이 앱을 테스트하려면 어떤 에뮬레이터 환경을 갖춰야 하는지 정리했습니다."
pubDate: 2026-11-24T12:40:00Z
category: insight
tags: ["pleos", "android-automotive", "aaos", "android"]
series: pleos-connect
seriesOrder: 1
aiPreview: "Pleos Connect는 현대자동차그룹의 차세대 인포테인먼트로, Android Automotive OS 위에 차량 전용 SDK(Vehicle, NaviHelper, Fused Location, STT·TTS 등)를 얹은 플랫폼입니다. 휴대폰 앱과 달리 화면 왼쪽은 운전 정보가 고정이고, 차량 데이터는 pleos.car.permission 권한으로 받습니다. 차 없이 개발하려면 Pleos Connect Emulator v2.1.0(API 34, Automotive)을 쓰고, Virtual Console로 기어·도어·좌석 값을 바꿔 가며 확인합니다. 에뮬레이터로 확인할 수 없는 것(제어 값 반영, 시동 OFF, 일부 서버 기능)도 함께 정리했습니다."
---

올해 가을 현대자동차그룹 차량용 앱 개발 공모전에 참가하면서 Pleos Connect로 앱을 처음 만들어 봤습니다.
안드로이드로 만들지만 휴대폰 앱과는 신경 쓸 부분이 꽤 달랐고 아직 참고할 자료도 많지 않았습니다.
그래서 무엇을 만들었는지보다 플랫폼과 SDK를 직접 써 본 내용 위주로 시리즈를 남겨 봅니다.
이번 글은 Pleos Connect가 어떤 플랫폼인지와 테스트 환경 이야기입니다.

## Pleos와 Pleos Connect

Pleos는 현대자동차그룹이 소프트웨어 중심 자동차(SDV)를 위해 내놓은 소프트웨어 브랜드입니다.
그중 차 안의 화면, 즉 인포테인먼트 시스템을 맡는 것이 Pleos Connect입니다.
첫 탑재 차종은 신형 그랜저이고 현대자동차그룹은 2030년까지 약 2,000만 대에 Pleos Connect를 적용하겠다고 밝혔습니다.

개발자 입장에서 가장 먼저 알아 둘 점은 Pleos Connect가 Google의 Android Automotive OS(AAOS) 위에 만들어졌다는 것입니다.
그래서 앱은 평소처럼 Android Studio에서 Kotlin으로 만들고 Compose도 그대로 씁니다.
여기에 Pleos가 제공하는 차량 전용 SDK를 붙여 차량 데이터와 기능을 사용합니다.
공식 문서도 AAOS에 같은 기능이 있으면 그 방식에 맞춘다는 정책을 밝히고 있습니다.

## 휴대폰 앱과 다른 점

### 화면을 혼자 쓰지 않습니다

화면 왼쪽에는 속도, 기어, 차량 상태를 보여 주는 운전 정보 영역(Driving View)이 항상 떠 있고 아래에는 공조와 앱 바가 있습니다.
내 앱은 남은 영역에만 그려집니다.
운전자가 내비와 화면을 나눠 쓰면 앱 영역은 절반으로 줄어들기 때문에 반응형 레이아웃이 사실상 필수였습니다.

### 차량 데이터는 권한으로 받습니다

기어, 도어, 좌석 같은 차량 정보는 `pleos.car.permission.*` 권한을 선언해야 읽을 수 있습니다.
대부분은 normal 권한이라 Manifest에 선언만 하면 되지만 위치(`FUSED_LOCATION`)처럼 dangerous 권한이라 실행 중에 사용자에게 따로 물어야 하는 것도 있습니다.
권한을 빠뜨리면 조용히 실패하지 않고 `SecurityException`이 나면서 앱이 종료됩니다.

### 운전 중이라는 맥락이 있습니다

Pleos 디자인 가이드는 글자 대비 4.5:1 이상, 한 문단 3줄 이하, 터치 응답 0.25초 이내처럼 운전 중에도 한눈에 읽히는 화면을 기준으로 삼습니다.
휴대폰 앱처럼 정보를 빽빽하게 담기 어렵습니다.

## Pleos Connect SDK 한눈에 보기

문서에 공개된 주요 SDK는 아래와 같습니다.

| SDK | 하는 일 |
| --- | --- |
| Vehicle | 기어, 도어·트렁크, 좌석 착석 등 차량 상태 읽기 |
| NaviHelper | 현재 위치·경로 상태 조회, 지도 열기 |
| Fused Location | 차량 기준 통합 위치 |
| Gleo AI (STT·TTS·LLM) | 음성 인식, 음성 합성, 언어 모델 |
| ADAS | 주행 보조 정보 |
| Sync | 기기 간 동기화 |

다만 문서에 있다고 해서 지금 바로 쓸 수 있는 것은 아니었습니다.
제가 개발하던 시점에 개발자 콘솔에서 바로 쓸 수 있던 것은 Vehicle 상태 조회와 NaviHelper 정도였고 위치·음성·차량 제어는 Coming Soon으로 표시되어 있었습니다.
에뮬레이터에서는 위치와 음성 인식이 동작했지만 TTS의 서버 합성은 권한 거부가 났고 차량 제어는 성공 응답만 올 뿐 값이 바뀌지 않았습니다.

그래서 기획 단계라면 쓰려는 SDK가 지금 어떤 상태인지부터 확인하는 편이 좋습니다.
문서 첫 화면에도 문서와 SDK·에뮬레이터 버전이 다를 수 있으니 버전을 먼저 확인하라는 안내가 있습니다.

## 테스트 환경: 어떤 에뮬레이터를 써야 하나

차량 없이 개발하려면 Pleos가 제공하는 전용 에뮬레이터가 필요합니다.
Pleos SDK는 에뮬레이터 안에 들어 있는 Pleos 차량 서비스에 연결해서 동작하기 때문에 일반 Automotive 에뮬레이터로는 SDK를 테스트할 수 없습니다.

| 항목 | 제가 쓴 환경 |
| --- | --- |
| 에뮬레이터 | Pleos Connect Emulator v2.1.0 |
| 시스템 | Android 14 (API 34), Automotive 폼팩터 |
| 설치 | Android Studio SDK Manager에 Pleos의 SDK Update Site를 추가해 시스템 이미지를 받음 |
| 화면 | 2560×1440, 160dpi |
| 앱 영역 | 넓은 화면 약 1682×1210, 내비와 나눴을 때 약 841×1210 |

160dpi라서 앱 영역의 px 값이 그대로 dp 값이 됩니다.

![Pleos Connect 에뮬레이터를 켠 직후의 기본 화면. 왼쪽은 운전 정보 영역, 오른쪽은 내비가 떠 있는 앱 영역, 아래는 공조와 앱 바](/uploads/pleos-connect-01-emulator.png)

에뮬레이터를 켠 직후의 화면입니다.
왼쪽이 Driving View, 오른쪽이 앱이 그려지는 영역(지금은 내비), 아래가 공조와 앱 바입니다.

### Virtual Console로 차량 상태 바꾸기

Pleos 에뮬레이터에는 차량 값을 바꾸는 Virtual Console이 있습니다.
기어를 P에서 D로 바꾸거나, 트렁크를 열고 닫거나, 좌석에 사람이 앉은 상태로 바꿀 수 있습니다.
Vehicle SDK로 읽는 값은 대부분 여기서 바꿔 가며 확인할 수 있어서 실제 차에 타지 않고도 트렁크가 열렸을 때의 흐름 같은 것을 테스트할 수 있습니다.

### 에뮬레이터 실행 옵션

명령줄에서 켤 때는 아래 옵션 두 개를 붙여 두면 편합니다.

```bash
# 음성 인식을 테스트하려면 호스트(맥) 마이크를 에뮬레이터에 연결
emulator -avd Pleos_Connect_v2.1.0 -allow-host-audio

# 스냅샷 없이 콜드 부팅 (상태가 꼬였을 때)
emulator -avd Pleos_Connect_v2.1.0 -no-snapshot-load
```

`-allow-host-audio` 없이 켜면 마이크 권한을 줘도 소리가 들어가지 않아서 음성 인식이 아무것도 알아듣지 못합니다.

### 에뮬레이터로 확인할 수 없는 것

에뮬레이터가 실제 차를 전부 대신하지는 못했습니다.

- 차량 제어(Set): 문 잠금, 창문, 공조 같은 제어 API는 성공 응답이 와도 다시 읽어 보면 값이 그대로였습니다. 실제로 쓰려면 별도 승인도 필요합니다.
- 시동 OFF: 실제 차에서는 시동이 꺼지면 앱과 센서도 멈추는데, 에뮬레이터에서는 이 상황을 재현하기 어렵습니다. 주차 이후를 다루는 기능은 설계로 풀어야 했습니다.
- 일부 서버 기능: TTS 서버 합성처럼 승인이 필요한 기능은 에뮬레이터에서도 권한 거부가 납니다.

## 정리

- 기획 전에 쓰려는 SDK가 실제로 열려 있는지부터 확인하는 게 좋습니다.
- 차량 데이터 권한 중 dangerous 권한은 런타임 요청을 잊지 않아야 합니다.
- 테스트는 Pleos Connect Emulator v2.1.0과 Virtual Console로 하고 음성을 쓸 때는 `-allow-host-audio`로 켭니다.

### 참고

- [Pleos Connect SDK 문서](https://document.pleos.ai/en/api-reference/connect-sdk-pleos/)
- [Pleos Playground](https://pleos.ai/playground/develop)
- [현대자동차그룹: Pleos Connect 차세대 인포테인먼트 발표](https://www.hyundaimotorgroup.com/ko/news/hyundai-motor-group-redefines-in-vehicle-experience-with-pleos-connect-next-generation-infotainment-system)
