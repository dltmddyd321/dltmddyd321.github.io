---
title: "커밋 로그에서 슬랙 배포 알림까지 — Fastlane 자동화 노트"
description: "배포 때마다 손으로 정리하던 커밋 목록과 슬랙 공지를 Fastlane 레인 하나로 자동화한 과정을 정리했습니다. 이슈 링크로 시작하는 커밋만 골라내고 중복 제목을 제거하는 로직과, 이슈 트래커 릴리즈 링크를 실패 없이 붙이는 방법을 다룹니다."
pubDate: 2026-09-23T04:00:00Z
category: ai-lab
tags: ["fastlane", "slack", "ci-cd", "automation", "ruby"]
aiPreview: "배포할 때마다 git log를 손으로 훑어 슬랙 공지를 쓰던 반복 업무를 Fastlane 레인으로 자동화했습니다. 마지막 배포 커밋 이후의 로그에서 이슈 링크로 시작하는 커밋만 필터링하고 중복 제목을 제거해 배포 알림에 넣을 목록을 만들고, 이슈 트래커 REST API로 릴리즈 리포트 링크를 조회하되 실패해도 전체 알림이 죽지 않도록 분리했습니다. Fastlane의 lane/Fastfile 기본 개념부터 실제 슬랙 알림 레인이 완성되기까지의 과정을 정리했습니다."
---

배포 브랜치가 머지되고 나면 슬랙 배포 채널에 무엇이 바뀌었는지 알려야 합니다. 그동안은 `git log`를 열어서 최근 커밋들을 눈으로 훑고, 이슈 링크가 붙은 것만 골라내고, 같은 수정사항이 여러 번 커밋됐으면 하나로 합치고, 마지막으로 이슈 트래커의 릴리즈 리포트 링크까지 손으로 붙여넣었습니다. 배포할 때마다 반복하다 보니 이 부분도 자동화하기로 했습니다.

## Fastlane이 뭔지 먼저

Fastlane은 모바일 앱 빌드·배포 작업을 자동화하는 Ruby 기반 CLI 도구입니다. 스토어 업로드, 스크린샷 생성, 서명, 슬랙 알림 같은 반복 작업을 "lane"이라는 단위로 묶어두고 명령 한 줄로 실행합니다.

핵심 개념은 두 가지입니다.

- `Fastfile`에 `lane :이름 do ... end` 블록으로 자동화 스크립트를 정의합니다. 각 lane 안에서는 Fastlane이 기본 제공하는 액션(`gradle`, `upload_to_play_store`, `slack` 등)을 조합하거나, 그냥 Ruby 코드를 그대로 씁니다.
- 실행은 터미널에서 `fastlane 이름` 한 줄로 합니다. 파라미터가 필요하면 `fastlane 이름 key:value` 형태로 넘기고 lane 안에서는 `options[:key]`로 받습니다.

CI(예: GitHub Actions)에 이 명령 한 줄만 넣어두면 머지·태그 같은 이벤트가 트리거가 되어 빌드부터 배포, 알림까지 사람 개입 없이 흘러갑니다. 저희도 이 구조 위에 배포 알림 레인을 하나 추가하는 식으로 작업했습니다.

## 배포 이후 커밋만 골라내기

가장 먼저 필요한 건 "이번 배포에 뭐가 들어갔는지"를 정확히 아는 것이었습니다. 방법은 이렇습니다.

1. 커밋 로그에서 가장 최근의 배포 커밋(버전을 올리는 커밋)을 찾습니다.
2. 그 커밋부터 지금(HEAD)까지의 커밋 로그를 가져옵니다.
3. 그중 커밋 메시지가 이슈 트래커 링크로 시작하는 것만 남깁니다. 버전업 커밋이나 머지 커밋, 잡무성 커밋은 애초에 링크로 시작하지 않으니 이 필터 하나로 자동으로 걸러집니다.
4. 링크 부분은 잘라내고 설명만 남겨 불릿으로 만듭니다.
5. 같은 문구가 여러 번 나오면 하나만 남깁니다.

코드로 옮기면 대략 이런 모양입니다.

