---
title: "제스처 바만 따로 놀던 테마 배경 — 범인은 DrawerLayout의 clipRect"
description: "화면 맨 아래 시스템 제스처 바 영역만 테마 이미지 대신 단색으로 남던 문제를, 버전 분기와 DrawerLayout의 그리기 잘림까지 따라가 해결한 기록입니다."
pubDate: 2026-11-05T02:00:00Z
category: dev-log
tags: ["android", "edge-to-edge", "window-insets", "drawerlayout", "navigation-bar"]
aiPreview: "테마 이미지를 바꿀 수 있는 앱에서 시스템 제스처 바 영역만 단색으로 남는 문제가 한 번 고친 뒤에도 계속 보고됐습니다. Android 15 이상에서만 배경 이미지를 Navigation Bar 뒤로 늘리도록 막아 둔 탓에 Android 14 이하 기기에서는 처리 자체가 돌지 않았고, SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION과 투명 navigationBarColor로 레이아웃을 펼친 뒤에도 흰 띠가 남았습니다. dumpsys와 스크린샷 픽셀 색을 맞춰 보니 DrawerLayout.drawChild()가 콘텐츠를 자기 높이로 clipRect해서 늘린 이미지가 그려지지 않고 있었습니다. DrawerLayout 자체를 제스처 바 높이만큼 늘리고 안쪽 UI는 패딩과 마진으로 제자리에 두어 해결했습니다."
---

테마 이미지를 바꿀 수 있는 앱에서 "아무리 고쳐도 맨 아래 영역만 검은색"이라는 이야기가 계속 나왔습니다.
화면 맨 아래, 시스템 제스처 바(가로 핸들이 있는 얇은 띠) 영역만 테마 이미지가 아니라 단색으로 따로 노는 문제입니다.
한 번 고쳐서 배포했는데도 그대로였고 이번에 실제 기기를 붙여서 끝까지 따라가 봤습니다.
처음 대응부터 중간에 왜 해결이 안 됐는지까지 기록해봅니다.

## 처음 했던 대응

Android 15(API 35)부터는 앱이 edge-to-edge로 강제됩니다.
앱 창이 Navigation Bar 뒤까지 펼쳐지고 그 영역을 어떻게 채울지는 앱 몫이 됩니다.

그래서 처음에는 이렇게 처리했습니다.

- 콘텐츠 루트에 Navigation Bar 높이만큼 하단 패딩을 줘서 버튼이나 탭이 바 밑으로 들어가지 않게 합니다.
- 루트의 `clipToPadding`, `clipChildren`을 꺼서 자식이 패딩 영역까지 그릴 수 있게 합니다.
- 배경 이미지 두 장(전체 배경, 하단 탭 배경)에만 음수 하단 마진을 줘서 패딩 아래까지 늘립니다.
- 제스처 내비게이션일 때만 적용합니다. 3버튼 내비게이션은 버튼이 잘 보여야 해서 단색을 유지했습니다.

```kotlin
ViewCompat.setOnApplyWindowInsetsListener(screenRoot) { _, insets ->
    val bottom = insets.getInsets(WindowInsetsCompat.Type.systemBars()).bottom
    val extension = if (isGestureNavigation(bottom)) bottom else 0
    backgroundImage.updateLayoutParams<MarginLayoutParams> { bottomMargin = -extension }
    bottomTabImage.updateLayoutParams<MarginLayoutParams> {
        height = baseHeight + extension
        bottomMargin = -extension
    }
    insets
}
```

이 처리는 Android 15 이상에서만 동작하도록 첫 줄에서 버전을 막아 두었습니다.
그 아래 버전은 앱이 Navigation Bar 뒤로 그리지 않으니 늘릴 공간도 없다고 봤습니다.

## 그래도 똑같다는 피드백

배포 후에도 같은 스크린샷이 왔습니다.
처음 받은 스크린샷은 수정 전 버전이라 업데이트하면 될 거라고 생각했는데, 최신 버전에서도 마찬가지라는 답이 돌아왔습니다.

