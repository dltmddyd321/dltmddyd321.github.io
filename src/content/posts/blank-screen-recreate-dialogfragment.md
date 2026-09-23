---
title: "로그인하면 흰 화면 — recreate()와 DialogFragment가 겹친 자리"
description: "로그인 직후 화면이 하얗게 비는데 재현은 안 된다는 제보를 기기 연결해서 추적한 기록입니다. 화면이 빈 게 아니라 빈 창이 덮고 있었고 원인은 동기화 후 호출되는 recreate()와 그 시점에 떠 있던 DialogFragment였습니다."
pubDate: 2026-09-23T07:00:00Z
category: dev-log
tags: ["android", "kotlin", "debugging", "adb", "fragment"]
aiPreview: "로그인 직후 화면이 흰색으로 비어버리는데 담당자는 재현하지 못한 버그를 실기기에 붙어서 추적한 과정입니다. uiautomator와 dumpsys 결과가 서로 어긋나는 걸 단서로 창이 두 개라는 걸 찾아냈고 동기화 완료 후 호출되는 Activity.recreate()가 그 시점에 떠 있던 DialogFragment를 내용 없이 복원하는 게 원인이었습니다. 특정 계정에서만 재현되는 이유와 재생성 전후로 오버레이를 직접 관리하도록 고친 방법까지 정리했습니다."
---

QA에서 이런 제보가 올라왔습니다. 로그인 직후 캘린더 화면이 하얗게 비어서 아무것도 안 보인다는 내용이었습니다. 그런데 같은 순서로 따라 해도 재현되지 않는다는 답변이 달렸습니다. 특정 계정에서만 나오는 문제였고 결국 기기를 직접 연결해서 그 계정으로 로그인해보는 것부터 시작했습니다.

## 화면이 빈 게 아니라 창이 두 개였다

재현은 어렵지 않았습니다. 제보된 계정으로 로그인하니 곧바로 흰 화면이 됐고 몇 분을 기다려도 돌아오지 않았습니다.

먼저 확인한 건 정말 화면이 비었는지였습니다. 화면에 보이는 뷰 계층을 덤프해봤습니다.

```bash
adb shell uiautomator dump /sdcard/ui.xml
adb pull /sdcard/ui.xml
```

결과는 DecorView 아래 content FrameLayout이 자식 하나 없이 비어 있는 상태였습니다. 여기까지만 보면 화면을 그리는 코드가 아예 실행되지 않은 것처럼 보입니다.

그런데 액티비티 쪽 뷰 계층을 따로 떠보니 이야기가 달랐습니다.

```bash
adb shell dumpsys activity top
```

이쪽에는 캘린더, 상단 네비게이션, 하단 탭까지 뷰가 전부 정상적으로 존재했고 visibility도 멀쩡했습니다. 화면에 안 보일 이유가 없는 상태였습니다.

두 결과가 어긋나는 이유는 창 목록을 보고 알았습니다.

```bash
adb shell dumpsys window windows | grep -E "Window #|isOnScreen|mObscured"
```

같은 액티비티에 창이 두 개 붙어 있었습니다. 아래쪽 창은 캘린더가 그려진 본 화면이었고(obscured=true), 그 위에 전체 화면 크기의 다른 창이 하나 더 올라와 있었습니다. uiautomator가 덤프한 건 맨 위 창, 즉 내용이 없는 그 창이었습니다. 화면이 빈 게 아니라 빈 창이 화면을 덮고 있었습니다.

## recreate()를 부른 쪽 찾기

위에 덮인 창이 어디서 왔는지는 logcat에 남아 있었습니다.

```
WindowManagerGlobal#addView, ty=2, ...
  caller=android.app.Dialog.show
         androidx.fragment.app.DialogFragment.onStart
```

DialogFragment가 띄운 다이얼로그였습니다. 로그인 후 계정 상태에 따라 뜨는 전체 화면 안내 오버레이였는데, 정작 그 안의 내용은 하나도 붙어 있지 않았습니다.

그 직전 로그에 답이 있었습니다.

```
scheduleRelaunchActivity: preserveWindow=true, r=MainActivity@...
  caller=android.app.Activity.recreate
         MainActivity.refresh
         SyncManager.syncFinal
```

동기화가 끝난 뒤 액티비티를 `recreate()`하고 있었습니다. 코드로 보면 이런 모양입니다.

```kotlin
fun refresh() {
    isReCreated = true
    recreate()
}
```

동기화 완료 콜백이 서버에서 받아온 계정 설정(언어, 타임존 등)을 반영하려고 액티비티를 통째로 다시 만드는 구조였습니다.

