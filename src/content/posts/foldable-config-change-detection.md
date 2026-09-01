---
title: 갤럭시 폴드를 펼치면 배경 이미지가 눌리는 이유
description: 폴더블 기기에서 화면 구성이 바뀌었는데도 회전 감지 로직이 반응하지 않아 생긴 버그를, configChanges 보강과 WindowInfoTracker 도입으로 잡은 과정을 정리합니다.
pubDate: 2026-09-01T07:50:20Z
category: dev-log
tags: [android, kotlin, foldable, configuration]
aiPreview: Configuration.orientation은 폴더블을 접었다 펼쳐도 값이 그대로인 경우가 많아, 회전 여부로만 판단하는 리프레시 로직이 무반응합니다. configChanges에 smallestScreenSize·screenLayout을 더하고, androidx.window의 WindowInfoTracker로 FoldingFeature 상태를 직접 구독하면 방향이 아니라 힌지 상태 자체를 신호로 받을 수 있습니다.
---

캘린더 앱에 테마별 배경 이미지를 넣는 기능이 있습니다. 세로 화면용과 가로 화면용 이미지를 따로 받아서 기기 방향에 맞는 쪽을 골라 보여주는 식입니다. 그런데 갤럭시 폴드를 펼친 상태에서 이 이미지가 위아래로 눌린 것처럼 보인다는 제보가 들어왔습니다.

저는 폴더블 기기가 없어서 직접 재현은 못 해봤고 캡처와 코드만으로 원인을 좁혀야 했습니다.

## 1. 뭐가 문제였나

이미지를 그려주는 뷰 자체는 `centerCrop`으로 비율을 유지한 채 잘라 채우는 방식이라, 뷰 크기만 맞으면 이론적으로 찌그러질 이유가 없습니다. 그런데 화면 안의 캘린더 컨텐츠(주/월 단위 행 높이)를 계산하는 코드 쪽을 보니, 화면 크기를 뷰 생성 시점에 한 번 읽어서 프로퍼티에 박아두는 부분이 있었습니다. 그 뒤로 화면 크기가 바뀌어도 이 값은 갱신되지 않고, 액티비티가 다시 만들어질 때만 새로 계산됩니다.

그래서 질문은 "액티비티가 언제 다시 만들어지는가"로 좁혀졌습니다. 코드를 보니 화면 회전이 바뀔 때만 리프레시를 태우고 있었습니다.

```kotlin
override fun onConfigurationChanged(newConfig: Configuration) {
    super.onConfigurationChanged(newConfig)
    val current = resources.configuration.orientation
    if (AppState.orientation == current) return   // 방향이 그대로면 아무것도 안 함
    AppState.orientation = current
    refresh()
}
```

일반 폰에서는 이 로직이 문제없이 동작합니다. 세로에서 가로로 돌리면 `Configuration.orientation` 값이 확실히 바뀌니까요. 문제는 폴더블입니다. 갤럭시 폴드나 플립은 접었다 펼쳐도 `Configuration.orientation` 자체는 그대로 PORTRAIT로 유지되는 경우가 많습니다. 화면 크기(`smallestScreenWidthDp`, `screenWidthDp`)만 크게 바뀌는 거죠. 그러니 위 코드의 `if (같으면 return)` 조건에 걸려서 리프레시가 아예 안 일어나고 캘린더 행 높이는 접힌 채로 계산된 값을 계속 씁니다. 좁은 폭 기준으로 계산된 행 안에 배경 이미지가 크롭되어 들어가니, 펼친 넓은 화면에서 보면 눌린 것처럼 보이는 거였습니다.

## 2. 폴더블을 위한 구성 변경 선언

여기서 한 가지 더 걸리는 부분이 있었습니다. 매니페스트에 선언한 `configChanges`가 `orientation|screenSize` 두 개뿐이었습니다.

