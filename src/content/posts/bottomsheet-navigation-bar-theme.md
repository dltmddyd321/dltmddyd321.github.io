---
title: "바텀시트 내비게이션 바 색이 안 바뀌던 이유"
description: "Bottom Sheet 하단 Navigation Bar 톤을 맞추면서, 처음에 원인으로 지목했던 테마 XML 수정이 실제로는 아무 효과가 없었다는 걸 실기기 측정으로 알게 됐습니다. 실제 원인은 두 개였습니다."
pubDate: 2026-09-04T11:00:00Z
category: dev-log
tags: ["android", "kotlin", "ui", "edge-to-edge"]
aiPreview: "런타임 코드로 Navigation Bar 톤을 뒤집어도 반영이 안 되자 뷰 트리 타이밍을 의심했고, 결국 특정 API 레벨 전용 스타일 리소스에 하드코딩된 속성을 찾아내 원인 규명으로 결론 냈습니다. 그런데 며칠 뒤 증상이 재발했습니다. 실기기를 연결해 화면 픽셀과 런타임 값을 직접 찍어보니, 그 리소스 수정은 처음부터 단 한 번도 작동한 적이 없었습니다. values-night에 넣은 값이 전부 라이트로 해석되고 있었기 때문입니다. 실제 원인은 비동기 캐시보다 먼저 확정돼 버린 나이트 모드, 그리고 시스템이 Navigation Bar 영역에 자동으로 덮는 대비 스크림 두 개였습니다."
---

Bottom Sheet를 팝업하면 기존에 적용된 다크 테마 기반의 토큰 규칙과 달리 하단 시스템 Navigation Bar가 밝게 표시되어 부자연스러움을 야기하는 문제가 있었습니다. 이를 해결하는 과정에서의 시행 착오를 기록해봅니다.
![스크린샷 2026-09-04 오후 2.05.57.png](/uploads/1788498505975------------2026-09-04------2.05.57.png)

## 색은 안전한데 톤이 계속 밝음

다크 테마에서 아이콘 대비를 결정하는 플래그(`isAppearanceLightNavigationBars`류)를 런타임에 명시적으로 뒤집어봐도 반영이 안 됐습니다.
뷰 트리 타이밍 문제라고 판단하고 인셋 콜백이 호출되는 시점, 창이 완전히 준비되는 시점 등을 계속 조정해봤지만 아무 효과가 없었습니다. 
코드 쪽만 계속 들여다본 게 잘못된 방향이었습니다.

## 리소스 XML을 원인으로 지목

특정 API 레벨 전용 스타일 리소스 파일을 열어보니, 실기기 대부분에 실제로 적용되는 그 리소스 안의 바텀시트 다이얼로그 테마에 이런 속성이 하드코딩돼 있었습니다.

```xml
<style name="BottomSheetDialogTheme" parent="...">
    <item name="android:windowLightNavigationBar">true</item>
    <item name="android:navigationBarColor">@color/white</item>
</style>
```

`windowLightNavigationBar=true`는 "이 창의 내비게이션 바는 항상 밝은 톤(아이콘은 어둡게)"이라고 **테마 선언 시점에** 못박아버리는 속성입니다. 다이얼로그 창이 생성되는 순간 이 테마가 곧바로 적용되기 때문에, 이후에 런타임 코드로 같은 플래그를 아무리 뒤집어도 이미 선언된 정적 값을 이길 수 없었던 겁니다. 코드로 뭔가를 "설정"했다고 생각했지만, 실제로는 이미 확정된 값을 다시 덮어쓰려던 것뿐이었습니다.

그래서 이 속성 자체를 리소스 한정자(다크/라이트 변형)로 분리했습니다.

```xml
<!-- values/bools.xml -->
<bool name="is_light_navigation_bar">true</bool>

<!-- values-night/bools.xml -->
<bool name="is_light_navigation_bar">false</bool>
```

```xml
<style name="BottomSheetDialogTheme" parent="...">
    <item name="android:windowLightNavigationBar">@bool/is_light_navigation_bar</item>
    <item name="android:navigationBarColor">@color/system_surface_overlay</item>
</style>
```

