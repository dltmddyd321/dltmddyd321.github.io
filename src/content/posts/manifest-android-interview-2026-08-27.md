---
title: "안드로이드 개발자라면, 안드로이드 기술 지식은 마스터해야지 (Manifest-Android-Interview) [2026-08-27]"
description: "엄재웅님의 안드로이드 기술 면접 대비용 안드로이드 기술 지식이 담긴 서적을 읽으면서 배운 점과 중요한 부분들을 정리하는 첫 번째 게시글입니다."
pubDate: 2026-08-27T13:35:21Z
category: read
tags: ["android", "cs", "kotiln"]
---

![스크린샷 2026-08-27 오후 9.05.04.png](/uploads/1787833078834------------2026-08-27------9.05.04.png)

### 안드로이드 OS 특징
- 오픈 소스 및 커스텀화
- SDK를 이용한 애플리케이션 개발
- 풍부한 앱 생태계
- 멀티태스킹 및 리소스 관리
- 다양한 하드웨어 지원

### 안드로이드 아키텍처
- 리눅스 커널 -> 하드웨어 추상화 계층(HAL) -> 안드로이드 런타임 및 코어 라이브러리(ART / Core Libraries) -> 네이티브 C/C++ 라이브러리 모음 -> 안드로이드 프레임워크 -> 애플리케이션

### Intent

#### 명시적 Intent
- 호출할 컴포넌트를 직접 명시
```kotlin
val intent = Intent(this, SecondActivity::class.java)
startActivity(intent)
```

#### 암시적 Intent
- 암시적 Intent는 특정 컴포넌트를 지정하지 않고 수행할 일반적인 작업을 선언

```kotlin
val intent = Intent(Intent.ACTION_SEND).apply {
    type = "text/plain"
    putExtra(Intent.EXTRA_TEXT, "공유할 텍스트 내용입니다!")
}

// 사용자가 여러 앱 중 선택할 수 있도록 Chooser 띄우기
val shareIntent = Intent.createChooser(intent, "공유하기")
startActivity(shareIntent)
```

#### Intent Filter란?
- 안드로이드의 intent filter6는 앱 컴포넌트가 링크 열기나 브로드캐스트 처리와 같은 특정 Intent에 어떻게 응답할 수 있는지를 정의합니다. 이는 Activity, Service 또
는 BroadcastReceiver가 처리할 수 있는 Intent 유형을 선언하는 필터 역할을 하며, AndroidManifest.xml 파일에 명시됩니다.

#### PendingIntent
- PendingIntent 는 다른 애플리케이션이나 시스템 컴포넌트가 애플리케이션을 대신하여 미리 정의된 Intent를 나중에 실행할 수 있는 권한을 부여하는 또 다른 종류의 Intent입니다.
- PendingIntent는 Activity, Service, Broadcase 총 3가지 주요 형태로 사용된다.
- 사용 사례 : Notification, Alarms, Services

### Serializable과 Parcelable 차이점
- Serializable과 Parcelable은 안드로이드에서 액티비티나 컴포넌트 간에 객체를 전달(Intent, Bundle 등)할 때 사용하는 인터페이스입니다. 가장 큰 차이점은 성능과 사용 편의성입니다.

#### Serializable
- 특징: 자바 기본 표준 인터페이스로, 구현하기가 매우 쉽습니다 (implements Serializable만 선언하면 끝).
- 단점: 내부적으로 자바 리플렉션(Reflection)을 사용하기 때문에 객체 직렬화 과정에서 많은 임시 객체가 생성되고, 가비지 컬렉터(GC)에 부담을 주어 성능이 느립니다.

#### Parcelable
- 특징: 안드로이드 SDK 전용으로 설계되어 IPC(프로세스간 통신) 및 메모리 전송에 최적화되어 있습니다.
- 장점: 리플렉션을 사용하지 않고 개발자가 직접 직렬화/역직렬화 코드를 처리하므로 속도가 훨씬 빠르고 메모리 효율적입니다.

### Context
- Context는 애플리케이션의 환경 또는 상태를 나타내며 애플리케이션별 리소스 및 클래스에 대한 접근을 제공
- Application Context : Application Context는 애플리케이션의 라이프 사이클과 연결되어 있습니다. 현재 Activity나 Fragment와 독립적인 전역적이고 오래 지속되는 Context가 필요할 때 사용됩니다.
- Activity Context : Activity 생명주기와 연결, 특정 리소스 접근, 다른 Activity 시작, 레이아웃 인플레이션에 사용됩니다.
- Service Context: 주로 네트워크 작업 수행이나 음악 재생과 같은 백그라운드에서 실행되는 작업에 사용됩니다.
- Broadcast Context: Broadcast Context는 BroadcastReceiver가 호출될 때 제공됩니다. 이는 수명이 짧으며 일반적으로 특정 브로드캐스트에 응답하는 데 사용됩니다. 따라서, Broadcast Context로 장기적인 태스크를 수행하면 안 됩니다.

