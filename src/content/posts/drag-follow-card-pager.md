---
title: "넘기다 멈출 수 있는 카드 페이저 — Fling 대신 진행률로"
description: "Fling 감지 후 고정 애니메이션만 재생하던 날짜 카드 넘기기를, 손가락을 따라 움직이고 두 날짜 사이에서 멈출 수 있는 드래그 방식으로 바꾼 기록입니다."
pubDate: 2026-11-05T04:30:00Z
category: dev-log
tags: ["android", "touch", "gesture", "animation", "custom-view"]
aiPreview: "날짜 카드를 좌우로 넘기는 화면이 Fling 감지 후 250ms 애니메이션을 처음부터 끝까지 재생하는 구조라, 넘기는 도중에 멈출 수 없었습니다. 애니메이션의 시작과 끝을 진행률 0과 1로 보고 손가락 이동량으로 진행률을 정해 가운데 카드와 들어오는 카드의 위치·크기·투명도를 매번 다시 배치했습니다. 터치는 부모의 onInterceptTouchEvent에서 가로 드래그일 때만 가져오고, 가로로 스크롤되는 자식과 ItemTouchHelper 드래그는 피했습니다. 손을 떼면 VelocityTracker 속도와 이동 거리로 넘길지 정하고, 같은 배치 함수를 ValueAnimator로 남은 구간만 이어서 움직였습니다."
---

날짜별 카드를 좌우로 넘기는 화면이 있습니다.
가운데에 오늘 카드가 크게 있고, 양옆에 전날과 다음 날 카드가 작고 흐리게 걸쳐 보이는 형태입니다.
그런데 이 화면은 넘기는 도중에 멈출 수가 없었습니다.
손가락을 조금 끌다가 멈춰도 카드는 꿈쩍하지 않고 손을 떼는 순간 넘어가거나 아무 일도 없거나 둘 중 하나였습니다.
손가락을 따라 카드가 움직이고 두 날짜 사이 어디서든 멈춰서 양쪽을 볼 수 있게 바꿨고 그 과정을 기록해봅니다.

## 왜 중간에 멈출 수 없었나

이 화면은 ViewPager를 쓰지 않고 카드 뷰 몇 장을 직접 움직이는 구조입니다.
날짜를 넘기는 트리거는 Fling 감지 하나뿐이었습니다.

```kotlin
override fun onFling(down, up, velocityX, velocityY) {
    if (가로로 충분히 움직였고 && 속도가 기준 이상) {
        playPageAnimation(next = 왼쪽으로 튕겼는지)
    }
}
```

손가락이 움직이는 동안에는 아무것도 하지 않습니다.
손을 뗄 때 조건이 맞으면 250ms짜리 애니메이션을 처음부터 끝까지 재생합니다.
그러니 사이 상태가 존재할 수 없었습니다.

![기존 방식. 끄는 동안 카드는 움직이지 않고, 손을 떼는 순간 고정 애니메이션이 한 번에 재생됩니다](/uploads/1793864000000-card-pager-before-fling.gif)

## 애니메이션의 진행을 손가락이 쥐게 하기

기존 애니메이션을 다시 보면 결국 두 상태 사이를 오가는 일이었습니다.

- 시작: 가운데 카드는 원래 크기, 옆 카드는 0.9배 크기에 반투명
- 끝: 들어온 카드가 가운데 원래 크기, 나간 카드가 옆자리 0.9배에 반투명

그래서 0에서 1 사이의 진행률 하나를 두고, 손가락 이동량으로 이 값을 정하기로 했습니다.
0이면 지금 화면, 1이면 기존 애니메이션이 끝난 화면입니다.
그 사이 값이면 두 상태 사이 어딘가에 카드를 놓으면 됩니다.

```kotlin
progress = abs(fingerOffset) / distanceToSideSlot   // 0f..1f
```

`distanceToSideSlot`은 가운데에서 옆 카드 자리까지의 거리입니다.
딱 그만큼 끌면 1이 됩니다.

## 터치를 언제 가져올지

카드 안에는 세로로 스크롤되는 목록도 있고 가로로 스크롤되는 버튼 줄도 있습니다.
그래서 가장 바깥 컨테이너의 `onInterceptTouchEvent`에서 가로 드래그인지 먼저 판단했습니다.

```kotlin
override fun onInterceptTouchEvent(ev): Boolean {
    when (ev.action) {
        DOWN -> 시작 좌표 기록, 자식에게 그대로 전달
        MOVE -> if (!dragging && shouldStartDrag(ev)) dragging = true
    }
    return dragging
}

fun shouldStartDrag(ev): Boolean {
    val dx = ev.x - downX
    val dy = ev.y - downY
    if (abs(dx) <= touchSlop || abs(dx) <= abs(dy)) return false
    if (다른 제스처가 진행 중) return false
    return !childCanScrollHorizontally(ev.x, ev.y, direction = -sign(dx))
}
```

DOWN은 가져가지 않습니다.
탭이나 길게 누르기는 예전처럼 자식이 받습니다.
가로로 Touch Slop을 넘고 세로보다 많이 움직였을 때만 `true`를 돌려 터치를 가져옵니다.
이 순간 자식들은 `ACTION_CANCEL`을 받기 때문에 목록 스크롤이나 기존 Fling 감지와 동시에 돌지 않습니다.

`childCanScrollHorizontally`는 손가락 아래에 있는 뷰를 재귀로 찾아 `canScrollHorizontally()`를 물어봅니다.
가로 버튼 줄 위에서 끌면 그 줄이 스크롤되고 날짜는 넘어가지 않습니다.

