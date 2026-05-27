---
name: interview-collector
description: >
  从中文互联网平台（小红书/B站/牛客/脉脉等）采集真实社招面试真题，只保留有明确来源的实际被问题目，过滤泛泛而谈内容。
  支持 AI Agent、后端、前端、产品、测试、UI设计、算法 7 大角色，自动识别角色并加载专属知识模块配置，
  输出带来源标注+公司分类+轮次标签的 Markdown 题集，并为每道题生成解答思路与参考答案。
  触发词：面试题采集、收集XX面试题、更新面试题集、刷新面试题、跑一次面试题采集、整理面试题、XX面经、XX面试真题。
  未指定角色时默认采集 AI Agent 面试题。
---

# 多角色社招面试题采集 Skill

## 概述

本 skill 从中文互联网平台系统采集多角色社招面试真题，进行清洗去重、模块分类，最终生成可直接用于复习备考的 Markdown 题集。核心价值在于"真实性"——只保留有明确来源的实际被问题目，过滤掉泛泛而谈的内容。

### 支持角色

| 角色 | role_id | 配置文件 |
|------|---------|---------|
| AI Agent / 大模型工程师（默认） | `ai-agent` | `references/roles/ai-agent.md` |
| 后端开发 | `backend` | `references/roles/backend.md` |
| 前端开发 | `frontend` | `references/roles/frontend.md` |
| 产品经理 | `product-manager` | `references/roles/product-manager.md` |
| 测试 / QA | `qa-testing` | `references/roles/qa-testing.md` |
| UI设计 | `ui-design` | `references/roles/ui-design.md` |
| 算法工程师 | `algorithm` | `references/roles/algorithm.md` |

### 平台优先级（按流量置信度排序）

高流量平台题目置信度更高，采集优先级：**小红书 > B站 > 牛客 > CSDN > 其他网站**（脉脉、知乎、BOSS直聘、猎聘、培训机构等）。

### Agent 架构

全部 8 个步骤通过独立 Agent 执行，主会话负责编排调度：

| Step | Agent 数 | 执行模式 | 说明 |
|------|---------|---------|------|
| Step 0 | 0 | 串行 | **角色识别与配置加载**（主会话直接执行） |
| Step 1 | 5 | **并行** | 按平台分组，5 个 Agent 同时采集 |
| Step 2 | 1 | 串行 | 汇总 Step 1 结果后清洗去重 |
| Step 3 | 1 | 串行 | 对清洗结果进行分类映射 |
| Step 4 | 1 | 串行 | 增量更新逻辑（合并历史数据） |
| Step 5 | 1 | 串行 | 生成主题目 Markdown 文件 |
| Step 6 | N（每组 5-10 题，约 25-40 个） | **逐组顺序** | 批量生成，减少 Agent 启动开销 |
| Step 7 | 2 | 串行 | 公司文件生成 + 索引校验 |

---

## Step 0：角色识别与配置加载

**执行：** 主会话在拉起任何采集 Agent 之前，先根据用户输入识别目标角色，加载对应配置文件。

### 0.1 角色匹配规则

根据用户输入消息中的关键词，匹配目标角色。匹配优先级：**具体角色 > 默认角色**。

| 角色 | role_id | 匹配关键词（任一命中即匹配） | 配置文件 |
|------|---------|--------------------------|---------|
| AI Agent（默认） | `ai-agent` | AI Agent, 大模型, LLM, Agent工程师, RAG, Agent面试 | `references/roles/ai-agent.md` |
| 后端开发 | `backend` | 后端, 后端开发, Java, Go, 服务端, 后台开发 | `references/roles/backend.md` |
| 前端开发 | `frontend` | 前端, 前端开发, React, Vue, JavaScript, TypeScript, Web | `references/roles/frontend.md` |
| 产品经理 | `product-manager` | 产品经理, PM, 产品面试 | `references/roles/product-manager.md` |
| 测试 | `qa-testing` | 测试, QA, 质量保证, 测试工程师, 自动化测试 | `references/roles/qa-testing.md` |
| UI设计 | `ui-design` | UI, UX, 交互设计, 视觉设计, 用户体验 | `references/roles/ui-design.md` |
| 算法 | `algorithm` | 算法, 算法工程师, ML, 机器学习, 深度学习, 推荐算法 | `references/roles/algorithm.md` |

