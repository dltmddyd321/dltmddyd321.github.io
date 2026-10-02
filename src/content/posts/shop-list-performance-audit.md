---
title: "사용자 경험 중시 - 오래된 상점 시스템에서 나오는 문제점을 대응하며 (2)"
description: "1편에서 상점 목록의 깜빡임과 물음표를 고친 뒤, 같은 기준으로 상점 전체를 다시 훑었습니다. 디자인과 흐름은 그대로 두고, 같은 화면을 더 적게 그리고 더 적게 요청하도록 고친 다섯 가지를 정리했습니다."
pubDate: 2026-10-02T06:00:00Z
category: dev-log
tags: ["android", "performance", "compose", "recyclerview", "image-loading"]
aiPreview: "홈 화면의 아이템 섹션은 화면 밖으로 스크롤돼도 매 프레임 블러를 다시 계산했고, 동기화나 렌더 이벤트가 올 때마다 섹션을 통째로 새로 만든 뒤 목록을 한 번 더 바인딩했습니다. 썸네일은 이미 받은 원본을 두고 URL이 다른 변환본을 또 받았습니다. Compose 목록의 페이징 기준은 LaunchedEffect가 처음 잡은 목록 크기에 멈춰 다음 페이지를 미리 끝까지 당겨 왔고, 로딩 플래그는 IO 스레드에서 늦게 켜져 같은 페이지를 중복 요청할 수 있었습니다. 디자인과 흐름은 건드리지 않고 getGlobalVisibleRect, 결과 비교 키, 받아 둔 파일 재사용, rememberUpdatedState와 distinctUntilChanged, 즉시 켜고 finally에서 끄는 플래그로 고친 기록입니다."
---

지난 글에서는 상점 아이템 순위 목록 하나를 붙잡고 깜빡임과 물음표의 원인을 찾았습니다.
고치고 나니 같은 기준으로 상점 전체를 다시 보고 싶어졌습니다.
홈 화면의 아이템 섹션, 검색, 제작자 페이지, 상세 화면까지 훑었습니다.

이번에는 조건을 하나 걸었습니다.
디자인과 사용자 흐름은 그대로 두고 같은 화면을 더 적은 비용으로 그리는 것만 고치기로 했습니다.
새 화면이나 새 상태를 추가하는 개선은 따로 모아 두고 이번 범위에서 뺐습니다.

## 화면 밖에서도 블러를 계산하고 있었습니다

홈 화면에는 아이템 섹션이 여러 개 있고 섹션마다 뒷배경을 흐리게 깔아주는 블러 뷰가 하나씩 붙어 있습니다.
이 블러 뷰는 `OnPreDrawListener`에서 매 프레임 화면 전체를 별도 Canvas에 다시 그리고 블러를 겁니다.

그리기를 건너뛰는 조건은 `isShown()` 하나였습니다.
`isShown()`은 자기와 부모들이 VISIBLE인지만 봅니다.
스크롤해서 화면 밖으로 밀려난 섹션도 VISIBLE이니 계속 그렸습니다.

섹션이 N개면 프레임마다 화면 전체를 N번 다시 그리게 됩니다.
섹션 안의 APNG 썸네일이 움직이는 동안에는 프레임이 쉬지 않고 돌아서 이 비용이 계속 쌓입니다.

```kotlin
override fun onPreDraw(): Boolean {
    if (isShown && getGlobalVisibleRect(visibleRect) && prepare()) {
        drawDecorIntoBlurCanvas()
        blur()
    }
    return true
}
```

`getGlobalVisibleRect()`는 뷰가 실제로 화면에 조금이라도 보일 때만 true를 돌려줍니다.
화면 밖이면 그 프레임의 블러를 건너뜁니다.

보이지 않는 동안 블러 이미지가 갱신되지 않는 것은 문제가 되지 않습니다.
다시 화면에 들어오는 순간 그 프레임의 `onPreDraw`가 먼저 돌아서 그려지기 전에 블러가 새로 계산됩니다.

## 홈에 돌아올 때마다 섹션을 새로 만들고 있었습니다

홈 화면은 동기화가 끝날 때, 화면을 다시 그리라는 이벤트를 받을 때마다 갱신됩니다.
그때마다 아이템 섹션 API를 다시 부르고, 섹션 뷰를 전부 지운 뒤 새로 만들었습니다.

```kotlin
api.getItemSections { sections ->
    container.removeAllViews()
    sections.forEach { container.addView(SectionView(it)) }
    container.applyThemeToSections()
}
```

