---
title: "사용자 경험 중시 - 오래된 상점 시스템에서 나오는 문제점을 대응하며"
description: "토스 Android 웨비나에서 들은 '빠르고 버벅이지 않는 스크롤'이라는 기준으로, 우리 앱의 상점 아이템 목록을 다시 들여다봤습니다. 스크롤할 때 이미지가 깜빡이고, 가끔 물음표가 뜨고, 버튼 아이콘이 사라지던 이유를 코드에서 하나씩 찾아 정리했습니다."
pubDate: 2026-10-01T03:00:00Z
category: dev-log
tags: ["android", "recyclerview", "coroutine", "image-loading", "performance"]
aiPreview: "스크롤하면 상점 아이템 이미지가 깜빡이고, 빠르게 내리면 물음표가 뜨고, 버튼의 코인 아이콘이 가끔 사라졌습니다. 취소된 이미지 로딩을 실패로 처리해 다른 아이템 자리에 물음표를 덮어썼고, 다음 페이지를 붙일 때마다 목록 전체를 다시 그렸고, 재사용된 뷰에 이전 아이템의 상태가 남아 있었습니다. 디코딩은 메인 스레드에서 돌았고 변환 이미지는 캐시 없이 매번 새로 받았습니다. 토스 웨비나에서 들은 기준으로 원인을 찾고, 결과를 붙이기 전 뷰 확인, 범위 알림, 기본 상태 먼저 깔기, IO 디코딩과 캐시 키 정리로 고친 기록입니다."
---

어제 토스 Android 채용 웨비나를 들었습니다.
길지 않은 세션이었고 메모해 둔 건 몇 줄 안 됩니다.
그런데 그 몇 줄을 들고 우리 앱을 다시 열어보니 걸리는 화면이 하나 있었습니다.

## 웨비나에서 들은 것

메모해 둔 건 네 가지였습니다.

- 홈 화면은 빠르고 안정적으로 만든다
- Layout Inspector로 봤을 때 컴포넌트가 하나하나 구분되어 보이면 Native다
- 사용자에게 빠르고 버벅이지 않는 스크롤과 상품 정보 렌더링 환경을 만든다
- Shared Element Transition으로 화면을 넘어가도 맥락을 이어준다

이 중 세 번째가 오래 남았습니다.
토스는 채용 공고에도 핵심 사용자 경험일수록 Native로 만든다고 적어두었는데 그 이유가 결국 이 문장 하나로 모이는 것 같았습니다.
스크롤이 버벅이지 않고 내리는 동안 정보가 제자리에 제때 그려지는 것.
사용자가 의식하지 못할 만큼 당연해야 하는 부분입니다.

Layout Inspector 이야기도 같은 맥락으로 들렸습니다.
화면을 열었을 때 컴포넌트가 각각 독립된 뷰로 보인다는 건 화면을 웹뷰 한 장으로 띄우지 않고 각 요소를 플랫폼이 직접 관리한다는 뜻입니다.
그래야 스크롤, 재사용, 애니메이션 같은 걸 세밀하게 다룰 수 있습니다.
여기까지는 제 해석입니다.

## 우리 상점 화면은 어땠나

우리 앱에는 꾸미기 아이템을 사고파는 상점이 있습니다.
그 안에 아이템 순위 목록이 있는데 웨비나를 듣고 나서 이 화면을 끝까지 내려봤습니다.

세 가지가 눈에 띄었습니다.

- 스크롤하는 동안 썸네일이 번쩍이며 바뀐다
- 빠르게 내리다 보면 어떤 썸네일은 물음표 이미지로 뜬다
- 구매 버튼 안의 코인 아이콘이 가끔 안 보인다

<figure class="phone-capture">
  <video src="/uploads/1790819366091-shop-list-before.mp4" autoplay muted loop playsinline></video>
  <figcaption>고치기 전, 아이템 순위 목록을 끝까지 내려본 화면</figcaption>
</figure>

물음표가 뜬 아이템은 스크롤을 살짝 올렸다 내리면 그제야 제대로 나왔습니다.
코인 아이콘도 항상 안 보이는 건 아니었고 볼 때마다 빠진 아이템이 달랐습니다.

"가끔", "그제야", "볼 때마다 다르다".
이런 말이 붙는 버그는 대개 뷰 재사용이나 비동기 작업의 순서 문제입니다.
그 방향으로 코드를 열어봤습니다.

## 물음표는 실패가 아니라 취소였습니다

목록은 RecyclerView로 되어 있고 각 아이템의 썸네일은 코루틴 안에서 불러옵니다.
뷰홀더가 다른 아이템에 다시 쓰이면 이전 아이템의 로딩 작업은 취소합니다.
여기까지는 맞습니다.

