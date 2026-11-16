---
title: "스토어 밖에서 설치되는 이전 버전 APK 받기 — Go로 만든 사내 다운로더"
description: "Play 자동 보호 때문에 스토어 밖 설치가 막힌 이전 버전 APK를, Play Developer API와 OAuth 로그인으로 받아오는 윈도우용 도구를 Go로 만든 기록입니다."
pubDate: 2026-11-16T05:30:00Z
category: dev-log
tags: ["go", "google-play", "oauth", "pkce", "android"]
aiPreview: "Play 자동 보호가 켜진 앱은 스토어 밖에서 설치하면 실행이 막히고, 테스트 트랙은 가장 높은 versionCode만 내려줘서 이전 버전을 받을 수 없었습니다. Play Developer API의 generatedApks로 운영 앱과 같은 키로 서명된 보호 없는 범용 APK를 받았고, 배포 권한이 있는 서비스 계정 키 대신 로컬 리디렉션과 PKCE를 쓰는 OAuth 설치형 앱 흐름으로 각자 구글 계정으로 로그인하게 했습니다. 동의 화면은 앱이 쓰는 프로젝트를 건드리지 않도록 사내 도구용 프로젝트에 내부용으로 만들었고, 403 SERVICE_DISABLED는 API 사용 설정으로 해결했습니다. 버전 이름은 빌드 커밋에서 만든 대응표를 go:embed로 넣어 찾고, Go 크로스 컴파일로 설치가 필요 없는 윈도우 exe 하나로 배포했습니다."
---

고객 문의 대응으로 이전 버전 앱을 따로 전달해야 하는 일이 생겼습니다.
예전에는 Google 드라이브에 APK를 올려 링크만 보내면 설치가 됐는데, 어느 순간부터 설치하자마자 "Google Play에서 앱 받기" 화면이 뜨면서 실행이 막혔습니다.
대표님이 필요할 때 직접 원하는 버전을 받을 수 있도록 작은 다운로드 도구를 Go로 만들었고 그 동작 원리를 기록해봅니다.

## 스토어 밖 설치가 막힌 이유

원인은 Play Console의 자동 보호(automatic protection)였습니다.
Play App Signing을 쓰는 앱은 Google이 업로드된 App Bundle로 APK를 만들고 서명까지 대신 해 줍니다.
자동 보호를 켜 두면 이 과정에서 설치 출처를 확인하는 코드가 함께 들어갑니다.
그래서 Play 스토어가 아닌 경로로 설치된 앱은 실행 시점에 스토어로 안내되면서 막힙니다.

Play Console 도움말에는 보호되지 않은 버전을 받는 방법이 두 가지 나와 있습니다.
하나는 보호를 끈 릴리스를 새로 만들어 번들 탐색기의 다운로드 탭에서 받는 방법이고 다른 하나는 Play Developer API로 받는 방법입니다.

처음에는 테스트 트랙을 하나 만들어서 그 링크로 이전 버전을 설치해 보려 했습니다.
하지만 계속 최신 버전이 설치됐습니다.
Play 스토어는 사용자가 참여한 모든 트랙 중에서 versionCode가 가장 높은 빌드를 내려주기 때문에, 프로덕션에 더 높은 버전이 있으면 테스트 트랙의 낮은 버전은 선택되지 않습니다.
스토어를 거쳐서는 낮은 버전을 받을 방법이 없으니 API 쪽으로 방향을 잡았습니다.

## generatedApks API로 APK 받기

Play Developer API의 `generatedApks` 리소스는 업로드된 App Bundle로 Google이 만든 APK 목록을 돌려주고 그중 하나를 내려받게 해 줍니다.
요청은 두 번이면 됩니다.

```
GET /androidpublisher/v3/applications/{packageName}/generatedApks/{versionCode}
GET /androidpublisher/v3/applications/{packageName}/generatedApks/{versionCode}/downloads/{downloadId}:download?alt=media
```

첫 번째 응답에는 서명 키별로 묶인 APK 정보가 들어 있습니다.
각 항목에 서명 인증서의 SHA-256 해시가 있어서 실제 운영 앱의 서명 키와 같은 항목을 골라 그 안의 범용 APK(universal APK) `downloadId`를 꺼냅니다.
범용 APK는 모든 ABI, 화면 밀도, 언어 리소스가 한 파일에 들어 있어서 기기 사양과 관계없이 설치할 수 있습니다.