**兜底策略：** 若用户输入中未命中任何特定角色的关键词，或仅包含通用词（如"面试题"、"采集"、"更新"），默认加载 `references/roles/ai-agent.md`。保证所有现有触发短语（"更新面试题集"、"跑一次面试题采集"等）在未提及其他角色时继续走 AI Agent 流程。

### 0.2 加载角色配置

1. 使用 Read 工具读取匹配到的角色配置文件（`references/roles/{role_id}.md`）
2. 从配置文件中提取以下参数，供后续 Step 1-7 使用：
   - **`role_id`** — 角色唯一标识（用于输出子目录命名，如 `samples/ai-agent/`）
   - **`display_name`** — 角色中文名（用于标题、报告文本）
   - **`domain`** — 角色完整领域名（用于 Agent 描述文本）
   - **搜索关键词（Section 2）** — 各平台（小红书/B站/牛客/CSDN/其他WebFetch组/其他CDP组）的关键词列表
   - **知识模块（Section 3）** — 模块表格（编号、模块名称、文件名、章节emoji、涵盖主题），用于 Step 3 分类和 Step 6 答案生成
   - **输出配置（Section 4）** — 题集文件前缀、主标题模板、来源行、统计行、综合类文件名
   - **公司分类（Section 5）** — 若配置文件有自定义公司分类则使用，否则使用 `references/defaults/company-classification.md` 中的默认 6 大类分类
   - **面试轮次定义（Section 6）** — 若配置文件有此章节则读取，否则使用 `references/defaults/round-definitions.md` 中的默认轮次定义；主会话在注入 Step 3 和 Step 7 Agent prompt 时替换 `{{ROUND_DEFINITIONS}}` 占位符
   - **输出根目录** — 所有输出文件统一放在 `samples/{role_id}/` 目录下，不同角色输出隔离

3. **加载基线配置：** 主会话在 Step 0 时额外加载以下默认配置文件，供后续 Step 使用：
   - `references/defaults/company-classification.md` — 默认公司 6 大类分类
   - `references/defaults/round-definitions.md` — 默认面试轮次定义（7 种轮次）
   - 若角色配置的 Section 5 / Section 6 有自定义值，覆盖对应默认值

4. 若配置文件不存在或读取失败：报错并终止，提示用户检查角色配置

### 0.3 冲突处理

若用户输入匹配多个角色关键词（如"收集前端和后端面试题"），按匹配表中首次命中的角色为准，并在确认消息中告知用户当前识别的角色。若用户需要另一个角色，可明确指定。

### 0.4 快速路径检查（增量执行优化）

角色识别与配置加载完成后，检查 `samples/{role_id}/` 目录状态，判断是否可跳过部分步骤：

**检查逻辑：**

1. 若 `{题集文件前缀}_*.md` 存在，且最新文件的日期为近 24 小时内：
   - 用户输入不含"重新采集/重新搜索/全量更新" → **跳过 Step 1-4**，直接进入 Step 5
   - 用户输入含"解答/答案"但不含"采集/搜索" → **跳过 Step 1-5**，直接进入 Step 6
   - 用户输入含"索引/公司文件" → **跳过 Step 1-6**，直接进入 Step 7

2. 若 `answers/_index.json` 存在，且用户只要求补充解答：
   - 对比题集中的题目与 `_index.json` 中的已有题目
   - **跳过 Step 1-5**，直接进入 Step 6，只生成缺失的解答

3. 其他情况 → 走完整 Step 0-7 流程

**向用户确认：** 命中快速路径时，向用户报告"检测到近期采集结果（{日期}），将跳过 Step X-Y，直接进入 Step Z"，让用户有机会选择全量重新运行。

---

## Step 1：并行平台搜索采集

**核心依赖：`web_access` skill。** 小红书、B站、脉脉等平台反爬严格，普通 HTTP 请求无法获取有效内容，**必须**通过 `web_access` skill 的 CDP 浏览器模式才能成功采集。`web_access` 是本 skill 正常工作的重要前提。

若确实无法使用 `web_access`，可降级使用 WebSearch/WebFetch 工具，但小红书、B站、脉脉等内容将**大幅受限或完全无法获取**，最终仅能覆盖牛客、CSDN、知乎等对搜索引擎友好的平台。