```kotlin
override fun onBindViewHolder(holder: ItemViewHolder, position: Int) {
    holder.loadJob?.cancel()
    holder.loadJob = scope.launch {
        imageLoader.load(holder.thumbnail, items[position].imageUrl)
    }
}
```

문제는 이미지를 불러오는 함수 쪽에 있었습니다.
구조를 단순하게 옮기면 이렇습니다.

```kotlin
suspend fun load(view: ImageView, url: String) {
    try {
        val file = withContext(Dispatchers.IO) { download(url) }
        view.show(file)
    } catch (e: Exception) {
        view.setImageResource(R.drawable.fallback_question)
    }
}
```

빠르게 스크롤하면 이런 일이 생깁니다.

뷰홀더 A가 아이템 1의 이미지를 받는 사이에 화면 밖으로 나갔다가 아이템 7 자리로 다시 쓰입니다.
바인딩이 다시 일어나면서 아이템 1의 작업은 취소되고 아이템 7의 작업이 시작됩니다.

취소된 작업의 `withContext`는 블록이 끝나고 돌아오는 순간 `CancellationException`을 던집니다.
코루틴이 취소됐다는 걸 알리는 정상적인 신호입니다.

그런데 `catch (e: Exception)`이 이 신호까지 잡습니다.
`CancellationException`도 `Exception`의 한 종류라서 그렇습니다.
그러고는 실패로 처리해 물음표 이미지를 넣습니다.

물음표가 들어간 뷰는 이미 아이템 7을 보여주는 중입니다.
아이템 7의 이미지가 먼저 도착했다면 그 위를 물음표가 덮고, 늦게 도착했다면 물음표가 잠깐 보였다가 바뀝니다.
스크롤을 살짝 올렸다 내리면 정상으로 보였던 것도 같은 이유입니다.
다시 바인딩될 때는 취소 없이 로딩이 끝나니까요.

고칠 방향은 두 가지입니다.
취소는 실패로 치지 않고 다시 던집니다.
그리고 결과를 붙이기 직전에 이 뷰가 아직 같은 아이템을 보여주는지 확인합니다.

```kotlin
suspend fun load(view: ImageView, url: String) {
    view.tag = url
    try {
        val image = withContext(Dispatchers.IO) { downloadAndDecode(url) }
        if (view.tag == url) view.show(image)
    } catch (e: CancellationException) {
        throw e
    } catch (e: Exception) {
        if (view.tag == url) view.setImageResource(R.drawable.fallback_question)
    }
}
```

어댑터 쪽에는 `CancellationException`을 다시 던지는 처리가 이미 있었습니다.
안쪽 함수가 먼저 삼켜버려서 바깥의 처리가 아무 의미가 없었던 겁니다.
코루틴을 쓰면서 `catch (e: Exception)`을 넓게 잡아두면 이런 일이 생긴다는 걸 이번에 다시 봤습니다.

## 다음 페이지를 붙일 때마다 전부 다시 그렸습니다

번쩍임 쪽은 원인이 하나가 아니었습니다.
가장 크게 보이던 건 목록 끝에서 다음 페이지를 붙일 때였습니다.

```kotlin
fun append(newItems: List<ShopItem>) {
    items.addAll(newItems)
    notifyDataSetChanged()
}
```

`notifyDataSetChanged()`는 RecyclerView에게 "전부 바뀌었으니 처음부터 다시 그려라"라고 말하는 것과 같습니다.
실제로 바뀐 건 끝에 몇 개가 붙은 것뿐인데 화면에 보이는 아이템 전부가 다시 바인딩됩니다.
바인딩이 다시 일어나면 이미지 로딩도 다시 시작되고 앞에서 본 취소 문제도 한꺼번에 터집니다.

스크롤 중에 일정한 간격으로 화면 전체가 번쩍였던 게 이 때문이었습니다.
번쩍이는 시점이 페이지를 하나 더 불러오는 시점과 정확히 겹쳤습니다.

붙인 범위만 알려주면 됩니다.

```kotlin
fun append(newItems: List<ShopItem>) {
    val start = items.size
    items.addAll(newItems)
    notifyItemRangeInserted(start, newItems.size)
}
```

이러면 이미 화면에 있던 아이템은 다시 그려지지 않습니다.

## 재사용된 뷰에는 이전 아이템이 남아 있었습니다

RecyclerView는 화면 밖으로 나간 뷰를 버리지 않고 다음 아이템에 다시 씁니다.
그래서 바인딩할 때 이전 아이템이 남긴 상태를 빠짐없이 덮어써야 합니다.
덮어쓰지 않은 속성은 이전 아이템 값 그대로 남습니다.

썸네일이 그랬습니다.
새 이미지가 도착하기 전까지 이전 아이템의 이미지가 그대로 보였습니다.
잠깐이지만 다른 아이템 그림이 보였다가 바뀌니 번쩍이는 것처럼 보였던 겁니다.
바인딩을 시작할 때 이전 요청을 정리하고 이미지를 비워두면 해결됩니다.

