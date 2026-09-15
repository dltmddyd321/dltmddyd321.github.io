---
title: "minifyEnabled를 켰는데 난독화율이 3%였던 이유"
description: "Play Console 앱 최적화 경고에서 시작해 keep 룰 하나가 전체 난독화를 무력화하고 있던 것을 찾고, 클래스명에 의존하는 코드를 전수 점검한 뒤 mapping.txt로 실제 비율을 측정한 기록입니다."
pubDate: 2026-09-15T13:00:00Z
category: dev-log
tags: ["android", "proguard", "r8", "gradle"]
aiPreview: minifyEnabled가 켜져 있는데도 난독화율이 3%로 측정된 원인은 `-keep class * { @Annotation <methods>; }` 형태의 룰이었습니다. -keep은 중괄호 안 멤버를 필터로 쓰지 않고 매칭된 클래스를 전부 보존하기 때문에, 사실상 앱과 모든 라이브러리의 클래스명 난독화를 꺼버립니다. 지시어를 -keepclassmembers로 바꾸고 라이브러리 blanket keep을 정리하되, 그 전에 런타임에 클래스명을 문자열로 다루는 코드를 전수 점검한 과정과 mapping.txt로 비율을 측정하는 방법을 정리했습니다.
---

Play Console 앱 최적화 리포트에 경고가 하나 떠 있었습니다.
난독화 비율이 3%라 기준선인 25%에 한참 못 미친다는 내용입니다.

`minifyEnabled true`는 분명히 켜져 있었습니다.
그런데도 3%가 나왔다면 R8이 도는 것과 별개로 룰이 무언가를 막고 있다는 뜻이라 ProGuard 룰 파일을 처음부터 읽었습니다.

## keep 룰 하나가 전체를 덮고 있었다

DI 모듈을 보호하겠다고 넣어둔 룰이 이렇게 생겼습니다.

```proguard
-keep class * {
    @dagger.Provides <methods>;
}
```

의도는 "@Provides가 붙은 메서드를 가진 클래스를 지켜라"였을 겁니다.
실제 동작은 다릅니다.

ProGuard와 R8에서 `-keep`은 class specification에 매칭된 클래스 자체를 보존하고, 중괄호 안은 그 위에 추가로 보존할 멤버를 적는 자리입니다.
멤버 조건은 클래스를 고르는 필터가 아닙니다.
그래서 `class *`는 앱과 모든 라이브러리의 전 클래스에 매칭되고, `@Provides` 메서드가 하나도 없는 클래스까지 이름이 박제됩니다.

세 지시어의 차이를 정리하면 이렇습니다.

| 지시어 | 클래스 이름 | 멤버 | 매칭 조건 |
|---|---|---|---|
| `-keep class X { ... }` | 보존 | 보존 | 멤버 유무와 무관 |
| `-keepclassmembers class X { ... }` | 난독화됨 | 보존 | 클래스가 살아남은 경우 |
| `-keepclasseswithmembers class X { ... }` | 보존 | 보존 | 해당 멤버를 실제로 가진 클래스만 |

필요한 건 두 번째였습니다.

```proguard
-keepclassmembers class * {
    @dagger.Provides <methods>;
    @dagger.Binds <methods>;
}
```

참고로 요즘 Dagger는 생성된 factory에서 provider 메서드를 직접 호출하기 때문에 이 룰이 아예 없어도 동작합니다.
다만 한 번에 하나씩 바꾸려고 지시어만 교체했습니다.

한 가지 더 짚고 갈 부분이 있습니다.
이 룰은 클래스 이름만 잡아뒀고 필드와 메서드는 이미 난독화되고 있었습니다.
그래서 이번 변경으로 새로 생기는 위험은 "클래스명이 바뀐다" 하나로 좁혀집니다.
이 구분이 뒤에 할 점검의 범위를 정해줬습니다.

## 라이브러리 전체를 keep하던 룰들

같은 파일에 이런 것들도 있었습니다.

```proguard
-keep class okhttp3.** { *; }
-keep class com.google.gson.** { *; }
-keep class dagger.hilt.** { *; }
```