### 1.1 平台优先级（按流量置信度排序）

高流量平台题目置信度更高，**严格按此顺序**分配搜索资源：

| 优先级 | 平台 | 流量置信度 | Agent |
|--------|------|-----------|-------|
| 1（最高） | 小红书 | 极高 | Agent 1 |
| 2 | B站 | 高 | Agent 2 |
| 3 | 牛客 | 中 | Agent 3 |
| 4 | CSDN | 较低 | Agent 4 |
| 5（最低） | 其他（脉脉/BOSS直聘/猎聘/知乎/培训机构等） | 低 | Agent 5 |

### 1.2 Agent 执行规则

**5 个 Agent 同时拉起（并行执行）**，等待全部完成后汇总结果进入 Step 2。单个 Agent 失败不影响其他 Agent——记录失败原因后继续。

每个 Agent 执行前必须加载：
1. **角色配置文件** — 从 Step 0 已加载的配置中获取当前角色的 `display_name`、`domain` 和各平台搜索关键词
2. **对应平台的经验文件**（`references/site-patterns/` 目录下），了解 URL 结构、CDP 脚本模式和已知陷阱。若本地文件不存在，回退到 `${CLAUDE_SKILL_DIR}/web-access/references/site-patterns/{domain}.md`

**所有搜索时间范围限定近 12 个月或者用户给定的时间范围，比如1-5月份。**

**通用兜底：** 若角色配置中无对应平台的关键词配置，使用通用关键词：`{display_name} 面试题 {时间范围}`。

---

### 1.3 平台采集 Agent（通用模板 + 平台参数表）

5 个 Agent 并行拉起，主会话为每个 Agent 加载 `references/prompts/step1-platform-agent.md` 通用模板，替换 `{{PLACEHOLDER}}` 后注入对应平台的参数。

**平台参数表：**

| Agent | 平台 | 工具 | 优先级 | 经验文件 | 结果数 | 特殊说明 |
|-------|------|------|--------|---------|--------|---------|
| 1 | 小红书 | web_access CDP | 最高 | `references/site-patterns/xiaohongshu.md` | 3-5 | 搜索 URL: `https://www.xiaohongshu.com/search_result?keyword={关键词}&type=51`；图片笔记需 OCR 提取文字 |
| 2 | B站 | web_access CDP | 高 | `references/site-patterns/bilibili.md` | 5 | CDP 页面内 fetch 调用搜索 API `/x/web-interface/search/type?search_type=video&keyword={关键词}&order=likes`；过滤 bvid 为空的；字幕通过 aisubtitle.hdslb.com 获取（不带 Referer 头） |
| 3 | 牛客 | WebSearch + WebFetch | 中 | - | 5 | 静态 HTML，WebFetch 即可获取完整正文，无需 CDP |
| 4 | CSDN | WebSearch + WebFetch | 较低 | - | 5 | 静态 HTML，WebFetch 获取正文 |
| 5 | 多平台（脉脉/BOSS直聘/猎聘/知乎/掘金/博客园/培训机构等） | WebFetch 组 + CDP 组 | 最低 | `references/site-patterns/zhipin.com.md`（仅 CDP 组） | 3-5 | WebFetch 组（知乎/掘金/博客园/51CTO/猎聘/培训机构）优先执行；CDP 组（脉脉/BOSS直聘）后执行，BOSS直聘必须先 Read 经验文件 |

**关键词来源：** 各 Agent 从角色配置 Section 2 的对应平台章节获取搜索关键词，兜底使用 `{display_name} 面试题 2025 2026`。

**通用模板：** 见 `references/prompts/step1-platform-agent.md`。主会话替换占位符：
- `{{PLATFORM_NAME}}` → 平台名
- `{{TOOL}}` → 采集工具
- `{{DISPLAY_NAME}}` → 角色中文名
- `{{SITE_PATTERN_INSTRUCTION}}` → 经验文件加载指令（有经验文件的平台替换为具体 Read 指令，无则替换为"无需加载"）
- `{{PLATFORM_CHARACTERISTICS}}` → 平台特征描述
- `{{KEYWORD_SECTION}}` → 角色配置中关键词章节名
- `{{RESULT_COUNT}}` → 每条搜索结果数
- `{{FALLBACK_KEYWORDS}}` → 兜底关键词
- `{{OPERATION_FLOW}}` → 操作流程
- `{{EXTRACTION_METHOD}}` → 内容提取方法