코인 아이콘도 마찬가지였습니다.
구매 버튼은 아이템 상태에 따라 세 갈래로 나뉩니다.

```kotlin
when {
    item.isPurchased -> {
        coinIcon.visibility = View.GONE
        buyButton.background = disabledBackground
    }
    item.isPremiumOnly && !user.isPremium -> {
        buyButton.setOnClickListener { showPremiumGuide() }
    }
    else -> {
        coinIcon.visibility = View.VISIBLE
        buyButton.background = primaryBackground
        buyButton.setOnClickListener { purchase(item) }
    }
}
```

두 번째 갈래, 프리미엄 전용 아이템은 클릭 동작만 정하고 아이콘과 배경은 건드리지 않습니다.
결과는 이 뷰홀더가 직전에 무엇을 그렸느냐에 따라 달라졌습니다.
직전에 일반 아이템을 그렸다면 아이콘이 보이고 이미 구매한 아이템을 그렸다면 숨김 상태가 그대로 남습니다.
그래서 볼 때마다 빠진 아이템이 달랐습니다.

버튼 배경도 같은 식으로 회색이 남을 수 있었습니다.
아직 눈에 띄지 않았을 뿐입니다.

갈래마다 빠뜨리지 않게 조심하기보다 공통 상태를 먼저 한 번 정하고 갈래에서는 다른 부분만 바꾸는 쪽이 안전합니다.

```kotlin
coinIcon.visibility = View.VISIBLE
buyButton.background = primaryBackground

when {
    item.isPurchased -> {
        coinIcon.visibility = View.GONE
        buyButton.background = disabledBackground
        buyButton.setOnClickListener(null)
    }
    item.isPremiumOnly && !user.isPremium -> {
        buyButton.setOnClickListener { showPremiumGuide() }
    }
    else -> {
        buyButton.setOnClickListener { purchase(item) }
    }
}
```

이러면 새 갈래가 생겨도 기본 상태가 항상 먼저 깔립니다.

## 같은 이미지를 스크롤할 때마다 새로 받았습니다

마지막은 눈에 덜 띄지만 스크롤을 무겁게 만들던 부분입니다.

상점 썸네일은 움직이는 이미지(APNG)일 수도 있고 일반 이미지일 수도 있습니다.
그래서 파일을 먼저 받아 형식을 확인한 뒤 그리는데 일반 이미지면 webp로 변환한 주소로 한 번 더 요청했습니다.

여기에 두 가지가 겹쳤습니다.

변환 이미지 요청에 디스크 캐시를 끄는 옵션이 붙어 있었습니다.
그래서 한 번 본 이미지라도 스크롤해서 돌아오면 네트워크에서 다시 받았습니다.

움직이는 이미지의 디코딩은 메인 스레드에서 돌았습니다.
파일을 받는 건 IO 스레드에서 했지만 받은 파일을 이미지로 푸는 작업은 `withContext`가 끝난 뒤에 있었기 때문입니다.
움직이는 이미지가 화면에 들어올 때마다 그만큼 스크롤이 끊길 수 있습니다.

## 이렇게 고쳤습니다

물음표, 전체 다시 그리기, 남아 있던 상태는 위에서 고친 코드를 같이 적었습니다.
여기서는 나머지 둘과, 바인딩 시작 부분을 어떻게 바꿨는지 정리합니다.

바인딩을 시작할 때 이전 아이템의 흔적부터 지웁니다.
돌고 있던 애니메이션을 멈추고 이미지 라이브러리에 걸려 있던 요청을 정리하고 이미지를 비웁니다.

```kotlin
override fun onBindViewHolder(holder: ItemViewHolder, position: Int) {
    holder.loadJob?.cancel()
    holder.thumbnail.stopAnimation()
    imageLoader.clear(holder.thumbnail)
    holder.thumbnail.setImageDrawable(null)

    holder.loadJob = scope.launch {
        imageLoader.load(holder.thumbnail, items[position].imageUrl)
    }
}
```

새 이미지가 오기 전까지는 빈칸으로 보입니다.
다른 아이템 그림이 잠깐 보였다가 바뀌는 것보다는 빈칸이 낫다고 봤습니다.

움직이는 이미지는 받는 것과 푸는 것을 한 번에 IO 스레드에서 끝냅니다.
메인 스레드로 돌아왔을 때는 그리기만 하면 됩니다.

그러면 IO 블록이 돌려주는 결과가 세 갈래로 나뉩니다.
움직이는 이미지면 디코딩된 Drawable을, 일반 이미지면 캐시 키에 쓸 원본 파일을 돌려줘야 하고 실패면 돌려줄 게 없습니다.
갈래마다 들고 있는 값의 타입이 다릅니다.