```ruby
private_lane :extract_release_commits do |options|
  last_release_commit = sh("git log -i --pretty=format:'%h' --grep 'Release ' HEAD -1").strip
  git_range = last_release_commit.empty? ? "HEAD" : "#{last_release_commit}...HEAD"

  sh("git log --pretty=format:'%s' #{git_range}").strip
    .split("\n")
    .select { |c| c =~ /\Ahttps?:\/\// }   # 이슈 링크로 시작하는 커밋만
    .map { |c| "- #{c.split(' ', 2)[1]}" } # 링크 접두사 제거
    .uniq                                  # 같은 제목 중복 제거
    .join("\n")
end
```

여기서 `.uniq` 한 줄이 실제로 제일 자주 도움이 됩니다. 같은 수정사항을 리뷰 대응하면서 커밋을 여러 번 나눠 올리는 경우가 흔한데, 커밋 제목 자체는 똑같으니 이 한 줄로 배포 알림에는 한 번만 뜹니다.

슬랙에 보내기 전에 이 목록을 터미널에서 미리 보고 싶어서 별도 레인도 하나 만들어뒀습니다. `fastlane previewReleaseNotes`를 실행하면 슬랙에는 아무것도 안 보내고 같은 목록을 터미널에 그대로 출력합니다. 배포 직전에 한 번 훑어보기 좋습니다.

## 이슈 트래커 릴리즈 링크 붙이기

커밋 목록만으로는 부족해서 이번 배포 버전에 해당하는 이슈 트래커의 릴리즈 리포트 링크도 같이 붙이기로 했습니다. 이슈 트래커 REST API로 현재 버전 이름과 일치하는 릴리즈를 찾아 그 리포트 URL을 가져오는 방식입니다.

이 부분에서 신경 쓴 건 실패 처리였습니다. 인증 파일이 없거나, API 호출이 실패하거나, 버전 이름이 일치하는 릴리즈를 못 찾을 수 있습니다. 이 셋 중 무엇이 나든 슬랙 알림 자체가 실패해서는 안 됩니다. 그래서 이 조회 함수는 어떤 이유로든 실패하면 `nil`을 반환하도록 만들고 호출하는 쪽에서는 `nil`이면 그 필드를 그냥 생략하도록 했습니다. 링크 하나 못 붙이는 것과 배포 알림 자체가 안 가는 것은 완전히 다른 문제라서 이 둘을 분리하는 게 중요했습니다.

## 완성된 슬랙 알림

두 조각을 합치면 배포 레인은 이렇게 정리됩니다.

```ruby
lane :slackMessage do |options|
  commits = extract_release_commits(options)
  release_url = get_release_report_url(version_name: current_version_name)

  fields = [{ title: "주요 수정사항", value: commits }]
  fields << { value: "*관련 이슈 목록* : #{release_url}" } if release_url

  slack(
    message: "Android build #{current_version_name}(#{current_version_code}) 버전 배포되었습니다.",
    slack_url: ENV["SLACK_WEBHOOK_URL"],
    attachment_properties: { mrkdwn_in: ["text", "fields"], fields: fields }
  )
end
```

배포 스크립트 마지막에 이 레인 하나만 호출하면, 버전 정보와 이번에 들어간 수정사항 목록, 그리고 릴리즈 리포트 링크가 있으면 그것까지 슬랙 채널에 자동으로 올라갑니다. 예전에는 배포하고 나서 따로 시간을 내 슬랙 메시지를 작성했는데, 지금은 배포 파이프라인의 마지막 단계일 뿐입니다.

## 정리

- 배포 알림에 들어갈 커밋은 "이슈 링크로 시작하는가"라는 조건 하나로 자동 필터링됩니다.
- 같은 제목의 커밋이 여러 번 있어도 `.uniq` 한 줄로 알림에는 한 번만 뜹니다.
- 이슈 트래커 릴리즈 링크 조회는 실패해도 전체 알림이 죽지 않도록 별도로 분리했습니다.
- 슬랙에 보내기 전 터미널에서 미리 볼 수 있는 레인을 따로 둬서 배포 직전에 한 번 확인할 수 있습니다.