이런 룰은 대체로 "혹시 몰라서" 들어갑니다.
그런데 요즘 라이브러리는 자기가 필요한 keep 룰을 배포 산출물에 같이 넣어서 내려줍니다.
AAR이면 `proguard.txt`, JAR이면 `META-INF/proguard/*.pro`입니다.

Gradle 캐시에서 직접 꺼내보면 무엇을 지키는지 바로 확인됩니다.

```bash
unzip -p <aar 경로> proguard.txt
unzip -p <jar 경로> "META-INF/proguard/gson.pro"
```

Gson이 배포하는 룰 파일에는 이런 주석이 달려 있습니다.

> 이 규칙은 additive하다. Gson에 특정한 것이 아닌 규칙(모든 클래스의 난독화를 완전히 끄는 것 같은)은 넣지 말 것. 그러면 사용자가 그걸 끌 수 없게 된다.

OkHttp 쪽은 `-dontwarn` 몇 줄과 `-adaptresourcefilenames` 한 줄이 전부였습니다.
publicsuffix 데이터를 상대 경로로 읽기 때문에 그 리소스 파일명만 맞춰주면 된다는 뜻입니다.
라이브러리 전체를 keep할 이유가 없습니다.

여기에 더해 의존성 목록에 없는 라이브러리를 위한 룰도 꽤 남아 있었습니다.
예전에 쓰다 뺀 SDK, 다른 제조사 스토어 대응용 SDK, 지금은 안 쓰는 디버깅 도구 같은 것들입니다.
난독화율에는 영향이 없지만 파일을 읽기 어렵게 만듭니다.

정리하면서 원칙을 하나 세웠습니다.
`-keep*`만 지우고 `-dontwarn`과 `-keepattributes`는 그대로 뒀습니다.
`-dontwarn`을 지우면 참조가 남아 있는 경우 R8이 missing class 에러로 빌드를 세울 수 있습니다.

## 지우기 전에 확인해야 할 것

클래스명을 풀어주면 런타임에 이름으로 클래스를 찾는 코드가 깨집니다.
그래서 코드베이스에서 클래스명을 문자열로 다루는 지점을 전부 찾았습니다.

`Class.forName`, `ClassLoader.loadClass`, `javaClass.name`, `::class.java.name`, `getSimpleName()`, `ComponentName(...)` 정도를 훑으면 대부분 걸립니다.

나온 것들을 성격별로 나눠보면 상당수는 무해합니다.
로그 태그로 쓰는 `this::class.java.name`이 대표적입니다.
Crashlytics에 매핑 파일을 올리고 있다면 리포트에서 원래 이름으로 복원됩니다.

`fragmentFactory.instantiate(classLoader, SomeFragment::class.java.name)` 같은 호출도 안전합니다.
넘기는 이름을 런타임에 클래스 객체에서 얻기 때문에 이름이 바뀌어도 양쪽이 같이 바뀝니다.

위험한 쪽은 이름을 어딘가에 저장하는 경우입니다.
예를 들어 위젯 provider가 SharedPreferences 키를 이렇게 만들고 있었습니다.

```kotlin
private fun prefsKey() = "widgetScale_${javaClass.simpleName}"
```

난독화된 이름은 빌드마다 달라질 수 있어서 이 키는 업데이트할 때마다 바뀌고 저장값이 사라집니다.
위젯 provider와 receiver는 원래도 keep 대상이라 결과적으로는 안전했지만 이런 코드가 있다면 해당 클래스는 반드시 이름을 고정해야 합니다.

같은 이유로 PendingIntent에 커스텀 Parcelable이나 Serializable을 담는 코드도 확인 대상입니다.
Bundle이 클래스명을 같이 저장하기 때문에 업데이트 전에 예약된 알람이 업데이트 후 언파셀되면서 클래스를 못 찾을 수 있습니다.

기능 탐지도 확인 대상입니다.

```java
try {
    getClassLoader().loadClass("androidx.renderscript.RenderScript");
    // 이 구현체 사용
} catch (Throwable e) {
    // 다른 구현체로 폴백
}
```

