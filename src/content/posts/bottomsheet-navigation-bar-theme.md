---
title: "바텀시트 내비게이션 바 색이 안 바뀌던 이유"
description: "바텀시트가 뜰 때 하단 내비게이션 바 색을 배경 톤에 맞추려다, 딤이 통째로 날아가고 그 다음엔 색이 아예 안 바뀌는 두 번의 삽질 끝에 코드가 아니라 테마 XML에 원인이 있다는 걸 발견했습니다."
pubDate: 2026-09-04T11:00:00Z
category: dev-log
tags: ["android", "kotlin", "ui", "edge-to-edge"]
aiPreview: "첫 시도는 액티비티 창 전용 트릭(decorView 배경 칠하기)을 다이얼로그 창에 그대로 재사용해, 배경이 투명해야 하는 다이얼로그의 콘텐츠까지 덮여 딤 자체가 사라졌습니다. 이걸 고쳐서 딤은 되돌아왔는데, 이번엔 런타임 코드로 내비게이션 바 톤을 아무리 뒤집어도 색이 안 바뀌는 문제가 남았습니다. 범인은 코드가 아니라 특정 API 버전 전용 리소스 파일의 다이얼로그 테마에 박혀 있던 하드코딩된 속성이었고, 그 정적 선언이 런타임 시도를 매번 이기고 있었습니다."
---

바텀시트가 떠 있는 동안 화면 아래쪽이 어둡게 딤 처리되는데, 정작 맨 밑의 시스템 내비게이션 바(하단 제스처/버튼 바 영역)만 흰색 그대로 남아 어색해 보인다는 요청이 들어왔습니다. 이 바를 시트 배경 톤에 맞추는 게 목표였는데, 여기까지 가는 데 두 번의 잘못된 시도가 있었습니다.

## 1차 시도: 딤이 통째로 사라짐

액티비티에는 이미 다크 테마일 때 내비게이션 바를 테마 색으로 칠하는 함수가 있었습니다. 최신 안드로이드 버전에서는 `Window.navigationBarColor` 대입 자체가 시스템에 무시되는 edge-to-edge 강제 정책 때문에, 대신 창의 `decorView` 배경을 직접 칠하는 방식으로 만들어져 있었죠.

```
fun applyNavBarColor(window: Window, color: Int) {
    if (isEdgeToEdgeForced()) {
        window.decorView.setBackgroundColor(color)
    } else {
        window.navigationBarColor = color
    }
}
```

이 함수를 그대로 바텀시트에도 적용했습니다. 그런데 화면을 켜보니 딤은 흔적도 없이 사라지고 화면 전체가 시트 배경색으로 뒤덮여 있었습니다.

원인은 이 함수가 성립하는 전제 자체가 액티비티 창에만 해당됐기 때문입니다. 액티비티는 콘텐츠 루트에 하단 인셋만큼 패딩을 걸어두는 별도 처리가 있어서, `decorView` 배경을 칠해도 그 패딩된 인셋 영역(=내비게이션 바 자리)에만 색이 비칩니다. 반면 다이얼로그 창은 그런 패딩이 없고, 콘텐츠 자체가 의도적으로 투명해서 그 투명한 부분으로 뒤에 있는 화면의 딤이 비쳐 보이는 구조입니다. 여기에 `decorView` 배경을 칠하면 **창 전체가 불투명해져** 딤이 있던 자리까지 다 덮어버립니다. 함수 하나를 맥락 확인 없이 재사용한 게 원인이었습니다.

수정은 창 전체가 아니라, 하단 인셋 높이만큼의 얇은 뷰 하나만 콘텐츠 루트에 깔고 그 뷰만 칠하는 방식으로 바꿨습니다.

