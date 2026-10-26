---
title: "화면이 재생성돼도 끝나야 하는 작업 — NonCancellable"
description: "라이트에서 다크 테마로 바꾸면 Activity가 재생성되면서 lifecycleScope가 취소되고, 서버에 테마를 알리는 요청이 빠지던 문제를 NonCancellable로 고친 기록입니다."
pubDate: 2026-10-26T07:30:00Z
category: dev-log
tags: ["android", "coroutine", "noncancellable", "lifecycle", "dark-mode"]
aiPreview: "라이트 테마에서 다크 테마로 바꾸면 야간 모드 갱신으로 Activity가 재생성되고, lifecycleScope가 취소되면서 테마 적용 뒤에 서버에 알리는 코드가 실행되지 않았습니다. 기기와 서버의 테마가 어긋나 동기화 때마다 이전 테마를 받으라는 창이 떴습니다. 이전 버전에서는 우연히 순서가 맞았을 뿐이었고, 적용과 서버 반영을 withContext(Dispatchers.IO + NonCancellable)로 묶어 끝까지 실행되게 했습니다. CancellationException을 실패로 잡던 catch도 함께 고쳤고, NonCancellable은 짧고 끊기면 상태가 어긋나는 작업에만 쓰는 게 맞다고 정리했습니다."
---

테마를 바꾸고 메인 화면으로 돌아와 동기화를 누르면, 방금 바꾼 테마를 버리고 이전 테마를 다시 받겠냐는 창이 떴습니다. 같은 라이트 테마끼리 바꿀 때는 멀쩡했고 라이트 테마에서 다크 테마로 넘어갈 때만 생겼습니다.

## 구조

테마 적용은 두 단계로 되어 있었습니다.

1. 테마 리소스를 내려받아 기기에 적용한다
2. 서버에 "이 사용자의 테마는 이제 X다"라고 알린다

동기화할 때는 서버에 저장된 테마와 기기의 테마를 비교해서 다르면 서버 쪽 테마를 받을지 묻습니다. 그러니 창이 떴다는 건 2번이 빠졌다는 뜻입니다.

코드는 대략 이랬습니다.

```kotlin
lifecycleScope.launch {
    val isSuccess = withContext(Dispatchers.IO) { themeManager.apply(theme) }
    hideProgress()
    if (isSuccess) {
        showToast()
        notifyServer()
    }
}
```

## 로그로 본 순서

debug 빌드의 HTTP 로그를 걸고 재현했습니다. 테마 이미지 다운로드가 끝나고 17ms 뒤에 `Activity.recreate()`가 찍혔고, 서버에 알리는 요청은 끝까지 나가지 않았습니다.

원인은 `apply()` 안에 있었습니다. 테마를 저장하는 순간 다크 모드 여부가 바뀌면 `AppCompatDelegate`로 야간 모드를 갱신하는데, 그러면 떠 있는 Activity가 전부 재생성됩니다. 재생성되면서 기존 Activity의 `lifecycleScope`가 취소됩니다. `withContext` 블록 안의 작업은 이미 끝났어도, 블록에서 돌아오는 순간 취소된 스코프라 `CancellationException`이 나고 그 뒤의 `notifyServer()`는 실행되지 않습니다.

결과적으로 기기에는 새 테마가, 서버에는 이전 테마가 남았습니다.

## 예전에는 왜 괜찮았나

이전 버전에서 테스트할 때는 이런 일이 없었습니다. 비교해 보니 같은 날 `apply()` 끝에 위젯 갱신 호출을 하나 추가했습니다. 위젯 여러 개에 broadcast를 보내는 작업이라 반환이 조금 늦어졌습니다.

그전에는 `apply()`가 재생성보다 먼저 돌아와서 우연히 순서가 맞았던 것으로 보입니다. 원래부터 순서에 기대는 구조였고 몇 ms가 늘어나자 드러난 셈입니다.

## NonCancellable로 묶기

위젯 갱신을 빼서 예전 타이밍으로 돌리는 방법도 있었지만 그건 다시 운에 맡기는 일입니다. 대신 "적용"과 "서버에 알리기"를 화면 수명과 떼어서 한 묶음으로 끝까지 실행되게 했습니다.

```kotlin
lifecycleScope.launch {
    val isSuccess = withContext(Dispatchers.IO + NonCancellable) {
        themeManager.apply(theme).also { if (it) notifyServer() }
    }
    hideProgress()
    if (isSuccess) showToast()
}
```

`NonCancellable`을 컨텍스트에 더하면 바깥 스코프가 취소돼도 블록 안은 끝까지 실행됩니다. 블록에서 돌아올 때는 여전히 `CancellationException`이 나서 `hideProgress()`, `showToast()`는 실행되지 않습니다. 이 둘은 사라진 화면의 UI라 실행되지 않는 게 맞습니다. 재생성된 화면은 새 테마를 읽어서 다시 그립니다.

나눈 기준은 하나였습니다. 화면이 사라져도 반드시 끝나야 하는 일은 블록 안에 두고, 화면이 있어야 의미가 있는 일은 블록 밖에 둡니다.

## 함께 고친 것

다른 화면에도 같은 구조가 있었는데, 거기는 이렇게 감싸져 있었습니다.

```kotlin
val isSuccess = try {
    withContext(Dispatchers.IO) { themeManager.apply(theme) }
} catch (e: Exception) {
    logError(e)
    false
}
```

`CancellationException`도 `Exception`이라 여기서 잡힙니다. 그래서 화면이 재생성되면 성공한 작업이 실패로 기록되고, 에러 로그까지 남았습니다. 취소 예외는 먼저 다시 던지게 했습니다.

```kotlin
} catch (e: CancellationException) {
    throw e
} catch (e: Exception) {
```

## 주의할 점

`NonCancellable`은 취소를 무시하는 도구라 아무 데나 쓰면 안 됩니다. 사용자가 화면을 나가면 멈춰야 하는 긴 다운로드에 붙이면 오히려 자원을 낭비합니다. 이번처럼 짧고 중간에 끊기면 상태가 어긋나는 작업에만 썼습니다.

더 길거나 앱이 꺼져도 끝나야 하는 작업이라면 Application 수준의 스코프나 WorkManager로 옮기는 게 맞습니다. 이번 작업은 몇 초 안에 끝나고 화면 재생성 정도만 버티면 됐기 때문에 `NonCancellable`로 충분했습니다.

