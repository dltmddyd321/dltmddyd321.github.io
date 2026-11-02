---
title: "색 하나 읽다가 멈춘 위젯 — ANR 덤프 읽는 법과 중복 onUpdate"
description: "홈 화면 위젯 갱신 중 메인 스레드가 리소스 조회에서 찍힌 ANR을 추적해, 브로드캐스트 한 번에 달력을 세 번 그리던 중복 onUpdate와 반복 getIdentifier 호출을 정리한 기록입니다."
pubDate: 2026-11-02T08:00:00Z
category: dev-log
tags: ["android", "anr", "appwidget", "broadcastreceiver", "resources"]
aiPreview: "위젯 갱신 중 발생한 ANR 덤프의 맨 윗줄은 색 리소스 조회였지만, 실제 원인은 AppWidgetProvider를 상속하면서 super.onReceive()와 직접 onUpdate()를 함께 불러 시스템 갱신 한 번에 달력을 최대 세 번 그리던 구조와, 42칸마다 getIdentifier()로 색 이름을 다시 찾던 반복 조회였습니다. ACTION_APPWIDGET_UPDATE는 부모로 넘기지 않게 하고 리소스 ID만 캐싱해 그리기를 한 번으로 줄였습니다. 콜드 스타트 초기화 부담은 남아 있어 배포 후 ANR 추이를 다시 볼 예정입니다."
---

ANR 스레드 덤프를 하나 받았는데 스택이 이상했습니다. 메인 스레드 맨 위가 `AssetManager2::FindEntryInternal`, 그 아래로 `Resources.getColor()`가 이어지고, 더 내려가면 홈 화면 위젯의 `onReceive()`가 있었습니다. 색 하나 읽다가 앱이 멈췄다는 얘기처럼 보입니다.

```
main (native)
#00 libandroidfw.so (AssetManager2::FindEntryInternal)
  at android.content.res.Resources.getColor
  at androidx.core.content.ContextCompat.getColor
  at ...ThemeColors.resolve
  at ...WidgetPalette.getLabelOnPrimary
  at ...CalendarWidgetProvider.setDateColor
  at ...CalendarWidgetProvider.drawCalendar
  at ...CalendarWidgetProvider.onUpdate
  at ...CalendarWidgetProvider.onReceive
  at android.app.ActivityThread.handleReceiver
```

> 클래스 이름은 실제 코드와 다르게 바꿔 적었습니다.

## ANR 덤프의 맨 윗줄은 범인이 아닙니다

먼저 짚고 갈 점이 있습니다. 이건 크래시 스택이 아니라 ANR이 났을 때 시스템이 찍은 스레드 덤프입니다. 메인 스레드가 오래 응답하지 않으면 시스템이 그 순간 모든 스레드의 스택을 한 번 찍어 둡니다. 맨 윗줄은 "찍힌 순간 하던 일"일 뿐이고 그 한 줄이 느렸다는 뜻은 아닙니다.

그래서 봐야 할 것은 맨 위가 아니라 흐름 전체입니다. 이 덤프에서 읽히는 건 세 가지였습니다.

- `ActivityThread.handleReceiver` 아래에서 돌고 있으니 브로드캐스트 수신 중이었습니다. 브로드캐스트 리시버는 정해진 시간 안에 `onReceive()`를 끝내야 하고 넘기면 ANR입니다.
- 그 안에서 위젯 달력 전체를 그리고 있었습니다.
- 다른 스레드를 보면 Firebase, 분석 SDK, 광고 SDK 스레드가 막 만들어진 상태였습니다. 위젯 갱신 브로드캐스트 때문에 프로세스가 새로 뜬 콜드 스타트였다는 뜻입니다. `Application.onCreate()`의 초기화가 같은 시간 예산을 먼저 깎아 먹은 상태에서 위젯을 그린 겁니다.

## 원인 1: 한 번 받은 브로드캐스트에 달력을 세 번 그렸습니다

위젯 Provider의 `onReceive()`는 대략 이런 모양이었습니다.

```kotlin
override fun onReceive(context: Context?, intent: Intent?) {
    super.onReceive(context, intent)
    // 클릭한 버튼에 따라 상태 설정 (이전/다음 달, 동기화 등)
    ...
    val ids = appWidgetManager.getAppWidgetIds(thisWidget)
    super.onReceive(context, intent)
    onUpdate(context, appWidgetManager, ids)
}
```