```
fun applyNavBarColor(window: Window, color: Int) {
    if (isEdgeToEdgeForced()) {
        val strip = View(window.context)
        window.decorView.addView(strip, matchWidthAtBottom())
        strip.doOnApplyWindowInsets { insets ->
            strip.height = insets.systemBarsBottom()
        }
        strip.setBackgroundColor(color)
    } else {
        window.navigationBarColor = color
    }
}
```

이걸로 딤은 정상으로 돌아왔습니다.

## 2차 시도: 색은 안전한데 톤이 계속 밝음

딤은 살렸는데, 이번엔 내비게이션 바가 계속 밝은 톤 그대로였습니다. 다크 테마에서 아이콘 대비를 결정하는 플래그(`isAppearanceLightNavigationBars`류)를 런타임에 명시적으로 뒤집어봐도 반영이 안 됐습니다.

여기서 두 번째 삽질이 있었습니다. 뷰 트리 타이밍 문제라고 판단하고 인셋 콜백이 호출되는 시점, 창이 완전히 준비되는 시점 등을 계속 조정해봤지만 아무 효과가 없었습니다. 코드 쪽만 계속 들여다본 게 잘못된 방향이었습니다.

## 진짜 원인: 코드가 아니라 리소스 XML

범인은 특정 API 레벨 전용 스타일 리소스 파일에 있었습니다. 실기기 대부분에 실제로 적용되는 그 리소스 안의 바텀시트 다이얼로그 테마에 이런 속성이 하드코딩돼 있었습니다.

```xml
<style name="BottomSheetDialogTheme" parent="...">
    <item name="android:windowLightNavigationBar">true</item>
    <item name="android:navigationBarColor">@color/white</item>
</style>
```

`windowLightNavigationBar=true`는 "이 창의 내비게이션 바는 항상 밝은 톤(아이콘은 어둡게)"이라고 **테마 선언 시점에** 못박아버리는 속성입니다. 다이얼로그 창이 생성되는 순간 이 테마가 곧바로 적용되기 때문에, 이후에 런타임 코드로 같은 플래그를 아무리 뒤집어도 이미 선언된 정적 값을 이길 수 없었던 겁니다. 코드로 뭔가를 "설정"했다고 생각했지만, 실제로는 이미 확정된 값을 다시 덮어쓰려던 것뿐이었습니다.

해결은 이 속성 자체를 리소스 한정자(다크/라이트 변형)로 분리하는 것이었습니다.

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

앱이 다크 모드를 명시적으로 강제하는 구조였기 때문에, 이 리소스 한정자 분기가 정확히 앱의 테마 상태와 맞아떨어졌습니다. 런타임 코드(1차 시도에서 만든 스트립 뷰 방식)는 아이템별로 달라지는 동적인 색을 위해 그대로 남겨두고, "기본 밝기 톤" 자체는 정적 리소스 오버라이드로 고정하는 걸로 마무리됐습니다.

## 정리

세 단계 모두 겉보기엔 "내비게이션 바 색이 이상하다"는 같은 증상이었지만, 층위가 완전히 달랐습니다.

- **1차**: 액티비티 전용 트릭을 다이얼로그에 그대로 재사용 → 창 구조의 전제 차이를 놓쳐 딤이 사라짐
- **2차**: 뷰 트리·타이밍 쪽만 계속 의심 → 정작 원인은 뷰가 아니라 테마 리소스에 있었음
- **3차(원인)**: 리소스 XML에 하드코딩된 정적 속성이 런타임 코드보다 먼저, 그리고 더 강하게 적용되고 있었음

"코드로 설정했으니 반영될 것"이라는 가정이 계속 틀렸던 이유는, 안드로이드에서는 테마 리소스가 창 생성 시점에 먼저 확정되고 코드는 그 위에 얹히는 순서라는 걸 놓쳤기 때문입니다. 런타임 로직만 계속 고치기 전에, 그 값이 애초에 리소스 레벨에서 이미 못박혀 있지는 않은지부터 확인하는 게 더 빠른 길이었을 겁니다.
