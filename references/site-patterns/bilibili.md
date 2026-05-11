---
domain: bilibili.com
aliases: [B站, bilibili, BiliBili]
updated: 2026-05-11
---

## 平台特征

- **公开 API 可用**：视频元数据和播放器数据可通过公开 REST API 获取，无需登录
- **搜索 API 需浏览器上下文**：搜索接口直接 curl 会触发 412 风控，必须在 CDP 浏览器页面内通过 fetch 调用
- **AI 字幕**：部分视频有 AI 自动生成字幕（`ai-zh`），存储在 `aisubtitle.hdslb.com` CDN 上，JSON 格式
- **字幕鉴权**：字幕 JSON 文件的下载 URL 包含 `auth_key` 鉴权参数，auth_key 已包含完整鉴权，curl 可直接下载
- **登录态**：字幕 URL 的获取可能受登录态影响，不同 session 返回结果可能不同

## URL 结构与路由

### 视频页
```
https://www.bilibili.com/video/{bvid}/
```

### 搜索页
```
https://search.bilibili.com/video?keyword={keyword}&order={order}
```
order 取值：`likes`（最多点赞）、`click`（最多播放）、`pubdate`（最新发布）、`dm`（最多弹幕）、`stow`（最多收藏）

### 关键 API 端点
```
# 视频元数据（含 cid、title、duration、stat 等）
https://api.bilibili.com/x/web-interface/view?bvid={bvid}

# 播放器数据（含字幕信息）
https://api.bilibili.com/x/player/v2?bvid={bvid}&cid={cid}

# 搜索视频（需在 CDP 浏览器上下文内调用）
https://api.bilibili.com/x/web-interface/search/type?search_type=video&keyword={keyword}&order={order}&page={page}
```

### 字幕 CDN URL 格式
```
https://aisubtitle.hdslb.com/bfs/ai_subtitle/prod/{hash}?auth_key={timestamp}-{token}-0-{signature}
```

## 有效模式

### 1. 获取视频元数据（2026-05-11）

```bash
# 直接 curl 可用
curl -s "https://api.bilibili.com/x/web-interface/view?bvid={bvid}" | python3 -m json.tool
```

从响应中提取关键字段：`data.cid`（分P ID）、`data.aid`、`data.title`、`data.duration`、`data.stat`（含真实 like、view 等数据）。

### 2. 获取字幕 URL（2026-05-11）

```bash
# 在浏览器页面内发起请求（带 Cookie），注意：不要带 Referer 头！
curl -s --noproxy '*' "http://localhost:3456/eval?target={TARGET_ID}" \
  -d '(async () => {
    const resp = await fetch("https://api.bilibili.com/x/player/v2?bvid={bvid}&cid={cid}", {credentials: "include"});
    const data = await resp.json();
    return JSON.stringify(data.data.subtitle);
  })()'
```

关键点：
- 必须使用 `credentials: "include"` 携带浏览器 Cookie
- **绝对不能加 Referer 请求头**，加了会导致 `subtitle_url` 返回空字符串
- 响应中的 `data.subtitle.subtitles[]` 数组包含字幕列表，每个字幕有 `lan`、`lan_doc`、`subtitle_url`、`ai_status` 等字段
- `ai_status: 2` 表示 AI 字幕已生成完毕

### 3. 下载字幕 JSON 文件（2026-05-11）

```bash
# auth_key 已包含完整鉴权，直接用 curl 下载，无需 CDP 浏览器
curl -s -o subtitle.json "https://aisubtitle.hdslb.com/bfs/ai_subtitle/prod/{hash}?auth_key={auth_key}"

# 如 curl 失败，可回退到 CDP 浏览器方式
curl -s --noproxy '*' "http://localhost:3456/eval?target={TARGET_ID}" \
  -d '(async () => {
    const resp = await fetch("https://aisubtitle.hdslb.com/bfs/ai_subtitle/prod/{hash}?auth_key={auth_key}");
    const data = await resp.json();
    return JSON.stringify(data);
  })()' > subtitle.json
```

字幕 JSON 结构：
```json
{
  "font_size": 0.4,
  "type": "AIsubtitle",
  "lang": "zh",
  "version": "v1.7.0.4",
  "body": [
    {
      "from": 0.04,
      "to": 1.22,
      "sid": 1,
      "location": 2,
      "content": "字幕文本",
      "music": 0
    }
  ]
}
```

### 4. 搜索视频并按点赞排序（2026-05-11）

```bash
# 先打开 B站任意页面（如首页）作为上下文
curl -s --noproxy '*' "http://localhost:3456/new?url=https://www.bilibili.com/"

# 在页面内通过 fetch 调用搜索 API（直接 curl 会触发 412 风控）
curl -s --noproxy '*' -X POST "http://localhost:3456/eval?target={TARGET_ID}" \
  -d '(async () => {
    const resp = await fetch("https://api.bilibili.com/x/web-interface/search/type?search_type=video&keyword={URL_ENCODED_KEYWORD}&order=likes&page=1", {credentials: "include"});
    const data = await resp.json();
    return JSON.stringify({
      numResults: data.data.numResults,
      pages: data.data.numPages,
      videos: data.data.result
        .filter(v => v.bvid)  // 过滤掉课程和广告（无 bvid）
        .map(v => ({
          bvid: v.bvid,
          title: v.title,
          author: v.author,
          play: v.play
        }))
    });
  })()'
```