---

### 1.4 收集与汇总

**5 个 Agent 全部完成后，主会话汇总所有输出：**

1. 合并 5 个 Agent 返回的题目列表，按平台分组记录
2. 统计每个平台的采集成功/失败/跳过数量
3. 将汇总后的原始题目列表传递给 Step 2

**错误处理：**
- 单个 Agent 全部失败：记录为"该平台采集失败"，不阻断后续步骤
- 单个 Agent 部分搜索失败：正常合并成功部分
- web_access/CDP 完全不可用：小红书/B站/脉脉/BOSS直聘 Agent 将返回空结果；牛客/CSDN/知乎/掘金/博客园等使用 WebFetch 的 Agent 不受影响

---

## Step 2：清洗与去重 Agent

**依赖：** Step 1 所有 5 个平台 Agent 全部完成。

**执行：** 主会话汇总 Step 1 的原始采集结果，从 `references/prompts/step2-cleaning.md` 加载 Agent prompt 模板，替换 `{{DISPLAY_NAME}}` 和 `{{STEP1_ALL_RESULTS}}` 后拉起 1 个 Agent 执行清洗去重。

### 错误处理

- 若 Step 1 全部平台均无结果：Agent 报告"所有平台均无有效结果，建议扩大搜索范围或检查 web_access 可用性"
- 若清洗后题目 < 10：记录警告但继续后续步骤

---

## Step 3：分类 Agent

**依赖：** Step 2 清洗去重完成。

**执行：** 主会话将 Step 2 清洗后的题目列表注入分类 Agent 上下文。从 `references/prompts/step3-classification.md` 加载 Agent prompt 模板，替换以下占位符后拉起 1 个 Agent 执行三维护分类（知识模块 + 公司类别 + 面试轮次）：

- `{{DISPLAY_NAME}}` → 角色中文名
- `{{STEP2_CLEANED_RESULTS}}` → Step 2 输出
- `{{MODULE_TABLE}}` → 从角色配置 Section 3 加载的模块表格
- `{{COMPANY_CLASSIFICATION}}` → 从 `references/defaults/company-classification.md` 加载（或角色配置 Section 5 覆盖）
- `{{ROUND_DEFINITIONS}}` → 从 `references/defaults/round-definitions.md` 加载（或角色配置 Section 6 覆盖）

---

## Step 4：增量更新 Agent

**依赖：** Step 3 分类完成。

**执行：** 主会话将 Step 3 分类后的题目列表注入增量更新 Agent。从 `references/prompts/step4-incremental.md` 加载 Agent prompt 模板，替换 `{{DISPLAY_NAME}}`、`{{ROLE_ID}}`、`{{STEP3_CLASSIFIED_RESULTS}}`、`{{OUTPUT_DIR}}`、`{{FILE_PREFIX}}` 后拉起 1 个 Agent 处理历史数据合并和解答状态检查。

---

## Step 5：输出文件生成 Agent

**依赖：** Step 4 增量更新完成。

**执行：** 主会话将 Step 4 的合并后完整题目列表注入输出文件生成 Agent。从 `references/prompts/step5-output.md` 加载 Agent prompt 模板，替换 `{{DISPLAY_NAME}}`、`{{ROLE_ID}}`、`{{OUTPUT_DIR}}`、`{{STEP4_FINAL_QUESTION_LIST}}`、`{{FILE_PREFIX}}`、`{{MAIN_TITLE}}`、`{{SOURCE_LINE}}`、`{{STATS_LINE}}`、`{{MODULE_EMOJI_MAP}}`、`{{OTHER_MODULE_FILE}}` 后拉起 1 个 Agent 生成主题目 Markdown 文件。

### 错误处理

- 若 `samples/{role_id}/` 目录不存在，先创建再写入
- 写入后验证文件存在且非空，再进入 Step 6

---

## Step 6：批量生成解答（每组 5-10 题，顺序追加）

**依赖：** Step 5 主题目文件生成完成。

