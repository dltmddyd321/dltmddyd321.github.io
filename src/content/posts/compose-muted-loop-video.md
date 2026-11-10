---
title: "Compose 카드에서 mp4를 무음 반복 재생하기 — TextureView로 둥근 모서리 살리기"
description: "이미지만 받던 Compose 카드에 mp4 재생을 붙이면서 영상 판별, TextureView 선택, 비율 맞추기, 플레이어 수명 관리를 정리한 기록입니다."
pubDate: 2026-11-10T03:00:00Z
category: dev-log
tags: ["android", "jetpack-compose", "exoplayer", "media3", "textureview"]
aiPreview: "Coil로 이미지만 그리던 Compose 안내 카드에 mp4를 무음 반복 재생으로 붙였습니다. 이미지 로더에는 영상 디코더가 없어 플레이어를 따로 붙였고, 영상 여부는 쿼리를 뗀 URL 확장자와 서버 타입 값을 함께 보고 판단했습니다. PlayerView 기본 출력인 SurfaceView는 별도 Surface라 Compose의 둥근 clip이 먹지 않아 TextureView를 AndroidView로 감싸 출력 대상으로 지정했습니다. 비율은 16:9로 자리를 잡았다가 onVideoSizeChanged에서 실제 값으로 바꾸고, 플레이어는 remember(url)과 DisposableEffect로 수명을 묶어 해제하며 ON_STOP에서 일시정지합니다."
---

홈 화면 상단에는 서버에서 내려주는 짧은 안내 카드가 있습니다.
지금까지는 이미지(정적 이미지, GIF, 애니메이션 WebP)만 받을 수 있었는데, 이번에 mp4도 재생되게 해 달라는 요청이 들어왔습니다.
카드는 Compose로 그리고 있었고 이미지 로딩은 Coil이 맡고 있었습니다.
Compose 안에서 짧은 영상을 무음 반복 재생으로 붙이면서 고민했던 부분을 기록해봅니다.

## 이미지 로더로는 안 되는 이유

처음에는 혹시 지금 구조로도 될까 싶어 확인해 봤습니다.
Coil에 등록된 디코더는 GIF와 애니메이션 이미지용뿐이었습니다.
영상 프레임을 뽑는 디코더가 없으니 mp4 URL을 넘기면 디코딩에 실패하고 빈 썸네일이 남습니다.
설령 영상 디코더를 추가해도 그건 첫 프레임 한 장을 이미지로 보여주는 것이지 재생이 아닙니다.
결국 플레이어를 따로 붙여야 했습니다.

## 영상인지 어떻게 구분할까

서버 응답에는 콘텐츠 타입 필드가 하나 있었지만 앱에서 한 번도 쓴 적이 없어서 어떤 값이 오는지 알 수 없었습니다.
그래서 두 가지를 같이 보도록 했습니다.

```kotlin
fun isVideoSource(url: String?, type: String?): Boolean {
    if (type?.contains("video", ignoreCase = true) == true) return true
    val path = url?.substringBefore('?')?.substringBefore('#') ?: return false
    return path.endsWith(".mp4", ignoreCase = true)
}
```

URL은 쿼리스트링과 fragment를 떼어낸 경로로 확장자를 봅니다.
CDN 주소에 서명 파라미터가 붙는 경우가 많아서 `endsWith`를 URL 전체에 걸면 놓치기 때문입니다.
확장자가 없는 주소로 내려오는 경우를 대비해 타입 필드에 video가 들어 있으면 영상으로 보는 경로도 열어 뒀습니다.

## Compose에서 플레이어를 띄우는 방법

플레이어는 앱에 이미 들어와 있던 Media3 ExoPlayer를 그대로 썼습니다.
최신 Media3에는 Compose 전용 모듈이 있지만 프로젝트가 쓰는 버전에는 없어서 `AndroidView`로 View를 감싸는 방식을 택했습니다.

가장 먼저 떠오르는 건 Media3 UI의 `PlayerView`인데, 이 카드는 모서리가 둥글어야 해서 그대로 쓰기 어려웠습니다.
`PlayerView`는 기본적으로 영상을 `SurfaceView`에 그립니다.
`SurfaceView`는 앱 View 계층과 분리된 별도의 Surface에 그려지기 때문에 Compose의 `clip(RoundedCornerShape(...))`가 먹지 않습니다.
그래서 `TextureView`를 직접 만들어 플레이어 출력 대상으로 지정했습니다.
`TextureView`는 일반 View처럼 계층 안에서 합성되므로 바깥 Box의 clip이 그대로 적용됩니다.