`AppWidgetProvider.onReceive()`는 `ACTION_APPWIDGET_UPDATE`를 받으면 인텐트에 담긴 위젯 ID로 `onUpdate()`를 호출합니다. 그런데 여기서는 `super.onReceive()`를 두 번 부르고 마지막에 `onUpdate()`를 또 직접 부릅니다. 시스템이 보내는 갱신 브로드캐스트(위젯 추가, 주기 갱신, 앱 업데이트 후 갱신)가 오면 `onUpdate()`가 세 번 돌았습니다. 다른 위젯들도 `super.onReceive()` 한 번에 직접 `onUpdate()` 한 번, 즉 두 번씩 그리고 있었습니다.

직접 부르는 `onUpdate()`는 지울 수 없었습니다. 이전/다음 달 이동이나 동기화 버튼은 앱이 직접 만든 `APPWIDGET_UPDATE` 인텐트를 보내는데, 여기에는 `EXTRA_APPWIDGET_IDS`가 없습니다. 그래서 `super.onReceive()`는 아무 일도 하지 않고 실제 갱신은 직접 부르는 `onUpdate()`가 맡고 있었습니다.

## 원인 2: 셀마다 색을 문자열 이름으로 다시 찾았습니다

달력은 6주 × 7일, 42칸입니다. 칸마다 날짜 색을 정하면서 테마 색을 읽는데, 기본 테마의 색 값은 hex가 아니라 `color_palette_blue_500` 같은 리소스 이름이었습니다. 읽을 때마다 이렇게 풀었습니다.

```kotlin
fun resolveColorValue(value: String): Int {
    if (value.startsWith("#")) return Color.parseColor(value)
    val resId = context.resources.getIdentifier(value, "color", context.packageName)
    return if (resId != 0) ContextCompat.getColor(context, resId) else Color.WHITE
}
```

`getIdentifier()`는 이름 문자열로 리소스 테이블을 뒤지는 API라 느립니다. 공식 문서도 ID로 직접 접근하는 것보다 훨씬 느리니 쓰지 말라고 적어 둘 정도입니다. 이게 칸 수 × 색 종류 × 그리기 횟수(최대 3번)만큼 반복됐습니다. 덤프에서 메인 스레드가 마침 리소스 조회 중에 찍힌 것도 이 때문이라고 봅니다. 가장 자주 하던 일이니 찍힐 확률도 가장 높습니다.

## 고친 것

**중복 그리기 제거.** 공통 부모 Provider에서 `ACTION_APPWIDGET_UPDATE`일 때는 `super.onReceive()`로 넘기지 않게 했습니다.

```kotlin
override fun onReceive(context: Context?, intent: Intent?) {
    if (intent?.action == AppWidgetManager.ACTION_APPWIDGET_UPDATE) return
    super.onReceive(context, intent)
}
```

각 위젯이 마지막에 직접 부르는 `onUpdate()`는 그 Provider의 위젯 ID 전체를 대상으로 하니, 시스템이 보낸 ID 목록이 빠져도 갱신되지 않는 위젯은 없습니다. 위젯을 새로 추가한 경우에도 갱신 브로드캐스트가 올 때는 이미 ID가 등록된 뒤라 목록에 들어 있습니다. 삭제, 크기 변경, 활성화 같은 다른 액션은 그대로 부모에게 넘깁니다. 두 번 부르던 `super.onReceive()`는 상태를 다 설정한 뒤의 한 번만 남겼습니다.

**리소스 ID 캐싱.** 이름으로 찾은 리소스 ID를 맵에 저장해 두고 다시 씁니다.

```kotlin
private val colorResIdCache = ConcurrentHashMap<String, Int>()

val resId = colorResIdCache.getOrPut(value) {
    context.resources.getIdentifier(value, "color", context.packageName)
}
```

캐싱한 건 ID뿐이고 색 자체는 아닙니다. 리소스 ID는 빌드 때 정해져서 프로세스가 사는 동안 바뀌지 않지만 같은 ID가 가리키는 색은 라이트/다크 설정에 따라 달라지기 때문입니다. 색까지 캐싱했다면 다크 모드로 바꿔도 위젯 색이 그대로 남았을 겁니다.

결과적으로 갱신 한 번에 그리기는 1번이 되고, `getIdentifier()`는 색 이름 종류만큼만 불립니다.

## 다시 안 나느냐고 묻는다면

이번 수정으로 메인 스레드에서 하던 일의 양은 크게 줄었습니다. 그래도 "다시는 안 난다"고는 말하지 않으려 합니다.

