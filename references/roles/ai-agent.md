---
role_id: ai-agent
display_name: AI Agent
domain: AI Agent / 大模型工程师
version: "1.0"
---

# AI Agent 社招面试题采集配置

## 1. 角色识别

### 触发短语

- AI Agent面试题
- 大模型面试题
- LLM面试题
- Agent工程师面试
- 更新面试题集
- 刷新AI Agent面试题
- 收集最新面试题
- 跑一次面试题采集
- 采集面试题
- 整理面试题

### 角色关键字

AI Agent, 大模型, LLM, Agent工程师, RAG, Function Calling, MCP, LangGraph, prompt engineering, 向量数据库, LoRA, Multi-Agent

## 2. 搜索关键词配置

### 小红书

1. AI Agent 面试题 2025 2026
2. 大模型 Agent 社招面试 2025 2026
3. RAG 面试题 实际经验 2025 2026
4. Function Calling Agent MCP 面试 2025 2026
5. prompt engineering LLM 面试题 2025 2026

### B站

1. AI大模型面试题 合集 2025 2026
2. AI Agent 面试题 视频 2025 2026
3. 大模型 Agent 面试经验 2025 2026
4. RAG Agent 面试题 2025 2026

### 牛客

1. AI Agent 面试题 site:nowcoder.com 2025 2026
2. 大模型 Agent 面试 牛客网 2025 2026
3. LLM 面试 牛客 2025 2026
4. RAG 面试 面经 牛客 2025 2026

### CSDN

1. AI Agent 面试题 site:csdn.net 2025 2026
2. 大模型 RAG 面试题 CSDN 2025 2026
3. LLM Agent 社招面试 CSDN 2025 2026

### 其他平台（WebFetch组）

1. RAG 面试题 实际问的 2025 2026
2. Function Calling MCP 面试 经验 2025 2026
3. Multi-Agent 面试真题 2025 2026
4. LangGraph LangChain 面试题 2025 2026
5. 向量数据库 embedding 面试题 2025 2026
6. LoRA QLoRA 微调 面试题 2025 2026
7. 生产级 LLM 系统设计题 2025 2026
8. prompt engineering 面试 真实经验 2025 2026
9. 黑马程序员 AI大模型面试题 合集 2025 2026
10. 尚硅谷 AI大模型面试题 合集 2025 2026

### 其他平台（CDP组）

11. 大模型工程师面试 脉脉 2025 2026
12. AI Agent 面试 BOSS直聘 猎聘 2025 2026

## 3. 知识模块定义

| 编号 | 模块名称 | 文件名 | 章节emoji | 涵盖主题 |
|------|---------|--------|-----------|---------|
| 1 | Prompt / LLM 原理类 | module_01_prompt_llm | 🎯 | Token、Temperature、微调、LoRA/QLoRA、Transformer、KV Cache、量化 |
| 2 | RAG 设计与优化类 | module_02_rag | 🎯 | 向量检索、Embedding、混合检索、RAGAS、分块策略、重排序 |
| 3 | 工具调用类 | module_03_tool_calling | 🎯 | Function Calling、MCP、工具路由、tool_choice 策略 |
| 4 | Agent 架构设计类 | module_04_agent_architecture | 🎯 | ReAct、记忆系统（短期/长期）、LangGraph、任务规划 |
| 5 | 多 Agent 设计类 | module_05_multi_agent | 🎯 | Multi-Agent、AutoGen、CrewAI、协作协议、冲突解决 |
| 6 | 工程落地类 | module_06_engineering | 🎯 | 流式输出、成本控制、可观测性、限流、安全防护、幻觉缓解 |
| 7 | 云端部署类 | module_07_deployment | 🎯 | Docker、Lambda/Serverless、CI/CD、K8s、API 网关 |
| 8 | 技术演进与视野类 | module_08_evolution | 🎯 | 历史演变、前沿趋势、开放性设计题、行业对比 |

## 4. 输出配置

- **题集文件前缀**: `ai_agent_interview_questions`
- **题集主标题**: `# AI Agent 社招面试题集（采集日期：YYYY-MM-DD）`
- **来源行**: `> 来源：小红书 / B站 / 牛客 / CSDN / 脉脉 / BOSS直聘 / 猎聘 / 知乎 / 黑马程序员 / 尚硅谷等`
- **统计行**: `> 本次新增：N 题 | 累计去重后：M 题`
- **综合类文件名**: `module_00_other`

## 5. 公司分类配置

继承默认（6大类：互联网公司、外企、AI公司、硬件芯片、创业公司、其他）。
