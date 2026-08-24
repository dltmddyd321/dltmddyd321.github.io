---
title: "iOS 인앱 업데이트 안내, App Store Lookup으로 모방하기"
description: "Android Play Core의 In-App Update를 iOS에 그대로 옮길 수 없어서, iTunes Lookup API로 버전을 비교해 App Store로 안내하는 방식으로 대체한 과정을 정리합니다."
pubDate: 2026-08-23T12:01:49Z
category: dev-log
tags: ["ios", "swift"]
aiPreview: Android는 Play Core의 In-App Update API로 앱 안에서 업데이트를 다운로드까지 시키지만, App Store는 그런 API 자체를 열어주지 않습니다. 대신 iTunes Lookup API로 스토어 최신 버전을 직접 조회해 비교하고, 다이얼로그로 App Store 딥링크를 안내하는 방식으로 우회했습니다.
---

안드로이드에서는 신규 버전이 마켓에 업로드되면 사용자에게 업데이트 안내를 하는 기능을 제공합니다. Play Core의 In-App Update API를 쓰면 스토어에 새 버전이 올라왔을 때 앱을 켜는 시점에 자동으로 감지합니다. 사용자가 앱을 계속 쓰는 동안 백그라운드로 새 버전을 받아두고 다운로드가 끝나면 재시작을 유도할 수 있습니다.

이걸 iOS에도 똑같이 넣으려고 찾아보다가, 애초에 대응되는 API가 없다는 걸 알게 됐습니다.. Android와 iOS를 공부할수록 보이는 차이점들이 흥미롭네요.

## Android: Play Core가 다운로드까지 맡아준다

`AppUpdateManager`에 현재 업데이트 가능 여부를 물어보면 됩니다.

```kotlin
val appUpdateManager = AppUpdateManagerFactory.create(context)

appUpdateManager.appUpdateInfo.addOnSuccessListener { info ->
    if (info.updateAvailability() == UpdateAvailability.UPDATE_AVAILABLE &&
        info.isUpdateTypeAllowed(AppUpdateType.FLEXIBLE)
    ) {
        appUpdateManager.startUpdateFlowForResult(
            info,
            updateLauncher,
            AppUpdateOptions.newBuilder(AppUpdateType.FLEXIBLE).build(),
        )
    }
}
```

`FLEXIBLE` 타입으로 요청하면 사용자는 앱을 계속 쓸 수 있고 Play가 알아서 백그라운드에서 다운로드를 진행합니다. 다운로드가 끝났는지는 리스너로 감지합니다.

```kotlin
val listener = InstallStateUpdatedListener { state ->
    if (state.installStatus() == InstallStatus.DOWNLOADED) {
        // 재시작 안내
    }
}
appUpdateManager.registerListener(listener)
```

여기서 한 가지 놓치기 쉬운 부분이 있는데, `registerListener`는 등록된 시점 이후의 상태 변화만 콜백합니다. 사용자가 다운로드를 끝내놓고 재시작을 미룬 채 앱을 완전히 종료했다가 다시 켜면, 새로 붙는 리스너는 이미 지나간 "완료" 이벤트를 받을 방법이 없습니다. 그래서 앱을 켤 때마다 `appUpdateInfo`를 한 번 더 조회해서 `installStatus`가 이미 `DOWNLOADED`인 경우도 따로 챙겨야 합니다. 다운로드는 끝났는데 재시작 안내를 영영 못 보는 상태로 남아버리기 때문입니다.

## iOS: 애초에 이런 API가 없다

Apple은 이 종류의 API를 아예 제공하지 않습니다. 이유를 짐작해보면, App Store는 앱 배포와 설치 권한을 자기 자신만 갖고 있는 구조라서 서드파티 앱이 다른 앱(자기 자신 포함)의 설치·업데이트를 트리거하는 경로 자체를 열어주지 않는 것 같습니다. Android가 Play Store 바깥에서도 APK 설치를 허용하는 것과는 플랫폼 접근 개념이 많이 다른 영향이겠네요.

그렇다고 손 놓고 있을 일은 아니고 "업데이트가 나왔다는 걸 앱이 스스로 알아채서 사용자에게 안내하는 것"까지는 충분히 만들 수 있습니다. 다운로드·설치는 어차피 사용자가 App Store에서 직접 눌러야 하지만 그 앞 단계인 "지금 업데이트가 있는지 확인하고 알려주는" 부분은 iTunes Lookup API로 해결됩니다.

```
GET https://itunes.apple.com/lookup?bundleId=com.windrr.boat
```
https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/iTuneSearchAPI/LookupExamples.html

인증도 필요 없는 공개 API고 응답에 `version`, `trackViewUrl` 같은 필드가 들어 있습니다. 현재 앱의 `CFBundleShortVersionString`과 비교해서 스토어 버전이 더 높으면 다이얼로그를 띄우고 확인을 누르면 `trackViewUrl`을 열어 App Store 상세 페이지로 보냅니다.

## 버전 비교는 숫자로 해야 한다

버전 문자열 두 개를 비교할 때 흔히 하는 실수가 그냥 문자열로 비교하는 겁니다. `"2.0.10"`과 `"2.0.9"`를 사전순으로 비교하면 `"10"`이 `"9"`보다 작다고 나옵니다. 첫 글자만 보고 비교하니 `1 < 9`가 되어버리는 겁니다. 그래서 점 단위로 쪼갠 다음 각 자리를 정수로 바꿔서 비교해야 합니다.
대학교때 뭔가 이런 문제를 풀었었던 기억이 나는군요. ㅎㅎ