#### ContextWrapper란?
- ContextWrapper는 Context를 상속받고 있는 클래스로, Context 객체를 감싸서(wrapping) 래핑된 Context에 대한 호출을 위임하는 기능을 제공합니다.
- ContextWrapper는 기존 Context의 특정 동작을 개선시키거나 재정의해야 할 때 사용됩니다.

### Application Class
- 안드로이드의 Application 클래스는 전역 애플리케이션 상태와 생명주기를 유지하기 위한 역할을 합니다. 또한, Activity, Service 또는 BroadcastReceiver와 같은 다른 컴포넌트보다 가장 먼저 초기화되는 앱의 프로세스 진입점 역할을 수행합니다. (의존성 설정 + 라이브러리 구성 + 리소스 초기화 등)

### 안드로이드 운영 체제에 애플리케이션에 대한 필수 정보를 정의하는 AndroidManifest.xml
#### 주요 기능
- 애플리케이션 컴포넌트 선언
- 권한 선언
- 하드웨어 및 소프트웨어 요구 사항
- 앱 메타 정보 선언
- 인텐트 필터 선언
-앱 구성 및 세팅

### Activity LifeCycle
- 아래 그림 하나로.. 모든 것이 설명됩니다.
![스크린샷 2026-08-27 오후 10.13.48.png](/uploads/1787836450283------------2026-08-27------10.13.48.png)

- 개인적으로 생명 주기 관련해서는 하나 쯤 시나리오에 대한 질문이 나올 수 있을 것 같아 정리해봤습니다. ->
1. 프로세스 강제 종료(Process Death) 상황에서의 상태 복구
질문: 시스템이 백그라운드에 있는 액티비티의 프로세스를 강제 종료(Low Memory Kill)했을 때, 사용자가 다시 앱으로 돌아오면 시스템은 액티비티를 어떻게 복구하나요? 이때 ViewModel만으로는 상태 유지가 불가능한 이유와 이를 해결하기 위한 SavedStateHandle의 동작 원리를 설명해 주세요.

면접관이 기대하는 핵심 포인트:

프로세스 종료 시나리오: 액티비티가 백그라운드로 밀려난 후 메모리 부족으로 프로세스 자체가 통째로 소멸(killProcess)되면, ViewModel 인스턴스도 함께 메모리에서 사라집니다.

onSaveInstanceState의 한계: 대용량 데이터나 복잡한 객체는 Bundle 크기 제한(Binder Transaction Limit, 약 1MB) 때문에 저장할 수 없습니다.

SavedStateHandle의 역할: ViewModel 내부에서 프로세스 죽음 이후에도 시스템이 Bundle을 통해 상태를 보존할 수 있도록 생명주기 컴포넌트와 결합된 Key-Value 저장소 역할을 수행하는 원리를 짚어야 합니다.

2. 앱 사용 중, 전화가 걸려온 상황에 대한 라이프사이클 -> 
전화가 걸려 온 상황 (전화 수신 UI가 전체 화면을 덮을 때)전화가 오면 현재 실행 중인 앱은 시스템에 의해 포커스를 잃고 가려지게 됩니다.

onPause(): 전화가 걸려오며 알림이 뜨거나 전화 수신 화면이 포커스를 가져가므로, 현재 액티비티가 상호작용을 멈추고 포커스를 잃습니다.

onStop(): 전화 수신 화면이 화면 전체를 완전히 덮어 현재 액티비티가 사용자에게 보이지 않게 됩니다.(통화 종료 후 다시 앱으로 돌아올 때)

onRestart() -> onStart() -> onResume(): 액티비티가 다시 백그라운드에서 포그라운드로 복귀하며 활성화됩니다.

💡 참고: 전화가 전체 화면이 아닌 상단 팝업(Heads-up) 알림 형태로만 왔다가 사라진 경우에는 화면이 완전히 가려지지 않으므로 onStop()까지 가지 않고 onPause() -> onResume()으로 복귀합니다.

## B 화면 → A 화면 이동 후 다시 B 화면으로 돌아올 때

B 화면에서 `startActivity` 등으로 A 화면을 띄웠다가, A 화면에서 뒤로가기(`back`) 버튼을 눌러 다시 B 화면으로 돌아오는 과정입니다.

### ① B 화면에서 A 화면으로 넘어갈 때

1. B `onPause()`: 새로운 액티비티(A)가 실행되기 시작하므로 B는 포커스를 잃습니다.
2. A `onCreate()` → `onStart()` → `onResume()`: A 액티비티가 생성되고 화면에 완전히 나타나며 포커스를 잡습니다.
3. B `onStop()`: A가 화면 전체를 가리게 되므로 B는 완전히 보이지 않게 됩니다. (이때 B는 백스택에 유지됩니다.)

### ② A 화면에서 뒤로가기를 눌러 다시 B 화면으로 돌아올 때

1. A `onPause()`: 종료(또는 백스택으로 이동)되기 전 A가 포커스를 잃습니다.
2. B `onRestart()` → `onStart()` → `onResume()`: 백스택에 남아있던 B가 다시 호출되며 화면에 복귀합니다.
3. A `onStop()` → `onDestroy()`: B가 완전히 화면을 차지한 후, A는 화면에서 사라지고 메모리에서 완전히 소멸됩니다.
