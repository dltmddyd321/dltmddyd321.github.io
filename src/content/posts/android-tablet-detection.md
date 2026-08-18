---
title: 안드로이드 태블릿 판별과 폴더블 함정
description: 화면 크기로 태블릿 여부를 판별하는 표준 공식과, 그 값을 어디서 갱신해야 폴더블 기기에서도 깨지지 않는지 정리합니다.
pubDate: 2026-08-18T03:11:13Z
category: archive
tags: [android, kotlin, device]
aiPreview: 폭/높이 단순 비교 대신 smallestWidthDp(min(width, height) / density)로 태블릿을 판별하고, 폴더블 기기에서는 앱 시작 시 한 번이 아니라 화면 구성이 바뀔 때마다 이 값을 다시 계산해야 펼치는 도중에도 깨지지 않습니다.
---

태블릿과 폰에 각각 다른 리소스(아이콘, 배경 이미지 세트 등)를 내려줘야 하는 앱이 있었습니다. 서버는 플랫폼 구분 파라미터로 모바일용과 태블릿용 에셋을 이미 나눠 내려주고 있었지만, 클라이언트는 정작 이 값을 항상 같은 문자열로 고정해서 보내고 있었습니다. 결과적으로 태블릿에서 실행해도 폰용 리소스만 받아오는 상태였습니다.

결국 "지금 이 기기가 태블릿인가"를 판별할 전역 함수 하나가 필요해진 셈입니다.

## smallestWidthDp — 회전에 흔들리지 않는 기준

폭(width)과 높이(height)를 그냥 비교하는 방식은 쓸 수 없습니다. 세로에서는 폭이 짧다가 가로로 돌리는 순간 서로 뒤바뀌므로, 폰을 눕히는 동작 하나로 판정 결과가 뒤집혀 버립니다.

실제로 Android가 리소스 폴더 분기(`sw600dp` 같은 qualifier)에서 쓰는 기준은 두 축 중 더 짧은 쪽입니다. 마침 갖고 있던 `DisplayMetrics`로 이 값을 직접 계산하면 이렇게 됩니다.

```kotlin
val smallestWidthDp = min(metrics.widthPixels, metrics.heightPixels) / metrics.density
val isTablet = smallestWidthDp >= 600
```

600dp는 구글이 정한 "7인치 이상" 기준값이고, 10인치급만 따로 골라내고 싶을 때는 720dp를 쓰는 경우도 있습니다.

## 이 값을 어디에 두느냐가 진짜 문제였습니다

이 계산은 처음엔 앱이 켜질 때 딱 한 번 도는 초기화 함수 안에 넣어뒀습니다. 갤럭시 폴드 같은 폴더블 기기를 떠올리기 전까지는 그걸로 충분해 보였습니다.

- 접힌 상태에선 폰 기준(약 289dp)에 머물다가, 펼치는 순간 `smallestScreenWidthDp` 값 자체가 태블릿 기준(약 679dp)을 넘어갑니다.
- 폰이나 일반 태블릿은 화면 크기가 물리적으로 고정돼 있어 신경 쓸 일이 없었지만, 폴더블은 앱이 실행되는 도중에도 폼팩터가 바뀔 수 있다는 게 문제였습니다.

액티비티의 `configChanges`엔 회전(`orientation`)과 화면 크기(`screenSize`) 변화를 처리하도록 선언돼 있었는데, 정작 `smallestScreenSize`가 빠져 있었습니다. 선언되지 않은 차원이 바뀌면 Android는 그 액티비티를 destroy 후 recreate로 처리하므로, 폴드/언폴드는 회전과는 성격이 다른 **액티비티 재생성 이벤트**였던 셈입니다.

그래서 앱 시작 시 한 번만 값을 계산해두는 방식으로는 "펼쳐둔 채로 앱을 새로 켜면 멀쩡한데, 켜놓은 채로 펼치면 갱신이 안 되는" 애매한 버그가 나타났습니다. 액티비티 자체는 재생성되지만, 그 경로가 프로세스 단위 초기화 함수까지 다시 호출하지는 않기 때문입니다.

## 고친 방법

결국 액티비티가 재생성될 때마다 자동으로 다시 불리는 함수 쪽으로 이 계산을 옮기는 게 핵심이었습니다. 마침 화면 크기가 바뀔 때마다 갱신하는 함수가 이미 있었기에, 거기에 얹는 방향으로 정리했습니다.

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

앱을 처음 띄울 때 돌던 초기화 로직도 이 함수를 거쳐 가도록 바꿔서, 같은 계산이 두 곳에서 따로 관리되는 일은 없앴습니다.

## 정리

- 회전에 안전하게 태블릿을 판별하려면 폭/높이를 단순 비교하지 말고 `min(width, height) / density`(= smallestWidthDp)를 써야 합니다.
- 이 값을 어디서 계산할지가 생각보다 중요합니다. 폴더블처럼 실행 중에 폼팩터가 바뀌는 기기라면, "프로세스당 한 번"이 아니라 "화면 구성이 바뀔 때마다" 다시 불리는 함수 쪽에 둬야 합니다.
- 단서는 액티비티의 `configChanges`에서 어떤 차원이 빠졌는지 확인하는 데 있었습니다. 빠진 차원의 변화는 `onConfigurationChanged`가 아니라 액티비티 재생성으로 처리된다는 점을 이용해서, 재생성 시점에 값이 다시 갱신되도록 위치만 옮기면 해결됩니다.
