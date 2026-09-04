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

## 재발, 그리고 실기기 측정

빌드배포 하려니까 문제가 다시 확인되네요;;; 

먼저 스크린샷을 떠서 좌표별 RGB를 뽑았습니다. 
시트 본문 영역은 다크 테마 토큰 값과 정확히 일치했고, Navigation Bar 영역만 라이트 토큰도 다크 토큰도 아닌 엉뚱한 밝은 회색이었습니다.
색 계산이 틀린 게 아니라, 우리 색이 아닌 무언가가 그 위에 그려지고 있다는 뜻이었죠.
즉, 이중으로 덮어씌워지는 문제로 인해서 올바르게 토큰 색상이 보이지 않는 것이었습니다.

```
uiMode = NIGHT_NO                     ← 리소스 설정은 "라이트"
bool/is_light_navigation_bar = true   ← 위에서 넣은 값이 라이트로 해석됨
color/…_overlay = #FFFFFFFF           ← 흰색으로 해석됨
앱 자체 테마 플래그 isDarkTheme = true  ← 앱은 다크
```

`values-night`에 넣은 값이 전부 라이트로 해석되고 있었습니다.
애초에 렌더링 시점으로 인해서 해결이 된 것처럼 순간 오해(?)가 있었을 뿐, theme 규칙에 따른 다크 라이트 구분이 리소스 레벨에서 정상적으로 처리되고 있지 않았습니다.

## 나이트 모드가 캐시보다 먼저 확정됨

앱이 다크인데 리소스는 왜 라이트일까.
구축한 시스템에서는 라이트/다크를 OS 설정이 아니라 자체 테마 플래그로 결정하고, 그 플래그에 맞춰 앱 시작 시 나이트 모드를 명시적으로 못박습니다. 
첫 화면이 만들어지기 전에 못박아야 하니 시작 지점에 두는 것 자체는 맞습니다.

하지만 프로젝트 자체 초기 시점에 호출되는 것이 아닌, 사용자가 지정한 컬러를 통해 비동기로 로드되는 컬러 토큰들이 존재하는 경우가 있었습니다.
기본 시스템 테마의 다크/라이트는 식별자만 보면 즉시 알 수 있지만, 사용자 지정 테마는 그 정보가 별도 저장소에서 비동기로 로드되는 속성 캐시에 들어 있습니다. 
시작 시점의 순서가 이렇게 됩니다.

```
앱 시작
 ├─ 나이트 모드 확정 요청  →  캐시가 아직 null  →  isDark = false  →  "라이트"로 못박음
 └─ (수십 ms 후) 속성 캐시 로드 완료  →  isDark = true  →  다시 맞추는 지점이 없음
```

그래서 아이템 다크 테마를 쓰는 동안 앱 전체의 night 한정 리소스가 반대로 해석되고 있었습니다.
여태 안 들킨 건 이 앱이 색을 거의 전부 런타임 코드로 칠하기 때문입니다.

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

단서는 우연히 잡혔습니다. 공식 문서 상 무시된다고 알려진 `navigationBarColor` 대입을 검증 과정에서 다시 넣어봤더니 화면이 정상이 됐습니다.
그런데 로그를 보면 대입 전후 getter 값이 똑같이 투명(`#0`)이었습니다. 색이 들어가서 고쳐진 게 아니라, 그 setter의 부작용이 뭔가를 건드린 겁니다.

앞에서 한 실수를 반복하지 않으려고, 한 번에 하나씩만 바꾸는 A/B로 후보를 좁혔습니다.

| 바꾼 것 | 결과 |
|---|---|
| 무시되는 색 대입을 다시 넣음 | 정상. 다만 왜인지는 불명확 |
| 그 대입만 제거 | 재발. 이 대입이 원인이라는 건 확정 |
| 창을 명시적으로 edge-to-edge로 선언 | 재발. 이건 아님 |
| Navigation Bar 대비 스크림 끄기 | 정상. 여기서 확정 |

범인은 시스템이 Navigation Bar 아이콘 가독성을 위해 그 영역에 자동으로 덮는 **반투명 보호막**이었습니다.
앱이 그 영역을 직접 칠하는지와 무관하게 얹히기 때문에, 스트립 뷰가 정확한 위치와 크기와 색으로 멀쩡히 있어도 그 위를 덮고 있었던 거죠.
앞서 무시되는 색 대입이 통한 것도, 그 setter가 내부적으로 앱이 이 영역을 직접 관리한다는 상태를 함께 세우면서 스크림을 비활성화했기 때문이었습니다.