关键点：
- 搜索 API 必须在 CDP 页面内发起（携带浏览器 Cookie/UA），直接 curl 触发 412 风控
- 需过滤 `bvid` 为空的结果（付费课程、广告等非视频条目）
- 返回的 `video_review` 是弹幕数，不是点赞数；真实点赞数需调用 `view` API 获取 `stat.like`

### 5. 获取真实点赞数并精确排序（2026-05-11）

搜索 API 的 `video_review` 字段实际是弹幕数，如需按真实点赞数排序，需额外调用 `view` API：

```bash
curl -s --noproxy '*' -X POST "http://localhost:3456/eval?target={TARGET_ID}" \
  -d '(async () => {
    const bvids = ["BVxxx1","BVxxx2",...]; // 从搜索结果提取的 bvid 列表
    const results = [];
    for (const bvid of bvids) {
      const resp = await fetch("https://api.bilibili.com/x/web-interface/view?bvid=" + bvid, {credentials: "include"});
      const data = await resp.json();
      if (data.code === 0) {
        results.push({
          bvid,
          title: data.data.title,
          like: data.data.stat.like,
          view: data.data.stat.view,
          cid: data.data.cid
        });
      }
    }
    results.sort((a, b) => b.like - a.like);
    return JSON.stringify(results);
  })()'
```

### 6. 批量获取多个视频的字幕（2026-05-11）

```bash
# 在单次 eval 中循环获取多个视频的字幕 URL
curl -s --noproxy '*' -X POST "http://localhost:3456/eval?target={TARGET_ID}" \
  -d '(async () => {
    const videos = [
      {bvid:"BVxxx1",cid:"xxx"},
      {bvid:"BVxxx2",cid:"xxx"},
      ...
    ];
    const results = [];
    for (const v of videos) {
      const resp = await fetch("https://api.bilibili.com/x/player/v2?bvid=" + v.bvid + "&cid=" + v.cid, {credentials: "include"});
      const data = await resp.json();
      if (data.code === 0 && data.data.subtitle) {
        results.push({bvid: v.bvid, subtitles: data.data.subtitle.subtitles});
      }
    }
    return JSON.stringify(results);
  })()'
```

拿到字幕 URL 后，可并行 curl 下载所有字幕 CDN 文件。

## 已知陷阱

- **Referer 头导致字幕 URL 为空**（2026-05-11）：在请求 `player/v2` API 时，如果携带 `Referer` 请求头，B站后端会返回 `subtitle_url: ""`（空字符串）。去掉 Referer 头后才能拿到完整的字幕 CDN URL。这是最关键的反直觉行为。
- **搜索 API 直接 curl 触发 412 风控**（2026-05-11）：搜索接口 `/x/web-interface/search/type` 对直接 curl 请求有风控校验，返回 412 错误。必须在 CDP 浏览器页面内通过 `fetch` 调用（携带浏览器 Cookie 和 UA 等上下文）。
- **搜索 API 的 video_review ≠ 真实点赞数**（2026-05-11）：搜索 API 返回的 `video_review` 字段实际是弹幕数（danmaku），不是点赞数。真正的点赞数在单视频 `view` API 的 `stat.like` 字段中。如需精确按点赞排序，需先搜索拿到结果列表，再逐个查询 `view` API。
- **搜索结果混入非视频条目**（2026-05-11）：搜索结果可能包含付费课程（`cheese/play` 链接）、广告（`cm.bilibili.com`）等，这些条目 `bvid` 为空字符串，需要在解析时过滤。
- **初始状态中字幕 URL 可能为空**（2026-05-11）：视频页面的 `window.__INITIAL_STATE__.videoData.subtitle.list[].subtitle_url` 在页面加载时可能为空，需要通过 API 动态获取实际 URL
- **字幕 CDN 需要 auth_key**（2026-05-11）：字幕 JSON 文件存储在 `aisubtitle.hdslb.com`，URL 包含时效性 `auth_key` 参数，需要从 API 响应中获取完整 URL 才能下载。但 auth_key 已包含完整鉴权，curl 可直接下载，不需要额外 Cookie。
- **不同登录态返回不同字幕数据**（2026-05-11）：未登录或不同 session 调用 `player/v2` API 可能返回不同的字幕列表（甚至完全不同视频的字幕），需要确保请求来自正确的浏览器上下文
- **代理环境变量干扰 CDP 通信**（2026-05-11）：`http_proxy` 环境变量会导致 curl 请求 `localhost:3456` 经过代理返回 502。所有 CDP curl 命令需加 `--noproxy '*'`