- 위젯 그리기 자체는 여전히 `onReceive()` 안, 메인 스레드에서 한 번은 돕니다. 달력 데이터 조회는 원래 IO 스레드에서 하고 있었지만 RemoteViews를 채우는 일은 메인 스레드 몫입니다.
- 콜드 스타트 때 `Application.onCreate()`가 무거운 문제는 그대로입니다. 저사양 기기에서 초기화만으로 시간을 많이 쓰면, 남은 시간 안에 한 번 그리는 것도 빠듯할 수 있습니다.

그래서 배포 후 Play Console에서 이 스택의 ANR 건수가 줄어드는지 보고, 남아 있으면 다음 단계로 `goAsync()`로 그리기를 리시버 밖으로 빼거나 위젯 갱신 때 불필요한 SDK 초기화를 미루는 쪽을 볼 생각입니다.

## 정리

- ANR 덤프의 맨 윗줄은 "그 순간 하던 일"입니다. 범인을 찾으려면 어떤 콜백 안에서, 무엇을, 몇 번 하고 있었는지를 봐야 합니다.
- `AppWidgetProvider`를 상속하면서 `super.onReceive()`와 직접 `onUpdate()`를 같이 부르면, 시스템 갱신 때 두 번 그리게 됩니다.
- `getIdentifier()`를 반복 경로에서 쓰고 있다면 ID를 캐싱하되, 색이나 drawable 같은 설정 의존 값까지 캐싱하지는 않아야 합니다.

<!-- HUMANIZE-SUMMARY v1.6.1
run_id: 2026-11-02-001
mode: monolith (route_hint light, 강도 보수)
metrics:
  char_in: 4539
  char_out: 4533
  change_rate: 약 0.2% (쉼표 6개 삭제, 자가 산출 참고값)
  self_check: 6/6
  grade: B
categories:  # before → after
  C-11 연결어미(-고/-지만) 뒤 쉼표: 7 → 1 (가독성 위해 1건 의도적 보존)
  C-10 콜론 부제 헤딩: 2 → 2 (헤딩 구조 유지 지시로 보존)
  D-1 결산 lexicon: 1 → 1 (임계 미만)
  A·D·G·H·I 기타 S1/S2: 0 → 0
self_check:
  - 고유명사·수치·인용·코드 블록·백틱·인용(>) 100% 보존: ✅
  - 변경률 30% 이하: ✅
  - 장르 이탈 없음(기술 블로그): ✅
  - register 보존(-습니다체, '~한 겁니다' 구어 종결 유지): ✅
  - S1 잔존 0건(C-11 6회 미만으로 하향): ✅
  - 인공 표현 추가 없음(삭제만 수행): ✅
highlights:
  - id: C-11
    before: "\"찍힌 순간 하던 일\"일 뿐이고, 그 한 줄이 느렸다는 뜻은 아닙니다."
    after: "\"찍힌 순간 하던 일\"일 뿐이고 그 한 줄이 느렸다는 뜻은 아닙니다."
  - id: C-11
    before: "`onReceive()`를 끝내야 하고, 넘기면 ANR입니다."
    after: "`onReceive()`를 끝내야 하고 넘기면 ANR입니다."
  - id: C-11
    before: "`super.onReceive()`를 두 번 부르고, 마지막에 `onUpdate()`를 또 직접 부릅니다."
    after: "`super.onReceive()`를 두 번 부르고 마지막에 `onUpdate()`를 또 직접 부릅니다."
  - id: C-11
    before: "바뀌지 않지만, 같은 ID가 가리키는 색은"
    after: "바뀌지 않지만 같은 ID가 가리키는 색은"
  - id: C-11
    before: "IO 스레드에서 하고 있었지만, RemoteViews를 채우는 일은"
    after: "IO 스레드에서 하고 있었지만 RemoteViews를 채우는 일은"
residual_findings:
  - C-11 (S2 수준): "줄어드는지 보고, 남아 있으면" 쉼표 1건 보존 — 긴 문장의 절 경계 가독성용
  - C-10 (S2): "원인 1: ~", "원인 2: ~" 헤딩 — 헤딩 구조 유지 지시로 미수정
grade_reason: "B — S1 0건, 자체검증 6/6 통과. 원문이 이미 low risk라 변경률이 A 기준 하한(10%)에 못 미쳐 B. 보수 강도상 의도된 결과."
-->