<figure class="nbs-embed">
  <div class="nbs-board">
    <section class="nbs-panel" aria-labelledby="nbs-stack-title">
      <div class="nbs-panel-head">
        <h4 class="nbs-panel-title" id="nbs-stack-title">창의 레이어 구조</h4>
        <span class="nbs-panel-sub">bottom → top</span>
      </div>
      <div class="nbs-stack" id="nbsStack">
        <div class="nbs-connector" aria-hidden="true"></div>
        <div class="nbs-row">
          <div class="nbs-plate nbs-plate-window" data-tag="L0"></div>
          <div class="nbs-info">
            <p class="nbs-name">다이얼로그 decorView</p>
            <p class="nbs-meta">콘텐츠는 투명 — 뒤의 딤(dim)이 비쳐 보이는 자리</p>
          </div>
        </div>
        <div class="nbs-row">
          <div class="nbs-plate nbs-plate-strip" data-tag="L1"></div>
          <div class="nbs-info">
            <p class="nbs-name">우리가 붙인 스트립 뷰</p>
            <p class="nbs-meta"><span class="nbs-dot"></span>fill: <code>#1B1B19</code> · 위치·크기 정상 확인됨</p>
          </div>
        </div>
        <div class="nbs-row nbs-row-scrim">
          <div class="nbs-plate nbs-plate-scrim" data-tag="L2"></div>
          <div class="nbs-info">
            <p class="nbs-name">시스템 대비 스크림</p>
            <p class="nbs-meta">앱이 그 영역을 칠하는지와 무관하게 항상 얹힘</p>
          </div>
        </div>
      </div>
      <div class="nbs-toggle-row">
        <span class="nbs-toggle-label"><span class="nbs-prop">isNavigationBarContrastEnforced</span> = <span id="nbsPropVal">true</span></span>
        <input type="checkbox" class="nbs-switch" id="nbsToggle" checked role="switch" aria-checked="true" aria-label="isNavigationBarContrastEnforced 값 전환">
      </div>
    </section>
    <section class="nbs-panel" aria-labelledby="nbs-result-title">
      <div class="nbs-panel-head">
        <h4 class="nbs-panel-title" id="nbs-result-title">합성 결과</h4>
        <span class="nbs-panel-sub">실측값</span>
      </div>
      <div class="nbs-result">
        <div class="nbs-device" aria-hidden="true">
          <div class="nbs-device-screen"></div>
          <div class="nbs-device-sheet"></div>
          <div class="nbs-device-navbar" id="nbsNavbar"><span></span><span></span><span></span></div>
        </div>
        <div class="nbs-readout">
          <div class="nbs-cell" id="nbsCellColor">
            <span class="nbs-k">화면에 보이는 색</span>
            <span class="nbs-v" id="nbsColorVal">#D1D1D1</span>
          </div>
          <div class="nbs-cell">
            <span class="nbs-k">우리가 칠한 색</span>
            <span class="nbs-v">#1B1B19</span>
          </div>
        </div>
        <p class="nbs-verdict" id="nbsVerdict">스크림이 화면 픽셀을 <b>#D1D1D1</b>로 덮고 있다 — 우리 색과 무관</p>
      </div>
    </section>
  </div>
  <figcaption class="nbs-caption">스위치를 눌러 <code>isNavigationBarContrastEnforced</code>를 켜고 꺼보세요 · 다이어그램: Claude</figcaption>
