---
title: "EditText 선택 영역 색을 View와 Compose 양쪽에 입히기"
description: "텍스트 드래그 시 보이는 배경·핸들 색을 앱 테마 컬러로 바꾸는 작업을 View 시스템과 Compose 양쪽에서 진행하며 겪은 API 차이와 커버리지 문제를 기록합니다."
pubDate: 2026-09-11T13:00:00Z
category: dev-log
tags: ["android", "kotlin", "jetpack-compose", "ui"]
aiPreview: EditText 텍스트 선택 시 배경과 드래그 핸들 색을 앱 테마 컬러로 바꾸는 작업 기록입니다. highlightColor는 API 제약 없이 바로 되지만 핸들 색 변경은 API 29 이상에서만 가능하고, Compose는 아예 다른 CompositionLocal 메커니즘을 씁니다. 화면 수십 개에 흩어진 입력창을 하나씩 고치는 대신 이미 모든 화면이 거쳐가는 공통 진입점 4곳에 훅을 걸어 해결했습니다.
---

텍스트를 드래그해서 선택하면 배경이 옅게 깔리고 좌우에 물방울 모양 핸들이 뜹니다. 기본값은 시스템 파란색인데, 이걸 앱 테마의 primary 컬러로 바꿔달라는 요청을 받고 작업한 기록입니다.

## 배경색과 핸들은 완전히 다른 API

먼저 착각했던 부분부터. "선택 영역 색"이라고 뭉뚱그려 말하지만 실제로는 서로 무관한 세 가지입니다.

- **선택된 글자 뒤 배경** — `EditText.highlightColor`
- **좌우 드래그 핸들** — `setTextSelectHandle()` 계열
- **글자 자체 색** — `textColor`, 선택 여부와 무관하게 그대로 유지됨

배경은 색상 값 하나 넣는 프로퍼티라 API 레벨 제약 없이 바로 적용됩니다. 알파를 섞고 싶으면 `ColorUtils.setAlphaComponent(color, alpha)`로 미리 계산해서 넣으면 됩니다.

```kotlin
editText.highlightColor = ColorUtils.setAlphaComponent(primaryColor, (255 * 0.2f).toInt())
```

핸들은 얘기가 다릅니다. `setTextSelectHandle()` / `setTextSelectHandleLeft()` / `setTextSelectHandleRight()`가 **API 29(Android 10) 이상에만 존재**합니다. 새 벡터 드로어블을 만드는 대신, 플랫폼이 원래 쓰던 드로어블을 그대로 가져와 tint만 바꿔치기하는 쪽을 택했습니다.

```kotlin
fun applySelectionColors(editText: EditText) {
    val primary = getThemePrimaryColor()
    editText.highlightColor = ColorUtils.setAlphaComponent(primary, (255 * 0.2f).toInt())

    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return

    editText.textSelectHandle?.mutate()?.let {
        it.setTint(primary)
        editText.setTextSelectHandle(it)
    }
    editText.textSelectHandleLeft?.mutate()?.let {
        it.setTint(primary)
        editText.setTextSelectHandleLeft(it)
    }
    editText.textSelectHandleRight?.mutate()?.let {
        it.setTint(primary)
        editText.setTextSelectHandleRight(it)
    }
}
```

`getTextSelectHandle()`로 읽어온 드로어블을 `.mutate()`로 복제하지 않으면 같은 리소스를 참조하는 다른 뷰까지 같이 물들어버립니다. mutate 없이 tint하면 안 된다는 원칙이 여기서도 그대로 적용됩니다. 모양은 OS 네이티브 그대로 유지하면서 색만 바뀌는 게 이 방식의 장점입니다. API 29 미만 기기는 핸들 색 변경 자체가 불가능해서 배경색만 반영되고 넘어갑니다.

## Compose는 아예 다른 세계

View 시스템에서 쓴 API는 Compose `TextField`에는 안 먹힙니다. Compose는 `LocalTextSelectionColors`라는 CompositionLocal에 `TextSelectionColors(handleColor, backgroundColor)`를 제공하는 방식입니다.

```kotlin
@Composable
fun ThemedTextSelectionColors(content: @Composable () -> Unit) {
    val primary = Color(getThemePrimaryColor())
    CompositionLocalProvider(
        LocalTextSelectionColors provides TextSelectionColors(
            handleColor = primary,
            backgroundColor = primary.copy(alpha = 0.2f)
        ),
        content = content
    )
}
```