**核心设计：** 原方案每题独立 Agent（200 次调用）导致大量 token 浪费在 Agent 启动开销上（每次 ~8000-12000 tokens system overhead）。改为每组 10-20 题合并为一个 Agent（不到10题默认一个Agent），Agent 调用次数从 200 降至 10-20。10-20 题的上下文远未达到迷失阈值，答案质量不受影响。

### 6.1 总体流程

主会话按以下嵌套循环执行：

```
从 Step 4 输出中获取"待生成解答题目清单"（按模块分组）

加载角色配置 Section 3 模块表格，获取模块列表（编号、模块名称、文件名）。

FOR 每个模块 M in [1, 2, ..., N, 0(其他/综合类)]（N 由角色配置的模块数量决定）:
  ├── 检查模块 M 是否有"待生成解答"的题目
  ├── IF 该模块无新题目 → SKIP，记录"模块 M 无新题目，跳过"
  ├── IF 该模块有新题目：
  │   ├── 确定起始 Q 编号（见 6.5）
  │   ├── 确定目标文件路径：{output_dir}/samples/{role_id}/answers/{文件名}.md（文件名从角色配置 Section 3 表格的 `文件名` 列读取）
  │   │
  │   └── 将模块 M 的新题目按 5-10 题一组拆分（≤5 题不拆，6-10 题一组，11-15 题拆两组，类推）:
  │       ├── LAUNCH NEW Agent（注入：从 references/prompts/step6-answer-batch.md 加载的 prompt + 本组题目列表 + 起始 Q编号 + 追加模式 + 目标文件路径）
  │       ├── WAIT for agent to complete
  │       ├── Verify: agent 已将本组所有 Q{N} 追加写入目标文件
  │       ├── IF 写入成功 → N = N + 本组题目数
  │       ├── IF 某题写入失败 → 记录"Q{N} 生成失败: {原因}"，N = N + 1，继续下一组
  │       ├── IF 整组失败 → 逐题重试该组题目（回退到单题 Agent 模式），继续
  │       └── CONTINUE to next batch
  │
  └── 模块 M 所有新题目处理完成 → 下一个模块

所有模块处理完成 → 生成 _index.json（见 6.8）→ 进入 Step 7
```

### 6.2 Per-Batch Agent Prompt

主会话从 `references/prompts/step6-answer-batch.md` 加载 prompt 模板，替换以下占位符后注入 Agent：

- `{{DISPLAY_NAME}}` → 角色中文名
- `{{ROLE_ID}}` → 角色标识
- `{{OUTPUT_DIR}}` → 输出根目录
- `{{MODULE_NAME}}` → 当前模块名称
- `{{MODULE_NUMBER}}` → 当前模块编号
- `{{MODULE_FILENAME}}` → 当前模块文件名（角色配置 Section 3）
- `{{START_N}}` → 起始 Q 编号
- `{{END_N}}` → 结束 Q 编号
- `{{BATCH_SIZE}}` → 本组题目数
- `{{BATCH_QUESTIONS}}` → 本组题目列表（含来源标签）

### 6.3 模块文件命名

模块文件命名从角色配置 Section 3 表格的 `文件名` 列读取。综合类文件使用角色配置 Section 4 中的 `综合类文件名`（默认 `module_00_other`）。

**所有解答文件统一保存到：** `{题集文件同目录}/samples/{role_id}/answers/` 目录下。

### 6.4 解答文件结构

每个模块解答文件追加后的结构：

```markdown
# {模块名称} - 面试题解答

> 生成日期：YYYY-MM-DD | 共 N 题

---

## Q1：[题目内容]

### 考察点
[一句话]

### 解答思路
1. [第一步]
2. [第二步]
3. [第三步]

### 参考答案
[详细回答，300-500 字]

**加分项：** [额外知识点]

---

## Q2：[题目内容]
...
```

### 6.5 增量模式 Q 编号

**增量模式下，主会话在进入模块 M 的循环前执行：**

1. 检查目标文件 `samples/{role_id}/answers/{文件名}.md` 是否存在
2. 若存在：读取文件，找到最后一个 `## Q` 标题的编号（如 Q12），起始 Q = 12 + 1 = 13
3. 若不存在：起始 Q = 1（初次采集模式）
4. 验证"待生成解答"列表中不包含已有答案文件中的题目（与 Step 4 的差集做双重校验）

