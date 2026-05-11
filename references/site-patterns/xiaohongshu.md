---
domain: xiaohongshu.com
aliases: [小红书, XHS, rednote]
updated: 2026-05-10
---

## 平台特征

- **反爬严格**：静态层（WebSearch / WebFetch / curl）无法获取笔记内容，必须通过浏览器 CDP
- **登录态**：搜索和笔记浏览通常不需要登录即可查看公开内容
- **内容形式**：大量笔记以图片轮播（Swiper）呈现文字内容，纯文本笔记较少
- **图片格式**：内容图片为 WebP，存储在 `sns-webpic-qc.xhscdn.com`
- **用户头像**：存储在 `sns-avatar-qc.xhscdn.com`

## URL 结构与路由

### 搜索页
```
https://www.xiaohongshu.com/search_result?keyword={关键词}&type=51
```

### 笔记链接（DOM 中的 href）
```
/search_result/{note_id}?xsec_token={token}&xsec_source=
```
- DOM 中 `xsec_source` 为空字符串
- 点击后浏览器地址栏会自动补全为 `xsec_source=pc_search`

### 笔记最终落地页（302 重定向后）
```
/explore/{note_id}?xsec_token={token}&xsec_source=pc_search
```
- `/search_result/{note_id}` 是跳板，会 302 重定向到 `/explore/{note_id}`
- `xsec_token` **必须携带**，否则返回 404（error_code=300031，"当前笔记暂时无法浏览"）
- `xsec_token` 是动态生成的，每个笔记不同

## 有效模式

### 1. 搜索并提取笔记链接（2026-05-10）

```bash
# 打开搜索页
curl -s --noproxy '*' "http://localhost:3456/new?url=https://www.xiaohongshu.com/search_result?keyword={URL_ENCODED_KEYWORD}&type=51"

# 滚动触发懒加载
curl -s --noproxy '*' "http://localhost:3456/scroll?target={TARGET_ID}&direction=bottom"

# 提取笔记链接（含 xsec_token）
curl -s --noproxy '*' -X POST "http://localhost:3456/eval?target={TARGET_ID}" \
  -d 'JSON.stringify(Array.from(document.querySelectorAll("a[href*=\"/search_result/\"]")).map(a => ({href: a.href, text: a.textContent.trim().substring(0,80)})))'
```

选择器 `a[href*="/search_result/"]` 定位笔记卡片链接。

### 2. 打开笔记（2026-05-10）

两种方式均可，最终都会落在 `/explore/{note_id}?xsec_token=...`：

```bash
# 方式一：直接用上一步提取的完整 href（含 xsec_token）
curl -s --noproxy '*' "http://localhost:3456/navigate?target={TARGET_ID}&url={FULL_HREF}"

# 方式二：构造 URL
curl -s --noproxy '*' "http://localhost:3456/new?url=https://www.xiaohongshu.com/explore/{note_id}?xsec_token={token}&xsec_source=pc_search"
```

### 3. 提取图片轮播笔记的全部图片（2026-05-10）

```bash
# 获取所有 swiper slide 中的图片 URL（无论是否已加载）
curl -s --noproxy '*' -X POST "http://localhost:3456/eval?target={TARGET_ID}" \
  -d '(function(){var slides=document.querySelectorAll(".swiper-slide img[src*=\"sns-webpic\"]");var urls=[];for(var i=0;i<slides.length;i++){urls.push(slides[i].src)}var unique=[];var seen={};for(var j=0;j<urls.length;j++){if(!seen[urls[j]]){seen[urls[j]]=true;unique.push(urls[j])}}return JSON.stringify(unique)})()'
```

关键点：
- Swiper 会创建 duplicate slide（首尾各一个），需去重
- 图片 URL 全部在 DOM 中（懒加载仅影响加载时机，不影响 src 属性）
- 不需要逐张点击轮播翻页，直接取所有 `<img>` 的 `src` 即可
- 图片格式为 WebP，需转换为 PNG 后再 OCR

### 4. OCR 提取图片中的中文文字（2026-05-10）

```bash
# 需先安装依赖
brew install tesseract tesseract-lang

# 下载图片并 OCR
python3 -c "
from PIL import Image
from urllib.request import urlopen
img = Image.open(urlopen('{IMAGE_URL}'))
img.save('slide.png')
"
tesseract slide.png output -l chi_sim
```

注意：
- 图片 URL 可能包含 `|` 等特殊字符，Python 下载比 curl 更可靠
- tesseract 需保存到非 `/tmp` 目录（可能有沙箱限制）
- `.webp` 文件存桌面项目目录，`sips` 可能转换失败，推荐 Python PIL

### 5. 笔记元数据提取（2026-05-10）

```bash
# 标题
curl -s --noproxy '*' -X POST "http://localhost:3456/eval?target={TARGET_ID}" -d 'document.title'
# 返回值如："AI Agent 精选面试题 - 小红书"

# 标签
curl -s --noproxy '*' -X POST "http://localhost:3456/eval?target={TARGET_ID}" \
  -d 'document.querySelector("meta[name=description]")?.getAttribute("content")'

# 作者/日期/正文摘要
curl -s --noproxy '*' -X POST "http://localhost:3456/eval?target={TARGET_ID}" \
  -d 'document.querySelector(".note-scroller")?.innerText?.substring(0, 500)'
```

## 已知陷阱

- **`xsec_token` 缺失导致 404**（2026-05-10）：直接访问 `/explore/{note_id}` 会重定向到 404 页（error_code=300031）。必须携带从搜索结果 DOM 中提取的 `xsec_token`
- **手动构造 URL 不可靠**（2026-05-10）：站内 DOM 中的 `href` 天然携带所需参数（xsec_token），手动拼接容易缺失参数导致被拦截
- **WebFetch/curl 无法获取内容**（2026-05-10）：小红书对静态请求有严格反爬，WebFetch 和 curl 获取的 HTML 不包含实际笔记内容
- **tesseract 不支持 WebP**（2026-05-10）：需先用 Python PIL 将 WebP 转为 PNG 再 OCR
- **tesseract 可能无法读取 /tmp**（2026-05-10）：macOS 沙箱可能限制 tesseract 访问 `/tmp`，建议将图片保存到用户目录
- **swiper 懒加载**（2026-05-10）：只有当前及相邻 slide 的图片会被加载（naturalWidth > 0），但所有图片的 `src` 属性都在 DOM 中，直接收集 URL 统一下载即可，不需要逐张翻页加载
- **图片 URL 含特殊字符**（2026-05-10）：小红书图片 URL 包含 `|` 和 `!` 等字符，curl 下载时需正确转义，Python urlopen 处理更可靠
- **代理环境变量干扰 CDP 通信**（2026-05-10）：`http_proxy` 环境变量会导致 curl 请求 localhost:3456 经过代理返回 502。所有 CDP curl 命令需加 `--noproxy '*'`