안드로이드는 `configChanges`에 선언 안 한 카테고리의 변화가 생기면 액티비티를 통째로 죽였다 다시 만듭니다. 문제는 폴더블의 접힘/펼침이 `orientation`, `screenSize` 말고도 `smallestScreenSize`, `screenLayout` 카테고리까지 같이 건드린다는 점입니다. [공식 문서](https://developer.android.com/guide/topics/large-screens/configuration-and-continuity)도 폴더블을 다루려면 이 네 가지를 전부 선언하라고 안내합니다.

```xml
<activity
    android:name=".MainActivity"
    android:configChanges="orientation|screenSize|smallestScreenSize|screenLayout" />
```

이걸 다 선언하지 않으면 두 가지 애매한 상황이 겹칩니다. 어떤 폴더블에서는 시스템이 강제로 액티비티를 재생성해버리고(그러면 앞서 본 `onConfigurationChanged`도 안 타고 그냥 `onCreate`부터 다시 돕니다), 또 어떤 폴더블에서는 재생성도 안 되고 `onConfigurationChanged`도 무시당하는 경우가 생깁니다. 어느 쪽이든 화면 크기 관련 캐시가 갱신될 기회를 놓치는 건 마찬가지입니다.

## 3. 접힘 상태는 방향이 아니라 별도로 감지해야 한다

`configChanges`를 다 선언하고 나면 이제 "접혔는지 펼쳤는지"를 우리 코드가 직접 판단해야 합니다. 그런데 1번에서 봤듯이 이걸 `Configuration.orientation` 비교로 유추하는 건 애초에 신뢰할 수 없는 신호였습니다. 방향은 그대로인데 크기만 바뀌는 게 폴더블의 기본 동작이니까요.

안드로이드가 이 문제 때문에 따로 내놓은 게 [Jetpack의 WindowManager 라이브러리](https://developer.android.com/develop/adaptive-apps/guides/foldables/make-your-app-fold-aware)입니다. `WindowInfoTracker`를 구독하면 `FoldingFeature`라는 형태로 접힘/펼침 상태(`FLAT`, `HALF_OPENED`)를 직접 받을 수 있습니다. 방향이나 크기로 추론하는 게 아니라, "지금 힌지가 접혀 있다/펼쳐져 있다"는 사실 자체를 이벤트로 주는 셈입니다.

```gradle
implementation 'androidx.window:window:1.5.1'
```

([현재 안정 버전 확인은 여기서](https://developer.android.com/jetpack/androidx/releases/window))

```kotlin
lifecycleScope.launch {
    lifecycle.repeatOnLifecycle(Lifecycle.State.STARTED) {
        WindowInfoTracker.getOrCreate(this@MainActivity)
            .windowLayoutInfo(this@MainActivity)
            .collect { layoutInfo ->
                val folding = layoutInfo.displayFeatures
                    .filterIsInstance<FoldingFeature>()
                    .firstOrNull()
                // folding?.state == FoldingFeature.State.FLAT / HALF_OPENED
            }
    }
}
```

일반 폰에서는 `displayFeatures`가 비어 있어서 `folding`이 그냥 `null`로 나옵니다. 별도 분기 없이도 폴더블이 아닌 기기에서는 자연스럽게 무시되는 구조입니다.

## 4. 최종 코드

여기까지 합치면 접힘 상태가 실제로 바뀌었을 때만 기존 리프레시 함수를 태우는 구조로 정리됩니다. 처음 구독을 시작한 시점에는 이전 상태가 없으니 바로 리프레시하지 않고, 그다음부터 값이 바뀔 때만 반응하도록 이전 상태를 변수 하나로 들고 있습니다.

```kotlin
private var lastFoldState: FoldingFeature.State? = null

private fun observeFoldingFeature() {
    lifecycleScope.launch {
        lifecycle.repeatOnLifecycle(Lifecycle.State.STARTED) {
            WindowInfoTracker.getOrCreate(this@MainActivity)
                .windowLayoutInfo(this@MainActivity)
                .collect { layoutInfo ->
                    val folding = layoutInfo.displayFeatures
                        .filterIsInstance<FoldingFeature>()
                        .firstOrNull() ?: return@collect

                    if (lastFoldState != null && lastFoldState != folding.state) {
                        refresh()   // 기존 recreate() 기반 리프레시 재사용
                    }
                    lastFoldState = folding.state
                }
        }
    }
}
```

기존 방향 감지 로직은 그대로 남겨뒀습니다. 일반 회전은 `Configuration.orientation` 비교로 충분히 잡히니, 폴더블 힌지 감지는 별도 경로로 추가하는 쪽이 기존 동작을 건드리지 않아 안전합니다.

폴더블 기기가 없어서 실기기 검증은 못 했지만, Android Studio 에뮬레이터에 폴더블 프로파일을 하나 만들어두면 Extended Controls에서 접힘/펼침 상태를 그대로 시뮬레이션할 수 있습니다. 처음엔 AVD 생성 자체가 `cmdline-tools` 미설치로 계속 실패해서 그것부터 잡아야 했는데, 그 얘기는 다음에 따로 적어볼까 합니다.
