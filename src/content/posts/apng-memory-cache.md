---
title: "움직이는 스티커가 메모리를 놓지 않던 이유 - APNG 캐시를 용량 기준으로 바꾸며"
description: "디코딩한 APNG를 캐시에서 빼도 메모리가 바로 돌아오지 않았습니다. 프레임을 네이티브 메모리에 미리 풀어두는 라이브러리 구조와 개수 기준 LruCache가 겹친 결과였고, 공식 문서의 비트맵 캐시 기준을 따라 용량 기준 상한과 안전한 해제로 바꾼 과정을 정리했습니다."
pubDate: 2026-10-02T08:00:00Z
category: dev-log
tags: ["android", "memory", "apng", "lrucache", "performance"]
aiPreview: "LINE apng-drawable은 디코딩할 때 모든 프레임을 네이티브 메모리에 미리 풀어두고, recycle()을 부르지 않으면 GC가 finalize할 때까지 메모리를 놓지 않습니다. 그런데 APNG 캐시는 sizeOf 없이 개수 20개 기준이라 큰 스티커가 쌓이면 수백 MB까지 갈 수 있었고, 캐시에서 빠진 항목도 해제하지 않았습니다. 공식 Caching Bitmaps 문서처럼 KB 단위로 재고 상한은 memoryClass의 1/8로 잡았으며, 화면에서 쓰는 중인지 Drawable.getCallback()으로 확인해 보이는 것은 해제하지 않고 나중에 해제하도록 했습니다. 해제 대기 목록은 약한 참조로 두고, 상한보다 큰 APNG는 캐시에 넣지 않습니다."
---

상점 화면을 손보면서 움직이는 스티커(APNG)를 보여주는 컴포넌트도 다시 열어봤습니다.
지난번에 같은 이미지를 여러 화면에서 공유하다 애니메이션이 멈추던 문제는 고쳤는데, 이번에는 메모리 쪽이 걸렸습니다.
디코딩한 APNG를 캐시에 넣어두는데, 캐시에서 빠진 뒤에도 메모리가 바로 돌아오지 않았습니다.
원인과 고친 방식을 기록해봅니다.

## APNG 한 장이 차지하는 메모리