문제는 그 시점에 안내 오버레이가 이미 떠 있었다는 겁니다. `recreate()`가 일어나면 FragmentManager는 표시 중이던 DialogFragment를 복원합니다. 복원 과정에서 다이얼로그 창은 다시 만들어졌는데, 그 안에 들어갈 뷰는 붙지 않은 채로 창만 화면을 덮어버렸습니다.

순서로 정리하면 이렇습니다.

1. 로그인 성공 후 메인 화면이 계정 정보를 다시 불러오면서 안내 오버레이를 띄웁니다.
2. 같은 흐름에서 시작된 동기화가 서버 계정 설정을 받아옵니다.
3. 기기 설정과 다른 값이 있어서 액티비티 재생성이 필요하다고 판정합니다.
4. 동기화 완료 1초 뒤 `recreate()`가 실행됩니다.
5. 오버레이가 복원되면서 내용 없는 전체 화면 창으로 남습니다.

## 왜 어떤 계정에서만 재현되나

3번의 재생성 판정이 열쇠였습니다. 대략 이런 코드입니다.

```kotlin
val isNeedUpdateLocale = currentLanguage != serverPreferences.language
val isNeedUpdateTimezone = currentTimezone != serverPreferences.timezone
val isNeedRecreate = isNeedUpdateLocale || isNeedUpdateTimezone || isStartDayChanged
```

서버에 저장된 계정 설정이 지금 기기의 앱 설정과 하나라도 다르면 재생성이 걸립니다. 제보에 쓰인 계정은 서버 언어가 기기와 달랐습니다. 그래서 로그인하자마자 재생성이 발생했습니다. logcat에도 로케일이 바뀌는 줄이 찍혀 있었습니다.

```
Updating configuration, locales updated from [xx] to [yy]
```

반대로 계정 설정과 기기 설정이 같은 사람은 재생성 자체가 일어나지 않으니 오버레이도 멀쩡하게 보입니다. 재현이 안 된다던 답변은 버그가 없어서가 아니라 그 조건에 안 걸리는 계정이었기 때문입니다.

## 고친 방법

선택지는 두 가지였습니다. 재생성 직전에 오버레이를 내렸다가 재생성 후 다시 띄우거나, 오버레이가 닫힐 때까지 재생성을 미루거나.

후자는 사용자가 오버레이를 닫는 순간 화면이 갑자기 새로고침되는 것처럼 보입니다. 게다가 오버레이가 이전 언어로 떠 있다가 닫은 뒤에야 계정 언어로 바뀝니다. 그래서 전자를 택했습니다.

```kotlin
fun refresh() {
    isReCreated = true
    dismissOverlay()
    recreate()
}

private fun dismissOverlay() {
    (supportFragmentManager.findFragmentByTag(OVERLAY_TAG) as? OverlayFragment)
        ?.dismissAllowingStateLoss()
}
```

그리고 재생성이 끝난 뒤 다시 띄웁니다. 기존 코드에는 이런 분기가 있었습니다.

```kotlin
if (!isFreshStart || isReCreated) {
    isReCreated = false
    return
}
showOverlayIfNeeded()
```

재생성된 경우에는 곧장 return이라 오버레이를 새로 띄우지 않았습니다. 복원된 게 있으니 그대로 쓰겠다는 전제였는데, 그 복원본이 깨지는 게 이번 버그였습니다. 그래서 재생성된 경우에도 한 번 띄우도록 바꿨습니다.

```kotlin
if (!isFreshStart || isReCreated) {
    val wasReCreated = isReCreated
    isReCreated = false
    if (wasReCreated) showOverlayIfNeeded()
    return
}
showOverlayIfNeeded()
```

이제 오버레이는 재생성이 끝난 뒤 계정 언어가 반영된 상태로 한 번 뜹니다.

## 정리

- 화면이 비어 보인다고 뷰가 없는 건 아닙니다. `dumpsys window windows`로 창이 몇 개인지 먼저 확인하면 방향이 빨리 잡힙니다.
- `uiautomator dump`는 맨 위 창만 보여주고 `dumpsys activity top`은 액티비티의 뷰 계층을 보여줍니다. 두 결과가 어긋나면 그 자체가 단서입니다.
- `recreate()`는 표시 중이던 DialogFragment도 함께 복원합니다. 재생성을 트리거하는 코드와 다이얼로그를 띄우는 코드가 서로 모르는 사이라면 충돌 지점이 생깁니다.
- 재현이 안 되는 제보는 계정별 서버 설정 차이를 의심해볼 만합니다.