### 6.6 非角色相关题处理

归类为"其他 / 综合类"且标记为 `[标记: 非角色相关题]` 的题目：
- 不拉起 Agent 生成解答
- 在题集文件中仅保留题目文本，不标注 Module N，不生成解答链接
- 主会话在 Step 6 循环中自动跳过这类题目

### 6.7 错误处理

| 场景 | 处理方式 |
|------|---------|
| 单题解答失败（组内部分题） | 记录 `Q{N}: 生成失败（{原因}）`，组内其他题正常追加，不中断整组 |
| 整组 Agent 失败（所有题未生成） | 将该组题目拆为单题 Agent 逐题重试（回退模式） |
| 整个模块所有 Q 失败 | 记录"模块 M 全部生成失败"，继续下一个模块 |
| Agent 写入验证失败 | 标记 Q{N} 为"待重试"，继续后续题目；模块结束后统一汇报失败列表 |
| 目标目录不存在 | Agent 创建 `samples/{role_id}/answers/` 目录后再写入 |
| 文件写入冲突 | 同模块内组与组之间顺序执行，不会有并发写入冲突 |

### 6.8 答案索引文件维护

**每次 Step 6 完成后，主会话生成/更新 `samples/{role_id}/answers/_index.json`**，供后续增量运行时 Step 4 快速判断已有答案（无需读取全部答案文件）。

**索引文件格式：**

```json
{
  "updated": "YYYY-MM-DD",
  "total_questions": 200,
  "modules": {
    "{模块文件名}": {
      "name": "{模块名称}",
      "questions": [
        {"q": 1, "text": "题目内容"},
        {"q": 2, "text": "..."}
      ]
    },
    ...
    "module_00_other": { "name": "其他 / 综合类", "questions": [...] }
  }
}
```

> 模块列表从角色配置 Section 3 表格动态生成，文件名和名称一一对应。综合类固定使用角色配置中的 `综合类文件名`。

**生成规则：**
- `text` 字段为题目内容（不含来源标签、模块标签等元数据），用于 Step 4 文本匹配
- 只收录已成功生成解答的题目（`## QN` 已写入对应模块文件）
- 非角色相关题（不生成解答）不收录到索引中
- 增量模式：读取现有 `_index.json`，追加新题目条目，更新 `updated` 和 `total_questions`
- 文件保存到 `{题集文件同目录}/samples/{role_id}/answers/_index.json`

**Step 4 读取优先级：**
1. 先读 `samples/{role_id}/answers/_index.json`（~10K，5K tokens）→ 匹配已有答案
2. `_index.json` 不存在 → 回退到读取 `module_*.md` 文件（~932K，50 万 tokens）

---

## Step 7：公司分类文件生成

**依赖：** Step 6 所有模块的逐题解答全部生成完毕。

**执行：** 主会话先拉起 Agent 1 生成公司文件 + 索引，再拉起 Agent 2 执行校验。两个 Agent 串行执行。

### 7.1 Agent 1：公司文件与索引生成

主会话从 `references/prompts/step7-company-files.md` 加载 Agent prompt 模板，替换以下占位符后注入：

- `{{DISPLAY_NAME}}` → 角色中文名
- `{{ROLE_ID}}` → 角色标识
- `{{OUTPUT_DIR}}` → 输出根目录
- `{{STEP5_OUTPUT_FILE_PATH}}` → Step 5 生成的主题目文件路径
- `{{FILE_PREFIX}}` → 题集文件前缀（角色配置 Section 4）
- `{{MODULE_FILE_MAP}}` → 模块编号→文件名映射（角色配置 Section 3）
- `{{COMPANY_CLASSIFICATION}}` → 从 `references/defaults/company-classification.md` 加载（或角色配置 Section 5 覆盖）
- `{{ROUND_DEFINITIONS}}` → 从 `references/defaults/round-definitions.md` 加载（或角色配置 Section 6 覆盖）

### 7.2 Agent 2：索引校验

**依赖：** Agent 1 完成所有公司文件和 company_index.md 的生成。

主会话从 `references/prompts/step7-validation.md` 加载 Agent prompt 模板，替换 `{{ROLE_ID}}` 和 `{{OUTPUT_DIR}}` 后注入。

