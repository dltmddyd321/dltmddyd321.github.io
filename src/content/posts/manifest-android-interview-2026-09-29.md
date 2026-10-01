---
title: "안드로이드 개발자라면, 안드로이드 기술 지식은 마스터해야지 (Manifest-Android-Interview) [2026-09-29]"
description: "기술 지식 - Compose에 관련된 기본 기술 지식에 대해 읽어보았다."
pubDate: 2026-09-29T13:22:00Z
category: read
tags: []
aiPreview: "Compose가 Compiler, Runtime, UI 세 계층으로 나뉘고, 화면을 그릴 때 Composition, Layout, Drawing 순서를 거친다는 기본 구조를 정리했습니다. Composition 단계에서 Slot Table에 컴포저블 관계를 기록하는 방식, 매개변수나 관찰 중인 상태가 바뀔 때 recomposition이 일어나는 조건, 중앙 상태 관리자인 Composer의 역할, 컴파일러가 컴포저블을 Restartable과 Skippable 등으로 분류하는 이유까지 읽은 내용을 담았습니다."
---

## Compose Fundamentals
- 컴포즈는 시스템적으로 Compose Compiler, Compose Runtime, Compose UI의 세 가지 계층 구조로 이루어져 있다.
- 컴파일러는 선언형 UI 코드를 컴포즈가 실행 가능한 최적화된 코드로 변환하는 역할을 한다.

### Compose Phase
- UI를 화면에 그릴 때, 컴포즈는 Composition, Layout, Drawing의 세 가지 렌더링 파이프라인을 따른다.
- 컴포지션 단계는 컴포저블 함수를 실행하고 UI 트리를 구축하여 컴포저블 함수에 대한 설명을 생성하는 역할을 한다. 이 단계에서 컴포즈는 초기 UI 구조를 구축하고 Slot Table 이라는 데이터 구조에 컴포저블 간의 관계를 기록한다. 상태 변경이 발생하면 Composition 단계는 영향을 받는 UI에 대해 다시 계산하고, 필요한 경우에 **recomposition**을 트리거한다.
- 레이아웃 단계에서는 제공된 제약 조건에 따라 각 UI 컴포넌트의 크기와 위치를 결정한다.
- 드로잉 단계에서는 시각적 요소를 렌더링하고 화면에 UI 컴포넌트를 그린다.

### 선언형 UI 주요 특징
- 상태 주도 UI / 컴포넌트를 함수 또는 클래스로 정의 / 직접적인 데이터 바인딩 / 컴포넌트 멱등성

### 리컴포지션 발생 조건
- 매개변수에 변경이 발생했을 때
- 상태 변경이 관찰되었을 때 (remember 함수와 State API를 통해 상태 변경을 모니터링)
```kotlin
@Composable
fun Counter() {
    var count by remember { mutableStateOf(0) }

    Button(onClick = { count++ }) {
        Text("Count: $count")
    }
}
```
- 여기서 remember는 count 상태가 recomposition이 발생하더라도 값이 메모리에 유지되도록 보장하고, mutableStateOf는 상태가 변경될 때 Compose에 이 사실을 알리고 recomposition을 트리거한다.

### Composer의 역할 (중앙 상태 관리자)
-  상태관리 / UI 계층 구조 구성 / 최적화 / 리컴포지션 제어

### Composable 함수 추론하기
- 성능을 최적화하기 위해 컴파일러는 컴포저블 함수를 Restartable, Skippable, Moveable,Replaceable과 같은 유형으로 분류한다.
- 재실행 가능 (Restartable): 매개변수 입력값 또는 상태가 변경되면 Compose 런타임은 UI를 업데이트하기 위해 recomposition을 위해 함수를 재호출한다.
- 생략 가능 (Skippable): Skippable 함수는 스마트 recomposition에 의해 활성화된 특정 조건 하에서 **recomposition을 건너뛸 수 있다. **이러한 recomposition 최적화는 복잡한 컴포저블 계층 구조의 최상위 노드에 있는 루트 컴포저블의 성능 향상에 중요한데, recomposition을 건너뛰면 하위 함수를 재호출 하지 않아도 되기 때문이다.