앱이 다크 모드를 명시적으로 강제하는 구조였으니 이 한정자 분기가 앱의 테마 상태와 맞아떨어질 것으로 봤습니다.
빌드가 통과하고 화면도 정상으로 보여서, 여기서 원인 규명이 끝났다고 판단했습니다.
그런데 이 수정은 처음부터 아무 효과가 없었습니다. 그걸 며칠 뒤에 알았습니다.

## 재발, 그리고 실기기 측정

며칠 뒤 같은 증상이 다시 올라왔습니다. 이번엔 특정 화면만이 아니었습니다.

그동안 저는 계속 추론만 하고 있었습니다. 라이브러리가 덮어쓰는 게 아닐까, 창이 하단까지 안 닿는 게 아닐까, 테마 컨텍스트가 다른 게 아닐까.
매번 그럴듯했고 매번 틀렸습니다. 실기기를 연결해 값을 직접 찍어보기로 했습니다.

먼저 스크린샷을 떠서 좌표별 RGB를 뽑았습니다. 시트 본문 영역은 다크 테마 토큰 값과 정확히 일치했고, Navigation Bar 영역만 라이트 토큰도 다크 토큰도 아닌 엉뚱한 밝은 회색이었습니다.
색 계산이 틀린 게 아니라, 우리 색이 아닌 무언가가 그 위에 그려지고 있다는 뜻이었죠.

다음은 스트립 뷰의 런타임 상태였습니다. 함수는 호출됐고 색은 올바른 다크 값으로 계산됐습니다. 뷰도 추가됐습니다.
레이아웃 후 좌표는 화면 최하단 인셋 영역과 픽셀 단위로 일치했고, 전체 너비에 가시 상태였습니다.
그런데 화면에는 안 보였습니다.

Material 라이브러리가 개입하는지도 확인해야 했습니다. 캐시된 aar을 디컴파일해 해당 콜백을 읽어보니, 시트 배경 밝기로 Status Bar 대비만 재계산하고 Navigation Bar는 읽기 한 번 외에 건드리지 않더군요.

그리고 창 컨텍스트가 실제로 해석한 리소스 값을 찍었습니다.

```
uiMode = NIGHT_NO                     ← 리소스 설정은 "라이트"
bool/is_light_navigation_bar = true   ← 위에서 넣은 값이 라이트로 해석됨
color/…_overlay = #FFFFFFFF           ← 흰색으로 해석됨
앱 자체 테마 플래그 isDarkTheme = true  ← 앱은 다크
```

`values-night`에 넣은 값이 전부 라이트로 해석되고 있었습니다.
앞 절의 수정은 단 한 번도 작동한 적이 없었고, 그때 화면이 정상으로 보인 건 다른 이유였습니다.

## 나이트 모드가 캐시보다 먼저 확정됨

앱이 다크인데 리소스는 왜 라이트일까.
이 앱은 라이트/다크를 OS 설정이 아니라 자체 테마 플래그로 결정하고, 그 플래그에 맞춰 앱 시작 시 나이트 모드를 명시적으로 못박습니다. 첫 화면이 만들어지기 전에 못박아야 하니 시작 지점에 두는 것 자체는 맞습니다.

문제는 구매형 아이템 테마였습니다. 기본 테마의 다크/라이트는 식별자만 보면 즉시 알 수 있지만, 아이템 테마는 그 정보가 별도 저장소에서 비동기로 로드되는 속성 캐시에 들어 있습니다. 시작 시점의 순서가 이렇게 됩니다.

```
앱 시작
 ├─ 나이트 모드 확정 요청  →  캐시가 아직 null  →  isDark = false  →  "라이트"로 못박음
 └─ (수십 ms 후) 속성 캐시 로드 완료  →  isDark = true  →  다시 맞추는 지점이 없음
```

그래서 아이템 다크 테마를 쓰는 동안 앱 전체의 night 한정 리소스가 반대로 해석되고 있었습니다.
여태 안 들킨 건 이 앱이 색을 거의 전부 런타임 코드로 칠하기 때문입니다. 정적 XML로 색을 참조하는 곳에서만 티가 났고, 그게 하필 Bottom Sheet 테마였죠. 세어보니 정적 참조가 41개 파일 76곳 있었습니다.