항목을 길게 눌러 순서를 바꾸는 기능도 같은 목록에 있는데, 이건 따로 막을 필요가 없었습니다.
ItemTouchHelper가 드래그를 시작하면 부모에게 `requestDisallowInterceptTouchEvent(true)`를 보내기 때문에 위 판단 자체가 불리지 않습니다.

## 진행률 하나로 카드 배치

드래그 방향이 정해지면 먼저 대기 중인 카드 한 장에 들어올 날짜를 미리 로드해 옆자리에 둡니다.
원래 그 자리에 있던 미리보기 카드는 겹치지 않게 투명하게 숨깁니다.
그다음부터는 MOVE가 올 때마다 진행률로 세 카드를 다시 놓습니다.

```kotlin
fun applyProgress(p: Float) {
    val side = distanceToSideSlot * direction
    centerCard.translationX = -side * p
    centerCard.setScaleAlpha(lerp(1f, 0.9f, p), lerp(1f, 0.5f, p))

    incomingCard.translationX = side * (1 - p)
    incomingCard.setScaleAlpha(lerp(0.9f, 1f, p), lerp(0.5f, 1f, p))

    oppositePreview.translationX = -side * (1 + p)
}
```

| 카드 | 위치 | 크기, 투명도 |
|---|---|---|
| 가운데 카드 (나가는 쪽) | 가운데 → 옆자리 | 1.0 → 0.9배, 100% → 50% |
| 들어오는 카드 | 옆자리 → 가운데 | 0.9 → 1.0배, 50% → 100% |
| 반대편 미리보기 | 옆자리 → 더 바깥 | 그대로 |

드래그 도중 방향을 바꾸면 대기 카드에 반대쪽 날짜를 다시 로드합니다.

## 손을 뗄 때

`VelocityTracker`로 마지막 속도를 구해서 넘길지 정합니다.

```kotlin
fun release() {
    val v = velocityTracker.xVelocity
    val flingForward = abs(v) > minFling && v 방향 == 넘기는 방향
    val flingBack = abs(v) > minFling && v 방향 == 반대 방향
    val commit = !flingBack && (flingForward || progress >= 0.35f)
    settle(target = if (commit) 1f else 0f)
}
```

35% 이상 끌었거나 넘기는 방향으로 빠르게 튕기면 넘어갑니다.
반대 방향으로 튕기면 얼마나 끌었든 되돌아갑니다.
터치가 시스템에 의해 취소된 경우도 되돌립니다.

마무리 애니메이션은 현재 진행률에서 목표값까지 `ValueAnimator`로 이어서 움직입니다.

```kotlin
fun settle(target: Float) {
    val duration = (250 * abs(target - progress)).coerceAtLeast(80)
    ValueAnimator.ofFloat(progress, target).apply {
        addUpdateListener { applyProgress(it.animatedValue as Float) }
        doOnEnd { if (target == 1f) finishPage() else cancelPage() }
    }.start()
}
```

시간을 남은 거리에 비례해서 주기 때문에 거의 다 끌어 놓고 놓으면 짧게 끝납니다.
애니메이션도 손가락 드래그와 같은 `applyProgress`로 그려서 손을 떼는 지점에서 카드가 튀지 않습니다.

![바꾼 방식. 카드가 손가락을 따라 움직이고 중간에 멈출 수 있으며, 35% 미만에서 놓으면 되돌아가고 그 이상이면 이어서 넘어갑니다](/uploads/1793864000000-card-pager-after-drag.gif)

## 마무리 처리

넘어간 경우에는 가운데 카드와 대기 카드의 참조만 서로 바꿉니다.
화면상으로는 이미 들어온 카드가 가운데에 있으니 아무 변화가 없습니다.
그다음 기존 넘김 로직의 후속 처리, 즉 상단 날짜 갱신이나 연동된 달력 이동 같은 일을 그대로 호출합니다.
상단 날짜가 드래그 중에는 그대로이다가 손을 뗀 뒤에 바뀌는 이유가 이것입니다.

되돌아간 경우에는 모든 카드를 원래 위치와 크기로 돌리고 대기 카드를 숨깁니다.
여기서 하나 놓치기 쉬운 게 있었습니다.
대기 카드에 날짜를 미리 로드하면서 카드 바깥의 공용 UI 상태가 그 날짜 기준으로 바뀔 수 있었습니다.
그래서 취소할 때 현재 가운데 카드 기준으로 그 상태를 다시 맞춥니다.

드래그가 시작되면 넘김 중이라는 플래그를 걸어 두고 마무리에서 풉니다.
그 사이에는 버튼으로 넘기기 같은 기존 경로나 새 드래그가 끼어들지 못합니다.

## 정리

- 중간에 멈출 수 없었던 건 Fling 감지 후 고정 애니메이션을 재생하는 구조였기 때문입니다.
- 애니메이션의 시작과 끝 상태를 진행률 0과 1로 보고, 손가락 이동량으로 진행률을 정했습니다.
- 터치는 부모의 `onInterceptTouchEvent`에서 가로 드래그일 때만 가져오고 가로 스크롤 자식과 다른 드래그 제스처는 피했습니다.
- 손을 떼면 거리와 속도로 넘길지 정하고 같은 배치 함수로 남은 구간만 이어서 움직입니다.
- 넘기는 기준 35%와 Fling 속도 400dp/s는 써 보면서 조정할 값입니다.