이 컴포저블로 `setContent { }` 블록을 감싸기만 하면 그 안의 모든 `TextField`/`BasicTextField`가 같은 색을 씁니다. View 쪽 로직을 재사용할 방법은 없습니다. 그냥 완전히 별개 구현을 하나 더 만드는 게 맞습니다.

## 진짜 문제는 색이 아니라 범위

입력창이 화면 스무 곳 넘게 흩어져 있는 상황에서 한 곳씩 찾아다니며 고치는 건 비효율적입니다. 그래서 색을 적용하는 함수 자체는 하나만 만들고 **이미 모든 화면이 예외 없이 거쳐가는 공통 지점**에 그 함수 호출을 끼워 넣는 쪽으로 방향을 잡았습니다.

```kotlin
fun applySelectionColorsToTree(view: View?) {
    when (view) {
        null -> return
        is EditText -> applySelectionColors(view)
        is ViewGroup -> {
            for (i in 0 until view.childCount) {
                applySelectionColorsToTree(view.getChildAt(i))
            }
        }
    }
}
```

이 재귀 순회 함수를 걸어둔 지점은 네 곳입니다.

- 화면 전반에서 이미 폰트를 일괄 적용하느라 뷰 트리를 순회하던 기존 유틸 함수 (140곳 넘게 호출되고 있어 사실상 전 화면 커버)
- 모든 화면의 공통 베이스 액티비티가 콘텐츠를 다 그린 직후 시점
- 다이얼로그를 띄우는 공통 함수
- 바텀시트 공통 베이스 클래스가 화면에 나타나는 시점

새 코드를 추가한 게 아니라, 원래 있던 "모든 화면이 통과하는 관문" 네 개에 한 줄씩 얹은 셈입니다. 신규 화면이 추가돼도 저 관문 중 하나는 반드시 거치니 별도로 챙길 필요가 없어집니다.

## 실측 해프닝

적용 후 실기기 스크린샷을 픽셀 단위로 찍어봤는데, 핸들 색이 기대한 값과 미묘하게 달랐습니다. 계산상 나와야 할 색과 비교하면 실측값은 R 채널만 눈에 띄게 높았고 나머지 채널은 거의 일치했습니다.

가장 먼저 의심한 건 제조사 커스텀 UI가 핸들을 자체적으로 다시 그리면서 우리가 tint한 드로어블을 무시하는 경우였습니다. 확인하려고 진단 로그를 넣어 핸들 드로어블이 null인지, tint가 실제로 적용된 인스턴스로 교체됐는지를 찍어봤는데 전부 정상이었습니다. 드로어블도 null이 아니었고 set 이후 재조회해도 우리가 만든 인스턴스가 그대로 남아 있었습니다.

순정 AOSP 에뮬레이터에서 같은 화면을 띄워 같은 픽셀 위치를 재보니 실기기와 동일한 값이 나왔습니다. 제조사 커스텀 UI 문제가 아니라는 뜻이었고 남은 설명은 하나였습니다. 핸들이 단색 도형이 아니라 안티앨리어싱이 들어간 비트맵이라 배경과 섞이는 가장자리 픽셀까지 평균에 끼면서 기대치 계산(단순 알파 합성 공식)이 어긋난 탓이었습니다. 코드는 처음부터 정상 동작했고 검증 쪽 계산이 잘못됐던 셈입니다.

## 정리

- "선택 영역 색"은 배경·핸들·글자색 세 가지가 서로 다른 API로 나뉘어 있다
- 핸들 색 변경은 API 29 이상 전용이라 하위 버전에서는 배경색만 적용된다
- 새 드로어블을 만들기보다 플랫폼 기본 드로어블을 mutate 후 tint하는 쪽이 안전하다
- Compose는 View 쪽 API를 그대로 가져다 쓸 수 없고 CompositionLocal로 별도 구현해야 한다
- 화면 수가 많을 때는 화면마다 고치는 대신 이미 존재하는 공통 진입점을 찾아 거기에 붙이는 쪽이 유지보수 관점에서 낫다
- 실측값이 계산과 다르면 코드보다 검증 쪽 가정을 먼저 의심해볼 필요가 있다