</figure>
<style>
  .nbs-embed {
    --nbs-bg: var(--surface, #131410);
    --nbs-surface-2: var(--surface-2, #1a1c16);
    --nbs-border: var(--border, #2a2c24);
    --nbs-text: var(--text, #ece9df);
    --nbs-text-muted: var(--text-muted, #8f9285);
    --nbs-accent: var(--accent, #e0a458);
    --nbs-app-swatch: #1b1b19;
    --nbs-scrim-fill: rgba(255,255,255,0.6);
    --nbs-scrim-line: rgba(255,255,255,0.82);
    --nbs-good: #7fd6a3;
    --nbs-bad: #ef8b74;
    --nbs-font-sans: var(--font-sans, -apple-system, sans-serif);
    --nbs-font-mono: var(--font-mono, ui-monospace, monospace);
    margin: 2em 0;
    font-family: var(--nbs-font-sans);
    color: var(--nbs-text);
  }
  .nbs-board {
    display: grid;
    grid-template-columns: 1.15fr 0.85fr;
    gap: 14px;
  }
  @media (max-width: 640px) {
    .nbs-board { grid-template-columns: 1fr; }
  }
  .nbs-panel {
    background: var(--nbs-bg);
    border: 1px solid var(--nbs-border);
    border-radius: 12px;
    padding: 18px 18px 16px;
  }
  .nbs-panel-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 16px;
  }
  .nbs-panel-title {
    font-family: var(--nbs-font-sans);
    font-weight: 600;
    font-size: 14px;
    color: var(--nbs-text);
    margin: 0;
  }
  .nbs-panel-sub {
    font-family: var(--nbs-font-mono);
    font-size: 11px;
    color: var(--nbs-text-muted);
  }
  .nbs-stack {
    position: relative;
    padding: 4px 4px 14px;
    display: flex;
    flex-direction: column;
    gap: 18px;
  }
  .nbs-row {
    display: grid;
    grid-template-columns: 104px 1fr;
    align-items: center;
    gap: 14px;
    position: relative;
  }
  .nbs-plate {
    height: 50px;
    border-radius: 9px;
    border: 1px solid var(--nbs-border);
    position: relative;
    transition: transform 420ms cubic-bezier(.2,.7,.3,1), opacity 420ms ease, box-shadow 420ms ease;
    box-shadow: 0 6px 14px -8px rgba(0,0,0,0.55);
  }
  .nbs-plate::after {
    content: attr(data-tag);
    position: absolute;
    top: 5px;
    left: 8px;
    font-family: var(--nbs-font-mono);
    font-size: 9px;
    letter-spacing: 0.05em;
    color: rgba(255,255,255,0.5);
  }
  .nbs-plate-window {
    background: repeating-linear-gradient(135deg, var(--nbs-surface-2) 0 8px, var(--nbs-border) 8px 16px);
  }
  .nbs-plate-strip {
    background: var(--nbs-app-swatch);
    border-color: #35352f;
  }
  .nbs-plate-scrim {
    background: var(--nbs-scrim-fill);
    border: 1px dashed var(--nbs-scrim-line);
  }
  .nbs-info { min-width: 0; }
  .nbs-name {
    font-family: var(--nbs-font-sans);
    font-weight: 600;
    font-size: 13px;
    color: var(--nbs-text);
    margin: 0 0 4px;
  }
  .nbs-meta {
    font-family: var(--nbs-font-mono);
    font-size: 11px;
    color: var(--nbs-text-muted);
    line-height: 1.55;
  }
  .nbs-meta code {
    font-family: inherit;
    background: none;
    padding: 0;
    color: var(--nbs-text);
  }
  .nbs-dot {
    display: inline-block;
    width: 8px; height: 8px;
    border-radius: 2px;
    margin-right: 5px;
    vertical-align: -1px;
    background: var(--nbs-app-swatch);
    border: 1px solid var(--nbs-border);
  }
  .nbs-stack.nbs-scrim-off .nbs-plate-scrim {
    transform: translate(26px, -30px) scale(0.92);
    opacity: 0;
    box-shadow: none;
  }
  .nbs-stack.nbs-scrim-off .nbs-row-scrim .nbs-info {
    opacity: 0.45;
  }
  .nbs-connector {
    position: absolute;
    left: 104px;
    right: 0;
    top: 50%;
    height: 1px;
    background: linear-gradient(90deg, var(--nbs-border) 0 6px, transparent 6px 10px);
    background-size: 10px 1px;
    z-index: -1;
  }
  .nbs-toggle-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin-top: 4px;
    padding: 10px 12px;
    background: var(--nbs-surface-2);
    border: 1px solid var(--nbs-border);
    border-radius: 10px;
  }
  .nbs-toggle-label {
    font-family: var(--nbs-font-mono);
    font-size: 11px;
    color: var(--nbs-text);
  }
  .nbs-prop { color: var(--nbs-accent); }
  .nbs-switch {
    appearance: none;
    -webkit-appearance: none;
    width: 42px;
    height: 24px;
    border-radius: 999px;
    background: var(--nbs-border);
    border: 1px solid var(--nbs-border);
    position: relative;
    cursor: pointer;
    flex: none;
    transition: background 200ms ease;
  }
  .nbs-switch::before {
    content: "";
    position: absolute;
    top: 2px; left: 2px;
    width: 18px; height: 18px;
    border-radius: 50%;
    background: var(--nbs-text);
    box-shadow: 0 1px 3px rgba(0,0,0,0.4);
    transition: transform 220ms cubic-bezier(.2,.7,.3,1);
  }
  .nbs-switch:checked {
    background: var(--nbs-accent);
    border-color: var(--nbs-accent);
  }
  .nbs-switch:checked::before {
    transform: translateX(18px);
    background: #241705;
  }
  .nbs-switch:focus-visible {
    outline: 2px solid var(--nbs-accent);
    outline-offset: 2px;
  }
  .nbs-result {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
  }
  .nbs-device {
    width: 144px;
    height: 272px;
    border-radius: 26px;
    border: 3px solid var(--nbs-border);
    background: var(--nbs-surface-2);
    position: relative;
    overflow: hidden;
  }
  .nbs-device-screen {
    position: absolute;
    inset: 0;
    background: linear-gradient(180deg, var(--nbs-surface-2) 0%, var(--nbs-app-swatch) 62%);
  }
  .nbs-device-sheet {
    position: absolute;
    left: 0; right: 0; bottom: 0;
    top: 42%;
    background: var(--nbs-app-swatch);
    border-radius: 14px 14px 0 0;
    box-shadow: 0 -10px 26px -14px rgba(0,0,0,0.7);
  }
  .nbs-device-sheet::before {
    content: "";
    position: absolute;
    top: 9px; left: 50%;
    width: 30px; height: 4px;
    border-radius: 3px;
    background: rgba(255,255,255,0.16);
    transform: translateX(-50%);
  }
  .nbs-device-navbar {
    position: absolute;
    left: 0; right: 0; bottom: 0;
    height: 26px;
    background: var(--nbs-result-color, var(--nbs-app-swatch));
    transition: background 420ms ease;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 18px;
  }
  .nbs-device-navbar span {
    width: 7px; height: 7px;
    border-radius: 2px;
    background: rgba(0,0,0,0.35);
  }
  .nbs-readout {
    width: 100%;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  .nbs-cell {
    border: 1px solid var(--nbs-border);
    background: var(--nbs-surface-2);
    border-radius: 9px;
    padding: 9px 10px;
    text-align: center;
  }
  .nbs-k {
    font-family: var(--nbs-font-mono);
    font-size: 9.5px;
    color: var(--nbs-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    display: block;
    margin-bottom: 5px;
  }
  .nbs-v {
    font-family: var(--nbs-font-mono);
    font-size: 14px;
    font-variant-numeric: tabular-nums;
    color: var(--nbs-text);
  }
  .nbs-cell.nbs-bad .nbs-v { color: var(--nbs-bad); }
  .nbs-cell.nbs-good .nbs-v { color: var(--nbs-good); }
  .nbs-verdict {
    font-family: var(--nbs-font-mono);
    font-size: 11.5px;
    color: var(--nbs-text-muted);
    text-align: center;
    min-height: 1.6em;
    margin: 0;
  }
  .nbs-verdict b { color: var(--nbs-text); font-weight: 600; }
  .nbs-caption {
    margin-top: 10px;
    font-family: var(--nbs-font-mono);
    font-size: 11px;
    color: var(--nbs-text-muted);
    text-align: center;
  }
  .nbs-caption code {
    font-family: inherit;
    color: var(--nbs-text);
  }
</style>
<script>
(function () {
  var toggle = document.getElementById('nbsToggle');
  var stack = document.getElementById('nbsStack');
  var propVal = document.getElementById('nbsPropVal');
  var navbar = document.getElementById('nbsNavbar');
  var colorVal = document.getElementById('nbsColorVal');
  var cellColor = document.getElementById('nbsCellColor');
  var verdict = document.getElementById('nbsVerdict');
  if (!toggle) return;
  var COVERED = '#D1D1D1';
  var CLEAR = '#1B1B19';
  function render() {
    var enforced = toggle.checked;
    propVal.textContent = enforced ? 'true' : 'false';
    stack.classList.toggle('nbs-scrim-off', !enforced);
    toggle.setAttribute('aria-checked', String(enforced));
    var shown = enforced ? COVERED : CLEAR;
    navbar.style.setProperty('--nbs-result-color', shown);
    colorVal.textContent = shown;
    cellColor.classList.toggle('nbs-bad', enforced);
    cellColor.classList.toggle('nbs-good', !enforced);
    verdict.innerHTML = enforced
      ? '스크림이 화면 픽셀을 <b>#D1D1D1</b>로 덮고 있다 — 우리 색과 무관'
      : '스크림을 끄니 화면 픽셀이 <b>#1B1B19</b> — 우리가 칠한 색과 일치';
  }
  toggle.addEventListener('change', render);
  render();
})();
</script>

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
- 시스템 View에 얽힌 사소한 줄 알았으나 복잡한 이해 관계