校验三项检查：
- **检查 A（正向校验）**：索引中每个链接指向的文件真实存在
- **检查 B（反向校验）**：company/ 目录下每个文件在索引中有对应条目
- **检查 C（分类与统计一致性）**：公司分类正确，统计数字一致

### 7.3 增量更新

公司分类文件同样支持增量更新：
- 新增题目时，对应公司文件追加新题到对应轮次 section
- 若该公司首次出现，创建新的公司文件
- 更新 `company_index.md` 中的公司列表

---

## 执行结束后的汇报

完成后，向用户汇报（角色：{display_name}）：

**平台采集总览（按优先级排序）：**
- 小红书（最高优先级）：成功/失败/跳过
- B站（高优先级）：成功/失败/跳过
- 牛客（中优先级）：成功/失败/跳过
- CSDN（较低优先级）：成功/失败/跳过
- 其他平台（最低优先级）：成功/失败/跳过

**Agent 执行总览：**
- Step 0: 角色识别 — 已识别为 {display_name}（{role_id}）
- Step 1: 5 个 Agent（并行），成功 N / 失败 N
- Step 2: 1 个 Agent（清洗去重），成功/失败
- Step 3: 1 个 Agent（分类），成功/失败
- Step 4: 1 个 Agent（增量更新），成功/失败
- Step 5: 1 个 Agent（输出文件生成），成功/失败
- Step 6: N 个 Agent（每组 5-10 题批量解答），成功 N / 失败 N
- Step 7: 2 个 Agent（公司文件 + 校验），成功/失败

**数据统计：**
- 本次新增题目数 / 累计题目总数
- 输出文件的完整路径（题集 + 解答）
- 解答文件生成情况（哪些模块生成了、各多少题）
- 公司分类文件生成情况（涉及多少家公司、分布哪些大类）
- 近期高频题 Top 5（简要列出）
- Step 6 失败题目清单（如有）

---

## 注意事项

- **Step 0 先于一切执行**：拉起任何采集 Agent 前必须先识别角色并加载配置，否则搜索关键词和模块分类将不正确
- **Agent 失败不中断整体流程**：单个 Agent 失败记录错误后继续下一步。Step 1 单平台 Agent 失败不影响其他平台；Step 6 单题 Agent 失败记录 Q 编号并跳过，不中断整个模块
- **平台优先级严格遵守**：小红书 > B站 > 牛客 > CSDN > 其他，高优先级平台分配更多搜索资源和 Agent 查询次数
- **Step 6 逐组 Agent 顺序执行**：同模块内各组必须按顺序拉 Agent（非并行），确保追加写入不冲突；每组合并 10-20 题，减少 Agent 调用次数
- 搜索失败不等于 skill 失败——跳过并继续，最后汇报哪些平台访问失败
- 不采集、不尝试绕过付费内容
- 题目质量 > 题目数量：200 题上限是为了保证精选
- 输出文件名含日期，方便按版本追溯历史
- **生成完毕后必须执行 Step 7.2 公司索引校验**（检查 A/B/C），确保所有链接指向的文件真实存在，分类和统计数据一致
- **增量模式下已有答案不重复生成**：优先检查 `samples/{role_id}/answers/` 已有解答文件，仅对新题目生成答案并追加写入，不覆盖已有内容，不创建 `_new.md` 临时文件
- **必须加载站点经验文件**：小红书/B站/脉脉等反爬严格的平台，直接用 web_access 通用 CDP 指令大概率失败。每次采集对应平台前，务必先用 Read 工具加载本 skill 的 `references/site-patterns/{domain}.md`（优先），若本地文件不存在则回退到 `${CLAUDE_SKILL_DIR}/web-access/references/site-patterns/{domain}.md`
- **角色配置优先**：所有搜索关键词、知识模块定义、输出文件命名均从角色配置文件读取，不得使用 SKILL.md 中的示例关键词作为默认值
- **Agent prompt 模板外置**：Step 1-7 的 Agent prompt 模板统一存放在 `references/prompts/` 目录，主会话加载后替换 `{{PLACEHOLDER}}` 再注入 Agent
- **基线配置独立管理**：公司分类和轮次定义默认值存放在 `references/defaults/` 目录，角色配置可按需覆盖
