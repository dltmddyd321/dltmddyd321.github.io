---
title: "GA4를 MCP로 못 붙여서, 대신 스크립트로 만든 이야기"
description: "사이드 프로젝트 앱의 Firebase Analytics(GA4) 지표를 Claude에게 바로 물어보고 싶어서 MCP 연결을 시도했다가, 대신 Google Analytics Data API 스크립트를 직접 만들게 된 과정을 정리했습니다."
pubDate: 2026-09-17T12:10:00Z
category: ai-lab
tags: ["claude-code", "firebase", "python", "tooling"]
aiPreview: "MCP 레지스트리에 Firebase나 Google Analytics 커넥터가 아예 없다는 걸 확인한 뒤, Google Analytics Data API를 직접 호출하는 Python 스크립트로 방향을 틀었습니다. 이 과정에서 Apple Silicon 맥에서 x86_64 Python이 Rosetta 위에서 돌다가 cryptography 패키지의 네이티브 바인딩이 깨지는 문제를 겪었고, arm64 네이티브 Python으로 venv를 다시 만들어 해결했습니다. MAU는 별도 계산 로직 없이 GA4의 내장 지표(active28DayUsers)로 바로 나온다는 것도 이번에 알게 됐습니다."
---

사이드 프로젝트로 만들고 있는 앱의 Firebase Analytics(GA4) 지표를, 콘솔을 매번 열지 않고 Claude에게 그냥 물어보고 싶었습니다. "우리 앱 Firebase나 Analytics MCP 연결해서 지표를 한 번에 조회 가능할까?"라고 물어본 게 시작이었습니다.

## MCP 레지스트리부터 확인

기대와 달리 Firebase나 Google Analytics(GA4) 전용 MCP 커넥터는 검색해봐도 나오지 않았습니다. "firebase", "google analytics", "google", "bigquery" 키워드로 다 돌려봤는데 관련 없는 CRM 커넥터 하나만 걸렸습니다. MCP로 바로 붙이는 방법 자체가 지금은 없다는 뜻입니다.

이럴 때 선택지는 세 가지 정도였습니다.

1. Firebase 콘솔을 그때그때 직접 열어서 확인
2. Analytics 데이터를 BigQuery로 export해두고 나중에 SQL로 조회
3. Google Analytics Data API를 직접 호출하는 스크립트 작성

1번은 자동화가 안 되고, 2번은 지금 당장 쓸 일이 없는데 미리 인프라만 만들어두는 셈이라 3번으로 정했습니다.

## 준비물: 서비스 계정과 Viewer 권한

GA4 Data API를 코드로 호출하려면 사람이 브라우저로 로그인하는 대신, 프로그램이 인증할 방법이 필요합니다. Google Cloud의 **서비스 계정**이 그 역할을 합니다.

1. GCP 콘솔에서 "Google Analytics Data API"를 사용 설정
2. 서비스 계정을 만들고 JSON 키를 발급
3. 그 키 안에 있는 `client_email`을 복사해서, GA4 관리 화면의 **속성 액세스 관리**에 뷰어(Viewer) 권한으로 추가

이렇게 하면 서비스 계정이 "이 GA4 속성을 읽기 전용으로 조회할 수 있는 계정"이 됩니다. 사람 계정 로그인 없이도 스크립트가 데이터를 가져올 수 있는 이유입니다.

```python
def property_path() -> str:
    prop_id = os.environ.get("GA4_PROPERTY_ID")
    if not prop_id:
        raise SystemExit("GA4_PROPERTY_ID 환경변수가 없습니다.")
    return f"properties/{prop_id}"
```

키 파일은 당연히 저장소에 커밋하면 안 되는 값이라, `.gitignore`에 `*.json`을 걸어두고 코드만 별도 레포에 올렸습니다.

## Apple Silicon에서 만난 첫 번째 벽

venv를 만들고 `pip install`까지는 순조로웠는데, 스크립트를 실행하자마자 이런 에러가 났습니다.

```
ImportError: dlopen(.../cryptography/hazmat/bindings/_rust.abi3.so, ...):
symbol not found in flat namespace '_ERR_get_error_all'
```

`cryptography` 패키지의 네이티브(Rust) 바인딩을 로드하다가 실패한 겁니다. 원인을 찾아보니 맥은 arm64(Apple Silicon)인데, 실제로 쓰고 있던 Python 바이너리가 **x86_64용**이었습니다.

```bash
file venv/bin/python3.9
# venv/bin/python3.9: Mach-O 64-bit executable x86_64
```

x86_64 Python이 Rosetta 위에서 돌아가면서, 그 위에 설치된 `cryptography`의 네이티브 라이브러리가 기대하는 심볼 집합과 실제 로드되는 라이브러리 사이에 불일치가 생긴 것으로 보입니다. 마침 Python 3.9는 EOL 경고까지 뜨고 있던 참이라, 패치하는 대신 Homebrew로 arm64 네이티브 Python을 새로 설치하고 venv를 통째로 다시 만들었습니다.