두 번째 요청은 파일 자체를 받는 요청이라 `alt=media`를 붙여야 메타데이터가 아니라 바이너리가 내려옵니다.
이렇게 받은 APK에는 자동 보호 코드가 빠져 있고 서명은 Play 앱 서명 키 그대로입니다.
서명이 운영 앱과 같기 때문에 Google 로그인이나 FCM처럼 서명 지문으로 앱을 확인하는 기능도 그대로 동작하고 나중에 Play 스토어에서 최신 버전으로 업데이트하는 것도 문제가 없습니다.

## 인증은 서비스 계정 대신 본인 구글 계정으로

처음 동작을 확인할 때는 배포 자동화에 쓰던 서비스 계정 키를 그대로 썼습니다.
그런데 이 키에는 앱을 올리고 내릴 수 있는 권한까지 있었습니다.
이 키를 실행 파일과 함께 다른 PC에 두는 건 배포 권한을 통째로 나눠주는 것과 같아서 각자 자기 구글 계정으로 로그인하는 방식으로 바꿨습니다.
이렇게 하면 다운로드는 로그인한 사람의 Play Console 권한으로 이뤄지고 권한 관리도 Play Console 사용자 설정 한 곳에서 끝납니다.

데스크톱 프로그램에서 구글 로그인을 붙일 때는 OAuth의 설치형 앱 흐름을 씁니다.
gcloud CLI 같은 도구가 로그인할 때 쓰는 방식과 같습니다.

```go
listener, _ := net.Listen("tcp", "127.0.0.1:0")
redirectURI := fmt.Sprintf("http://127.0.0.1:%d", listener.Addr().(*net.TCPAddr).Port)

verifier := randomString(64)
challenge := sha256.Sum256([]byte(verifier))

loginURL := authURL + "?" + url.Values{
    "client_id":             {clientID},
    "redirect_uri":          {redirectURI},
    "response_type":         {"code"},
    "scope":                 {"https://www.googleapis.com/auth/androidpublisher"},
    "code_challenge":        {base64.RawURLEncoding.EncodeToString(challenge[:])},
    "code_challenge_method": {"S256"},
    "state":                 {state},
    "access_type":           {"offline"},
}.Encode()
```

프로그램이 `127.0.0.1`의 빈 포트에 작은 HTTP 서버를 띄우고 그 주소를 리디렉션 주소로 넣어 브라우저를 엽니다.
사용자가 로그인하고 허용을 누르면 브라우저가 이 로컬 주소로 인증 코드를 넘겨주고 프로그램은 그 코드를 토큰으로 바꿉니다.

데스크톱 앱의 클라이언트 보안 비밀번호는 실행 파일 안에 들어갈 수밖에 없어서 사실상 공개된 값입니다.
그래서 PKCE를 같이 씁니다.
로그인을 시작할 때 만든 임의의 `verifier`를 해시해서 `code_challenge`로 보내 두고, 코드를 토큰으로 바꿀 때 원래 `verifier`를 함께 보냅니다.
중간에 누가 인증 코드를 가로채더라도 `verifier`가 없으면 토큰을 받을 수 없습니다.
`state` 값은 브라우저에서 돌아온 요청이 이 프로그램이 시작한 로그인인지 확인하는 데 씁니다.

`access_type=offline`으로 받은 refresh token은 사용자 설정 폴더에 저장해 둡니다.
다음 실행부터는 이 토큰으로 바로 access token을 받기 때문에 로그인 화면이 다시 뜨지 않고 토큰이 만료됐을 때만 다시 로그인합니다.

## 동의 화면은 별도 프로젝트에 내부용으로

OAuth 클라이언트를 만들려면 GCP 프로젝트에 동의 화면이 있어야 합니다.
처음에는 앱이 원래 쓰던 프로젝트에 만들려고 했는데, 이 프로젝트의 동의 화면은 앱의 구글 로그인과 캘린더 연동이 함께 쓰고 있었습니다.
여기를 "내부" 사용자 유형으로 바꾸면 회사 계정이 아닌 일반 사용자 전부가 로그인을 못 하게 됩니다.

그래서 사내 도구용 GCP 프로젝트를 따로 만들고 동의 화면을 내부(Internal)로 설정했습니다.
내부 앱은 같은 Google Workspace 조직 계정만 로그인할 수 있고 구글 앱 심사를 거치지 않아도 됩니다.
클라이언트 유형은 데스크톱 앱으로 만들었습니다.

