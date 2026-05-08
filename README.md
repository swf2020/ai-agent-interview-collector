# AI Agent 社招面试题采集工具

> AI Agent 社招面试题自动采集与整理工具。从中文互联网平台搜集近 12 个月真实面试题，清洗去重后按 8 大模块分类，同时标注公司分类与面试轮次，生成带来源标注和参考答案的 Markdown 题集。

## 功能特性

- **自动搜索采集**：覆盖牛客/小红书/脉脉/B站/知乎/CSDN 等 14+ 中文平台
- **清洗去重**：只保留真实面试题，语义去重，标注来源平台与日期
- **8 大模块分类**：Prompt/LLM 原理、RAG、工具调用、Agent 架构、Multi-Agent、工程落地、云端部署、技术演进
- **公司分类**：6 大类（互联网公司/外企/AI公司/硬件芯片/创业公司/其他），每类下按具体公司名细分
- **面试轮次**：一面（基础）/ 二面（系统设计）/ 三面（文化匹配）/ HR面 / 总监面 / 加面 / 综合
- **并行生成解答**：按模块分 agent 并行生成解答（考察点 → 思路 → 参考答案 + 加分项）
- **增量更新**：每次只采集新增题目，合并去重后生成新版本

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
- "更新面试题集"
- "刷新 AI Agent 面试题"
- "收集最新面试题"
- "跑一次面试题采集"

## 输出示例

运行后会生成以下文件：

1. **题集文件**：`ai_agent_interview_questions_YYYYMMDD.md`（按 8 大模块分类，每题标注 `[公司大类|具体公司|轮次]`）
2. **解答目录**：`answers/` 下按模块分文件
3. **公司索引**：`company_index.md`（6 大类公司索引）
4. **公司分类文件**：`company/{公司大类}/{公司名}.md`（按面试轮次分组）

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

> 未安装 web-access 时，采集流程会降级使用内置的 WebSearch/WebFetch 工具，但部分反爬较强的平台（如小红书）可能无法采集。

## 目录结构

```
├── SKILL.md                    # Skill 定义（核心）
├── package.json                # npm 包配置（支持 npx 安装）
├── bin/
│   └── cli.js                  # CLI 入口脚本
├── samples/                    # 输出示例
│   ├── ai_agent_interview_questions_20260502.md
│   ├── company_index.md
│   ├── company/
│   │   ├── 互联网公司/
│   │   │   └── 京东.md
│   │   ├── 外企/
│   │   │   └── 微软.md
│   │   └── ...
│   └── answers/
│       ├── module_01_prompt_llm.md
│       ├── module_02_rag.md
│       └── ...
└── README.md
```

## License

Apache License
