---
title: "바텀시트 내비게이션 바 색이 안 바뀌던 이유"
description: "바텀시트가 뜰 때 하단 내비게이션 바 색을 배경 톤에 맞추려다, 딤이 통째로 날아가고 그 다음엔 색이 아예 안 바뀌는 두 번의 삽질 끝에 코드가 아니라 테마 XML에 원인이 있다는 걸 발견했습니다."
pubDate: 2026-09-04T11:00:00Z
category: dev-log
tags: ["android", "kotlin", "ui", "edge-to-edge"]
aiPreview: "첫 시도는 액티비티 창 전용 트릭(decorView 배경 칠하기)을 다이얼로그 창에 그대로 재사용해, 배경이 투명해야 하는 다이얼로그의 콘텐츠까지 덮여 딤 자체가 사라졌습니다. 이걸 고쳐서 딤은 되돌아왔는데, 이번엔 런타임 코드로 내비게이션 바 톤을 아무리 뒤집어도 색이 안 바뀌는 문제가 남았습니다. 범인은 코드가 아니라 특정 API 버전 전용 리소스 파일의 다이얼로그 테마에 박혀 있던 하드코딩된 속성이었고, 그 정적 선언이 런타임 시도를 매번 이기고 있었습니다."
---

Bottom Sheet를 팝업하면 기존에 적용된 다크 테마 기반의 토큰 규칙과 달리 하단 시스템 Navigation Bar가 밝게 표시되어 부자연스러움을 야기하는 문제가 있었습니다. 이를 해결하는 과정에서의 시행 착오를 기록해봅니다.
![스크린샷 2026-09-04 오후 2.05.57.png](/uploads/1788498505975------------2026-09-04------2.05.57.png)

## 색은 안전한데 톤이 계속 밝음

다크 테마에서 아이콘 대비를 결정하는 플래그(`isAppearanceLightNavigationBars`류)를 런타임에 명시적으로 뒤집어봐도 반영이 안 됐습니다.
뷰 트리 타이밍 문제라고 판단하고 인셋 콜백이 호출되는 시점, 창이 완전히 준비되는 시점 등을 계속 조정해봤지만 아무 효과가 없었습니다. 
코드 쪽만 계속 들여다본 게 잘못된 방향이었습니다.

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
- 뷰 트리·타이밍 쪽만 계속 의심 → 정작 원인은 뷰가 아니라 테마 리소스에 있었음
- 리소스 XML에 하드코딩된 정적 속성이 런타임 코드보다 먼저, 그리고 더 강하게 적용되고 있었음

"코드로 설정했으니 반영될 것"이라는 가정이 계속 틀렸던 이유는, 안드로이드에서는 테마 리소스가 창 생성 시점에 먼저 확정되고 코드는 그 위에 얹히는 순서라는 걸 놓쳤기 때문입니다. 런타임 로직만 계속 고치기 전에, 그 값이 애초에 리소스 레벨에서 이미 못박혀 있지는 않은지부터 확인하는 게 더 빠른 길이었을 겁니다.