문제가 재현되는 테마와 기기를 직접 연결했습니다.
Galaxy S20, Android 13, 제스처 내비게이션이었습니다.
첫 줄의 버전 체크 때문에 이 기기에서는 처리 자체가 실행되지 않았던 겁니다.

`dumpsys`로 뷰 배치를 보면 상황이 분명했습니다.

```
adb shell dumpsys activity top
```

| 뷰 | 세로 범위(px) |
|---|---|
| 콘텐츠 루트, 배경 이미지 | 0 ~ 2355 |
| navigationBarBackground | 2355 ~ 2400 |

앱 화면은 2355px에서 끝나고 아래 45px은 시스템의 `navigationBarBackground` 뷰가 차지합니다.
이 뷰는 `window.navigationBarColor`로 칠해지는데, Android 14 이하에서는 여기에 테마의 단색을 넣고 있었습니다.
다크 테마라 그 색이 검정으로 보였습니다.

## Android 14 이하에서도 Navigation Bar 뒤로 그리기

Android 15와 같은 구조를 낮은 버전에서도 만들었습니다.
메인 화면 하나에만 적용했습니다.

- `SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION`을 추가했습니다. Navigation Bar를 숨기는 게 아니라 레이아웃만 그 뒤까지 펼치는 플래그입니다.
- 콘텐츠 루트에는 Android 15 경로와 똑같이 하단 inset만큼 패딩을 줬습니다.
- 가로 모드 3버튼 내비게이션은 바가 옆에 붙기 때문에 좌우에도 패딩을 넣었습니다.
- 제스처 내비게이션이면 `navigationBarColor`를 투명으로 바꾸고 `isNavigationBarContrastEnforced`도 껐습니다. 이걸 켜 두면 시스템이 반투명 막을 깔아 줍니다.

```kotlin
window.decorView.systemUiVisibility =
    window.decorView.systemUiVisibility or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION

ViewCompat.setOnApplyWindowInsetsListener(contentRoot) { view, insets ->
    val nav = insets.getInsets(WindowInsetsCompat.Type.navigationBars())
    val bottom = insets.getInsets(WindowInsetsCompat.Type.systemBars()).bottom
    view.setPadding(nav.left, 0, nav.right, bottom)
    insets
}
```

설치해 보니 이번에는 검정이 아니라 흰 띠가 나왔습니다.
여전히 맨 아래만 따로 놀았습니다.

## 다 맞는데 왜 흰 띠일까

확인할 수 있는 건 전부 확인했습니다.

- 창 플래그: `vsysui=0x700`으로 레이아웃이 Navigation Bar 뒤까지 펼쳐져 있었습니다.
- 콘텐츠 루트: 0~2400px으로 화면 끝까지 내려와 있었습니다.
- 배경 이미지 두 장: 레이아웃상 2400px까지 늘어나 있었습니다.
- `navigationBarBackground`: INVISIBLE이었습니다. 투명 처리가 먹은 겁니다.
- SystemUI의 Navigation Bar: `dumpsys activity service com.android.systemui`에서 `MODE_TRANSPARENT`였습니다.

그래서 스크린샷의 픽셀 색을 직접 찍어 봤습니다.

| y(px) | 색 |
|---|---|
| 2300 ~ 2354 | #090815 (테마 배경) |
| 2356 ~ 2390 | #FBFBFB |

2355px을 경계로 색이 정확히 바뀌었습니다.
`#FBFBFB`는 Navigation Bar 색이 아니라 창 배경색이었습니다.
이미지는 2400px까지 늘어나 있는데, 2355px 아래는 그려지지 않고 그 뒤의 창 배경이 보이고 있었습니다.

## 범인은 DrawerLayout

배경 이미지들은 측면 메뉴 때문에 `DrawerLayout` 안에 들어 있었습니다.
`DrawerLayout`은 콘텐츠 자식을 그릴 때 `drawChild()`에서 캔버스를 자기 크기로 자릅니다.