새로 만든다는 건 섹션마다 RecyclerView와 어댑터, 블러 뷰가 다시 생기고 썸네일도 처음부터 다시 그린다는 뜻입니다.
응답 내용은 대부분 그대로인데도 그랬습니다.

마지막 줄도 문제였습니다.
섹션을 만들 때 이미 테마를 입혀서 목록을 바인딩했는데, 만든 직후 테마를 한 번 더 적용하면서 목록을 `notifyDataSetChanged()`로 다시 바인딩하고 있었습니다.
썸네일 요청과 APNG 디코딩이 섹션을 만들 때마다 두 번씩 일어났습니다.

```kotlin
api.getItemSections { sections ->
    val renderKey = listOf(sections, theme.id, theme.isDark, font.id)
    if (renderKey == lastRenderKey) return
    lastRenderKey = renderKey

    container.removeAllViews()
    sections.forEach { container.addView(SectionView(it)) }
}
```

응답 데이터와 화면 모양을 정하는 값(테마, 다크 모드 여부, 폰트)을 묶어서 직전 값과 비교합니다.
모두 같으면 지금 화면이 이미 그 결과이므로 아무것도 하지 않습니다.
하나라도 다르면 예전처럼 새로 만듭니다.

응답 모델이 data class라서 리스트 비교만으로 내용 비교가 됩니다.
테마나 폰트를 바꾸면 비교 값이 달라지므로 바뀐 모양은 그대로 반영됩니다.
만든 직후 테마를 다시 적용하던 줄은 지웠습니다.

## 받아 둔 원본을 두고 변환본을 또 받고 있었습니다

지난 글에서 썸네일을 그리는 함수를 손봤습니다.
APNG인지 확인하려고 원본 파일을 먼저 받고, 정적 이미지면 서버의 변환 이미지를 다시 요청하는 구조였습니다.
그때는 변환 이미지에도 디스크 캐시가 남도록 고쳤습니다.

다시 보니 근본적으로는 같은 이미지를 두 번 받고 있었습니다.
원본은 이미 손에 있는데 URL이 다른 변환본을 한 번 더 요청하니 캐시 키도 달라서 처음 볼 때마다 네트워크를 두 번 탔습니다.

```kotlin
val file = imageLoader.downloadOriginal(url)
when {
    file.isApng() -> view.setImageDrawable(ApngDrawable.decode(file))
    else -> imageLoader.load(file)
        .signature(file.lastModified())
        .error(imageLoader.load(convertedUrl(url)))
        .into(view)
}
```

정적 이미지는 이미 받은 파일을 그대로 넘깁니다.
이미지 로더가 뷰 크기에 맞춰 줄여서 디코딩하므로 원본이 커도 메모리 부담은 비슷합니다.

받은 파일은 이미지 로더의 디스크 캐시에 있는 파일입니다.
아주 드물게 표시하기 전에 캐시에서 밀려날 수 있어서 그때는 예전처럼 변환 이미지를 받아 그리도록 실패 대체 요청을 걸어 두었습니다.

## 페이징 기준이 처음 목록 크기에 멈춰 있었습니다

검색 결과와 제작자 페이지는 Compose로 되어 있고 목록 끝에 가까워지면 다음 페이지를 불러옵니다.

```kotlin
@Composable
fun ItemList(list: List<Item>) {
    val listState = rememberLazyListState()
    LazyColumn(state = listState) { /* ... */ }

    LaunchedEffect(listState) {
        snapshotFlow { listState.layoutInfo.visibleItemsInfo.lastOrNull() }
            .collect { last ->
                if (last != null && last.index >= list.size - 3) loadMore()
            }
    }
}
```

겉보기엔 맞는 코드인데 `list`가 문제였습니다.
`LaunchedEffect`의 key는 `listState` 하나라서 이 블록은 처음 한 번만 시작되고 다시 시작되지 않습니다.
안의 람다가 잡은 `list`는 처음 composition 때 받은 값 그대로 남습니다.
화면에는 불변 리스트로 복사해서 넘기고 있어서 페이지가 붙어도 람다 안의 `list.size`는 첫 페이지 크기에서 멈춰 있었습니다.

첫 페이지가 20개였다면 기준은 계속 17입니다.
17번째를 넘어 스크롤하는 동안에는 조건이 내내 참이라 다음 페이지를 미리 끝까지 당겨 왔습니다.
빈 상태로 먼저 그려진 탭은 기준이 -3이 되어 처음부터 계속 참이었습니다.