```swift
static func isNewerVersion(_ remote: String, than local: String) -> Bool {
    let remoteParts = remote.split(separator: ".").map { Int($0) ?? 0 }
    let localParts = local.split(separator: ".").map { Int($0) ?? 0 }
    guard !remoteParts.isEmpty, !localParts.isEmpty else { return false }

    let count = max(remoteParts.count, localParts.count)
    for i in 0..<count {
        let r = i < remoteParts.count ? remoteParts[i] : 0
        let l = i < localParts.count ? localParts[i] : 0
        if r != l { return r > l }
    }
    return false
}
```

`"2.0"`처럼 자릿수가 짧은 버전과 비교할 때도 부족한 자리를 0으로 채워서 맞추고 혹시 버전 문자열에 숫자가 아닌 값이 섞여 있어도(예: 베타 태그) `Int($0) ?? 0`으로 그냥 0 취급하고 넘어가게 했습니다. 여기서 앱이 멈추면 안 되니, 판정이 살짝 틀리더라도 죽는 것보다는 낫다는 쪽으로 정했습니다.

## 실패하는 모든 경로가 그냥 "업데이트 없음"이어야 한다

이 기능 전체를 만들면서 가장 신경 쓴 지점은 사실 버전 비교 로직보다 "무슨 일이 있어도 이것 때문에 앱이 죽으면 안 된다"는 원칙이었습니다. iTunes Lookup은 Apple이 공식 문서함이 아니라 레거시 문서함에 올려둔 오래된 API라, 응답 형식이 언제 바뀔지 보장이 없습니다.

그래서 응답을 받는 구조체의 필드를 전부 옵셔널로 뒀습니다.

```swift
struct AppStoreLookupResult: Decodable {
    let version: String?
    let trackId: Int?
    let trackViewUrl: String?
}
```

네트워크 요청부터 디코딩까지는 `do-catch`로 감싸서 실패하면 그냥 `nil`을 돌려주고 호출하는 쪽은 그 `nil`을 "지금은 업데이트가 없다"와 똑같이 취급합니다.

```swift
do {
    let (data, response) = try await URLSession.shared.data(from: url)
    guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
        return nil
    }
    let decoded = try JSONDecoder().decode(AppStoreLookupResponse.self, from: data)
    guard (decoded.resultCount ?? 0) > 0 else { return nil }
    return decoded.results?.first
} catch {
    return nil
}
```

오프라인 상태든, 서버가 필드 하나를 슬쩍 빼버렸든, 아직 심사 중이라 `resultCount`가 0으로 오든 결과는 똑같습니다. 조용히 안내를 안 띄우고 넘어갈 뿐, 강제 언래핑 하나 때문에 앱 전체가 죽는 일은 없습니다.

## 다이얼로그는 "나중에"를 기억해야 한다

업데이트가 있다는 걸 확인했다고 매번 다이얼로그를 띄우면 금방 성가셔집니다. 앱에 이미 있던 알림 권한 안내 패턴을 그대로 가져와서 "나중에"를 누르면 며칠 동안은 다시 묻지 않도록 `UserDefaults`에 다음 노출 시각을 저장해뒀습니다. 알림 권한 쪽은 한 달 단위로 미뤘지만 이건 그것보다는 짧게 잡았습니다. 새 버전은 알림 권한 설정 변경보다 훨씬 자주 나오니까요.

```swift
private func check() async {
    guard Date().timeIntervalSince1970 >= UserDefaults.standard.double(forKey: Self.nextDisplayAtKey) else {
        return
    }
    guard let info = await AppStoreVersionChecker.fetchLatestVersionInfo() else { return }
    // ...버전 비교 후 다이얼로그 노출
}
```

앱 화면 자체는 그리지 않고 이 체크만 담당하는 뷰를 하나 만들어서 로그인 후 진입하는 메인 화면에 알림 권한 게이트와 나란히 붙여뒀습니다. 둘 다 "화면을 그리지 않고 필요할 때만 다이얼로그를 띄우는" 같은 모양의 컴포넌트라, 나중에 비슷한 걸 또 추가하게 되면 이 패턴을 그대로 재사용하면 될 것 같습니다.

## 정리

- Play Core In-App Update는 Android 전용이고 App Store는 서드파티 앱이 설치·업데이트를 트리거하는 경로를 아예 열어주지 않습니다.
- 대신 iTunes Lookup API로 스토어 버전을 직접 조회해서 비교하고 확인을 누르면 App Store 상세 페이지로 보내는 방식으로 안내까지는 만들 수 있습니다.
- 버전 문자열은 반드시 점 단위로 쪼개 숫자로 비교해야 합니다. 사전순 비교로는 두 자릿수 버전에서 틀린 결과가 나옵니다.
- 오래된 공개 API를 쓸 때는 응답 스펙이 바뀔 가능성을 기본값으로 깔고 실패하는 모든 경로가 크래시가 아니라 "기능이 조용히 꺼지는" 쪽으로 수렴하도록 짜야 합니다.
- 강제 업데이트를 위해서는 백엔드 검증을 통한 철저한 관리가 필요해보입니다. 그럼에도 불구하고 사용자가 업데이트를 회피할 수 있는 가능성이 있기 때문에 꼼꼼한 파악이 필요해보입니다.
