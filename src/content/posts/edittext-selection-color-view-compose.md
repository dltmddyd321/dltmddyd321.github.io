---
title: "EditText 선택 영역 색을 View와 Compose 양쪽에 입히기"
description: "텍스트 드래그 시 보이는 배경·핸들 색을 앱 테마 컬러로 바꾸는 작업을 View 시스템과 Compose 양쪽에서 진행하며 겪은 API 차이와 커버리지 문제를 기록합니다."
pubDate: 2026-09-11T13:00:00Z
category: dev-log
tags: ["android", "kotlin", "jetpack-compose", "ui"]
aiPreview: EditText 텍스트 선택 시 배경과 드래그 핸들 색을 앱 테마 컬러로 바꾸는 작업 기록입니다. highlightColor는 API 제약 없이 바로 되지만 핸들 색 변경은 API 29 이상에서만 가능하고, Compose는 아예 다른 CompositionLocal 메커니즘을 씁니다. 화면 수십 개에 흩어진 입력창을 하나씩 고치는 대신 이미 모든 화면이 거쳐가는 공통 진입점 4곳에 훅을 걸어 해결했습니다.
---

텍스트를 드래그해서 선택하면 배경이 옅게 깔리고 좌우에 물방울 모양 핸들이 뜹니다. 해당 부분의 색상을 커스터마이징 처리한 작업 기록에 대해 남겨봅니다.

![KakaoTalk_Photo_2026-09-11-15-50-58.jpeg](/uploads/1789109484393-KakaoTalk_Photo_2026-09-11-15-50-58.jpeg)

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

Compose에서는 `LocalTextSelectionColors`라는 CompositionLocal에 `TextSelectionColors(handleColor, backgroundColor)`를 제공하는 방식입니다.

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

이 컴포저블로 `setContent { }` 블록을 감싸기만 하면 그 안의 모든 `TextField`/`BasicTextField`가 같은 색을 쓰게 됩니다.