```kotlin
@Composable
fun LoopingClip(url: String, corner: Dp, onClick: () -> Unit) {
    val context = LocalContext.current
    var ratio by remember(url) { mutableFloatStateOf(16f / 9f) }
    val player = remember(url) {
        ExoPlayer.Builder(context).build().apply {
            volume = 0f
            repeatMode = Player.REPEAT_MODE_ONE
            setMediaItem(MediaItem.fromUri(url))
            prepare()
            playWhenReady = true
        }
    }

    Box(
        Modifier
            .fillMaxWidth()
            .aspectRatio(ratio)
            .clip(RoundedCornerShape(corner))
    ) {
        AndroidView(
            factory = { TextureView(it).also(player::setVideoTextureView) },
            modifier = Modifier.fillMaxSize()
        )
        Box(Modifier.fillMaxSize().clickable(onClick = onClick))
    }
}
```

클릭은 영상 위에 투명한 Box를 하나 더 올려서 받았습니다.
Compose 쪽에서 터치를 확실히 받게 하려는 목적이고 이미지일 때와 같은 클릭 동작을 그대로 연결할 수 있습니다.

## 영상 비율 맞추기

이미지는 로딩이 끝나면 원본 크기를 알 수 있어서 높이를 맞추기 쉽습니다.
영상은 재생을 준비하기 전까지 크기를 모릅니다.
그래서 처음에는 16:9로 자리를 잡아 두고 플레이어가 실제 크기를 알려주면 그 비율로 바꿉니다.

```kotlin
override fun onVideoSizeChanged(size: VideoSize) {
    if (size.width <= 0 || size.height <= 0) return
    ratio = size.width * size.pixelWidthHeightRatio / size.height
}
```

`pixelWidthHeightRatio`를 곱하는 건 픽셀이 정사각형이 아닌 영상까지 고려한 것입니다.
일반적인 영상에서는 1이라 값이 달라지지 않습니다.

## 플레이어 수명 관리

플레이어는 디코더와 버퍼를 잡고 있어서 해제를 놓치면 메모리가 그대로 남습니다.
홈 화면은 새로고침될 때마다 카드 내용을 다시 그리기 때문에 더 신경 써야 했습니다.

```kotlin
DisposableEffect(player, lifecycleOwner) {
    val observer = LifecycleEventObserver { _, event ->
        when (event) {
            Lifecycle.Event.ON_START -> player.play()
            Lifecycle.Event.ON_STOP -> player.pause()
            else -> Unit
        }
    }
    player.addListener(sizeListener)
    lifecycleOwner.lifecycle.addObserver(observer)
    onDispose {
        lifecycleOwner.lifecycle.removeObserver(observer)
        player.removeListener(sizeListener)
        player.release()
    }
}
```

플레이어는 `remember(url)`로 만들어서 URL이 바뀌면 새 플레이어가 생기고 이전 것은 `onDispose`에서 해제됩니다.
카드가 화면에서 빠지거나 새로 그려질 때도 같은 경로로 정리됩니다.
앱이 백그라운드로 가면 `ON_STOP`에서 일시정지하고 돌아오면 다시 재생합니다.
소리가 없더라도 보이지 않는 화면에서 계속 디코딩하는 건 배터리 낭비라서 넣었습니다.

## 정리

- 이미지 로더에 영상을 넘기면 재생이 아니라 실패하거나 첫 프레임만 나옵니다. 영상은 플레이어를 따로 붙여야 합니다.
- 영상 여부는 쿼리를 뗀 URL 확장자와 서버 타입 값을 함께 보고 판단했습니다.
- Compose에서 둥근 모서리를 적용하려면 `SurfaceView` 대신 `TextureView`로 출력해야 clip이 먹습니다.
- 비율은 16:9로 자리를 잡아 두고 `onVideoSizeChanged`에서 실제 값으로 바꿉니다.
- 플레이어는 `remember`와 `DisposableEffect`로 수명을 묶고 Lifecycle에 맞춰 일시정지합니다.
