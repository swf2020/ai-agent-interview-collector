# 多角色社招面试题采集工具

> 多角色社招面试题自动采集与整理工具。支持 AI Agent、后端开发、前端开发、产品经理、测试、UI设计、算法等角色。从中文互联网平台搜集近 12 个月真实面试题，清洗去重后按角色专属知识模块分类，同时标注公司分类与面试轮次，生成带来源标注和参考答案的 Markdown 题集。

## 功能特性

- **多角色支持**：AI Agent / 后端开发 / 前端开发 / 产品经理 / 测试 / UI设计 / 算法工程师，自动识别用户意图并加载对应角色配置
- **自动搜索采集**：覆盖小红书/B站/牛客/CSDN/脉脉/BOSS直聘/猎聘/知乎等 14+ 中文平台，严格按流量置信度优先级分配搜索资源
- **清洗去重**：只保留真实面试题，语义去重（相似度 >85% 合并），标注来源平台与日期，上限 200 题保证精选
- **角色专属模块分类**：每个角色独立的知识模块定义（如 AI Agent 的 Prompt/LLM/RAG/Agent架构等 8 大模块，后端开发的 Java基础/并发/数据库/系统设计等 8 大模块）
- **公司分类**：6 大类（互联网公司/外企/AI公司/硬件芯片/创业公司/其他），每类下按具体公司名细分
- **面试轮次**：一面（基础）/ 二面（系统设计）/ 三面（文化匹配）/ HR面 / 总监面 / 加面 / 综合
- **逐题解答**：每题独立 Agent 生成四段式解答（考察点 → 解答思路 → 参考答案 + 加分项），各模块并行执行
- **增量更新**：每次只采集新增题目，已有答案不重复生成，合并去重后追加到历史文件

## 支持角色

| 角色 | 触发词示例 |
|------|-----------|
| AI Agent / 大模型工程师（默认） | "更新面试题集"、"收集 AI Agent 面试题" |
| 后端开发 | "收集后端面试题"、"Java 面试题采集" |
| 前端开发 | "收集前端面试题"、"React 面试题" |
| 产品经理 | "收集产品经理面试题"、"PM 面试" |
| 测试 / QA | "收集测试面试题"、"自动化测试面试" |
| UI设计 | "收集 UI 设计面试题"、"交互设计面试" |
| 算法工程师 | "收集算法面试题"、"机器学习面试" |

> 不指定角色时，默认采集 AI Agent 面试题（向后兼容）。

## 平台优先级

高流量平台题目置信度更高，采集优先级：**小红书 > B站 > 牛客 > CSDN > 其他网站**（脉脉、知乎、BOSS直聘、猎聘、培训机构等）。

## Agent 架构

全部 8 个步骤通过独立 Agent 执行，主会话负责编排调度：

| Step | Agent 数 | 执行模式 | 说明 |
|------|---------|---------|------|
| Step 0 | 0 | 串行 | 角色识别与配置加载（主会话直接执行） |
| Step 1 | 5 | **并行** | 按平台分组，5 个 Agent 同时采集 |
| Step 2 | 1 | 串行 | 汇总 Step 1 结果后清洗去重 |
| Step 3 | 1 | 串行 | 对清洗结果进行三维护分类（使用角色知识模块） |
| Step 4 | 1 | 串行 | 增量更新逻辑（合并历史数据） |
| Step 5 | 1 | 串行 | 生成主题目 Markdown 文件 |
| Step 6 | N（批量） | **逐组顺序** | 每组 5-10 题，按模块批量生成 |
| Step 7 | 2 | 串行 | 公司文件生成 + 索引校验 |

## 安装

### 使用 npx 安装（推荐）

```bash
npx ai-agent-interview-collector
```

该命令会自动将 skill 文件复制到 `~/.claude/skills/ai-agent-interview-collector` 目录。

更新 skill：

```bash
npx ai-agent-interview-collector update
```

卸载：

```bash
npx ai-agent-interview-collector uninstall
```

### 在 Claude Code 中使用

安装完成后，在 Claude Code 对话中直接说：

**通用触发（默认 AI Agent）：**
- "更新面试题集"
- "收集最新面试题"
- "跑一次面试题采集"

**指定角色触发：**
- "收集后端面试题" / "收集前端面试题"
- "产品经理面试题采集"
- "测试工程师面试题"
- "UI设计面试题"
- "算法面试题采集"

### 在 OpenClaw 中使用

1. 将本仓库的 `SKILL.md` 文件复制到 OpenClaw 的 skills 目录：

```bash
mkdir -p ~/.openclaw/skills/ai-agent-interview-collector
cp SKILL.md ~/.openclaw/skills/ai-agent-interview-collector/
```

