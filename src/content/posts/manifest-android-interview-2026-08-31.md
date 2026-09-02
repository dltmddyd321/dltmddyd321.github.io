---
title: "안드로이드 개발자라면, 안드로이드 기술 지식은 마스터해야지 (Manifest-Android-Interview) [2026-08-31]"
description: "안드로이드 기술 면접 대비 읽으면서 개인적으로 중요하게 생각한 부분을 메모합니다."
pubDate: 2026-08-31T13:30:28Z
category: read
tags: ["android"]
aiPreview: "액티비티와 프래그먼트의 생명주기를 나란히 놓고, 프래그먼트에서 뷰 수명이 인스턴스 수명보다 짧다는 점을 짚습니다. onDestroyView에서 뷰 참조를 놓아주지 않으면 누수로 이어지고, 그래서 관찰에는 viewLifecycleOwner를 써야 합니다. FragmentManager와 ChildFragmentManager의 구분, 서비스의 종류, 구성 변경 처리 방법까지 이어집니다."
---

### Activity의 LifeCycle이란?
- lifecycle 인스턴스는 Jetpack Lifecycle library16의 일부이며, 개발자가 Activity의 생명주기 변화에 대응하여 코드를 깔끔하고 구조화된 방식으로 관리할 수 있도록 합니다.
- lifecycle 속성은 ComponentActivity의 하위 클래스에서 노출하는 Lifecycle 클래스의 인스턴스입니다. 이는 Activity의 현재 생명주기 상태를 나타내며 onCreate, onStart, onResume 등과 같은 생명주기 이벤트를 해당 메서드를 직접 재정의하지 않고 관찰하는 방법을 제공합니다. 
- 이를 통해 UI 업데이트, 리소스 해제 또는 LiveData를 구독하는데 유용합니다.
- lifecycle 인스턴스에 생명주기 이벤트를 관찰할 수 있는 **LifecycleObserver** 또는 **DefaultLifecycleObserver** 객체를 추가할 수 있습니다.

```kotlin
class MyObserver : DefaultLifecycleObserver {

    override fun onStart(owner: LifecycleOwner) {
        super.onStart(owner)
        // onStart 시 수행할 작업
    }

    override fun onStop(owner: LifecycleOwner) {
        super.onStop(owner)
        // onStop 시 수행할 작업
    }
}

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        lifecycle.addObserver(MyObserver())
    }
}
```

### LifeCycle 쓰면 뭐가 좋은데??
- 생명주기 인식 / 관심사 분리 / Jetpack 라이브러리와 호환성 증가

### Fragment LifeCycle
![fragment-view-lifecycle.png](/uploads/1788180624824-fragment-view-lifecycle.png)

### onCreateView()와 onDestroyView()의 목적은 무엇이며, 해당 메서드에서 뷰 관련 리소스를 올바르게 처리하는 것이 왜 중요한가요?
- onCreateView는 프래그먼트의 뷰 계층을 생성(Inflate)하고, onDestroyView는 화면에서 분리된 뷰가 파괴될 때 뷰 참조를 정리하는 콜백입니다.
- 프래그먼트와 뷰의 수명 차이로 발생하는 누수를 막기 위해 onDestroyView 시점의 뷰 참조 정리는 필수적입니다.

### FragmentManager와 ChildFragment의 차이점은 무엇인가?
- FragmentManager는 Activity 수준에서 동작하지만 child의 경우에는 Fragment 내에서 동작하며 부모 Fragment 내에 중접된 Fragment 관리
- Activity의 주요 UI 컴포넌트 형성 -> FragmentManager / Fragment가 자체적으로 중첩 Fragment 사용 -> childFragmentManager

### viewLifeCycleOwner란?
- viewLifecycleOwner는 Fragment의 뷰 계층과 관련된 LifecycleOwner입니다. 이는 Fragment의 onCreateView가 호출될 때 시작되고 onDestroyView가 호출될 때 끝나는 Fragment 뷰의 생명주기를 나타냅니다. 이를 통해 UI 관련 데이터나 리소스를 Fragment의 생명주기가 아닌 Fragment 뷰 계층 생명주기에 바인딩하여 잠재적인 메모리 누수와 같은 문제를 방지할 수 있습니다.

### Service 종류
- Started Service : startService()를 호출할 때 시작됩니다. stopSelf()를 사용하여 스스로 작업을 중지하거나 stopService()를 사용하여 명시적으로 중지될 때까지 백그라운드에서 지속적으로 실행됩니다. (ex: 백그라운드 음악 재생 또는 파일 업로드, 다운로드)
- Bound Service: 안드로이드의 컴포넌트가 bindService()를 사용하여 서비스에 바인딩할 수 있도록 합니다. Service는 바인딩된 클라이언트가 있는 동안 활성 상태를 유지하며 모든 클라이언트의 연결이 끊어지면 자동으로 중지됩니다. (원격 서버에서 데이터 가져오기, 백그라운드 블루투스 연결 관리)
- Foreground Service: Foreground Service는 지속적인 알림을 표시하면서 활성 상태를 유지하는 특별한 유형의 Service입니다. 음악 재생, 내비게이션 또는 위치 추적과 같이 사용자가 계속 인지해야 하는 작업에 사용됩니다.
- 즉시 실행이 필요하지 않은 백그라운드 작업에는 Work Manager 사용

### 구성 변경(configuration changes) 처리 방법
- UI 상태 저장 및 복원 : onSaveInstanceState() 및 onRestoreInstanceState() 구현
- ViewModel을 활용하여 Activity 재시작에도 문제 없도록 설계
- android:configChanges 속성으로 구성 변경 수동으로 처리하기
- Compose의 경우, rememberSaveable 활용