여기서 클래스명이 바뀌면 예외가 나고 조용히 다른 구현으로 넘어갑니다.
크래시는 안 나지만 동작이 달라집니다.
정리하다 이 패키지의 keep을 지웠다가 되돌렸습니다.

라이브러리 쪽은 추측하지 말고 consumer 룰을 열어보는 편이 빠릅니다.

- Room은 데이터베이스 클래스명에 `_Impl`을 붙여 `Class.forName`으로 찾습니다. AAR 안에 `-keep class * extends androidx.room.RoomDatabase`가 들어 있어서 생성된 구현체까지 함께 보존됩니다.
- WorkManager는 worker 클래스명을 내부 DB에 저장했다가 인스턴스화합니다. 이쪽도 `-keep class * extends androidx.work.Worker`를 자체적으로 넣어줍니다.
- Realm은 생성된 mediator가 `className.equals("SomeModel")` 형태의 컴파일 타임 문자열과 클래스 참조를 짝지어 두기 때문에 이름이 바뀌어도 양쪽이 함께 움직입니다. 테이블명도 생성 코드의 상수입니다.
- Hilt ViewModel은 `@LazyClassKey`로 클래스명 문자열을 multibinding 키로 씁니다. Dagger가 `@KeepFieldType`과 `includedescriptorclasses`를 쓰는 룰을 배포해서 해당 클래스명을 잡아줍니다.

XML 레이아웃에서 참조하는 커스텀 뷰와 매니페스트에 선언한 컴포넌트는 AAPT가 keep 룰을 자동 생성해줍니다.
이건 직접 적을 필요가 없습니다.

## 측정

바꾸고 나면 실제로 얼마나 올랐는지 봐야 합니다.
서명 설정이 없어도 R8 태스크만 따로 돌리면 mapping 파일이 나옵니다.

```bash
./gradlew :app:minifyReleaseWithR8
```

`app/build/outputs/mapping/release/mapping.txt`에 `원래이름 -> 난독화된이름:` 형태로 전부 적혀 있으니 좌우가 다른 줄을 세면 비율이 나옵니다.

결과는 클래스 기준 37%, 메서드 48%, 필드 88%였습니다.
앱 소스만 따지면 클래스의 81%가 난독화됐습니다.
3%에서 출발했으니 기준선은 여유 있게 넘겼습니다.

남아 있는 미난독화 클래스를 패키지별로 세어보면 대부분 Google Play 서비스 계열이었습니다.
자기 consumer 룰로 스스로를 keep하는 SDK들이라 손댈 수 있는 영역이 아닙니다.
앱 쪽에서 이름이 남은 건 JSON 모델, XML에서 참조하는 커스텀 뷰, 위젯, ViewModel이었고 전부 이유가 있는 것들이었습니다.

mapping 파일은 검증에도 씁니다.
worker와 Room 데이터베이스, 그 `_Impl`, 위젯 provider가 이름을 유지하고 있는지 grep으로 확인했습니다.
난독화돼도 되는 것과 되면 안 되는 것이 의도대로 갈렸는지는 이 파일을 봐야 알 수 있습니다.

## 정리

- `-keep class * { ... }`는 멤버 조건과 무관하게 매칭된 클래스를 전부 보존한다. 멤버만 지키려면 `-keepclassmembers`, 해당 멤버를 가진 클래스만 고르려면 `-keepclasseswithmembers`를 쓴다.
- 라이브러리 전체를 keep하기 전에 AAR의 `proguard.txt`, JAR의 `META-INF/proguard/*.pro`를 먼저 열어본다.
- `-keep*`만 정리하고 `-dontwarn`은 남긴다. 지우면 빌드가 깨질 수 있다.
- 클래스명을 저장하는 코드(prefs 키, 영속화된 intent extra)는 이름을 고정해야 한다. 런타임에 클래스 객체에서 이름을 얻어 쓰는 코드는 안전하다.
- 비율은 mapping.txt에서 직접 센다. R8 태스크만 돌리면 되고 서명 설정은 필요 없다.