2. 在 OpenClaw 对话中使用相同的触发词。

3. 输出文件默认生成在 OpenClaw 当前工作目录下，与 Claude Code 环境输出格式一致。

## 输出示例

每个角色的输出放在独立的子目录 `samples/{role_id}/` 下，各角色输出隔离。

以 AI Agent 角色为例（`samples/ai-agent/`）：

1. **题集文件**：`samples/ai-agent/ai_agent_interview_questions_YYYYMMDD.md`
2. **解答目录**：`samples/ai-agent/answers/` 下按模块分文件
3. **公司索引**：`samples/ai-agent/company_index.md`
4. **公司分类文件**：`samples/ai-agent/company/{公司大类}/{公司名}.md`

各角色输出目录：
| 角色 | role_id | 输出目录 |
|------|---------|---------|
| AI Agent | `ai-agent` | `samples/ai-agent/` |
| 后端开发 | `backend` | `samples/backend/` |
| 前端开发 | `frontend` | `samples/frontend/` |
| 产品经理 | `product-manager` | `samples/product-manager/` |
| 测试 | `qa-testing` | `samples/qa-testing/` |
| UI设计 | `ui-design` | `samples/ui-design/` |
| 算法 | `algorithm` | `samples/algorithm/` |

完整示例见 `samples/` 目录。

## 前置依赖

本 skill 的核心流程依赖联网采集能力，推荐安装 [web-access](https://github.com/eze-is/web-access) skill 以获得 CDP 浏览器模式支持：

### 安装 web-access

```bash
git clone https://github.com/eze-is/web-access ~/.claude/skills/web-access
```

或直接让 Claude 安装：
```
帮我安装这个 skill：https://github.com/eze-is/web-access
```

### CDP 前置配置

1. Chrome 地址栏打开 `chrome://inspect/#remote-debugging`
2. 勾选 **Allow remote debugging for this browser instance**（可能需要重启浏览器）

检查环境：

```bash
bash ~/.claude/skills/web-access/scripts/check-deps.sh
```

> 未安装 web-access 时，采集流程会降级使用内置的 WebSearch/WebFetch 工具，但小红书、B站、脉脉等反爬严格的平台将大幅受限或无法采集。

### 站点经验文件

`references/site-patterns/` 目录下维护了各站点的爬取经验（API 端点、CDP 脚本模式、已知陷阱），针对 AI Agent 面试题采集场景做了专项增强。采集对应平台前必须加载，若本地文件不存在则回退到 `web-access` skill 的同名文件。

| 平台 | 经验文件 |
|------|---------|
| 小红书 | `references/site-patterns/xiaohongshu.md` |
| B站 | `references/site-patterns/bilibili.md` |
| BOSS直聘 | `references/site-patterns/zhipin.com.md` |

## 目录结构

```
├── SKILL.md                    # Skill 定义（核心，含完整 8 步流程）
├── package.json                # npm 包配置（支持 npx 安装）
├── bin/
│   └── cli.js                  # CLI 入口脚本
├── references/
│   ├── site-patterns/          # 站点爬取经验文件
│   │   ├── xiaohongshu.md
│   │   ├── bilibili.md
│   │   └── zhipin.com.md
│   └── roles/                  # 角色配置文件（NEW）
│       ├── ai-agent.md         # AI Agent 配置
│       ├── backend.md          # 后端开发配置
│       ├── frontend.md         # 前端开发配置
│       ├── product-manager.md  # 产品经理配置
│       ├── qa-testing.md       # 测试配置
│       ├── ui-design.md        # UI设计配置
│       └── algorithm.md        # 算法配置
├── samples/                    # 输出目录（按角色分 subdir）
│   └── ai-agent/               # AI Agent 角色输出示例
│       ├── ai_agent_interview_questions_20260514.md
│       ├── company_index.md
│       ├── _raw_step1_results.md   # 中间产物（Step 1 原始采集）
│       ├── _step2_cleaned.md       # 中间产物（Step 2 清洗去重）
│       ├── _step3_classified.md    # 中间产物（Step 3 分类）
│       ├── _step4_final.md         # 中间产物（Step 4 增量合并）
│       ├── company/
│       │   └── 其他/
│       │       └── 通用面试题.md
│       └── answers/
│           ├── module_01_prompt_llm.md
│           ├── module_02_rag.md
│           ├── module_03_tool_calling.md
│           ├── module_04_agent_architecture.md
│           ├── module_05_multi_agent.md
│           ├── module_06_engineering.md
│           ├── module_07_deployment.md
│           └── module_08_evolution.md
└── README.md
```

## License

Apache License