판정값을 캐시 적재 때마다 함께 저장해 시작 시점에도 동기적으로 읽게 하고, 캐시 로드가 끝난 뒤 한 번 더 맞추는 것으로 수정했습니다.

```
val isDark get() = themeSystemFlag()?.let { it == "dark" }
    ?: prefs.getBoolean(KEY_IS_DARK, false)   // 캐시가 없을 때의 동기 폴백

fun onAttributeCacheLoaded(attr: Attr?) {
    cache = attr
    attr?.system?.let { prefs.putBoolean(KEY_IS_DARK, it == "dark") }
    syncNightMode()   // 시작 때 잘못 못박힌 값을 여기서 교정
}
```

## 시스템이 덮는 대비 스크림

나이트 모드와 별개로, Navigation Bar의 그 엉뚱한 밝은 회색이 남아 있었습니다.

단서는 우연히 잡혔습니다. 문서상 무시된다고 알려진 `navigationBarColor` 대입을 검증 과정에서 다시 넣어봤더니 화면이 정상이 됐습니다.
그런데 로그를 보면 대입 전후 getter 값이 똑같이 투명(`#0`)이었습니다. 색이 들어가서 고쳐진 게 아니라, 그 setter의 부작용이 뭔가를 건드린 겁니다.

앞에서 한 실수를 반복하지 않으려고, 한 번에 하나씩만 바꾸는 A/B로 후보를 좁혔습니다.

| 바꾼 것 | 결과 |
|---|---|
| 무시되는 색 대입을 다시 넣음 | 정상. 다만 왜인지는 불명확 |
| 그 대입만 제거 | 재발. 이 대입이 원인이라는 건 확정 |
| 창을 명시적으로 edge-to-edge로 선언 | 재발. 이건 아님 |
| Navigation Bar 대비 스크림 끄기 | 정상. 여기서 확정 |

범인은 시스템이 Navigation Bar 아이콘 가독성을 위해 그 영역에 자동으로 덮는 반투명 보호막이었습니다.
앱이 그 영역을 직접 칠하는지와 무관하게 얹히기 때문에, 스트립 뷰가 정확한 위치와 크기와 색으로 멀쩡히 있어도 그 위를 덮고 있었던 거죠.
앞서 무시되는 색 대입이 통한 것도, 그 setter가 내부적으로 앱이 이 영역을 직접 관리한다는 상태를 함께 세우면서 스크림을 비활성화했기 때문이었습니다.

```
fun applyDialogSystemBarTheme(window: Window) {
    insetsController(window).isAppearanceLightNavigationBars = !isDarkTheme

    if (!isEdgeToEdgeForced()) {
        window.navigationBarColor = navBarColor   // 구버전에선 이게 정식 경로
        return
    }
    window.isNavigationBarContrastEnforced = false  // 이게 없으면 스크림이 스트립을 덮는다
    paintBottomInsetStrip(window, navBarColor)
}
```

## 정리
- 뷰 트리·타이밍 쪽만 계속 의심 → 정작 원인은 뷰가 아니었음
- 리소스 XML의 정적 속성을 원인으로 지목했지만, 그 수정은 한 번도 작동하지 않았음
- 나이트 모드가 비동기 캐시보다 먼저 확정돼 night 한정 리소스가 앱 전체에서 반대로 해석되고 있었음
- 시스템이 Navigation Bar에 자동으로 덮는 대비 스크림이 앱이 칠한 색을 가리고 있었음

화면이 정상으로 보인다는 것과 내 수정이 그 이유라는 것은 다른 얘기인데, 중간에 그 둘을 구분하지 않고 결론을 냈습니다.
마지막에 우연히 통한 수정을 만났을 때도 같은 함정이 있었지만, 그때는 한 번에 하나씩 되돌려보고 "무엇이 고친 것인지"를 따로 확정했습니다. 그 한 단계가 차이의 전부였습니다.
추론은 값싸고 매번 그럴듯합니다. 실기기에서 픽셀과 런타임 값을 찍기 시작한 뒤로는, 며칠 붙잡고 있던 가설들이 몇 분 만에 하나씩 정리됐습니다.