새 프로젝트로 처음 실행했을 때는 로그인까지는 잘 되는데 API 호출이 403으로 막혔습니다.
응답 본문을 열어 보니 `SERVICE_DISABLED`였습니다.
권한 문제가 아니라 이 프로젝트에 Google Play Android Developer API가 켜져 있지 않다는 뜻이었고 API를 사용 설정하자 바로 다운로드가 됐습니다.
Play Console 쪽에서 GCP 프로젝트를 따로 연결하는 절차는 필요 없었습니다.
403이 나오면 메시지만 보고 계정 권한부터 의심하기 쉬운데, 응답의 `reason` 필드를 먼저 확인하는 게 빨랐습니다.

## 버전 이름을 버전 코드로 바꾸기

API는 versionCode로만 동작하고, 번들별 버전 이름(versionName)은 알려 주지 않습니다.
하지만 사람이 기억하는 건 `2.4.18` 같은 버전 이름입니다.

다행히 저장소에는 배포할 때마다 `Build 이름(코드)` 형식의 커밋이 남아 있었습니다.
이 커밋 메시지들에서 버전 이름과 코드의 대응표를 만들고 같은 이름의 빌드가 여러 개면 가장 높은 코드를 남겼습니다.
대응표는 `go:embed`로 실행 파일 안에 넣었습니다.

```go
//go:embed versions.txt
var versionsTable string
```

입력이 정확히 일치하지 않으면 앞자리로 찾습니다.
`2.4`을 입력하면 `2.4.`으로 시작하는 버전들을 숫자 단위로 비교해서 가장 높은 버전을 고릅니다.
문자열로 비교하면 `2.4.9`가 `2.4.18`보다 크다고 나오기 때문에, 점으로 나눈 각 자리를 정수로 비교했습니다.
대응표는 빌드한 시점까지의 정보라서 그 뒤에 나온 버전은 코드를 직접 입력하도록 안내했습니다.

## Go로 만든 이유

대표님 PC는 윈도우이고 개발 환경이 없습니다.
설치 없이 실행 파일 하나로 끝나야 했고 이 조건에 Go가 가장 잘 맞았습니다.

- 맥에서 `GOOS=windows GOARCH=amd64 go build` 한 줄로 윈도우용 exe가 나옵니다.
- 런타임이 실행 파일 안에 포함돼 있어서 받는 쪽에서 설치할 게 없습니다.
- HTTP, JSON, 해시, Base64가 모두 표준 라이브러리에 있어서 외부 의존성 없이 만들 수 있었습니다.

윈도우에서 신경 쓴 부분은 두 가지였습니다.
기본 콘솔 코드 페이지에서는 한글 출력이 깨질 수 있어서 시작할 때 `SetConsoleOutputCP(65001)`로 UTF-8 출력을 켰습니다.
다운로드가 끝나면 `explorer /select,경로`로 저장된 파일을 탐색기에서 바로 보여 줍니다.

코드 서명 인증서가 없는 실행 파일이라 처음 실행할 때 SmartScreen 경고가 뜹니다.
이 부분은 사용 안내문에 "추가 정보 → 실행"을 적어 두는 것으로 대신했습니다.

## 받은 APK 확인

받은 파일이 원하는 버전인지는 Android SDK 도구로 확인했습니다.
아래 명령어로 버전 정보와 서명 인증서를 볼 수 있습니다.

```
aapt2 dump badging app.apk
apksigner verify --print-certs app.apk
```

`versionCode`와 `versionName`이 요청한 값과 같은지, 서명 인증서 지문이 운영 앱과 같은지 확인했습니다.
APK 안에 자동 보호 관련 라이브러리가 없는 것도 함께 확인했습니다.

## 정리

- Play 자동 보호가 켜진 앱은 스토어 밖 설치가 막히고 테스트 트랙으로는 낮은 버전을 받을 수 없습니다.
- Play Developer API의 `generatedApks`로 보호되지 않은 범용 APK를 받을 수 있고 서명은 운영 앱과 같습니다.
- 배포 권한이 있는 서비스 계정 키를 나눠주는 대신 OAuth 설치형 앱 흐름(로컬 리디렉션 + PKCE)으로 각자 로그인하게 했습니다.
- 앱이 쓰는 프로젝트의 동의 화면은 건드리지 않고 사내 도구용 프로젝트를 따로 만들어 내부용으로 설정했습니다.
- API는 버전 코드만 받아서 빌드 커밋에서 만든 대응표를 실행 파일에 넣어 버전 이름으로도 찾게 했습니다.
- Go의 크로스 컴파일 덕분에 맥에서 설치가 필요 없는 윈도우 exe 하나로 배포할 수 있었습니다.
