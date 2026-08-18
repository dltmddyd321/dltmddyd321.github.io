---
title: 안드로이드 태블릿 판별과 폴더블 함정
description: 화면 크기로 태블릿 여부를 판별하는 표준 공식과, 그 값을 어디서 갱신해야 폴더블 기기에서도 깨지지 않는지 정리합니다.
pubDate: 2026-08-18
category: archive
tags: [android, kotlin, device]
---

앱에서 태블릿과 폰에 서로 다른 리소스(아이콘, 배경 이미지 세트 등)를 내려줘야 하는 상황이 생겼습니다. 서버 API는 이미 플랫폼 구분 파라미터로 모바일/태블릿 전용 에셋을 나눠 내려주고 있었는데, 클라이언트는 이 값을 항상 고정 문자열로 보내고 있었습니다. 태블릿에서 실행해도 폰용 리소스만 받아오는 상태였던 셈입니다.

그래서 "지금 이 기기가 태블릿인가"를 판별하는 전역 함수 하나가 필요했습니다.

## smallestWidthDp — 회전에 흔들리지 않는 기준

폭(width)이나 높이(height)를 단순 비교하면 안 됩니다. 세로 모드에서는 폭이 짧고, 가로로 돌리면 반대가 되기 때문에 폰을 눕히기만 해도 판정이 뒤집힐 수 있습니다.

Android가 리소스 폴더 분기(`sw600dp` 같은 qualifier)에 실제로 쓰는 기준은 "가로/세로 축 중 더 짧은 쪽"입니다. 이미 갖고 있던 `DisplayMetrics`로 직접 계산하면 다음과 같습니다.

```kotlin
val smallestWidthDp = min(metrics.widthPixels, metrics.heightPixels) / metrics.density
val isTablet = smallestWidthDp >= 600
```

600dp는 구글이 "7인치 이상 화면"을 태블릿으로 구분하는 표준 임계값입니다. 10인치급만 골라내고 싶다면 720dp를 쓰기도 합니다.

## 이 값을 어디에 두느냐가 진짜 문제였습니다

처음엔 이 계산을 앱이 처음 켜질 때 한 번만 도는 초기화 함수에 넣었습니다. 그런데 갤럭시 폴드 같은 폴더블 기기를 생각하면 이야기가 달라집니다.

- 폴드를 펼치면 `smallestScreenWidthDp` 자체가 바뀝니다. 접었을 땐 폰(약 289dp), 펼치면 태블릿(약 679dp) 기준을 넘습니다.
- 이 값이 "앱이 켜져 있는 도중에" 바뀔 수 있다는 게 핵심입니다. 폰이나 일반 태블릿은 화면 크기가 물리적으로 고정이라 신경 쓸 필요가 없었지만, 폴더블은 런타임에 폼팩터 자체가 바뀝니다.

액티비티의 `configChanges`에 회전(`orientation`)과 화면 크기(`screenSize`)는 처리하도록 선언돼 있었지만, `smallestScreenSize`는 빠져 있었습니다. Android는 `configChanges`에 선언되지 않은 차원이 바뀌면 해당 액티비티를 통째로 destroy 후 recreate합니다. 즉 폴드/언폴드는 회전과 달리 **액티비티가 재생성되는 이벤트**였습니다.

그 결과, 앱 시작 시 한 번만 계산하는 초기화 함수에 이 값을 둔 채로는 "펼친 채로 앱을 다시 켜면 정상, 켜놓은 채로 펼치면 갱신 안 됨"이라는 애매한 버그가 생겼습니다. 액티비티는 재생성되는데, 그 재생성 경로가 앱 프로세스 단위 초기화 함수까지 다시 부르지는 않았기 때문입니다.

## 고친 방법

핵심은 "액티비티가 재생성될 때마다 다시 불리는 함수"로 이 계산을 옮기는 것이었습니다. 이 프로젝트에는 화면 크기가 바뀔 때마다 갱신하는 함수가 이미 있었고, 거기에 얹는 쪽으로 정리했습니다.

```kotlin
object ScreenInfo {
    var isTablet: Boolean = false
        private set

    // 액티비티 onCreate/recreate 경로에서 매번 다시 호출되는 함수
    fun onScreenSizeChanged(metrics: DisplayMetrics) {
        val smallestWidthDp = min(metrics.widthPixels, metrics.heightPixels) / metrics.density
        isTablet = smallestWidthDp >= 600
    }
}
```

앱을 처음 띄울 때의 초기화 로직도 결국 이 함수를 거치도록 만들어서, 같은 계산을 두 곳에서 따로 관리할 필요가 없게 정리했습니다.

## 정리

- 태블릿 판별은 폭/높이 단순 비교가 아니라 `min(width, height) / density`(= smallestWidthDp)로 해야 회전에 안전합니다.
- 이 값을 어디서 계산하느냐가 생각보다 중요합니다. 폴더블처럼 런타임에 폼팩터가 바뀌는 기기가 있다면, "프로세스당 한 번" 도는 초기화 함수가 아니라 "화면 구성이 바뀔 때마다" 다시 불리는 함수에 둬야 합니다.
- 액티비티의 `configChanges`에 어떤 차원이 빠져 있는지 확인하는 게 실마리였습니다. 빠진 차원의 변화는 `onConfigurationChanged`가 아니라 액티비티 재생성으로 처리된다는 점을 이용해, 그 재생성 시점에 값이 다시 갱신되도록 위치를 옮기면 됩니다.