APNG 표시에는 LINE의 [apng-drawable](https://github.com/line/apng-drawable) 라이브러리를 쓰고 있습니다.
소스를 보면 `ApngDrawable`은 파일을 디코딩할 때 애니메이션의 모든 프레임을 미리 풀어서 네이티브 메모리에 올립니다.
라이브러리 안의 `Apng` 클래스에는 `allFrameByteCount`라는 값이 있는데, 주석에 "The size of memory required for this image in the native layer"라고 적혀 있습니다.

프레임을 미리 다 풀어두기 때문에 재생할 때는 가볍습니다.
대신 한 장이 차지하는 메모리가 생각보다 큽니다.
300×300 크기에 30프레임이면 ARGB 기준으로 300 × 300 × 4바이트 × 30 ≈ 10.8MB입니다.

그리고 이 메모리는 자바 힙이 아니라 네이티브 영역에 있습니다.
라이브러리는 `recycle()`을 부르면 바로 해제하고, 부르지 않으면 `finalize()`에서 해제합니다.
`finalize()`는 GC가 그 객체를 정리할 때 불리는데, GC는 자바 힙이 찰 때를 기준으로 돕니다.
`ApngDrawable` 객체 자체는 작으니 GC 입장에서는 급할 게 없고 그동안 네이티브 메모리는 그대로 남습니다.

## 캐시가 개수 기준이었습니다

스크롤로 같은 스티커가 다시 보일 때마다 디코딩하지 않으려고 메모리 캐시를 두고 있었습니다.

```kotlin
val cache = LruCache<String, ApngDrawable>(20)
```

`LruCache`는 `sizeOf()`를 따로 정하지 않으면 항목 하나의 크기를 1로 셉니다.
그래서 위 코드는 "최대 20개"라는 뜻이고 한 개가 0.4MB든 30MB든 똑같이 1로 계산합니다.
작은 스티커만 쌓이면 몇 MB에서 끝나지만 큰 스티커가 쌓이면 수백 MB까지 갈 수 있었습니다.
실제로 얼마나 쓸지 코드만 봐서는 알 수 없는 상태였습니다.

캐시에서 밀려난 항목도 그냥 버려졌습니다.
`LruCache`는 항목이 빠질 때 `entryRemoved()`를 불러주는데, 기본 구현은 아무것도 하지 않습니다.
앞에서 본 것처럼 `recycle()`을 부르지 않으면 네이티브 메모리는 GC를 기다립니다.

앱이 백그라운드로 갈 때 메모리를 비우려고 캐시를 `evictAll()`하는 코드도 있었는데, 같은 이유로 실제로는 거의 비워지지 않았습니다.

## 공식 문서의 기준

안드로이드 공식 문서의 [Caching Bitmaps](https://developer.android.com/topic/performance/graphics/cache-bitmap)는 메모리 캐시 크기를 이렇게 잡는 예시를 보여줍니다.

```kotlin
val maxMemory = (Runtime.getRuntime().maxMemory() / 1024).toInt()
val cacheSize = maxMemory / 8

memoryCache = object : LruCache<String, Bitmap>(cacheSize) {
    override fun sizeOf(key: String, bitmap: Bitmap): Int {
        return bitmap.byteCount / 1024
    }
}
```

핵심은 두 가지입니다.
캐시 크기를 개수가 아니라 실제 바이트(여기서는 KB)로 재고, 상한은 기기가 앱에 허용하는 메모리의 일부로 잡습니다.
문서에는 "모든 앱에 맞는 크기나 공식은 없다"는 말과 함께, 너무 작으면 이득 없이 비용만 들고 너무 크면 OOM이 난다는 설명도 붙어 있습니다.
한 화면에 이미지가 몇 장 보이는지, 이미지 한 장이 얼마를 차지하는지를 보고 정하라는 것입니다.

## 바꾼 방식

같은 원칙을 APNG 캐시에 그대로 적용했습니다.

```kotlin
val maxKb = memoryClassMb * 1024 / 8

val cache = object : LruCache<String, ApngDrawable>(maxKb) {
    override fun sizeOf(key: String, value: ApngDrawable): Int =
        (value.allocationByteCount / 1024).toInt()

    override fun entryRemoved(evicted: Boolean, key: String, oldValue: ApngDrawable, newValue: ApngDrawable?) {
        if (oldValue === newValue) return
        if (oldValue.callback == null) oldValue.recycle() else releaseLater(oldValue)
    }
}
```

`sizeOf()`에는 라이브러리가 알려주는 `allocationByteCount`를 넣었습니다.
네이티브에 올라간 모든 프레임과 그리기용 비트맵 하나를 합친 값입니다.

상한은 [`ActivityManager.getMemoryClass()`](https://developer.android.com/reference/android/app/ActivityManager#getMemoryClass())의 1/8로 잡았습니다.
`memoryClass`는 시스템이 이 기기에서 앱 하나에 허용하는 메모리를 MB 단위로 알려주는 값입니다.
공식 예시의 `maxMemory()`와 같은 성격의 값이고 고사양 기기에서는 크게, 저사양 기기에서는 작게 나옵니다.
APNG 프레임은 자바 힙 밖에 있어서 이 값과 직접 연결되지는 않습니다.
그래도 기기의 메모리 여유를 가늠하는 기준으로는 쓸 만하다고 판단했습니다.
고정값으로 정하면 저사양 기기에는 부담이 되고 고사양 기기에서는 여유가 남아서 기기에 맞춰 늘고 주는 쪽을 택했습니다.

## 화면에 보이는 것은 해제하지 않습니다

캐시에서 빠진다고 바로 `recycle()`하면 안 되는 경우가 있습니다.
그 APNG가 지금 화면의 이미지에 붙어서 재생 중일 수 있기 때문입니다.
캐시는 캐시대로 원본을 들고 있고 화면에는 그 원본이 그대로 붙어 있는 구조라서, 해제하면 보이던 애니메이션이 깨집니다.

그래서 [`Drawable.getCallback()`](https://developer.android.com/reference/android/graphics/drawable/Drawable#getCallback())을 확인합니다.
Drawable은 자기를 그려주는 View를 콜백으로 하나 들고 있고 어느 View에도 붙어 있지 않으면 이 값이 `null`입니다.

- 콜백이 없으면 아무 화면도 쓰지 않으니 바로 해제합니다
- 콜백이 있으면 "나중에 해제할 목록"에 넣어두고 그 View가 이미지를 내려놓을 때 해제합니다

나중에 해제할 목록은 `WeakHashMap`을 바탕으로 한 Set으로 만들었습니다.
화면에 붙기도 전에 사라진 항목을 이 목록이 붙잡고 있으면 GC도 회수하지 못하기 때문입니다.
약한 참조로 두면 최악의 경우에도 예전처럼 GC 시점에 `finalize()`로 정리됩니다.

상한보다 큰 APNG는 캐시에 넣지 않습니다.
`LruCache`는 넣는 순간 상한을 넘으면 바로 밀어내는데, 그러면 디코딩하자마자 해제된 걸 화면에 붙이게 됩니다.
이런 건 그 화면에서만 쓰고 화면에서 내려갈 때 해제합니다.

## 아직 확인할 것

상한이 정말 적당한지는 실제 스티커 크기를 봐야 알 수 있습니다.
디코딩할 때마다 크기와 상한을 로그로 남기게 해두었고 상점을 스크롤하면서 한 화면에 보이는 스티커들이 상한 안에 들어오는지 확인할 생각입니다.
공식 문서가 말한 것처럼 정답 공식이 있는 게 아니라서 측정값을 보고 비율을 조정할 수 있습니다.

## 정리

- APNG 라이브러리는 프레임을 미리 풀어 네이티브 메모리에 두고 `recycle()`을 부르지 않으면 GC가 돌 때까지 메모리가 남습니다
- `LruCache`는 `sizeOf()`를 정하지 않으면 개수로 셉니다. 크기가 제각각인 항목은 바이트로 재야 상한이 의미가 있습니다
- 캐시 상한은 고정값보다 기기가 허용하는 메모리에 비례해서 잡는 편이 공식 문서의 권장과도 맞습니다
- 캐시에서 빠졌다고 바로 해제하지 말고, 화면에서 쓰는 중인지 `Drawable.getCallback()`으로 확인합니다
- 해제를 미뤄두는 목록은 약한 참조로 둬서 그 목록 때문에 오히려 메모리가 묶이지 않게 합니다