검색 화면은 비용이 하나 더 있었습니다.
페이징 요청이 검색 버튼을 누를 때와 같은 경로를 타서 페이지를 넘길 때마다 최근 검색어를 DB에 다시 쓰고 키보드와 포커스 처리, 입력창 상태 갱신까지 반복했습니다.

```kotlin
val currentList by rememberUpdatedState(list)
LaunchedEffect(listState) {
    snapshotFlow { listState.layoutInfo.visibleItemsInfo.lastOrNull()?.index }
        .distinctUntilChanged()
        .collect { lastIndex ->
            if (lastIndex != null && lastIndex >= currentList.size - 3) loadMore()
        }
}
```

`rememberUpdatedState`로 람다가 항상 최신 목록을 보게 했습니다.
`visibleItemsInfo`의 항목은 레이아웃할 때마다 새 객체로 만들어지므로, index만 꺼내 `distinctUntilChanged`로 마지막으로 보이는 위치가 바뀔 때만 확인합니다.
검색 화면의 페이징은 검색 경로를 거치지 않고 다음 페이지 요청만 바로 하도록 나눴습니다.

## 로딩 플래그가 늦게 켜졌습니다

같은 페이지를 두 번 요청하지 않으려고 로딩 플래그를 두고 있었습니다.
그런데 확인은 메인 스레드에서 하고, 플래그는 IO 스레드로 넘어간 뒤에 켰습니다.

```kotlin
fun loadMore() {
    if (!hasNext || isLoading) return
    scope.launch {
        withContext(Dispatchers.IO) {
            isLoading = true
            val result = fetch(page) ?: return@withContext
            list.addAll(result.items)
            isLoading = false
        }
    }
}
```

확인과 플래그 사이에 다시 호출되면 둘 다 통과해서 같은 페이지를 두 번 요청하고 같은 아이템을 두 번 붙입니다.
LazyColumn에 아이템 id를 key로 주고 있어서 key가 겹치면 크래시로 이어질 수도 있습니다.
결과가 null이면 플래그를 끄지 않고 빠져나가서 그 뒤로는 다음 페이지를 영영 불러오지 못하는 문제도 있었습니다.

```kotlin
fun loadMore() {
    if (!hasNext || isLoading) return
    isLoading = true
    scope.launch {
        try {
            withContext(Dispatchers.IO) {
                val result = fetch(page) ?: return@withContext
                list.addAll(result.items)
            }
        } finally {
            isLoading = false
        }
    }
}
```

확인한 바로 그 자리에서 플래그를 켜고, 끄는 건 `finally`에 두었습니다.

## 바꾸지 않은 것

점검하면서 더 찾은 것들이 있습니다.
상점 탭을 오갈 때마다 다시 요청하는 것, 상세 화면에서 돌아올 때마다 전부 다시 불러오는 것, 요청마다 HTTP 클라이언트를 새로 만드는 것 등입니다.

이 항목들은 "언제 다시 불러와야 하는가"를 화면마다 정해야 하고, 잘못 고치면 구매한 아이템이 바로 반영되지 않는 식으로 흐름에 영향을 줍니다.
그래서 이번 범위에서는 뺐습니다.

이번에 고친 다섯 가지는 모두 같은 결과를 더 적게 그리고 더 적게 요청하는 쪽입니다.
화면 모양과 순서는 바뀌지 않습니다.
아직 실기기에서 프레임 시간을 재 보지는 않았고, 섹션이 많은 홈 화면에서 전후를 측정해 볼 생각입니다.

## 정리

- `isShown()`은 화면 안에 있는지 알려주지 않습니다. 화면 밖에서 비싼 그리기를 멈추려면 `getGlobalVisibleRect()`처럼 실제 노출 여부를 봐야 합니다
- 갱신 이벤트가 자주 오는 화면은 결과가 같으면 다시 만들지 않습니다. 비교 값에는 데이터뿐 아니라 모양을 정하는 설정까지 넣습니다
- 같은 이미지를 두 번 받고 있지 않은지 확인합니다. 캐시 키가 다르면 캐시가 있어도 소용이 없습니다
- `LaunchedEffect` 안의 람다는 처음 값을 잡습니다. 바뀌는 값은 `rememberUpdatedState`로 넘깁니다
- 중복 요청을 막는 플래그는 확인한 자리에서 바로 켜고 `finally`에서 끕니다