```bash
brew install python@3.12
rm -rf venv
/opt/homebrew/opt/python@3.12/bin/python3.12 -m venv venv
```

```bash
file venv/bin/python3.12
# venv/bin/python3.12: Mach-O 64-bit executable arm64
```

이후로는 문제없이 동작했습니다. 인텔 시절 설치된 Python이 여전히 기본 PATH에 남아있는 맥에서, arm64/x86_64 어느 쪽이 실제로 쓰이고 있는지 한 번쯤 `file` 명령으로 확인해볼 가치가 있다는 걸 배웠습니다.

## MAU는 계산할 필요가 없었다

지표를 팀에 공유할 고정 포맷으로 정리하면서, "월간 활성 사용자 수(MAU)는 따로 계산 로직이 필요하지 않을까"라는 이야기가 나왔습니다. 로그를 이벤트 단위로 집계해서 직접 "최근 28일 내 고유 사용자 수"를 계산해야 하는 건 아닌지 걱정한 겁니다.

찾아보니 GA4 Data API에는 이걸 위한 내장 지표가 이미 있었습니다. `active28DayUsers` — 기준일을 포함한 최근 28일간의 활성 사용자 수를 그대로 계산해서 돌려줍니다.

```python
mau_request = RunReportRequest(
    property=property_path(),
    metrics=[Metric(name="active28DayUsers")],
    date_ranges=[DateRange(start_date=end, end_date=end)],
)
```

날짜 차원(dimension) 없이 종료일 하루만 `date_range`로 넣으면, 그 하루를 기준으로 한 28일 롤링 윈도 값이 나옵니다. 별도 집계 코드를 작성할 필요가 없었던 셈입니다. 비슷하게 `active1DayUsers`(DAU), `active7DayUsers`(WAU)도 있어서, 직접 계산해야 한다고 생각했던 지표 대부분이 사실은 API가 이미 제공하고 있었습니다.

## 팀 보고 포맷에 맞추기

이벤트 이름과 집계 수치를 팀이 원하는 순서·형식 그대로 뽑아내는 옵션도 추가했습니다.

```python
SUMMARY_EVENTS = [
    "user_engagement",
    "session_start",
    "first_open",
    "notification_receive",
    "service_feedback",
]
```

앞의 네 개는 Firebase가 자동으로 수집하는 표준 이벤트라 별도 계측 코드 없이 바로 집계됩니다. `service_feedback`만 앱 코드에서 직접 로깅하는 커스텀 이벤트입니다. `--summary` 옵션 하나로 이 다섯 줄 + MAU가 고정된 포맷으로 출력되도록 만들어서, 앞으로는 매번 스크립트 옵션을 새로 조합할 필요 없이 물어보면 바로 뽑을 수 있게 됐습니다.

## Crashlytics는 같은 방식이 안 됐다

지표를 붙인 김에 크래시 데이터도 같이 조회하고 싶어졌는데, Crashlytics는 GA4와 사정이 달랐습니다. 공개된 Data API 자체가 없고, 프로그래밍적으로 접근하는 유일한 경로는 **BigQuery export**뿐이었습니다. 문제는 이게 무료(Spark) 요금제에서는 안 되고 종량제(Blaze) 플랜으로 전환해야 한다는 점이었습니다.

무료 플랜만 쓰기로 했기 때문에 이 경로는 접었습니다. 대신 택한 방법은 단순합니다 — 브라우저에서 Firebase 콘솔에 로그인해두고, 필요할 때마다 Claude가 그 화면을 직접 열어서 crash-free 비율이나 미해결 이슈 수를 읽어 알려주는 방식입니다. 완전 자동화는 아니지만, 비용 없이 "물어보면 바로 확인"하는 목적은 달성했습니다.

크래시 급증 알림도 디스코드로 받고 싶었는데, Firebase Alerts가 기본 지원하는 채널은 이메일과 Slack뿐이었습니다. Cloud Functions로 디스코드 웹훅까지 연결하는 우회로가 있긴 하지만, 이것도 결국 외부 네트워크 호출이 가능한 Blaze 플랜이 전제라 이번엔 이메일 알림으로 타협했습니다.

## 정리

- MCP로 어떤 서비스든 바로 붙을 거라 기대하면 안 되고, 레지스트리에 없으면 그 서비스의 공식 API를 직접 호출하는 스크립트가 여전히 유효한 대안이다.
- Apple Silicon 맥에서 오래된 도구체인을 쓸 때는 실행 파일이 arm64인지 x86_64인지부터 `file`로 확인하는 게 진단 시간을 크게 줄여준다.
- 직접 계산해야 한다고 생각한 지표(MAU 같은)가 API에 이미 내장돼 있는 경우가 있으니, 계산 로직부터 짜기 전에 문서를 한 번 더 찾아보는 게 낫다.
- 같은 Firebase 안에 있는 기능이라도 GA4와 Crashlytics는 API 지원 수준이 다르다. 무료 플랜을 유지해야 한다면 이 차이가 선택지를 크게 좁힌다.
