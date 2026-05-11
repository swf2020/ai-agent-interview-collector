---
domain: zhipin.com
aliases: [BOSS直聘, 直聘, zhipin]
updated: 2026-05-11
---

## 平台特征

- **薪资字体加密**：页面 DOM 中薪资数字使用 PUA（Private Use Area）自定义字体（`kanzhun-Regular` / `iboss`）混淆，直接读取 `textContent` 得到的是乱码字符（U+E031-U+E038 等）。自定义字体将 PUA 码点映射到形似数字的 glyph，使渲染结果对人眼可见但爬虫无法直接读取
- **API 返回明文数据**：搜索接口 `/wapi/zpgeek/search/joblist.json` 返回完整的 JSON 数据，其中 `salaryDesc` 字段为明文薪资字符串（如 `"30-60K·14薪"`），无需解码字体
- **搜索为宽泛匹配**：搜索关键词并非精确匹配，会返回语义相关的宽泛结果。例如搜索 "AI Agent" 会返回 AI 算法、DevOps、全栈等关联岗位
- **猎头匿名发布**：大量岗位由猎头发布（`proxyJob=1`），公司名称显示为「某XX公司」格式，真实公司信息被隐藏
- **无需登录**：搜索和岗位列表浏览无需登录态即可访问

## URL 结构与路由

### 搜索页
```
https://www.zhipin.com/web/geek/jobs?city={cityCode}&jobType={jobType}&salary={salary}&experience={experience}&query={keyword}
```

### 关键 URL 参数

| 参数 | 含义 | 示例值 |
|------|------|--------|
| `city` | 城市编码 | `101280600`（深圳） |
| `jobType` | 招聘类型 | `1901`（社招） |
| `salary` | 薪资范围 | `406`（35-50K），`405`（20-35K），`404`（10-20K） |
| `experience` | 经验要求 | `105`（3-5年），`104`（1-3年），`103`（应届生） |
| `query` | 搜索关键词 | URL 编码后的关键词 |
| `page` | 页码 | 从 1 开始 |

### 关键 API 端点

```
# 搜索职位列表（GET，返回 JSON）
https://www.zhipin.com/wapi/zpgeek/search/joblist.json?scene=1&query={keyword}&city={cityCode}&experience={exp}&jobType={type}&salary={salary}&page={page}&pageSize={size}

# 职位详情页
https://www.zhipin.com/job_detail/{encryptJobId}.html
```

- API 参数与搜索页 URL 参数一一对应，额外支持 `page` 和 `pageSize`（默认 15）
- API 响应字段：`zpData.jobList[]` 数组，包含 `jobName`、`salaryDesc`、`brandName`、`brandIndustry`、`brandStageName`、`brandScaleName`、`jobLabels`、`cityName`、`areaDistrict`、`businessDistrict`、`skills`、`welfareList` 等
- `zpData.resCount` 为总结果数，`zpData.hasMore` 指示是否有更多页

## 有效模式

### 1. 通过 CDP 浏览器调用搜索 API（2026-05-11）

核心策略：不直接抓 DOM 薪资（会被加密），而是通过 CDP 浏览器在 BOSS直聘页面上下文中调用内部 API，获取明文数据。

```bash
# Step 1: 打开搜索页作为上下文（携带浏览器 Cookie）
curl -s --noproxy '*' "http://localhost:3456/new?url=https://www.zhipin.com/web/geek/jobs?city=101280600&query=AI%20agent&page=1"

# Step 2: 在页面内通过 eval 调用搜索 API，获取明文 JSON
curl -s --noproxy '*' -X POST "http://localhost:3456/eval?target={TARGET_ID}" \
  -d 'document.body.innerText'
```

也可直接导航到 API 端点（CDP 浏览器自动携带 Cookie）：

```bash
curl -s --noproxy '*' "http://localhost:3456/new?url=https://www.zhipin.com/wapi/zpgeek/search/joblist.json?scene=1&query=AI%20agent&city=101280600&experience=105&jobType=1901&salary=406&page=1&pageSize=10"

curl -s --noproxy '*' -X POST "http://localhost:3456/eval?target={TARGET_ID}" \
  -d 'document.body.innerText'
```

### 2. 提取并整理职位信息（2026-05-11）

关键字段映射：
```javascript
// API 响应 → 提取
jobList.map(j => ({
  title: j.jobName,           // 职位名称
  salary: j.salaryDesc,        // 薪资（明文！）
  company: j.brandName,        // 公司名称
  industry: j.brandIndustry,   // 行业
  stage: j.brandStageName,     // 融资阶段
  scale: j.brandScaleName,     // 公司规模
  experience: j.jobExperience, // 经验要求
  degree: j.jobDegree,         // 学历要求
  city: j.cityName,            // 城市
  district: j.areaDistrict + " " + j.businessDistrict, // 区域
  skills: j.skills,            // 技能标签
  welfare: j.welfareList,      // 福利列表
  isHeadhunter: j.proxyJob === 1, // 是否猎头发布
  url: "https://www.zhipin.com/job_detail/" + j.encryptJobId + ".html"
}))
```

### 3. 获取多页结果（2026-05-11）

通过 `page` 参数翻页，注意控制频率避免触发风控：
```bash
# 在同一个 CDP 页面中逐页调用
for page in 1 2 3; do
  curl -s --noproxy '*' "http://localhost:3456/navigate?target={TARGET_ID}&url=https://www.zhipin.com/wapi/zpgeek/search/joblist.json?scene=1&query=AI%20agent&city=101280600&experience=105&jobType=1901&salary=406&page=${page}&pageSize=10"
  # 提取数据...
done
```

### 4. 并行分治获取多条件组合（2026-05-11）

多个搜索条件组合独立时，可让子 Agent 并行处理不同 URL，汇总结果。每个子 Agent 在自己的 CDP tab 中操作。

## 已知陷阱

- **DOM 薪资不可直接读取**（2026-05-11）：页面渲染层使用 PUA 自定义字体混淆薪资数字，`textContent` 返回的是 `U+E031-U+E038` 区间的乱码字符，无法直接解析为阿拉伯数字。解码需要下载字体文件并解析 cmap 表做 glyph→digit 映射，且每个字体文件的映射可能不同。**正确做法是调用 API 获取 `salaryDesc` 明文**。
- **代理环境变量干扰 CDP 通信**（2026-05-11）：`http_proxy` 环境变量会导致 `localhost:3456` 的 curl 请求经过代理返回 502。所有 CDP curl 命令需加 `--noproxy '*'`
- **API URL 参数在 `new` 中可能被截断**（2026-05-11）：当 API URL 包含多个查询参数时，`/new` 可能只保留第一个参数。可考虑先打开搜索页获取上下文，再通过 `navigate` 到完整 API URL，或使用 `eval` 发起 `fetch` 请求
- **搜索结果宽泛匹配**（2026-05-11）：搜索 "AI Agent" 返回的结果中包含几何算法、DevOps、运动控制等非直接相关的岗位。如需精确筛选，需要额外对结果做关键词过滤
- **猎头岗位公司信息模糊**（2026-05-11）：`proxyJob=1` 的岗位公司名显示为「某XXX公司」，无法获取真实公司名。`brandLogo` 为默认占位图而非真实 logo。这类岗位通常占据搜索结果的相当比例