두 값을 `Pair`로 묶어 돌려주는 방법도 있습니다.

```kotlin
val (file, drawable) = withContext(Dispatchers.IO) {
    val file = downloadOrNull(url)
    val drawable = if (file?.isAnimated() == true) decodeAnimated(file) else null
    Pair(file, drawable)
}
```

동작은 하지만 "파일은 없는데 Drawable은 있다" 같은 실제로는 일어날 수 없는 조합도 타입상으로는 만들 수 있습니다.
받는 쪽은 매번 두 값을 보고 지금이 어떤 경우인지 해석해야 합니다.

결과의 종류가 정해져 있으니 sealed interface로 묶었습니다.

```kotlin
sealed interface LoadedImage {
    class Animated(val drawable: Drawable) : LoadedImage
    class Static(val file: File) : LoadedImage
}

val image: LoadedImage? = withContext(Dispatchers.IO) {
    val file = downloadOrNull(url) ?: return@withContext null
    if (file.isAnimated()) LoadedImage.Animated(decodeAnimated(file))
    else LoadedImage.Static(file)
}

when (image) {
    is LoadedImage.Animated -> view.playAnimated(image.drawable)
    is LoadedImage.Static -> view.loadConverted(url, image.file.lastModified())
    null -> view.showFallback()
}
```

각 갈래는 자기에게 필요한 값만 들고 있습니다.
`when`에 `else`를 두지 않아도 컴파일러가 모든 경우를 다뤘는지 확인해 주고 나중에 다른 형식이 생겨 갈래가 늘면 처리하지 않은 곳에서 컴파일 오류가 납니다.
무거운 일은 IO에서 끝내고 메인 스레드는 붙이기만 한다는 구분도 코드 모양에 그대로 드러납니다.

변환 이미지 요청에서는 디스크 캐시를 끄던 옵션을 뺐습니다.
대신 원본 파일의 수정 시각을 캐시 키에 같이 넣었습니다.
원본이 바뀌지 않는 한 디스크에 있는 걸 다시 쓰고 원본이 바뀌면 새로 받습니다.

```kotlin
imageLoader.load(convertedUrl(url))
    .signature(originalFile.lastModified())
    .into(view)
```

디스크 캐시를 끈 이유가 원본이 바뀌었을 때 옛 이미지가 남는 걸 막으려던 거라면, 수정 시각을 키에 넣는 것으로 같은 목적을 지킬 수 있습니다.

<figure class="phone-capture">
  <video src="/uploads/1790819366092-shop-list-after.mp4" autoplay muted loop playsinline></video>
  <figcaption>고친 뒤, 같은 화면을 다시 내려본 화면</figcaption>
</figure>

고친 곳을 증상별로 묶으면 이렇습니다.

- 물음표: 취소는 다시 던지고, 결과를 붙이기 전에 뷰가 아직 같은 URL을 보여주는지 확인
- 페이지 추가 때 전체 번쩍임: 붙인 범위만 알리도록 변경
- 이전 아이템 그림이 비치던 것: 바인딩 시작 때 애니메이션 정지, 요청 정리, 이미지 비우기
- 코인 아이콘 누락: 구매 가능 상태의 기본 모양을 갈래에 들어가기 전에 먼저 설정
- 스크롤 끊김과 반복 다운로드: 디코딩을 IO로 옮기고 변환 이미지는 디스크에 남김

## 정리

- 코루틴 안에서 `catch (e: Exception)`은 취소 신호까지 잡는다. 취소는 다시 던지고, 실패 처리는 진짜 실패에만 한다
- 비동기로 불러온 결과를 붙이기 전에, 그 뷰가 아직 같은 데이터를 보여주는지 확인한다
- 목록에 몇 개 붙일 때는 `notifyDataSetChanged()` 대신 바뀐 범위만 알린다
- 재사용되는 뷰는 바인딩할 때 모든 상태를 덮어쓴다. 갈래마다 따로 챙기기보다 기본 상태를 먼저 깔아둔다
- 디코딩처럼 무거운 작업은 메인 스레드 밖에서 끝내고, 다시 볼 이미지는 캐시에 남긴다

웨비나에서 "빠르고 버벅이지 않는 스크롤"이라는 말은 당연하게 들렸습니다.
막상 우리 화면을 끝까지 내려보니 그 당연한 게 여러 군데서 조금씩 새고 있었습니다.
고친 버전으로 같은 화면을 실기기에서 다시 끝까지 내려봤습니다.
빠르게 내려도 물음표는 더 이상 뜨지 않았고, 썸네일이 번쩍이며 바뀌는 것도 없어졌습니다.
전후 영상은 위에 함께 붙여 두었습니다.