```java
// DrawerLayout.drawChild() 중 콘텐츠 뷰를 그리는 부분
canvas.clipRect(clipLeft, 0, clipRight, getHeight());
```

열린 Drawer 영역을 피하려고 좌우를 자르는 코드인데, 세로도 `getHeight()`로 잘라 버립니다.
그래서 자식 이미지에 음수 마진을 주고 상위 뷰마다 `clipChildren = false`를 줘도 `DrawerLayout` 높이(2355px) 아래는 절대 그려지지 않습니다.
`clipChildren`은 이 `clipRect`와는 관계가 없습니다.

처음 Android 15에서 했던 처리도 같은 구조였습니다.
결국 그때도 이미지는 레이아웃상으로만 늘어났고 실제로는 잘리고 있었을 가능성이 큽니다.
"아무리 작업해도 안 된다"는 말이 그대로 맞았던 겁니다.

## DrawerLayout 자체를 늘리기

자르는 경계를 화면 끝으로 내리면 됩니다.
그러려면 `DrawerLayout`이 Navigation Bar 아래까지 내려가야 하고 그 안의 UI는 원래 위치에 남아 있어야 합니다.

- `DrawerLayout`에 Navigation Bar 높이만큼 음수 하단 마진을 줍니다. 부모는 `clipChildren = false`라서 넘친 부분도 그려집니다.
- `DrawerLayout` 안의 콘텐츠 루트에는 같은 높이만큼 하단 패딩을 주고 `clipToPadding = false`로 둡니다. 탭, 버튼 같은 UI는 패딩 위에서 끝나고 배경 이미지만 기존 음수 마진으로 패딩 아래까지 그려집니다.
- 측면 메뉴(Drawer 쪽 자식)에는 같은 높이만큼 하단 마진을 줍니다. `DrawerLayout`은 Drawer 자식의 마진을 반영해서 측정하기 때문에 메뉴가 바 밑으로 내려가지 않습니다.

```kotlin
ViewCompat.setOnApplyWindowInsetsListener(screenRoot) { _, insets ->
    val extension = gestureBarHeightOrZero(insets)
    drawerLayout.updateLayoutParams<MarginLayoutParams> { bottomMargin = -extension }
    screenRoot.setPadding(screenRoot.paddingLeft, screenRoot.paddingTop, screenRoot.paddingRight, extension)
    sideMenu.updateLayoutParams<DrawerLayout.LayoutParams> { bottomMargin = extension }
    backgroundImage.updateLayoutParams<MarginLayoutParams> { bottomMargin = -extension }
    // 하단 탭 배경도 같은 방식
    insets
}
```

3버튼 내비게이션이면 `extension`이 0이라 전부 원래대로 돌아갑니다.

다시 설치해서 같은 지점의 픽셀을 찍었습니다.
2356~2390px도 `#090815`로 바뀌어 테마 배경이 제스처 바 영역까지 이어졌습니다.
`DrawerLayout`은 2400px까지 그려지고 측면 메뉴는 2355px에서 끝났습니다.
제스처 핸들 자체는 시스템이 그리는 거라 남아 있고 색만 테마 밝기에 맞춰 바뀝니다.

## 정리

- Android 14 이하는 앱이 Navigation Bar 뒤로 그리지 않아서 버전 체크로 막아 둔 처리 자체가 실행되지 않았습니다.
- 레이아웃을 펼친 뒤에도 `DrawerLayout.drawChild()`가 콘텐츠를 자기 높이로 잘라 늘린 이미지가 그려지지 않았습니다.
- 레이아웃 범위가 맞는데 화면이 다르면, 스크린샷 픽셀 색과 `dumpsys` 수치를 같이 보면 어디서 잘리는지 바로 드러납니다.
- 남은 확인: 3버튼 내비게이션, 측면 메뉴를 연 상태, Android 15 이상 제스처 내비게이션 기기.

