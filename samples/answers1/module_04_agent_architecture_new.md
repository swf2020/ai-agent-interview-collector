# Module 4：Agent 架构设计类 - 新增题目解答

> 生成日期：2026-05-11 | 共 62 题

---

## Q1：Agent 的 thinking 阶段如何决定调用工具还是直接回复？

### 考察点
考察候选人对 Agent 决策机制的理解，尤其是 thinking/reasoning 阶段的分流逻辑设计能力。

### 解答思路
1. 先说明 thinking 阶段的本质：LLM 对当前上下文做推理分析，产出下一步行动决策（工具调用 vs. 直接回复）
2. 展开决策依据的四个维度：模型置信度、工具匹配度、信息完备度、安全边界
3. 给出工程化的决策流程实现（意图分类前置 + 模型自行判断 + 后置兜底三层架构）

### 参考答案

Agent 在 thinking 阶段面临的核心决策是：**当前信息是否足够生成可靠回复？如果不够，需要调用哪个工具？**

**决策链路（三层架构）：**

**第一层：前置意图分类（Pre-thinking Router）**
在 LLM 推理之前，用轻量分类器判断：
```python
INTENT_CLASSES = {
    "direct_reply": ["简单寒暄", "常识问答", "不需要最新数据的知识"],
    "need_tool": ["需要实时数据", "需要外部操作", "需要查询私有数据"],
    "ambiguous": ["意图不明确，需要更多上下文"]
}
```
对于 `direct_reply` 类请求，直接跳过工具选择阶段，节省 token；对于 `ambiguous`，先反问澄清而非盲目调用工具。

**第二层：LLM 自主推理决策（核心）**
模型在 System Prompt 中收到工具列表后，thinking 阶段做以下判断：
1. **信息完备度检查**：当前上下文是否包含回答所需的全部信息？
2. **工具匹配度计算**：如果有信息缺口，哪个工具能填补这个缺口？工具描述是否与需求语义匹配？
3. **调用代价评估**：调用工具可能引入延迟（网络 IO）、成本（API 配额），是否值得？
4. **安全边界检查**：用户请求是否涉及需要人工审批的高风险操作？

**第三层：后置兜底（Post-thinking Guard）**
模型输出"直接回复"后，用一个验证器检查回复中是否包含幻觉指示词（如"根据最新数据显示"但实际未调用工具），若检测到异常则强制回退到工具调用路径。

**关键技术点**：
- 工具描述的**触发条件字段**（`when_to_use`）比功能描述更重要，它直接指导模型何时选择该工具
- 使用结构化输出约束 `tool_choice` 模式：`auto` 模式让模型有拒绝调用的空间，而 `required` 模式强制调用（适用于明确缺信息的场景）
- 对于 `ambiguous` 场景，优先反问用户而非猜测意图，这是 Anthropic 的"负责任 AI"设计原则

**加分项：** 可以提及 Claude 的 thinking/tool_use 交替模式——模型在 thinking 过程中可以多次调用工具，每次工具调用前后都有独立的 thinking block，形成"思考-行动-思考-行动"的细粒度决策循环，而非单次"全有或全无"的工具选择。

---

## Q2：Agent 失败/中断如何处理？重试安全如何保证？

### 考察点
考察候选人对 Agent 系统可靠性的工程实践能力，尤其是幂等性设计和安全重试机制。

### 解答思路
1. 先分类失败类型（瞬时性 vs. 确定性），不同失败不同策略
2. 展开重试安全的三要素：幂等性、退避策略、重试上限
3. 补充中断恢复和优雅降级的设计

### 参考答案

**失败分类与处理矩阵：**

| 失败类型 | 示例 | 策略 | 是否重试 |
|----------|------|------|----------|
| 瞬时性网络错误 | 连接超时、503 | 指数退避重试 | 是 (2-3次) |
| LLM API 限流 | 429 Too Many Requests | 退避 + 切换 API key | 是 |
| 工具参数错误 | JSON Schema 校验失败 | 反馈给 LLM 自行修正 | 是 (模型感知重试) |
| 业务逻辑错误 | 查询结果为空、权限不足 | 返回业务错误给用户 | 否 |
| 工具不存在 | 模型幻觉出不存在的工具 | 降级到备选工具 | 否 |
| 中间人攻击/安全问题 | Prompt Injection 检测 | 终止 + 告警 | 否 |

**重试安全（幂等性保证）——最关键的工程点：**

```
重试安全 = 幂等性设计 + 唯一请求ID + 状态检查

关键原则：对"写"操作，重试前检查是否已执行过
```

1. **幂等键（Idempotency Key）**：每次工具调用携带全局唯一的 `idempotency_key`，即使网络层面重试多次，业务层只执行一次
```python
class IdempotentToolExecutor:
    def execute(self, tool_name: str, params: dict, idempotency_key: str):
        # 1. 检查是否已执行过
        cached = redis.get(f"tool_result:{idempotency_key}")
        if cached:
            return cached
        # 2. 获取分布式锁防止并发重复执行
        with redis.lock(f"tool_lock:{idempotency_key}", timeout=30):
            # 双重检查
            cached = redis.get(f"tool_result:{idempotency_key}")
            if cached:
                return cached
            # 3. 执行工具
            result = tool_registry[tool_name](**params)
            # 4. 缓存结果
            redis.setex(f"tool_result:{idempotency_key}", 3600, result)
            return result
```

2. **指数退避 + 抖动（Jitter）**：
```python
for attempt in range(max_retries):
    try:
        return execute_tool()
    except TransientError:
        sleep_time = min(2 ** attempt + random.uniform(0, 1), 30)  # 最大 30s
        time.sleep(sleep_time)
```

3. **读/写分离重试策略**：读操作（GET/QUERY）可安全重试，写操作（POST/DELETE）必须走幂等逻辑

**中断恢复（Checkpoint + Resume）：**
- LangGraph 的 checkpoint 机制：每一步执行后自动保存状态，中断后可从最近 checkpoint 恢复
- 自研方案：将 (task_id, step_index, state_snapshot) 持久化到数据库，恢复时读取并继续执行

**优雅降级链：**
```
主工具不可用 -> 备选工具 -> 缓存数据 -> 模型自身知识 + "注意：以下信息可能不是最新"提示
```

**加分项：** 介绍"断路器模式"（Circuit Breaker）——当某工具连续失败 N 次，自动将其暂时标记为不可用（open state），经过一段冷却时间后再尝试（half-open），避免雪崩。还可引入"乐观重试"——不等待前一步失败，并行尝试多个备选方案，取最快成功的。

---

## Q3：Code Agent 和普通 Agent 的设计有什么区别？

### 考察点
考察候选人对垂直领域 Agent 的差异化设计能力，是否理解代码场景的特殊需求。

### 解答思路
1. 先定义 Code Agent 的特殊场景（代码生成、编辑、调试、执行）
2. 从工具集、上下文、执行环境、安全、评估五个维度对比
3. 给出 Code Agent 特有的架构设计（沙箱、LSP 集成、AST 分析）

### 参考答案

**Code Agent vs 普通 Agent 的核心差异：**

| 维度 | 普通 Agent | Code Agent |
|------|-----------|------------|
| **输入格式** | 自然语言为主 | 代码文本（有严格语法，多种语言） |
| **工具集** | API 调用、搜索、文件读写 | 代码编辑（替换、插入）、LSP 诊断、终端命令、Git 操作 |
| **上下文结构** | 对话历史 + 工具结果 | 代码文件树 + 项目结构 + 依赖图 + AST |
| **执行环境** | 无特殊要求 | 需要沙箱（Docker/VM）隔离执行 |
| **反馈循环** | 工具返回结果 | 编译器/linter/test 输出 + 运行时错误 |
| **安全要求** | 基础权限控制 | 命令注入防护、文件系统隔离、网络白名单 |
| **评估指标** | 任务完成率、准确性 | 测试通过率、代码 diff 质量、LSP 警告数 |
| **确定性需求** | 中等 | 极高（代码不能被"幻觉"出语法错误） |

**Code Agent 特有设计：**

**1. 工具层设计（以 Claude Code 为例）：**
```python
CODE_AGENT_TOOLS = {
    "Read": "读取文件内容（指定 offset/limit）",
    "Write": "全量覆写文件（新建或重写）",
    "Edit": "精确字符串替换（老字符串 -> 新字符串）",  # 最核心工具，避免全量重写
    "Bash": "在沙箱中执行终端命令",
    "Grep": "搜索引擎（模式搜索 + 文件过滤）",
    "Glob": "按模式匹配文件路径",
    "TodoWrite": "管理任务跟踪列表"  # Code Agent 特有，任务拆解
}
```
关键设计：`Edit` 工具用精确的 `old_string -> new_string` 替换，而非行号编辑，因为行号容易在多次编辑后漂移。

**2. 上下文设计：**
- **项目级上下文（Project Context）**：代码文件树、package.json/pyproject.toml、git status
- **文件级上下文**：当前编辑文件内容 + LSP 诊断信息（错误/警告的 location + message）
- **执行反馈上下文**：编译错误、lint 报告、测试结果、stdout/stderr
- **上下文优先级**：对当前编辑任务相关的代码片段给予更高 attention，非相关文件折叠为摘要

**3. 执行安全（沙箱设计）：**
```python
class CodeSandbox:
    def execute_command(self, cmd: str, workdir: str):
        # 1. 命令白名单校验（禁止 rm -rf /、curl to internal IP 等）
        if not is_safe_command(cmd):
            raise UnsafeCommandError(f"Blocked: {cmd}")
        # 2. 在隔离的 Docker 容器中执行
        result = docker.run(
            image="code-sandbox:latest",
            command=cmd,
            volumes={workdir: "/workspace"},
            network="none",  # 可选：禁止网络
            timeout=30,
            memory="512m"
        )
        return result
```

**4. 与普通 Agent 的本质差异：**
- 普通 Agent 的反馈循环是"工具返回结果"，Code Agent 多了一层"编译器/运行时反馈"——这是比工具返回更客观、更严格的信号
- Code Agent 的输出是**可执行产物**（代码、脚本），而非仅仅是自然语言回答，因此保证输出的语法正确性是底线
- Code Agent 的 context window 管理更复杂：不是简单的对话历史压缩，而是**代码结构感知的裁剪**（保留被编辑函数的完整上下文，折叠已完成的无关模块）

**加分项：** 介绍"AST-aware editing"——通过解析代码 AST 精准定位替换区域，避免字符串匹配的不确定性。可讨论 Tree-sitter 或 LSP 的 textDocument/applyEdit 协议。还可讨论"代码审查 Agent"的子类型——其工具集侧重于 diff 分析和 Suggestion 创建，与"代码编写 Agent"的工具集有本质不同。

---

## Q4：Claude Code/Cursor 的 System Prompt 设计有什么特点？上下文压缩怎么实现？

### 考察点
考察候选人对前沿 Agent 产品的逆向工程能力和系统设计思维，是否理解生产级 System Prompt 的架构分层。

### 解答思路
1. 分析 System Prompt 的分层架构（角色定义、环境注入、工具定义、行为约束、辅助文本）
2. 讨论每层的设计目的和关键决策
3. 展开上下文压缩的策略体系（摘要、截断、优先级标记、引用折叠）

### 参考答案

**System Prompt 的典型分层架构：**

**Layer 1 — 角色与能力声明（Identity & Capabilities）**
```
你是 Claude Code，Anthropic 的官方 CLI Agent。
你的能力：代码理解、编辑、终端执行、文件搜索、图像阅读。
你的限制：不能浏览网页（除非配置 MCP）、不能访问本地文件系统之外的资源。
```
设计目的：明确 Agent 的"人格边界"，防止模型过度承诺或拒绝合理请求。

**Layer 2 — 环境上下文注入（Environment Injection）**
```
你现在运行在：macOS, darwin 内核, zsh shell
当前工作目录: /Users/xxx/projects/my-app
这是一个 Git 仓库，当前分支: feat/new-feature
git status: (clean) / (modified: file1.ts, file2.ts)
```
设计目的：让模型在无工具调用的情况下就拥有"空间感知"，减少探索性的工具调用。特别是 git status 的注入，让 Agent 天然知道当前项目变更状态。

**Layer 3 — 工具系统定义（Tool Definitions）**
- 每个工具包含：name, description, parameters (JSON Schema)
- 关键设计原则：
  - description 中写明**何时使用**（trigger conditions），而非仅描述功能
  - 危险工具标注 `dangerouslyDisableSandbox: true`，默认需要用户确认
  - 工具描述按使用频率排序，高频工具前置

**Layer 4 — 行为准则（Guidelines / Constraints）**
```
- 对于文件搜索：用 Glob (不是 find/ls)，用 Grep (不是 grep/rg)
- Git 安全协议：永远不修改 git config、不走 --no-verify、不 force push to main
- 提交规范：永远新建 commit，不 amend；commit message 以 "Why" 为核心
```
设计目的：将工程经验固化为硬约束，避免 Agent 做出危险或低效的行为。

**Layer 5 — 辅助框架文本**
- `<env>` 标签包裹运行时信息
- `<system-reminder>` 注入安全提醒和 session 级别的动态配置
- 记忆系统注入：`project_context`（CLAUDE.md）、`memory`（用户偏好）

**上下文压缩（Context Compaction）的多种策略：**

**策略 1：对话摘要压缩（Conversation Summarization）**
```python
def summarize_history(messages: List[Message]) -> str:
    # 用一个轻量模型对长对话历史做摘要
    summary_prompt = f"""请将以下对话压缩为不超过 500 tokens 的结构化摘要：
    - 用户的主要目标和约束条件
    - 已完成的关键步骤和结果
    - 正在进行中的任务
    - 需要注意的问题和未解决的错误
    """
    return lightweight_llm.invoke(summary_prompt + format_history(messages))
```
摘要替代原始消息后，可节省 70-90% 的上下文空间，代价是丢失精确的代码片段和细节。

**策略 2：优先级标记 + 截断（Priority-based Truncation）**
```
每条消息标记优先级：
- P0（不可丢弃）：System Prompt、当前任务描述、最近的工具结果
- P1（高优先级）：最近的对话轮次、重要的错误信息
- P2（中优先级）：较早的对话轮次、已完成任务的执行轨迹
- P3（低优先级）：中间步骤的完整输出、冗余的 Observation
```
截断时从低优先级开始丢弃，保留 P0 和 P1 的完整性。

**策略 3：文件折叠（File Folding / Collapsing）**
```
原始：显示文件全部 500 行内容
压缩后：
[文件: src/auth/login.ts (500 行)]
第 1-50 行: import 和接口定义 (已折叠)
第 120-250 行: handleLogin 函数 (展开中)
第 251-500 行: 后续函数 (已折叠)
```
只展开当前正在编辑或讨论的代码段，其他部分折叠为摘要。

**策略 4：工具结果的引用压缩**
```
原始 Observation: {"files": ["src/a.ts", "src/b.ts", ...1000 files], ...}
压缩后：Observation: grep 找到了 1000 个匹配文件（仅展示前 20 个）
```
对于超过一定长度的工具结果，自动截断并保留头部 + 统计信息。

**策略 5：结构化信息的 token 高效表达**
- 使用 YAML/JSON 而非口语化描述来表示项目结构
- 例如用 `ls -R` 的树形结构比逐文件描述节省 60%+ token

**加分项：** 介绍"引用折叠"（Citation Collapsing）——Agent 多次读取同一文件的不同片段时，后续引用可简化为 `[ref: src/auth/login.ts#L120-L250, same as msg#3]`，而非重复粘贴大段代码。以及"增量上下文更新"——只向模型发送上次注入后的 `git diff` 变更，而非重新发送完整的文件内容。

---

## Q5：Agent 中长短期记忆如何设计？各自存什么？

### 考察点
考察候选人对记忆系统架构的分层设计能力，能否给出可落地的存储方案。

### 解答思路
1. 采用"三层记忆模型"给出架构图
2. 分别说明各层的存储内容、存储介质、容量策略、检索方式
3. 重点讨论记忆注入机制和衰减策略

### 参考答案

**三层记忆架构：**

| 层级 | 存储内容 | 存储介质 | 生命周期 | 容量限制 | 检索延迟 |
|------|----------|----------|----------|----------|----------|
| **工作记忆** | 当前任务执行状态、中间变量、工具调用结果暂存 | 进程内存（Python dict / Pydantic State） | 任务结束即释放 | GB 级 | 0（内存访问） |
| **短期记忆** | 当前会话的对话历史、最近 N 轮交互 | Redis / 进程内 cache | 会话级（24h TTL） | 受上下文窗口限制 | ms 级 |
| **长期记忆** | 用户画像、历史经验、领域知识、偏好设置 | 向量数据库 + 关系数据库 + 知识图谱 | 持久化 | 近乎无限 | ms-s 级（需检索） |

**各层详解：**

**工作记忆（Working Memory）——"Agent 的事务暂存区"**
```
存什么：
- 当前任务的子目标列表和完成状态
- 已调用的工具及其结果（含错误）
- 正在编辑的文件缓冲区
- 当前 Plan 的执行进度

访问模式：直接读写（零拷贝成本）
```
```python
class AgentState(TypedDict):
    task: str                      # 当前任务描述
    sub_tasks: List[SubTask]       # 子任务列表 (pending/done/failed)
    tool_outputs: Dict[str, Any]   # 工具调用结果缓存
    scratchpad: List[str]          # Thought-Action-Observation 轨迹
    current_plan: Plan             # 当前执行计划
    error_count: int               # 连续错误计数
```

**短期记忆（Short-term Memory）——"会话的上下文窗口"**
```
存什么：
- 最近 N 轮（通常 5-15 轮）的完整对话
- 当前会话的用户约束和偏好
- 本会话中读取的文件片段

存储策略：
1. 滑动窗口：保留最近 10 轮完整对话
2. 早期对话做摘要压缩（保留决策级信息，丢弃详细轨迹）
3. 基于重要性的筛选：被用户重复提及的关键信息独立保存

工程实现：
- Redis List: session:{session_id}:messages (按时间排列)
- Redis Hash: session:{session_id}:summary (压缩摘要)
- 过期策略: EXPIRE 86400 (24h 自动清理)
```

**长期记忆（Long-term Memory）——"跨会话的知识库"**
```
存什么：
- 用户画像：技术栈、项目背景、沟通偏好、权限等级
- 经验教训：历史任务的失败原因和修正方案
- 领域知识：项目结构、API 文档摘要、团队约定的编码规范
- 工具使用经验：哪些工具组合在哪些场景下最有效

存储方案矩阵：
| 记忆类型 | 存储方案 | 检索方式 |
|----------|----------|----------|
| 语义记忆（知识/经验） | Milvus/Chroma + Embedding | 向量相似度搜索 |
| 结构化记忆（用户画像） | PostgreSQL | SQL 查询 |
| 关系记忆（实体关系） | Neo4j 知识图谱 | 图谱遍历 |
| 文档记忆（项目文档） | 文件系统 + 全文索引 | 关键词 + 向量混合检索 |
```

**记忆注入（Memory Injection）——何时把什么注入到上下文：**
```python
def build_context(task: str, session_id: str, user_id: str) -> List[Message]:
    context = []
    # 1. 工作记忆（已在上下文中，不需要注入）
    # 2. 短期记忆
    context.extend(get_session_history(session_id, last_n=10))
    # 3. 长期记忆（按需检索）
    user_profile = db.get_user_profile(user_id)  # SQL
    relevant_knowledge = vector_db.search(task, top_k=5)  # 向量检索
    related_entities = graph_db.query(task_entities(task))  # 图谱查询
    context.append(SystemMessage(format_memories(user_profile, relevant_knowledge, related_entities)))
    return context
```

**记忆衰减与淘汰策略：**
- 短期记忆：超过 24h TTL 自动过期；会话中超过 10 轮的部分做摘要后丢弃
- 长期记忆：基于 `recency * 0.4 + frequency * 0.3 + relevance * 0.3` 计算重要性分数，低于阈值归档
- 工作记忆：任务完成后立即释放，仅关键决策点写回长期记忆

**加分项：** 介绍"反思记忆"（Reflexion Memory）——不仅存储"发生了什么"，还存储"从中学到了什么"。每次任务结束后，LLM 对执行轨迹做反思，生成的经验教训以更高质量的摘要存入长期记忆。带有 `importance` 和 `confidence` 双重评分。

---

## Q6：上下文工程与记忆管理的关系是什么？

### 考察点
考察候选人对系统级抽象的理解——能否将"上下文工程"和"记忆管理"这两个概念准确定位并说明其交互关系。

### 解答思路
1. 先分别定义上下文工程和记忆管理的内涵
2. 阐明它们的关系（上下文工程是"管道"，记忆管理是"水源"）
3. 给出协同工作的架构设计和关键决策点

### 参考答案

**定义区分：**

**上下文工程（Context Engineering）** 关注的是：**在一次 LLM 推理请求中，什么信息应该出现在 Prompt 中，以什么样的顺序和格式，占多少 token 预算**。它是"最后一公里"的组装艺术。

**记忆管理（Memory Management）** 关注的是：**在 Agent 系统中，如何跨时间、跨会话地存储、更新、检索、淘汰信息**。它是"全生命周期"的数据治理。

**类比理解：**
- 记忆管理 = 图书馆管理系统（买什么书、怎么分类、如何检索、何时淘汰旧书）
- 上下文工程 = 读者每次来馆时，图书管理员为他从馆藏中精选出 5 本最相关的书，按最佳阅读顺序摆放在他面前

**关系矩阵：**

| 维度 | 上下文工程 | 记忆管理 |
|------|-----------|----------|
| 时间尺度 | 单次请求（毫秒-秒） | 跨会话（天-月-年） |
| 数据量 | Token 预算内（8K-200K） | 近乎无限 |
| 核心操作 | 选择、排序、格式化、预算分配 | 写入、检索、去重、压缩、淘汰 |
| 优化目标 | 最大化单次推理效果 | 最大化信息资产的长期 ROI |
| 典型输出 | 一个 messages array | 一个检索 API |

**协同工作流程：**
```
[用户请求到达]
    |
    v
[记忆管理模块]  ← 回答 "有哪些相关信息？"
    |-- 短期记忆: 当前会话历史 (Redis LRANGE)
    |-- 长期记忆: 用户画像 (SQL SELECT) + 语义搜索 (向量 Top-K)
    |-- 反思记忆: 历史经验教训 (按场景过滤)
    |
    v
[上下文工程模块]  ← 回答 "怎么把这些信息塞进有限的 token 预算？"
    |-- 预算分配: System 20% | Tools 15% | Memory 30% | Conversation 35%
    |-- 排序: 按相关性 + 时间衰减排序
    |-- 格式化: JSON/YAML 压缩格式 vs 自然语言格式
    |-- 截断: 超预算时按优先级丢弃
    |
    v
[LLM 推理请求]

推理完成后：
[重要的新信息] --> 回写到记忆管理模块 (短期 + 长期)
```

**关键设计决策：**

1. **记忆检索的颗粒度由上下文工程决定**——如果上下文预算只有 8K tokens，检索时只取 Top-3 记忆；200K tokens 时可以取 Top-20
2. **记忆的存储格式受上下文工程影响**——如果上下文中用结构化 JSON 更节省 token，记忆存储时就应该预格式化为 JSON
3. **上下文工程的预算分配策略需要记忆管理提供 meta 信息**——哪段记忆的重要性更高、哪段已经过期可以放心丢弃

**一句话总结：** 记忆管理决定 Agent"记得什么"，上下文工程决定 Agent"此刻看到什么"。两个系统非耦合——记忆管理不知道（也不该关心）最终哪些信息会被注入 Prompt；上下文工程不负责信息的持久化存储。

**加分项：** 讨论"上下文配方"（Context Recipe）——针对不同类型的任务，定义不同的上下文组装模板（如代码编辑任务的 Context Recipe 包含：project structure + current file + lsp diagnostics + related files；纯问答任务的 Context Recipe 包含：user profile + relevant knowledge + conversation summary）。记忆管理提供"食材"，Context Recipe 决定"做什么菜"。

---

## Q7：Self-Refine / 自我修正做过哪些策略？

### 考察点
考察候选人对 Agent 自我优化机制的实践经验，能否给出具体的反思策略和效果数据。

### 解答思路
1. 列出主要的自我修正策略分类（即时修正、后验反思、跨任务学习）
2. 每类给出具体实现和 Prompt 设计
3. 讨论反思的边际效益递减问题和控制机制

### 参考答案

**自我修正策略全景：**

**策略 1：即时自我修正（Inline Self-Correction）——在输出阶段修正**
```
原理：模型在生成最终答案前，先对自己的 draft 做批判性审查
实现：
  Step 1: 生成草稿
  Step 2: 对草稿做 checklist 审查（事实准确性、逻辑一致性、格式合规）
  Step 3: 根据审查结果修正后输出最终答案
```
```python
SELF_CRITIQUE_PROMPT = """你刚才的回答草稿如下。请以严格的审查者视角检查：
1. 是否有事实错误？（不确定的信息需要标注）
2. 是否有逻辑断裂？（前后矛盾、循环论证）
3. 引用的代码片段语法是否正确？
4. 是否遗漏了用户问题的某个部分？

如果发现问题，请直接在后续输出中修正。如果没有问题，输出原始回答并在末尾加上 [审查通过]。
"""
```
**适用场景**：单次问答、简单任务、需要高质量输出的场景。开销较小（一次额外的 reasoning pass）。

**策略 2：工具结果驱动的修正（Observation-driven Correction）——在执行循环中修正**
```
原理：工具调用失败或返回意外结果时，让 LLM 分析错误并调整行动
流程：
  Action(错误的参数) -> Observation(错误信息) -> Thought(分析错误)
  -> Action(修正后的参数) -> Observation(正确结果)
```
关键：错误信息必须是结构化的，让 LLM 理解"什么错了"和"怎么修正"：
```python
TOOL_ERROR_TEMPLATE = """
工具调用失败：
  工具名: {tool_name}
  错误类型: {error_type}  # 参数错误 / 网络超时 / 权限不足
  错误详情: {error_detail}
  建议: {suggestion}  # 参数"city"不存在，可用城市列表：北京、上海、深圳
"""
```

**策略 3：Reflexion 反思（Post-hoc Reflection）——任务完成后反思并积累经验**
```
原理：任务执行完毕后，回顾完整轨迹，提炼"教训"存入长期记忆
流程：
  执行任务 -> 成功/失败 -> 生成反思 -> 存入经验库 -> 下次同类任务时注入
```
```python
REFLEXION_PROMPT = """回顾以下任务的执行轨迹：

任务: {task}
执行步骤: {trajectory}
最终结果: {result}
是否成功: {success}

请分析：
1. 成功的经验是什么？（哪些决策做对了？）
2. 失败/不理想的原因是什么？
3. 如果有弯路，更优路径是什么？
4. 下次遇到类似任务，应该吸取什么教训？

输出格式（JSON）:
{{
  "lesson": "一句话教训",
  "category": "tool_selection | planning | parameter_extraction | fallback",
  "importance": 1-10,
  "trigger_keywords": ["关键词1", "关键词2"]  # 下次遇到什么场景时触发这条经验
}}
"""
```
**效果**：多次失败后，成功率可提升 10-25%。关键是 `trigger_keywords` 机制——经验只在匹配场景时才注入，避免噪声。

**策略 4：输出验证器修正（Validator-based Correction）——外部规则兜底**
```
原理：用确定性的规则/模型验证 LLM 输出，发现错误后反馈修正
典型验证器：
- JSON Schema 验证器 → 输出不合法 JSON 时要求重生成
- 代码语法检查器（Linter） → 语法错误时附带 lint 结果重生成
- 事实性验证 → 用 NLI/retrieval 模型检查回答是否与知识库一致
```
```python
class ValidatorChain:
    validators = [JsonSchemaValidator(), LintValidator(), FactualityChecker()]

    def validate_and_refine(self, output, context):
        for validator in self.validators:
            errors = validator.check(output, context)
            if errors:
                output = self.regenerate_with_feedback(errors, context)
        return output
```

**策略 5：多路并行修正（Best-of-N with Self-Consistency）**
```
原理：生成 N 个独立回答，用一个裁判模型选出最好的，或取共识
适用场景：对质量要求高、对延迟不敏感的任务
成本：N 倍 token 消耗 + 1 次裁判评估
效果：质量提升 5-15%，但成本翻 N 倍
```

**反思控制机制（防止反思无限循环）：**
```python
class ReflectionController:
    def __init__(self, max_iterations=3, improvement_threshold=0.05):
        self.max_iterations = max_iterations
        self.threshold = improvement_threshold

    def should_continue(self, iteration: int, prev_score: float, current_score: float) -> bool:
        if iteration >= self.max_iterations:
            return False
        if (current_score - prev_score) < self.threshold:
            return False  # 边际收益太小，停止反思
        return True
```
**经验值**：大多数场景下，2 次反思已接近边际收益上限。第 3 次反思的改善通常 <3%。

**加分项：** 介绍"经验蒸馏（Experience Distillation）"——将反思日志积累到一定量后，用 SFT 微调模型，将隐式的经验转化为模型的内在能力，从"每次都要反思修正"变成"第一次就做对"。这是从"Agent 系统层面的修正"到"模型能力层面的修正"的质变。

---

## Q8：上下文超出限制时的处理机制（截断之外的策略）？

### 考察点
考察候选人对上下文窗口溢出问题的系统性解决方案，特别是除简单截断之外的工程化处理能力。

### 解答思路
1. 分类：主动管理（预防溢出）和被动处理（溢出后处理）
2. 列举所有可用策略及其适用场景、优缺点
3. 给出组合策略（多层防线）的架构设计

### 参考答案

**策略全家福（从预防到兜底）：**

**第一层：预防——不要让上下文逼近上限（主动管理）**

| 策略 | 原理 | 压缩率 | 信息损失 |
|------|------|--------|----------|
| 摘要压缩 | 用 LLM 将长对话总结为结构化摘要 | 70-90% | 中（丢失精确文本） |
| 文件折叠 | 只展开当前编辑区，已处理好部分折叠为摘要 | 50-80% | 低（结构化的） |
| 工具结果截断 | 返回结果只保留头部 + 统计摘要 | 60-90% | 低（保持关键信息） |
| 引用去重 | 同一文件多次读取时后续引用用简记符 | 30-50% | 很低 |
| 任务分解隔离 | 大任务拆成小任务，每个任务 context 独立 | N/A | 低（但需衔接成本） |

**第二层：压缩——在接近上限时执行（被动激活）**

当 token 计数达到阈值的 80% 时自动触发：

```python
class ContextBudgetManager:
    def __init__(self, max_tokens=200_000, warning_threshold=0.8):
        self.max_tokens = max_tokens
        self.warning = max_tokens * warning_threshold

    def manage(self, messages: List[Message]) -> List[Message]:
        current = count_tokens(messages)
        if current < self.warning:
            return messages  # 无需处理

        # 渐进式压缩策略
        strategies = [
            self.collapse_tool_outputs,      # Step 1: 对超长工具输出做截断
            self.summarize_old_turns,         # Step 2: 对超过 N 轮的对话做摘要
            self.deduplicate_references,      # Step 3: 合并重复引用
            self.drop_low_priority_messages,  # Step 4: 丢弃低优先级消息（兜底）
        ]
        for strategy in strategies:
            messages = strategy(messages)
            if count_tokens(messages) <= self.warning:
                break
        return messages
```

**第三层：分片（Chunking / Parallel Decomposition）——大任务的拆解**

```
大任务：分析整个 monorepo 中所有微服务的依赖关系
（需要读取 500+ 个文件，远超 context window）

拆解策略：
  Step 1: 列出所有服务目录（Glob 工具）
  Step 2: 将服务列表分成 10 个 batch，每个 batch 50 个服务
  Step 3: 对每个 batch 独立启动子 Agent：
    - 每个子 Agent 的 context: batch 内的服务 package.json + 依赖文件
    - 子 Agent 输出: 该 batch 内的依赖图（JSON 格式）
  Step 4: 汇总子 Agent 输出，生成全局依赖图
  Step 5: 此时全局依赖图可能只有 5000 tokens，完全在 context 内
```

**第四层：分步执行（Sequential Chunking）——顺序依赖的任务**

```
大任务：重构一个 3000 行的文件
策略：自顶向下分步执行

  Step 1: 分析文件结构，生成重构计划（此时只需要文件大纲，不需要全部内容）
  Step 2: 执行第 1-3 步重构（context 中只保留：计划 + 修改的片段 + 周围 20 行上下文）
  Step 3: 执行第 4-6 步重构（context 重置，只保留：计划 + 新片段 + 已完成部分的摘要）
  ...
```
关键设计：每步开始前，从前一步的 checkpoint 中提取"当前状态"，而非携带全部历史。

**第五层：层级化处理（Hierarchical Processing）——用 Map-Reduce 范式**

```
原始数据: 10000 条日志记录
直接塞入 context: 超出限制

Map 阶段:
  [1000 条日志] -> LLM 子请求 -> "这 1000 条日志中有 23 条 ERROR，主要问题：连接超时、OOM"
  [1000 条日志] -> LLM 子请求 -> "这 1000 条日志中有 5 条 ERROR，健康检查失败"
  ...（10 个并行子请求）

Reduce 阶段:
  将 10 个子摘要组装: "总计 47 条 ERROR，类型分布：连接超时 30 条、OOM 12 条、健康检查 5 条"
  Reduce 上下文: 约 2000 tokens（远低于限制）
```

**第六层：任务降级（Graceful Degradation）——实在处理不了时**

```python
def handle_task_overflow(task, context_limit):
    # 1. 尝试用简化版方案
    simplified_result = run_with_simplified_tools(task, limit=context_limit)
    # 2. 如果还不行，返回部分结果 + 未完成部分
    partial_result = {
        "completed": ["Step 1", "Step 2"],
        "partial": "Step 3 已完成 60%",
        "not_started": ["Step 4", "Step 5"],
        "recommendation": "建议将任务拆分为以下子任务后逐一处理: ..."
    }
    return partial_result
```

**组合防线架构：**
```
输入 -> [防线1: 预算检查 & 任务分解] -> [防线2: 优先级压缩] -> [防线3: 分片处理] -> [防线4: 降级返回] -> 输出
         (token < 40% 上限)           (token < 80% 上限)    (token < 100% 上限)  (token 严重超标)
```

**加分项：** 介绍"上下文迁移"（Context Migration）——当上下文确实放不下时，将当前状态序列化为结构化的 checkpoint，然后启动一个新的 context session，只注入 checkpoint + 当前子任务。相当于 Agent 的"换脑"操作，旧大脑把关键信息传给新大脑。以及"预测性上下文预取"——根据执行计划提前预测未来几步需要哪些信息，将不需要的主动清除、将即将需要的提前准备。

---

## Q9：LangGraph 的 Graph 结构三要素（State/Node/Edge）的定义与职责边界？

### 考察点
考察候选人对 LangGraph 核心抽象的准确理解，能否用 State/Node/Edge 描述任意复杂的工作流。

### 解答思路
1. 分别定义三要素的职责和设计原则
2. 说明它们如何协作构成完整的图执行模型
3. 给出一个从简单到复杂的示例

### 参考答案

**三要素核心定义：**

**State（状态）——图的"记忆"**

State 是贯穿整个图执行过程的共享数据结构，它定义了图的"数据类型"。

```python
from typing import TypedDict, Annotated
from langgraph.graph.message import add_messages

class AgentState(TypedDict):
    messages: Annotated[list, add_messages]  # 对话历史（累加器）
    next_step: str                           # 下一步要执行的节点
    result: Optional[str]                    # 最终结果
    error_count: int                         # 错误计数器
```

**State 的职责边界：**
- **负责**：在节点间传递数据、保持执行过程中的状态一致性
- **不负责**：业务逻辑（那是 Node 的职责）、控制流（那是 Edge 的职责）
- **关键约束**：State 应该是**不可变的**（函数式更新）、所有字段必须可序列化（支持 checkpoint）
- **Reducers（累加器）**：通过 `Annotated[type, reducer]` 定义字段的合并策略（如 `add_messages` 追加而非覆盖）

**Node（节点）——图的"计算单元"**

Node 是无状态函数，接收 State，返回 State 的部分更新。

```python
def agent_node(state: AgentState) -> dict:
    """LLM 推理节点：根据当前状态生成下一步行动"""
    response = llm_with_tools.invoke(state["messages"])
    return {"messages": [response]}

def tool_node(state: AgentState) -> dict:
    """工具执行节点：执行 LLM 请求的工具调用"""
    last_message = state["messages"][-1]
    tool_results = []
    for tool_call in last_message.tool_calls:
        result = execute_tool(tool_call)
        tool_results.append(ToolMessage(content=result, tool_call_id=tool_call["id"]))
    return {"messages": tool_results}
```

**Node 的职责边界：**
- **负责**：执行具体的计算逻辑（LLM 调用、工具执行、数据变换）
- **不负责**：决定下一步去哪（那是 Edge 的职责）、管理整体状态生命周期（那是 Graph compile 的职责）
- **关键约束**：Node 函数必须签名为 `(State) -> dict[str, Any]`、不能有副作用（或副作用要可控且可重放）
- **设计原则**：单一职责——一个 Node 只做一件事（读取一个文件、分析一段代码、生成一个回复）

**Edge（边）——图的"路由规则"**

Edge 定义了节点之间的流转关系，分为普通边和条件边。

```python
# 普通边：确定性流转
workflow.add_edge("tool_node", "agent_node")  # 工具执行后总是回到 agent 推理

# 条件边：基于状态的动态流转
def should_continue(state: AgentState) -> str:
    """条件函数：决定下一个节点"""
    last_message = state["messages"][-1]
    if hasattr(last_message, "tool_calls") and last_message.tool_calls:
        return "tools"  # 有工具调用，去执行工具
    if state["error_count"] >= 5:
        return "error_handler"  # 错误太多，去错误处理
    return END  # 任务完成，结束

workflow.add_conditional_edges("agent_node", should_continue, {
    "tools": "tool_node",
    "error_handler": "error_node",
    END: END
})
```

**Edge 的职责边界：**
- **负责**：基于当前 State 决定下一个要执行的 Node（路由逻辑）
- **不负责**：修改 State（那是 Node 的职责）、执行任何计算（那是 Node 的职责）
- **关键约束**：条件函数必须是纯函数 `(State) -> str`、必须覆盖所有可能的返回值（提供完整的路由映射表）

**三要素协作流程：**
```
[State 初始值]
    |
    v
[Entry Point] -> Edge: 从入口到第一个 Node
    |
    v
[Node: agent]  -> 读 State, 返回 {"messages": [...]} -> State 自动更新
    |
    v
[Conditional Edge: should_continue] -> 读更新后的 State，返回 "tools" 或 END
    |
    +-- "tools" -> [Node: tools] -> 读 State, 执行工具 -> State 更新
    |                                              |
    |                                              v
    |                                   [Edge] -> [Node: agent] (循环)
    |
    +-- END -> [图执行结束]
```

**一个完整的示例（ReAct Agent）：**
```python
from langgraph.graph import StateGraph, END

# 1. 定义 State
class ReActState(TypedDict):
    messages: Annotated[list, add_messages]

# 2. 构建图
workflow = StateGraph(ReActState)

# 3. 添加节点
workflow.add_node("agent", call_model)      # LLM 推理
workflow.add_node("tools", execute_tools)   # 工具执行

# 4. 设置入口
workflow.set_entry_point("agent")

# 5. 添加条件边（循环的关键）
workflow.add_conditional_edges(
    "agent",
    should_continue,  # 条件函数
    {"tools": "tools", END: END}  # 路由表
)
workflow.add_edge("tools", "agent")  # 工具执行后回到 agent（循环边）

# 6. 编译
app = workflow.compile()
```

**加分项：** State 的 reducer 机制是 LangGraph 最精妙的设计之一。理解 `add_messages` 如何自动追加（而非覆盖）消息列表、如何自定义 reducer 实现复杂的状态合并逻辑（如"保留最大值"、"取并集"），是区分入门和深入的关键。

---

## Q10：LangGraph 中 State 的不可变性为什么重要？直接修改 State 会有什么问题？

### 考察点
考察候选人对 LangGraph 内部机制的深入理解，特别是函数式编程范式在状态管理中的工程价值。

### 解答思路
1. 解释 LangGraph 的状态更新机制（函数返回 partial update + reducer 合并）
2. 说明不可变性的四个价值点
3. 给出直接修改的后果和排查难度

### 参考答案

**LangGraph 的状态更新机制：**

LangGraph 采用**函数式状态更新**模式。每个 Node 的返回值是一个 `dict`（包含部分字段的更新），LangGraph 运行时将其与现有 State 通过 reducer 合并：

```python
# 正确的函数式更新
def my_node(state: AgentState) -> dict:
    # 返回部分更新，不修改 state 本身
    return {"messages": [new_message], "counter": state["counter"] + 1}

# 错误的命令式修改
def bad_node(state: AgentState) -> dict:
    state["messages"].append(new_message)  # 危险！直接修改了 state
    state["counter"] += 1                   # 危险！直接修改了 state
    return {}
```

**State 使用 `Annotated` + `reducer` 的底层逻辑：**
```python
# add_messages reducer 的实现原理
def add_messages(existing: list, new: list) -> list:
    return existing + new  # 追加而非覆盖
```

实际执行时，LangGraph 的运行时逻辑大致是：
```python
def _apply_update(state: State, node_return: dict) -> State:
    for key, new_value in node_return.items():
        reducer = state_schema.__metadata__[key].get("reducer")
        if reducer:
            state[key] = reducer(state[key], new_value)
        else:
            state[key] = new_value  # 没有 reducer 则覆盖
    return state
```

**不可变性的四大价值：**

**价值 1：Checkpoint 可重放**
```python
# 如果 state 是不可变的，每个 checkpoint 是一个完整的快照
checkpoint_t0 = deepcopy(state)  # 可安全存储，不会被后续操作污染
# 中断恢复时：
resume_state = load_checkpoint(checkpoint_id)  # 100% 还原到当时的精确状态
```
如果 Node 内部直接修改了 state，checkpoint 记录的引用会指向被修改后的值，恢复时状态不一致。

**价值 2：时间旅行和分支**
```python
# LangGraph 支持从任意 checkpoint 分叉执行
forked_app = app.compile(checkpoint_id="step_3")
result_a = forked_app.invoke(initial_state, config={"thread_id": "branch_a"})
result_b = forked_app.invoke(initial_state, config={"thread_id": "branch_b"})
# 如果 state 不可变，fork 出的两个分支完全独立，互不干扰
```
直接修改 state 会导致两个分支共享同一个被污染的对象，结果不可预测。

**价值 3：并发执行安全**
```python
# LangGraph 支持 Send API 实现并行节点
def fan_out(state):
    return [Send("process_item", {"item": item}) for item in state["items"]]

# 如果 state 不可变，8 个并行 Node 各自拥有独立的 state 副本
# 如果可变，8 个并行 Node 可能互相覆盖对方的更新
```

**价值 4：调试和可观测性**
```python
# 不可变 state 让每个步骤的输入输出都可追踪
for step in trace:
    state_before = step.state_before  # Node 执行前的状态快照
    node_output = step.node_output    # Node 返回的部分更新
    state_after = step.state_after   # 应用更新后的状态快照
```
如果 Node 内部偷偷修改了 state，就会出现 `state_after != apply(state_before, node_output)` 的诡异现象，极难排查。

**直接修改 State 的常见后果：**

1. **数据丢失**：消息列表中本应保留的历史消息被意外覆盖
2. **Checkpoint 损坏**：保存的 checkpoint 包含指向被修改对象的引用，重新加载后状态是错误的
3. **多分支污染**：fork 出的多个分支共享同一份 state 对象，互相串扰
4. **调试困难**：trace 中看到的状态变更与实际不符，找不到 root cause

**一条实用规则：永远在函数中返回新的值对象，不要修改传入的对象。**

```python
# 正确模式
def correct_node(state):
    new_list = list(state["items"])  # 创建副本
    new_list.append(new_item)        # 修改副本
    return {"items": new_list}       # 返回新值
```

**加分项：** 理解 Python 中 shallow copy vs. deep copy 在 State 更新中的影响。如果 State 中嵌套了可变对象（如 dict 的 list），返回 `{"nested_field": modified_dict}` 时需要确保 modified_dict 是新对象。推荐使用 Pydantic 或 frozen dataclass 在类型层面强制不可变性。

---

## Q11：LangGraph 的条件边（Conditional Edge）怎么用？条件函数怎么写？

### 考察点
考察候选人对 LangGraph 动态路由机制的掌握程度，尤其是条件函数的编写技巧。

### 解答思路
1. 说明条件边的定义和作用
2. 展示条件函数的签名、返回值约定、常见模式
3. 给出复杂路由场景（多层判断、多路分支、动态路由映射）的示例

### 参考答案

**条件边的基本定义：**

条件边允许基于 State 的当前值动态决定下一个要执行的节点，是实现循环、分支、异常处理的核心机制。

```python
workflow.add_conditional_edges(
    source="source_node",           # 从哪个节点出发
    path=condition_function,        # 条件函数: (State) -> str
    path_map={                      # 路由映射表: {返回值: 目标节点}
        "path_a": "node_a",
        "path_b": "node_b",
        END: END                    # 返回 END 终止执行
    }
)
```

**条件函数的签名和约定：**
```python
def condition_function(state: StateType) -> str:
    """
    参数: state - 当前图的状态（只读）
    返回: str - path_map 中的某个 key，或 "__end__"（等同于 END）
    
    约定：
    1. 函数必须是纯函数（相同输入 -> 相同输出），不修改 state
    2. 返回值必须覆盖在 path_map 中定义的某个 key
    3. 如果可能返回未在 path_map 中定义的 key，使用 Literal 类型或动态路由
    """
    pass
```

**常见模式：**

**模式 1：二元分支（最常用）**
```python
def should_continue(state: AgentState) -> str:
    """有工具调用则执行工具，否则结束"""
    last_msg = state["messages"][-1]
    if hasattr(last_msg, "tool_calls") and last_msg.tool_calls:
        return "tools"
    return END

workflow.add_conditional_edges("agent", should_continue, {
    "tools": "tool_node",
    END: END
})
```

**模式 2：多路分支（基于状态的精确路由）**
```python
def route_by_intent(state: AgentState) -> Literal["search", "code", "image", "default"]:
    """根据用户意图路由到不同的处理器"""
    last_user_msg = [m for m in state["messages"] if isinstance(m, HumanMessage)][-1]
    intent = classify_intent(last_user_msg.content)  # 意图分类器
    
    if intent == "search_documentation":
        return "search"
    elif intent == "generate_code":
        return "code"
    elif intent == "generate_image":
        return "image"
    else:
        return "default"

workflow.add_conditional_edges("router", route_by_intent, {
    "search": "search_handler",
    "code": "code_handler",
    "image": "image_handler",
    "default": "fallback_handler"
})
```

**模式 3：循环终止检测（含多条件）**
```python
def decide_next(state: AgentState) -> str:
    """决定继续循环还是结束，包含多重终止条件"""
    # 条件 1: 达到最大步数
    if state["step_count"] >= state["max_steps"]:
        return "summarize_and_end"
    
    # 条件 2: 连续失败
    if state["consecutive_errors"] >= 3:
        return "error_handler"
    
    # 条件 3: 循环检测
    if detect_loop(state["action_history"]):
        return "loop_detected"
    
    # 条件 4: LLM 自行判断完成
    last_msg = state["messages"][-1]
    if "FINAL ANSWER" in last_msg.content:
        return END
    
    # 条件 5: 仍有工具待执行
    return "continue"

workflow.add_conditional_edges("agent", decide_next, {
    "continue": "tool_executor",
    "summarize_and_end": "summarizer",
    "error_handler": "error_node",
    "loop_detected": "loop_handler",
    END: END
})
```

**模式 4：带动态 fallback 的条件路由**
```python
def route_with_fallback(state: AgentState) -> str:
    node_name = state.get("next_node")
    # 检查目标节点是否在当前图中注册过
    if node_name in VALID_NODE_NAMES:
        return node_name
    return "unknown_handler"  # 兜底处理
```

**模式 5：条件边链式组合（决策树）**
```python
def first_level(state):
    if state["score"] > 0.8:
        return "high_quality"
    return "needs_review"

def second_level(state):
    if state["type"] == "critical":
        return "urgent_review"
    return "normal_review"

workflow.add_conditional_edges("evaluator", first_level, {
    "high_quality": "direct_publish",
    "needs_review": "quality_gate"  # 进入第二层判断
})
workflow.add_conditional_edges("quality_gate", second_level, {
    "urgent_review": "human_review",
    "normal_review": "auto_fix"
})
```

**条件函数编写最佳实践：**

1. **单一条件来源**：每个条件函数只基于 State 的一个方面做决策（如 tool_calls 是否存在）
2. **失败的默认行为**：条件函数遇到未知状态时，应该有明确的默认路由（通常是 END 或 fallback node）
3. **类型标注**：使用 `Literal["a", "b", "c"]` 标注返回值，获得 IDE 的自动补全和类型检查
4. **避免复杂计算**：条件函数应该轻量，复杂计算放在 Node 中，将结果写入 State，条件函数基于 State 中的结果做路由
5. **可测试性**：条件函数是纯函数，应该可以不依赖图运行时进行单独单元测试

**加分项：** 展示 `Send` API 实现动态并行——条件函数不仅返回字符串，还可以返回 `List[Send]`，实现 fan-out 并行：
```python
def continue_to_jokes(state: OverallState):
    return [Send("generate_joke", {"subject": s}) for s in state['subjects']]
```
这表明 LangGraph 的条件路由不仅有分支能力，还有动态并行能力，远超传统的 DAG 工作流引擎。

---

## Q12：LangGraph Checkpoint 持久化机制是什么？支持哪些存储后端？

### 考察点
考察候选人对 LangGraph 持久化层的理解，能否根据场景选择合适的存储方案。

### 解答思路
1. 说明 Checkpoint 的工作原理（保存什么、什么时候保存）
2. 列举支持的存储后端及适用场景
3. 讨论 Checkpoint 的高级用法（时间旅行、分支、中断恢复）

### 参考答案

**Checkpoint 机制原理：**

LangGraph 在每个超级步（superstep）执行完后自动保存 State 的快照。所谓的超级步，是从一个 Node 执行到下一个 Node 之间的完整状态变更。

```
执行流程: Node A -> Edge -> Node B -> Edge -> Node C

Checkpoint 保存时机:
  [初始 State] -> CP0（入口）
  [Node A 执行后] -> CP1
  [Node B 执行后] -> CP2
  [Node C 执行后] -> CP3（最终）
```

每个 checkpoint 包含：
```python
{
    "v": 1,                           # Checkpoint 版本号
    "id": "1ef7d...",                 # Checkpoint 唯一 ID
    "ts": "2024-01-15T10:30:00Z",    # 时间戳
    "channel_values": {               # State 各字段的值
        "messages": [...],
        "next_step": "tools",
        "result": None
    },
    "channel_versions": {             # 每个 channel 的版本号
        "messages": 5,
        "next_step": 3
    },
    "versions_seen": {                # 父节点和触发节点
        "__input__": {},
        "agent_node": {"messages": 3},
    },
    "pending_sends": []               # 待处理的 Send 消息
}
```

**存储后端对比：**

| 后端 | 类型 | 适用场景 | 持久化 | 分布式 |
|------|------|----------|--------|--------|
| **MemorySaver** | 内存 (dict) | 开发调试、单元测试 | 否（进程重启丢失） | 否 |
| **SqliteSaver** | SQLite 文件 | 单机生产、小规模部署 | 是 | 否 |
| **PostgresSaver** | PostgreSQL | 生产环境、多实例 | 是 | 是 |
| **AsyncPostgresSaver** | PostgreSQL (async) | 异步应用、高并发 | 是 | 是 |

**使用示例：**

```python
from langgraph.checkpoint.memory import MemorySaver
from langgraph.checkpoint.sqlite import SqliteSaver
from langgraph.checkpoint.postgres import PostgresSaver

# 1. 开发调试 — 进程内内存
memory = MemorySaver()
app = workflow.compile(checkpointer=memory)

# 2. 单机生产 — SQLite
with SqliteSaver.from_conn_string("checkpoints.db") as sqlite_saver:
    app = workflow.compile(checkpointer=sqlite_saver)

# 3. 分布式生产 — PostgreSQL
DB_URI = "postgresql://user:pass@localhost:5432/langgraph"
with PostgresSaver.from_conn_string(DB_URI) as pg_saver:
    pg_saver.setup()  # 创建必要的表
    app = workflow.compile(checkpointer=pg_saver)
```

**配置 thread_id 实现会话隔离：**
```python
# 每个 thread_id 拥有独立的 checkpoint 链
config = {"configurable": {"thread_id": "user-session-123"}}

# 第一次执行
result1 = app.invoke(initial_state, config)
# 同一个 thread_id，后续调用会从上次的 checkpoint 继续
result2 = app.invoke({"messages": [HumanMessage("继续分析")]}, config)
```

**高级用法：**

**1. 时间旅行（Time Travel）——从历史 checkpoint 重放**
```python
# 获取执行历史
history = list(app.get_state_history(config))

# 从指定 checkpoint 重新开始
resume_config = config.copy()
resume_config["configurable"]["checkpoint_id"] = history[3].config["configurable"]["checkpoint_id"]
result = app.invoke(None, resume_config)  # 从第 4 步分叉
```

**2. 中断与恢复（Human-in-the-Loop）**
```python
# 编译时设置在某个 Node 之前中断
app = workflow.compile(
    checkpointer=memory,
    interrupt_before=["dangerous_tool"]  # 执行前暂停等待人工确认
)

# 执行到 dangerous_tool 前自动暂停
result = app.invoke(initial_state, config)
# result 是中断时的状态

# 人工确认后继续执行
app.invoke(None, config)  # 传入 None 表示继续
```

**3. 分支执行（Fork and Resume）**
```python
# 从 checkpoint 分叉出多个分支
base_checkpoint = list(app.get_state_history(config))[3]

fork_a_config = {"configurable": {"thread_id": "fork-a", "checkpoint_id": base_checkpoint.config["checkpoint_id"]}}
fork_b_config = {"configurable": {"thread_id": "fork-b", "checkpoint_id": base_checkpoint.config["checkpoint_id"]}}

result_a = app.invoke(None, fork_a_config)  # 分支 A，独立执行
result_b = app.invoke(None, fork_b_config)  # 分支 B，独立执行
```

**存储后端的内部实现（以 SqliteSaver 为例）：**

```sql
-- LangGraph 自动创建的表结构
CREATE TABLE checkpoints (
    thread_id TEXT NOT NULL,
    checkpoint_ns TEXT NOT NULL DEFAULT '',
    checkpoint_id TEXT NOT NULL,
    parent_checkpoint_id TEXT,
    type TEXT,
    checkpoint BLOB,  -- 序列化的 Checkpoint 对象
    metadata BLOB,    -- 附加元数据
    PRIMARY KEY (thread_id, checkpoint_ns, checkpoint_id)
);

CREATE TABLE writes (
    thread_id TEXT NOT NULL,
    checkpoint_ns TEXT NOT NULL DEFAULT '',
    checkpoint_id TEXT NOT NULL,
    task_id TEXT NOT NULL,
    idx INTEGER NOT NULL,
    channel TEXT NOT NULL,
    type TEXT,
    value BLOB,
    PRIMARY KEY (thread_id, checkpoint_ns, checkpoint_id, task_id, idx)
);
```

**加分项：** 讨论 checkpoint 的选择性序列化——并非所有 State 字段都需要持久化，可以使用 `checkpoint=False` 标记不需要持久化的字段（如临时缓冲区、大文件内容），减少存储开销。另外可以讨论自定义 checkpoint adapter，将 checkpoint 存储到 Redis 或对象存储中，适配不同的基础设施。

---

## Q13：LangGraph vs LangChain Chain 的最大区别是什么？

### 考察点
考察候选人对这两个框架的架构级理解，能否从控制流、状态管理、适用场景等维度做出准确判断。

### 解答思路
1. 从控制流模型切入：线性链 vs. 有向图
2. 从状态管理、循环支持、可观测性等维度做系统性对比
3. 给出选型决策矩阵和实际项目中的组合使用建议

### 参考答案

**本质区别：控制流模型完全不同**

- **LangChain Chain**：基于**有向无环图（DAG / Pipeline）**模型，数据按预定义的线性管道流动
- **LangGraph**：基于**有向有环图（Cyclic Graph / 状态机）**模型，支持循环、条件跳转、动态路由

**系统性对比：**

| 维度 | LangChain Chain | LangGraph |
|------|----------------|-----------|
| **控制流模型** | 管道式（Pipeline），预定义线性顺序 | 状态机式（State Machine），支持循环和分支 |
| **循环支持** | 不支持（需要手动 while 循环包裹） | 原生支持（条件边 + 循环边） |
| **状态管理** | 隐式，通过链式调用的参数传递 | 显式 State 对象，支持 reducer 合并策略 |
| **分支/路由** | 有限（RouterChain、条件路由） | 原生支持（add_conditional_edges） |
| **人类介入** | 需自行实现 | 原生支持（interrupt_before/after） |
| **并行执行** | 有限（RunnableParallel） | 原生支持（Send API，fan-out） |
| **持久化** | 无内置 checkpointer | 内置 checkpoint 系统（支持 4 种后端） |
| **时间旅行** | 不支持 | 支持（从任意 checkpoint 重放） |
| **流式输出** | 支持（astream_events） | 更细粒度（每个 Node 可独立配置流式） |
| **学习曲线** | 低（声明式 API） | 中（需要理解状态机概念） |
| **代码量** | 少（管道拼接） | 多（需要定义 State/Node/Edge） |
| **灵活性** | 低（固定管道） | 高（图灵完备的控制流） |

**代码对比：**

同一个任务的两种实现——"查询天气，如果温度高则推荐避暑地点"：

**LangChain（管道式，无循环）：**
```python
# 只能线性执行：查询 -> 判断（需手动 if-else） -> 推荐
chain = (
    RunnablePassthrough.assign(weather=lambda x: weather_tool(x["city"]))
    | RunnablePassthrough.assign(
        result=lambda x: (
            recommend_tool(x["weather"])
            if x["weather"]["temp"] > 35
            else f"温度{x['weather']['temp']}度，不需要额外推荐"
        )
    )
)
# 问题：如果 recommend_tool 失败，无法自动重试
# 如果 weather_tool 需要修正参数，无法循环
```

**LangGraph（状态机，有循环）：**
```python
def agent(state):
    response = llm_with_tools.invoke(state["messages"])
    return {"messages": [response]}

def should_continue(state):
    last_msg = state["messages"][-1]
    if hasattr(last_msg, "tool_calls"):
        return "tools"
    return END

workflow = StateGraph(AgentState)
workflow.add_node("agent", agent)
workflow.add_node("tools", tool_executor)
workflow.set_entry_point("agent")
workflow.add_conditional_edges("agent", should_continue, {"tools": "tools", END: END})
workflow.add_edge("tools", "agent")  # 循环边：工具结果返回给 agent

app = workflow.compile()
# Agent 可以循环：查天气 -> 结果分析 -> 决定是否推荐 -> 推荐 -> 返回
# 如果天气 API 调用失败，LLM 可自行修正参数重试
```

**选型决策矩阵：**

| 场景 | 推荐框架 | 理由 |
|------|----------|------|
| RAG 流水线（检索->重排->生成） | LangChain Chain | 流程固定，无循环需求 |
| 简单的 Prompt 串联 | LangChain Chain | 代码最少 |
| 需要循环的 ReAct Agent | LangGraph | Chain 不支持循环 |
| Multi-Agent 协作 | LangGraph | 需要复杂路由和状态共享 |
| 需要人类审批的工作流 | LangGraph | interrupt_before/after |
| 需要从错误中恢复 | LangGraph | 循环 + checkpoint 恢复 |
| 需要分支执行的复杂决策 | LangGraph | 条件边 |
| 快速原型验证 | LangChain Chain | 开发最快 |

**实际项目中的组合使用——推荐的架构分层：**

```
┌─────────────────────────────────────────┐
│  控制流层 (Orchestration)               │
│  LangGraph: Graph / State / Edge        │  ← 精确控制执行流程
├─────────────────────────────────────────┤
│  组件层 (Building Blocks)               │
│  LangChain: ChatModel / Prompt / Tool   │  ← 复用成熟组件
├─────────────────────────────────────────┤
│  基础设施层 (Infrastructure)             │
│  自研: 监控 / 日志 / 限流 / 认证         │
└─────────────────────────────────────────┘
```

LangGraph 底层严重依赖 LangChain 的组件（LLM 封装、Tool 定义、Prompt 模板），两者不是竞争而是互补。LangGraph 负责"怎么执行"（控制流），LangChain 负责"用什么组件"（构件）。

**加分项：** 讨论两者的流式（streaming）差异。LangChain 的 `astream_events` 是事件驱动的流式（每个中间步骤都发出事件），LangGraph 的流式支持按 Node 粒度配置（可以选择只监听特定 Node 的输出，或监听 State 的每次变更）。多 Agent 场景下，LangGraph 的 Node 级流式控制更有价值——可以选择只向用户展示某个特定 Agent Node 的输出，隐藏中间工具调用细节。

---

## Q14：Harness 层的四大职责（调度/监控/错误隔离/上下文注入）分别怎么做？

### 考察点
考察候选人对 Agent 基础设施层的设计能力，特别是将横切关注点系统化的工程素养。

### 解答思路
1. 先定义 Harness 层的定位（Agent 运行时的"管家"）
2. 逐一展开四大职责的技术方案
3. 给出 Harness 层与 Agent 逻辑层的交互架构

### 参考答案

**Harness 层的定位：**

Harness 是 Agent 运行时和底层基础设施之间的"薄中间层"，负责所有横切关注点（Cross-cutting Concerns）。Agent 核心逻辑不需要感知 Harness 的存在——Agent 只关心"思考什么、调用什么工具"，Harness 负责"怎么安全地让这些事情发生"。

**架构图：**
```
┌─────────────────────────────────────┐
│  Agent Core（推理 + 决策 + 执行）      │
├─────────────────────────────────────┤
│  Harness Layer（横切关注点）          │
│  ┌──────────┬──────────┬──────────┐ │
│  │  调度器   │  监控器   │ 错误隔离  │ │
│  ├──────────┴──────────┴──────────┤ │
│  │       上下文注入引擎            │ │
│  └───────────────────────────────┘ │
├─────────────────────────────────────┤
│  Infrastructure（LLM API / 工具 / DB）│
└─────────────────────────────────────┘
```

**职责 1：调度（Scheduling / Orchestration）**

核心目标：管理 Agent 执行的生命周期和多实例并发。

```python
class AgentScheduler:
    def __init__(self):
        self.task_queue = asyncio.Queue()     # 任务队列
        self.active_agents = {}               # 活跃 Agent 实例
        self.max_concurrency = 10             # 并发上限

    async def schedule(self, task: AgentTask):
        # 1. 优先级排序
        priority = self.calculate_priority(task)  # 用户等级、紧急度、预估耗时

        # 2. 资源控制
        if len(self.active_agents) >= self.max_concurrency:
            await self.task_queue.put((priority, task))
            return

        # 3. 启动执行
        agent_id = await self.spawn_agent(task)

    async def spawn_agent(self, task):
        # 隔离的执行上下文（独立 session、独立上下文窗口）
        session = self.create_session(task)
        agent = AgentRunner(task, session)
        self.active_agents[agent.id] = agent
        try:
            result = await agent.run()
        finally:
            del self.active_agents[agent.id]
            # 如果有排队任务，释放资源给下一个
```

关键设计决策：
- **任务排队策略**：FIFO（简单）vs. Priority Queue（差异化服务）vs. Deadline-aware（保障 SLA）
- **超时熔断**：预估 token 消耗和时间，超过上限强制终止，避免单个任务霸占资源
- **负载均衡**：多模型 endpoint 间的请求分发（round-robin / least-connections / 按模型能力路由）

**职责 2：监控（Monitoring / Observability）**

核心目标：让 Agent 的执行过程完全可观测，出问题时快速定位。

```python
class AgentMonitor:
    def __init__(self):
        self.metrics = MetricsCollector()  # Prometheus / Datadog
        self.tracer = Tracer()             # OpenTelemetry

    @contextmanager
    def trace_step(self, step_name: str, tags: dict):
        """包装每一步执行，记录耗时、token、异常"""
        span = self.tracer.start_span(step_name, attributes=tags)
        start = time.time()
        try:
            yield span
            duration = time.time() - start
            span.set_attribute("duration_ms", duration * 1000)
            span.set_attribute("status", "success")
        except Exception as e:
            span.set_attribute("status", "error")
            span.set_attribute("error", str(e))
            self.metrics.increment("agent.step.error", tags={"step": step_name, "error": type(e).__name__})
            raise
        finally:
            span.end()

# 监控的核心指标
METRICS = {
    "agent.task.duration": "任务总耗时",
    "agent.step.count": "执行步数",
    "agent.tool_call.count": "工具调用次数",
    "agent.tool_call.error_rate": "工具调用失败率",
    "agent.llm.token_usage": "LLM Token 用量",
    "agent.llm.latency_p50/p95/p99": "LLM 调用延迟",
    "agent.loop.detected": "死循环检测次数",
    "agent.fallback.triggered": "降级策略触发次数",
}
```
关键设计：
- 每一步都要有 span（Agent step / LLM call / Tool execution / Memory retrieval）
- Span 之间通过 parent-child 关系形成完整的 trace tree
- 异常时的 span 要保留完整的 state snapshot 便于复现

**职责 3：错误隔离（Error Isolation）**

核心目标：一个 Agent 实例或一个工具的错误不能影响其他实例。

```python
class ErrorIsolator:
    def __init__(self):
        self.circuit_breakers = {}          # 断路器状态
        self.tool_health = defaultdict(list) # 工具健康度历史
        self.isolated_tools = set()         # 已隔离的工具

    async def execute_tool(self, tool_name: str, params: dict, agent_id: str):
        # 1. 断路器检查
        if tool_name in self.isolated_tools:
            raise ToolIsolatedError(f"Tool '{tool_name}' is isolated")

        # 2. 执行（带超时和资源隔离）
        try:
            result = await asyncio.wait_for(
                tool_executor.execute(tool_name, params, isolation_key=agent_id),
                timeout=30.0
            )
            self.tool_health[tool_name].append(("success", time.time()))
            return result
        except asyncio.TimeoutError:
            self.tool_health[tool_name].append(("timeout", time.time()))
            self.check_circuit_breaker(tool_name)
            raise
        except Exception as e:
            self.tool_health[tool_name].append(("error", time.time()))
            self.check_circuit_breaker(tool_name)
            raise

    def check_circuit_breaker(self, tool_name: str):
        """断路器逻辑：最近 10 次调用中失败超过 6 次则隔离"""
        recent = [s for s in self.tool_health[tool_name] if time.time() - s[1] < 300]
        failures = sum(1 for status, _ in recent if status != "success")
        if len(recent) >= 10 and failures >= 6:
            self.isolated_tools.add(tool_name)
            alert(f"CIRCUIT BREAKER OPEN: {tool_name} isolated for 5 minutes")
            # 5 分钟后自动恢复（half-open）
            asyncio.create_task(self.auto_recover(tool_name, delay=300))
```
关键设计模式：
- **Bulkhead 隔离**：每个 Agent 实例拥有独立的资源配额（内存、连接池），一个 Agent OOM 不影响其他
- **断路器（Circuit Breaker）**：Open -> Half-Open -> Closed 三态转换
- **错误传播边界**：Agent 内部的工具错误只影响当前任务步骤，不传播到 Harness 层

**职责 4：上下文注入（Context Injection）**

核心目标：在 Agent 每次 LLM 推理前，自动化地注入正确的上下文（记忆、环境信息、用户偏好）。

```python
class ContextInjector:
    def __init__(self, memory_manager, env_provider, config_provider):
        self.memory_manager = memory_manager
        self.env_provider = env_provider
        self.config_provider = config_provider

    async def inject(self, task: AgentTask, agent_config: dict) -> List[Message]:
        """在 Agent 推理前，自动化注入所有上下文"""
        context = []

        # 1. 环境上下文（每次推理前可能变化）
        env_info = await self.env_provider.get_context(task)
        context.append(SystemMessage(f"<env>\n{env_info}\n</env>"))

        # 2. 项目级上下文（静态，首次注入即可）
        if task.first_call:
            project_info = await self.config_provider.get_project_context(task)
            context.append(SystemMessage(f"<project>\n{project_info}\n</project>"))

        # 3. 用户记忆（动态检索）
            memories = await self.memory_manager.retrieve(
                user_id=task.user_id,
                query=task.description,
                memory_types=["user_profile", "preferences", "past_learnings"]
            )
            context.append(SystemMessage(f"<memory>\n{memories}\n</memory>"))

        # 4. 工具定义（动态注入，可以基于任务类型筛选工具集）
        tools = await self.config_provider.get_tools(task)
        context.append(SystemMessage(f"<tools>\n{self.format_tools(tools)}\n</tools>"))

        # 5. 行为准则（场景化选择）
        guidelines = await self.config_provider.get_guidelines(task.type)
        context.append(SystemMessage(guidelines))

        return context
```

关键设计：
- **分层注入**：项目级（一次）> 会话级（会话开始）> 请求级（每次推理）
- **增量注入**：不要让所有信息都在第一次推理就进来，根据执行进度逐步注入
- **Token 预算管理**：每种上下文类型的注入量有硬性 token 预算上限
- **标签化组织**：用 XML/HTML 标签（`<env>`, `<memory>`, `<tools>`）隔离不同上下文类型，帮助 LLM 结构化理解

**加分项：** 讨论 Harness 层的可插拔设计——将每个职责（调度/监控/隔离/注入）定义为独立的 Plugin，通过依赖注入组合，使得不同场景可以选择不同的实现（如本地开发的 LightweightMonitor vs. 生产环境的 DatadogMonitor）。同时讨论 Harness 层的"A/B 测试"能力——在调度层实现流量分裂，将 10% 流量导向新版本的 Agent 配置进行金丝雀测试。

---

## Q15：LangChain 的五大核心组件（Models/Prompts/Chains/Memory/Tools&Agents）是什么？

### 考察点
考察候选人对 LangChain 生态的全局理解，能否准确描述各组件的职责和典型用法。

### 解答思路
1. 逐一说明五大组件的定位和职责
2. 每个组件给出代码示例
3. 说明它们如何组合构建应用

### 参考答案

**五大核心组件全景：**

**1. Models（模型抽象层）——"大脑"**

提供统一的 LLM 调用接口，屏蔽不同厂商 API 的差异。

```python
from langchain_openai import ChatOpenAI
from langchain_anthropic import ChatAnthropic

# 统一的接口
llm = ChatOpenAI(model="gpt-4o", temperature=0)
# 或
llm = ChatAnthropic(model="claude-sonnet-4-20250514", temperature=0)

# 三种核心调用模式
response = llm.invoke("Hello")                    # 同步单次
response = await llm.ainvoke("Hello")             # 异步单次
async for chunk in llm.astream("Hello"):          # 流式输出
    print(chunk.content)
```

Models 组件包含三个子模块：
- **Chat Models**（聊天模型，最常用）：接收 Message 列表，返回 Message
- **LLMs**（传统补全模型）：接收文本，返回文本
- **Embeddings**（嵌入模型）：文本 -> 向量

**2. Prompts（提示词管理）——"配方"**

将 Prompt 从业务代码中解耦，实现版本化、参数化管理。

```python
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder

# 模板化 Prompt（支持参数化）
prompt = ChatPromptTemplate.from_messages([
    ("system", "你是 {role}，擅长 {domain}。"),
    MessagesPlaceholder("history"),  # 动态注入对话历史
    ("human", "{input}"),
])

# 参数填充
messages = prompt.invoke({
    "role": "资深后端工程师",
    "domain": "分布式系统设计",
    "history": [...],
    "input": "如何设计一个分布式锁？"
})

# Few-shot Prompt（含示例）
from langchain_core.prompts import FewShotChatMessagePromptTemplate
examples = [
    {"input": "排序一个列表", "output": "使用 sorted() 函数..."},
    {"input": "读取文件", "output": "使用 open() 函数..."},
]
few_shot_prompt = FewShotChatMessagePromptTemplate(
    examples=examples,
    example_prompt=ChatPromptTemplate.from_messages([
        ("human", "{input}"),
        ("ai", "{output}")
    ])
)
```

**3. Chains（链式组合）——"流水线"**

将多个组件串联为端到端的执行管道。

```python
from langchain_core.output_parsers import StrOutputParser

# LCEL 声明式链（现代写法）
chain = prompt | llm | StrOutputParser()
result = chain.invoke({"input": "什么是 RAG？"})

# 多步骤链（含检索）
rag_chain = (
    {"context": retriever, "question": RunnablePassthrough()}
    | prompt
    | llm
    | StrOutputParser()
)

# 并行链
from langchain_core.runnables import RunnableParallel
parallel_chain = RunnableParallel(
    summary=summary_chain,
    translation=translation_chain,
    tags=tagging_chain,
)
```

**4. Memory（记忆系统）——"对话的持久化"**

管理跨轮次的对话状态。

```python
from langchain.memory import ConversationBufferMemory, ConversationSummaryMemory

# 简单缓存记忆（保留全部历史）
buffer_memory = ConversationBufferMemory(return_messages=True)

# 摘要记忆（长对话自动压缩）
summary_memory = ConversationSummaryMemory(
    llm=llm,
    max_token_limit=2000,  # 摘要的 token 上限
    return_messages=True
)

# 记忆的读写
memory.chat_memory.add_user_message("我喜欢 Python")
memory.chat_memory.add_ai_message("好的，我会记住")
history = memory.load_memory_variables({})  # 加载为 Prompt 变量

# 结合 Chain 使用
chain_with_memory = (
    RunnablePassthrough.assign(history=lambda x: memory.load_memory_variables({})["history"])
    | prompt
    | llm
)
```

**5. Tools & Agents（工具与智能体）——"行动能力"**

赋予 LLM 调用外部工具的能力。

```python
from langchain_core.tools import tool

# 定义工具（函数式）
@tool
def weather(city: str) -> str:
    """查询指定城市的天气（当用户询问天气信息时使用）"""
    return f"{city} 今天晴天，25°C"

@tool
def calculator(expression: str) -> str:
    """执行数学计算（当用户需要复杂计算时使用）"""
    return str(eval(expression))

# Agent 创建
from langgraph.prebuilt import create_react_agent

agent = create_react_agent(
    model=llm,
    tools=[weather, calculator],
    prompt="你是乐于助人的助手，可以使用工具解决问题。"
)

result = agent.invoke({"messages": [HumanMessage("上海今天几度？25度的平方是多少？")]})
```

**组件协作全景图：**
```
用户输入
    |
    v
[Prompts] -- 格式化 System + User Message
    |
    v
[Memory] -- 注入对话历史
    |
    v
[Models] -- LLM 推理
    |
    +-- 需要调用工具? -> [Tools & Agents] -- 执行 -> [Models] -- 继续推理
    |
    v
[Chains] -- 组合为端到端管道（可选 Output Parser）
    |
    v
最终回答
```

**加分项：** 说明 LangChain 的组件生态策略——每个组件都是可替换的。今天用 OpenAI 的 GPT-4，明天可以切换到 Anthropic 的 Claude（Models 层抽象保证代码无需改动）。记住 LangChain 的定位是"Framework"而非"Library"——它提供了组件间的连接规范和最佳实践，但不会限制你的架构选择。

---

## Q16：LCEL（LangChain Expression Language）是什么？有什么优势？

### 考察点
考察候选人对 LangChain 核心 DSL 的理解，能否用 LCEL 优雅地表达复杂的管道逻辑。

### 解答思路
1. 先定义 LCEL 是什么（声明式的组件组合 DSL）
2. 通过代码展示 LCEL 的核心原语（管道、并行、分支、fallback）
3. 列出 LCEL 的核心优势（特别是自动流式传播和可观测性）

### 参考答案

**LCEL 定义：**

LCEL（LangChain Expression Language）是 LangChain 的声明式组件组合语言，用 `|`（管道）运算符将 Runnable 组件串联为执行图。它是 LangChain 从"命令式"到"声明式"架构转变的核心。

```python
# 传统命令式
def process(input):
    messages = prompt.format(input)
    response = llm.invoke(messages)
    return parser.parse(response)

# LCEL 声明式
chain = prompt | llm | parser
result = chain.invoke(input)
```

**核心原语：**

**1. 管道（`|`）——顺序组合**
```python
# 管道组合任意 Runnable
chain = retriever | prompt | llm | output_parser

# 管道的本质：chain = RunnableSequence(first=retriever, middle=[prompt, llm], last=output_parser)
# 数据流：retriever 的输出自动成为 prompt 的输入
```

**2. 并行（`RunnableParallel`）——同一输入并行处理**
```python
from langchain_core.runnables import RunnableParallel

chain = RunnableParallel(
    # 三个分支同时处理相同的输入
    summary=prompt_summary | llm | StrOutputParser(),
    translation=prompt_translate | llm | StrOutputParser(),
    sentiment=prompt_sentiment | llm | StrOutputParser(),
)

result = chain.invoke("这是一段很长的文章...")
# 返回: {"summary": "...", "translation": "...", "sentiment": "positive"}
```

**3. 条件分支（`RunnableBranch`）——基于输入的路由**
```python
from langchain_core.runnables import RunnableBranch

branch = RunnableBranch(
    (lambda x: "紧急" in x, urgent_prompt | llm),       # 条件 1
    (lambda x: len(x) > 1000, long_text_prompt | llm),   # 条件 2
    default_prompt | llm,                                  # 默认
)
```

**4. 动态配置（`RunnablePassthrough` + `RunnableLambda`）**
```python
from langchain_core.runnables import RunnablePassthrough, RunnableLambda

# RunnablePassthrough: 原样传递
chain = (
    {"context": retriever, "question": RunnablePassthrough()}
    | prompt | llm
)

# RunnableLambda: 自定义函数包装
chain = prompt | llm | RunnableLambda(lambda x: x.content.upper())
```

**5. Fallback（优雅降级）**
```python
# 主模型不可用时自动降级
fallback_chain = primary_llm.with_fallbacks([backup_llm, cache_llm])

# 整个管道的 fallback
robust_chain = chain.with_fallbacks([simplified_chain])
```

**6. 配置绑定（`with_config` / `.bind()`）——运行时参数注入**
```python
# 绑定模型参数
structured_chain = prompt | llm.bind(
    temperature=0,
    response_format={"type": "json_object"}
) | parser

# 运行时覆盖
result = structured_chain.with_config(
    configurable={"llm": "claude-haiku"}  # 动态切换模型
).invoke(input)
```

**LCEL 的六大核心优势：**

**优势 1：自动流式传播（Streaming）**
```python
# 不需要逐层手动实现流式，管道自动传播
async for chunk in chain.astream(input):
    print(chunk, end="", flush=True)
# 只要最底层的 LLM 支持流式，管道中的所有组件都会自动获得流式能力
```

**优势 2：内置可观测性（Observability）**
```python
# 自动与 LangSmith 集成，每个 chain 的调用都有完整的 trace
# 包括：输入、输出、延迟、token 消耗、每个子步骤的详细信息
# 无需额外埋点代码
```

**优势 3：异步并发（Async Support）**
```python
# 同一个 chain 同时支持同步和异步
result = chain.invoke(input)        # 同步
result = await chain.ainvoke(input) # 异步
# RunnableParallel 中的分支自动并行执行
```

**优势 4：批处理优化（Batching）**
```python
# 自动批处理，利用 LLM API 的 batch 能力
results = chain.batch([input1, input2, input3])
# 而非 for 循环逐条调用
```

**优势 5：中间结果访问（Intermediate Steps）**
```python
# 使用 with_listeners() 监听每个步骤
def log_step(step_name, output):
    print(f"[{step_name}]: {output}")

chain_with_logging = chain.with_listeners(on_end=lambda output: log_step)
# 或使用 astream_events 获取更细粒度的事件
```

**优势 6：类型安全和 IDE 友好**
```python
# LCEL chain 保留了输入输出类型信息
chain: Runnable[dict, str] = prompt | llm | StrOutputParser()
# IDE 可以推断 chain.invoke() 的参数类型和返回值类型
```

**实际复杂示例：**
```python
# 一个带 fallback、条件路由、并行的复杂 RAG chain
retrieval = RunnableParallel(
    vector_search=vector_retriever | reranker,
    keyword_search=keyword_retriever
) | (lambda x: deduplicate(x["vector_search"] + x["keyword_search"]))

answer_chain = (
    {"context": retrieval, "question": RunnablePassthrough()}
    | prompt
    | primary_llm.bind(temperature=0).with_fallbacks([backup_llm])
    | output_parser
    | RunnableLambda(validate_answer)  # 后处理
)

# 所有的流式、异步、可观测性、fallback 都自动生效
```

**LCEL 的设计哲学：**
- 每个组件都是 `Runnable`，有统一的接口：`.invoke()`, `.ainvoke()`, `.stream()`, `.batch()`
- 组合即设计：管道的结构就是系统架构
- 能力自动继承：每个组件继承其子组件的能力（流式、异步、回调）

**加分项：** 解释 `RunnableBinding` 和 `RunnableConfig` 机制——如何在 LCEL chain 中传递 runtime 配置（如 `thread_id`、`user_id`），而不需要在每个函数签名中显式声明。这是实现无侵入式追踪和用户隔离的关键。

---

## Q17：多轮对话中记忆冲突如何处理？

### 考察点
考察候选人在多轮交互场景下的记忆一致性管理能力，特别是冲突检测和解决策略。

### 解答思路
1. 先分析记忆冲突的四种典型场景
2. 给每种场景设计冲突解决策略
3. 最后给出一个综合性的冲突管理架构

### 参考答案

**记忆冲突的四种典型场景：**

**场景 1：用户信息自相矛盾**
```
第 3 轮：用户说 "我在北京工作"
第 8 轮：用户说 "每天早上坐高铁从天津到北京上班"
冲突：到底是住在北京还是天津？
```

**场景 2：偏好漂移**
```
第 1 轮：用户说 "回答尽量简洁"
第 20 轮：用户说 "给我详细解释一下"（对某个具体问题）
问题：当前的偏好应该是简洁还是详细？是全局偏好变化还是临时例外？
```

**场景 3：工具调用结果与历史记忆矛盾**
```
记忆：用户的 GitHub 用户名是 "alice123"
工具调用结果：GitHub API 返回用户已将用户名改为 "alice_dev"
冲突：记忆中的是旧值，工具返回的是最新值
```

**场景 4：多源记忆合并冲突**
```
向量检索返回：用户喜欢 TypeScript（来源：3 个月前的一次对话）
SQL 查询返回：用户最近项目使用 Python（来源：上周的项目记录）
冲突：应该推荐 TypeScript 还是 Python 方案？
```

**冲突解决策略矩阵：**

| 策略 | 适用场景 | 实现方式 | 风险 |
|------|----------|----------|------|
| **时效性优先** | 信息有明确时间戳 | 新数据覆盖旧数据 | 忽略用户回到旧偏好的可能 |
| **来源可信度加权** | 多源数据 | 工具返回值 > 用户陈述 > LLM 推断 | 工具可能出错 |
| **显式追问澄清** | 关键信息冲突 | 向用户确认哪个信息正确 | 打断用户流程 |
| **软覆盖 + 版本保留** | 所有场景 | 标记当前值 + 保留历史 | 存储开销增大 |
| **上下文衰减** | 偏好类信息 | 新偏好权重 1.0，旧偏好每轮衰减 0.1 | 全局偏好被忽略 |

**冲突管理架构：**

```python
class MemoryConflictResolver:
    """记忆冲突的检测与解决引擎"""

    def resolve(self, existing: MemoryEntry, incoming: MemoryEntry) -> MemoryEntry:
        # Step 1: 冲突检测
        conflict_type = self.detect_conflict(existing, incoming)
        if conflict_type is None:
            return self.merge(existing, incoming)  # 无冲突，直接合并

        # Step 2: 根据冲突类型选择策略
        if conflict_type == "temporal_contradiction":
            return self.resolve_by_recency(existing, incoming)
        elif conflict_type == "source_conflict":
            return self.resolve_by_source_trust(existing, incoming)
        elif conflict_type == "preference_drift":
            return self.resolve_by_context_awareness(existing, incoming)
        elif conflict_type == "critical_information":
            return self.resolve_by_clarification(existing, incoming)
        else:
            return self.resolve_by_hybrid(existing, incoming)

    def resolve_by_recency(self, existing, incoming):
        """时效性优先：新数据替换旧数据"""
        if incoming.timestamp > existing.timestamp:
            incoming.status = "active"
            existing.status = "archived"  # 保留历史版本，不删除
            existing.superseded_by = incoming.id
            return incoming
        return existing

    def resolve_by_source_trust(self, existing, incoming):
        """来源可信度：工具返回值 > 用户陈述 > LLM 推断 > 外部参考"""
        TRUST_SCORES = {"tool_output": 100, "user_statement": 90, "llm_inference": 50, "external_reference": 40}
        if TRUST_SCORES[incoming.source_type] > TRUST_SCORES[existing.source_type]:
            return incoming
        return existing

    def resolve_by_context_awareness(self, existing, incoming):
        """偏好漂移：区分全局偏好 vs 临时例外"""
        if existing.field_type == "preference":
            # 保留旧偏好作为 global_preference，新偏好似是 context_specific
            incoming.scope = "context_specific"
            incoming.expires_after = "current_conversation"
            # 两个都保留，注入时按 scope 优先级选择
            self.save_both(existing, incoming)
            return incoming  # 当前上下文中使用新值
        return self.resolve_by_recency(existing, incoming)

    def resolve_by_clarification(self, existing, incoming):
        """关键信息冲突：暂停流程，向用户确认"""
        clarification = self.generate_clarification(existing, incoming)
        user_response = self.ask_user(clarification)  # 向用户提问
        if user_response.confirmed_new:
            existing.status = "deprecated"
            return incoming
        else:
            return existing
```

**最佳实践:**

**1. 软删除而非硬删除**
```python
# 永远不要 UPDATE 覆盖旧值，而是 INSERT 新版本
# 好处：支持时间旅行、冲突回溯、A/B 对比
class VersionedMemory:
    def update(self, key, new_value, source_info):
        old_entry = self.get_current(key)
        if old_entry:
            old_entry.status = 'archived'
        new_entry = MemoryEntry(
            key=key, value=new_value,
            version=old_entry.version + 1 if old_entry else 1,
            previous_version_id=old_entry.id if old_entry else None,
            source=source_info
        )
        self.store([old_entry, new_entry])  # 事务写入
```

**2. 置信度标记**
```python
# 每段记忆有 confidence 分数
# 用户明确陈述: 1.0
# 工具返回: 0.95
# Agent 推断: 0.6
# 在冲突时，保留 confidence 更高的
# 在注入时，只注入 confidence > 0.7 的记忆
```

**3. 冲突日志与审计**
```python
# 记录每次冲突及其解决方式
ConflictLog.record(
    conflict_type=conflict_type,
    existing_entry_id=existing.id,
    incoming_entry_id=incoming.id,
    resolution_strategy=strategy_name,
    winner=winner.id,
    timestamp=now()
)
# 定期分析冲突日志，优化冲突策略
```

**4. 上下文注入时的动态仲裁**
```python
# 不在存储时解决所有冲突，而是在注入时做最终的动态仲裁
def inject_memory(query, context_window_budget):
    candidates = memory_store.retrieve_all(query)  # 包括 archived 版本
    # 对于同一 key 的多个版本，在注入时才决定用哪个
    deduplicated = deduplicate_and_arbitrate(candidates, context=query)
    # 可以给模型同时展示新旧版本，让模型自行判断
    return format_for_injection(deduplicated, budget=context_window_budget)
```

**加分项：** 讨论"记忆联邦"（Memory Federation）在多 Agent 场景下的冲突处理——不同的子 Agent 可能各自维护了关于同一用户的不同记忆，当这些子 Agent 交换信息时如何合并。建议引入全局 SeqNum 或 Vector Clock 来解决分布式记忆的一致性。类似于多主数据库的冲突解决（CRDT 思路），而非简单依赖单一信源。

---

## Q18：Agent Loop 跑多少轮开始衰减？用什么压缩策略？

### 考察点
考察候选人对 Agent 长时间执行中性能衰减问题的量化理解和应对策略。

### 解答思路
1. 先给出衰减的量化数据（基于研究成果和工程经验）
2. 分析衰减的根本原因（注意力稀释、信息过载、误差累积）
3. 给出分层的压缩策略组合

### 参考答案

**衰减量化分析：**

Agent Loop 的性能衰减符合"峰后衰减"曲线，关键数据：

| 轮次范围 | 性能水平 | 现象 | 原因 |
|----------|----------|------|------|
| 1-5 轮 | 峰值 | 决策准确率 90%+ | 上下文信息量适中，关键信息 proximity 高 |
| 6-10 轮 | 轻微衰减 | 准确率 85-90% | 上下文积累，模型开始"分心" |
| 11-15 轮 | 明显衰减 | 准确率 75-85% | 信息密度过高，Lost in the Middle 效应 |
| 16-25 轮 | 严重衰减 | 准确率 60-75% | 幻觉增加、重复操作、忘记早期约束 |
| 25+ 轮 | 崩溃区 | 准确率 < 60% | 循环模式、迷失、死循环 |

**研究支撑：**
- Liu et al. (2023) "Lost in the Middle" 论文证实：LLM 对上下文中间位置的信息利用最差，头尾位置利用较好
- ReAct 论文中，大多数成功的 Agent 任务在 7 步内完成
- 工程经验：max_iterations 通常设为 10-15，超过 15 步的任务需要特殊的上下文管理策略

**衰减的三大根因：**

**根因 1：注意力稀释（Attention Dilution）**
LLM 的 self-attention 机制需要在所有 token 间分配注意力权重。上下文中 token 越多，对关键信息的注意力被"稀释"得越厉害。特别是位置编码的局限——大多数模型的 RoPE 在超大序列时高频信息衰减。

**根因 2：信息过载与混淆**
Agent 上下文不仅包含对话，还有工具调用的输入输出。工具输出可能很长（如 Grep 返回 500 行匹配结果），这些"噪音"数据淹没了决策所需的关键信号。

**根因 3：误差累积与雪崩**
每轮决策都有小概率出错。在长时间链式中，错误会累积：一次错误的工具选择导致错误的观测，错误的观测导致下一步的错误推理，形成雪崩。

**压缩策略体系（分阶段执行）：**

**阶段 1：自动激活（3-5 轮触发）——轻量压缩**
```python
# 策略：工具输出裁剪
def trim_tool_outputs(messages, max_output_length=2000):
    """对超过长度的工具输出做智能裁剪"""
    for msg in messages:
        if isinstance(msg, ToolMessage) and len(msg.content) > max_output_length:
            lines = msg.content.split('\n')
            msg.content = '\n'.join(lines[:20]) + \
                         f"\n... (共 {len(lines)} 行，已裁剪 {len(lines)-20} 行) ...\n" + \
                         '\n'.join(lines[-5:])  # 保留头部 20 行 + 尾部 5 行
    return messages
```

**阶段 2：中度压缩（8-12 轮触发）——结构化摘要**
```python
# 策略：早期对话的滚动摘要
async def rolling_summary(messages, summarize_every_n_turns=8, keep_last_n_turns=5):
    """每 N 轮对早期对话做摘要，保留最近 N 轮完整"""
    if len(get_turns(messages)) <= keep_last_n_turns + summarize_every_n_turns:
        return messages  # 还不够多，不压缩

    # 找到需要摘要的部分
    early_section = messages[:-keep_last_n_turns * 2]  # 每轮 = 2 条消息
    recent_section = messages[-keep_last_n_turns * 2:]

    # 用轻量模型做压缩摘要
    summary = await summarize_llm.ainvoke(f"""将以下 Agent 执行轨迹压缩为不超过 500 tokens 的结构化摘要：
    - 用户的核心目标和约束条件
    - 已完成的关键步骤和结果（成功/失败）
    - 当前处于哪个阶段
    - 发生过的重要错误和修正

    原始轨迹:\n{format_trajectory(early_section)}""")

    return [SystemMessage(f"<execution_summary>\n{summary.content}\n</execution_summary>")] + recent_section
```

**阶段 3：深度压缩（15-20 轮触发）——任务重启**
```python
# 策略：序列化当前状态，在"新大脑"中继续
async def context_migration(state, llm_config):
    """将当前 Agent 状态序列化，启动新的上下文窗口继续执行"""
    # 1. 生成状态的全面摘要
    state_summary = await generate_comprehensive_summary(state)

    # 2. 生成继续执行计划
    continuation_plan = await generate_remaining_plan(state)

    # 3. 在"新大脑"中注入摘要和计划，继续执行
    new_messages = [
        SystemMessage(f"""你是 Agent 的延续实例。上一个实例已完成部分工作，以下是状态摘要:
        <previous_state>
        {state_summary}
        </previous_state>

        <remaining_plan>
        {continuation_plan}
        </remaining_plan>

        请从当前状态继续执行，不要重复已完成的工作。"""),
        HumanMessage("请继续完成剩余的工作。")
    ]

    # 4. 重启执行循环
    return await agent_loop(new_messages, llm_config)
```

**阶段 4：极限压缩（20+ 轮触发）——任务分解隔离**
```python
# 策略：不再让单个 Agent Loop 无限增长，而是将大任务拆为独立子任务
async def task_decomposition_and_isolation(task, state):
    # 1. 让 LLM 分析哪些子任务已完成、哪些待完成
    analysis = await llm.analyze_progress(state)

    # 2. 对待完成的子任务，每个启动一个全新的 Agent 实例
    results = []
    for sub_task in analysis.remaining_tasks:
        # 每个子 Agent 从干净的上下文开始，只注入必要信息
        sub_result = await agent_loop(
            initial_state={
                "task": sub_task,
                "context": extract_relevant_context(state, sub_task),  # 只注入相关上下文
            },
            max_iterations=5  # 每个子任务限制小步数
        )
        results.append(sub_result)

    return merge_results(results)
```

**压缩策略选择决策树：**
```
当前上下文 token 数占上限百分比?
|
+-- < 40%: 不压缩（流畅运行）
|
+-- 40-70%: 工具输出裁剪 + 引用去重（轻量，几乎无信息损失）
|
+-- 70-85%: 滚动摘要压缩（早期回合） + 文件折叠
|
+-- 85-95%: 深度压缩（任务重启，状态迁移到新上下文）
|
+-- 95%+: 任务拆解为子任务，每个子任务独立执行
```

**工程实践经验值：**
- 对于大多数 ReAct Agent，**max_iterations 设为 10 是甜点**：既给模型足够的发挥空间，又不会进入严重衰减区
- 滚动摘要的最佳触发点：每 8-10 轮做一次摘要，保留最近 5 轮完整对话
- 任务重启（context migration）是最后的杀手锏，一个任务中触发不应超过 2 次
- 压缩时的关键原则：**保留"目标"和"约束"，牺牲"过程细节"**

**加分项：** 介绍"注意力预算"（Attention Budget）概念——不仅管理 token 数量，还要管理每类信息的"注意力分配占比"：任务目标 20%、当前子任务 30%、最近工具结果 25%、历史摘要 15%、系统指令 10%。当需要压缩时，不是等比例缩小所有部分，而是动态调整占比（如减少历史摘要的占比，增加当前子任务的占比）。以及讨论结构化压缩（生成 YAML/JSON 摘要）vs. 自然语言摘要的 token 效率差异——结构化摘要通常能节省 30-50% token，但需要 LLM 额外理解格式。

---

> 以上 18 题覆盖了 Agent 架构设计的核心议题，包括决策机制、错误处理、Code Agent 设计、System Prompt 工程、记忆系统、上下文管理、自我修正、LangGraph 深入原理、Harness 层设计、LangChain 核心组件与 LCEL、记忆冲突处理和 Loop 衰减管理。每道题都包含了考察点、分步解答思路、详尽的参考答案和加分项，适合作为 Module 4 Agent 架构设计类的备考材料。

---


### Q19：上下文工程是怎么设计的？

**考察点**

考察候选人在Agent 架构设计类上的理解深度，尤其是Agent 的规划、记忆、状态流转、框架选型和复杂任务拆解能力。

**解答思路**

1. 先给出清晰定义，明确这个问题所在的系统边界和输入输出。
2. 再拆成核心机制、工程实现、风险控制三个层次回答，避免只背概念。
3. 最后结合生产场景说明如何评估效果、如何兜底，以及如何做取舍。

**参考答案**

这类问题回答时不要停留在名词解释，而要把它放到一个真实 AI Agent 系统里看。首先要明确目标：Agent 不是单次 LLM 调用，而是围绕任务目标进行推理、状态维护、工具调用和结果校验的闭环系统。因此回答时应说明该能力在闭环中的位置，例如是在输入理解阶段、计划生成阶段、工具执行阶段，还是结果评估阶段发挥作用。

工程实现上，可以按“策略层 + 执行层 + 保护层”展开。策略层负责判断是否需要该能力以及何时触发；执行层负责把策略落到具体组件，例如检索器、工具注册表、状态机、任务队列或评测器；保护层负责处理异常，包括参数校验、超时重试、权限检查、循环终止、低置信度拒答和人工升级。对于面试题中涉及框架或协议的场景，还要说明为什么选择它，而不是只说“用 LangChain/LangGraph/MCP 就可以”。

生产级答案还需要补充指标。效果类问题要看准确率、召回率、任务成功率、工具调用成功率和人工接管率；效率类问题要看端到端延迟、Token 成本、并发吞吐和失败重试次数；安全类问题要看越权调用、Prompt Injection、危险操作拦截率和审计日志完整性。只有把机制、实现和指标连起来，才说明候选人真正做过或认真设计过 Agent 系统。

**加分项：** 能主动指出边界条件和 trade-off，例如更强的 Agent 自主性会带来更高成本和更难调试的状态空间；更严格的安全策略会降低自动化率；更长上下文不等于更高准确率，仍然需要检索、压缩和评测闭环。

---

### Q20：记忆机制是怎么做的？

**考察点**

考察候选人在Agent 架构设计类上的理解深度，尤其是Agent 的规划、记忆、状态流转、框架选型和复杂任务拆解能力。

**解答思路**

1. 先给出清晰定义，明确这个问题所在的系统边界和输入输出。
2. 再拆成核心机制、工程实现、风险控制三个层次回答，避免只背概念。
3. 最后结合生产场景说明如何评估效果、如何兜底，以及如何做取舍。

**参考答案**

这类问题回答时不要停留在名词解释，而要把它放到一个真实 AI Agent 系统里看。首先要明确目标：Agent 不是单次 LLM 调用，而是围绕任务目标进行推理、状态维护、工具调用和结果校验的闭环系统。因此回答时应说明该能力在闭环中的位置，例如是在输入理解阶段、计划生成阶段、工具执行阶段，还是结果评估阶段发挥作用。

工程实现上，可以按“策略层 + 执行层 + 保护层”展开。策略层负责判断是否需要该能力以及何时触发；执行层负责把策略落到具体组件，例如检索器、工具注册表、状态机、任务队列或评测器；保护层负责处理异常，包括参数校验、超时重试、权限检查、循环终止、低置信度拒答和人工升级。对于面试题中涉及框架或协议的场景，还要说明为什么选择它，而不是只说“用 LangChain/LangGraph/MCP 就可以”。

生产级答案还需要补充指标。效果类问题要看准确率、召回率、任务成功率、工具调用成功率和人工接管率；效率类问题要看端到端延迟、Token 成本、并发吞吐和失败重试次数；安全类问题要看越权调用、Prompt Injection、危险操作拦截率和审计日志完整性。只有把机制、实现和指标连起来，才说明候选人真正做过或认真设计过 Agent 系统。

**加分项：** 能主动指出边界条件和 trade-off，例如更强的 Agent 自主性会带来更高成本和更难调试的状态空间；更严格的安全策略会降低自动化率；更长上下文不等于更高准确率，仍然需要检索、压缩和评测闭环。

---

### Q21：Agent 的任务规划是怎么做的？

**考察点**

考察候选人在Agent 架构设计类上的理解深度，尤其是Agent 的规划、记忆、状态流转、框架选型和复杂任务拆解能力。

**解答思路**

1. 先给出清晰定义，明确这个问题所在的系统边界和输入输出。
2. 再拆成核心机制、工程实现、风险控制三个层次回答，避免只背概念。
3. 最后结合生产场景说明如何评估效果、如何兜底，以及如何做取舍。

**参考答案**

这类问题回答时不要停留在名词解释，而要把它放到一个真实 AI Agent 系统里看。首先要明确目标：Agent 不是单次 LLM 调用，而是围绕任务目标进行推理、状态维护、工具调用和结果校验的闭环系统。因此回答时应说明该能力在闭环中的位置，例如是在输入理解阶段、计划生成阶段、工具执行阶段，还是结果评估阶段发挥作用。

工程实现上，可以按“策略层 + 执行层 + 保护层”展开。策略层负责判断是否需要该能力以及何时触发；执行层负责把策略落到具体组件，例如检索器、工具注册表、状态机、任务队列或评测器；保护层负责处理异常，包括参数校验、超时重试、权限检查、循环终止、低置信度拒答和人工升级。对于面试题中涉及框架或协议的场景，还要说明为什么选择它，而不是只说“用 LangChain/LangGraph/MCP 就可以”。

生产级答案还需要补充指标。效果类问题要看准确率、召回率、任务成功率、工具调用成功率和人工接管率；效率类问题要看端到端延迟、Token 成本、并发吞吐和失败重试次数；安全类问题要看越权调用、Prompt Injection、危险操作拦截率和审计日志完整性。只有把机制、实现和指标连起来，才说明候选人真正做过或认真设计过 Agent 系统。

**加分项：** 能主动指出边界条件和 trade-off，例如更强的 Agent 自主性会带来更高成本和更难调试的状态空间；更严格的安全策略会降低自动化率；更长上下文不等于更高准确率，仍然需要检索、压缩和评测闭环。

---

### Q22：当前的上下文是如何处理的？

**考察点**

考察候选人在Agent 架构设计类上的理解深度，尤其是Agent 的规划、记忆、状态流转、框架选型和复杂任务拆解能力。

**解答思路**

1. 先给出清晰定义，明确这个问题所在的系统边界和输入输出。
2. 再拆成核心机制、工程实现、风险控制三个层次回答，避免只背概念。
3. 最后结合生产场景说明如何评估效果、如何兜底，以及如何做取舍。

**参考答案**

这类问题回答时不要停留在名词解释，而要把它放到一个真实 AI Agent 系统里看。首先要明确目标：Agent 不是单次 LLM 调用，而是围绕任务目标进行推理、状态维护、工具调用和结果校验的闭环系统。因此回答时应说明该能力在闭环中的位置，例如是在输入理解阶段、计划生成阶段、工具执行阶段，还是结果评估阶段发挥作用。

工程实现上，可以按“策略层 + 执行层 + 保护层”展开。策略层负责判断是否需要该能力以及何时触发；执行层负责把策略落到具体组件，例如检索器、工具注册表、状态机、任务队列或评测器；保护层负责处理异常，包括参数校验、超时重试、权限检查、循环终止、低置信度拒答和人工升级。对于面试题中涉及框架或协议的场景，还要说明为什么选择它，而不是只说“用 LangChain/LangGraph/MCP 就可以”。

生产级答案还需要补充指标。效果类问题要看准确率、召回率、任务成功率、工具调用成功率和人工接管率；效率类问题要看端到端延迟、Token 成本、并发吞吐和失败重试次数；安全类问题要看越权调用、Prompt Injection、危险操作拦截率和审计日志完整性。只有把机制、实现和指标连起来，才说明候选人真正做过或认真设计过 Agent 系统。

**加分项：** 能主动指出边界条件和 trade-off，例如更强的 Agent 自主性会带来更高成本和更难调试的状态空间；更严格的安全策略会降低自动化率；更长上下文不等于更高准确率，仍然需要检索、压缩和评测闭环。

---

### Q23：Agent 的上下文你是怎么维护的？说下具体方案。

**考察点**

考察候选人在Agent 架构设计类上的理解深度，尤其是Agent 的规划、记忆、状态流转、框架选型和复杂任务拆解能力。

**解答思路**

1. 先给出清晰定义，明确这个问题所在的系统边界和输入输出。
2. 再拆成核心机制、工程实现、风险控制三个层次回答，避免只背概念。
3. 最后结合生产场景说明如何评估效果、如何兜底，以及如何做取舍。

**参考答案**

这类问题回答时不要停留在名词解释，而要把它放到一个真实 AI Agent 系统里看。首先要明确目标：Agent 不是单次 LLM 调用，而是围绕任务目标进行推理、状态维护、工具调用和结果校验的闭环系统。因此回答时应说明该能力在闭环中的位置，例如是在输入理解阶段、计划生成阶段、工具执行阶段，还是结果评估阶段发挥作用。

工程实现上，可以按“策略层 + 执行层 + 保护层”展开。策略层负责判断是否需要该能力以及何时触发；执行层负责把策略落到具体组件，例如检索器、工具注册表、状态机、任务队列或评测器；保护层负责处理异常，包括参数校验、超时重试、权限检查、循环终止、低置信度拒答和人工升级。对于面试题中涉及框架或协议的场景，还要说明为什么选择它，而不是只说“用 LangChain/LangGraph/MCP 就可以”。

生产级答案还需要补充指标。效果类问题要看准确率、召回率、任务成功率、工具调用成功率和人工接管率；效率类问题要看端到端延迟、Token 成本、并发吞吐和失败重试次数；安全类问题要看越权调用、Prompt Injection、危险操作拦截率和审计日志完整性。只有把机制、实现和指标连起来，才说明候选人真正做过或认真设计过 Agent 系统。

**加分项：** 能主动指出边界条件和 trade-off，例如更强的 Agent 自主性会带来更高成本和更难调试的状态空间；更严格的安全策略会降低自动化率；更长上下文不等于更高准确率，仍然需要检索、压缩和评测闭环。

---

### Q24：现在主流大模型能处理多长的上下文？

**考察点**

考察候选人在Agent 架构设计类上的理解深度，尤其是Agent 的规划、记忆、状态流转、框架选型和复杂任务拆解能力。

**解答思路**

1. 先给出清晰定义，明确这个问题所在的系统边界和输入输出。
2. 再拆成核心机制、工程实现、风险控制三个层次回答，避免只背概念。
3. 最后结合生产场景说明如何评估效果、如何兜底，以及如何做取舍。

**参考答案**

这类问题回答时不要停留在名词解释，而要把它放到一个真实 AI Agent 系统里看。首先要明确目标：Agent 不是单次 LLM 调用，而是围绕任务目标进行推理、状态维护、工具调用和结果校验的闭环系统。因此回答时应说明该能力在闭环中的位置，例如是在输入理解阶段、计划生成阶段、工具执行阶段，还是结果评估阶段发挥作用。

工程实现上，可以按“策略层 + 执行层 + 保护层”展开。策略层负责判断是否需要该能力以及何时触发；执行层负责把策略落到具体组件，例如检索器、工具注册表、状态机、任务队列或评测器；保护层负责处理异常，包括参数校验、超时重试、权限检查、循环终止、低置信度拒答和人工升级。对于面试题中涉及框架或协议的场景，还要说明为什么选择它，而不是只说“用 LangChain/LangGraph/MCP 就可以”。

生产级答案还需要补充指标。效果类问题要看准确率、召回率、任务成功率、工具调用成功率和人工接管率；效率类问题要看端到端延迟、Token 成本、并发吞吐和失败重试次数；安全类问题要看越权调用、Prompt Injection、危险操作拦截率和审计日志完整性。只有把机制、实现和指标连起来，才说明候选人真正做过或认真设计过 Agent 系统。

**加分项：** 能主动指出边界条件和 trade-off，例如更强的 Agent 自主性会带来更高成本和更难调试的状态空间；更严格的安全策略会降低自动化率；更长上下文不等于更高准确率，仍然需要检索、压缩和评测闭环。

---

### Q25：Agent 智能体的架构一般拆成哪几层？

**考察点**

考察候选人在Agent 架构设计类上的理解深度，尤其是Agent 的规划、记忆、状态流转、框架选型和复杂任务拆解能力。

**解答思路**

1. 先给出清晰定义，明确这个问题所在的系统边界和输入输出。
2. 再拆成核心机制、工程实现、风险控制三个层次回答，避免只背概念。
3. 最后结合生产场景说明如何评估效果、如何兜底，以及如何做取舍。

**参考答案**

这类问题回答时不要停留在名词解释，而要把它放到一个真实 AI Agent 系统里看。首先要明确目标：Agent 不是单次 LLM 调用，而是围绕任务目标进行推理、状态维护、工具调用和结果校验的闭环系统。因此回答时应说明该能力在闭环中的位置，例如是在输入理解阶段、计划生成阶段、工具执行阶段，还是结果评估阶段发挥作用。

工程实现上，可以按“策略层 + 执行层 + 保护层”展开。策略层负责判断是否需要该能力以及何时触发；执行层负责把策略落到具体组件，例如检索器、工具注册表、状态机、任务队列或评测器；保护层负责处理异常，包括参数校验、超时重试、权限检查、循环终止、低置信度拒答和人工升级。对于面试题中涉及框架或协议的场景，还要说明为什么选择它，而不是只说“用 LangChain/LangGraph/MCP 就可以”。

生产级答案还需要补充指标。效果类问题要看准确率、召回率、任务成功率、工具调用成功率和人工接管率；效率类问题要看端到端延迟、Token 成本、并发吞吐和失败重试次数；安全类问题要看越权调用、Prompt Injection、危险操作拦截率和审计日志完整性。只有把机制、实现和指标连起来，才说明候选人真正做过或认真设计过 Agent 系统。

**加分项：** 能主动指出边界条件和 trade-off，例如更强的 Agent 自主性会带来更高成本和更难调试的状态空间；更严格的安全策略会降低自动化率；更长上下文不等于更高准确率，仍然需要检索、压缩和评测闭环。

---

### Q26：Agent 和普通 LLM 的核心区别在哪里？

**考察点**

考察候选人在Agent 架构设计类上的理解深度，尤其是Agent 的规划、记忆、状态流转、框架选型和复杂任务拆解能力。

**解答思路**

1. 先给出清晰定义，明确这个问题所在的系统边界和输入输出。
2. 再拆成核心机制、工程实现、风险控制三个层次回答，避免只背概念。
3. 最后结合生产场景说明如何评估效果、如何兜底，以及如何做取舍。

**参考答案**

这类问题回答时不要停留在名词解释，而要把它放到一个真实 AI Agent 系统里看。首先要明确目标：Agent 不是单次 LLM 调用，而是围绕任务目标进行推理、状态维护、工具调用和结果校验的闭环系统。因此回答时应说明该能力在闭环中的位置，例如是在输入理解阶段、计划生成阶段、工具执行阶段，还是结果评估阶段发挥作用。

工程实现上，可以按“策略层 + 执行层 + 保护层”展开。策略层负责判断是否需要该能力以及何时触发；执行层负责把策略落到具体组件，例如检索器、工具注册表、状态机、任务队列或评测器；保护层负责处理异常，包括参数校验、超时重试、权限检查、循环终止、低置信度拒答和人工升级。对于面试题中涉及框架或协议的场景，还要说明为什么选择它，而不是只说“用 LangChain/LangGraph/MCP 就可以”。

生产级答案还需要补充指标。效果类问题要看准确率、召回率、任务成功率、工具调用成功率和人工接管率；效率类问题要看端到端延迟、Token 成本、并发吞吐和失败重试次数；安全类问题要看越权调用、Prompt Injection、危险操作拦截率和审计日志完整性。只有把机制、实现和指标连起来，才说明候选人真正做过或认真设计过 Agent 系统。

**加分项：** 能主动指出边界条件和 trade-off，例如更强的 Agent 自主性会带来更高成本和更难调试的状态空间；更严格的安全策略会降低自动化率；更长上下文不等于更高准确率，仍然需要检索、压缩和评测闭环。

---

### Q27：你知道哪些 Agent 开发框架？每个框架里有哪些核心组件？

**考察点**

考察候选人在Agent 架构设计类上的理解深度，尤其是Agent 的规划、记忆、状态流转、框架选型和复杂任务拆解能力。

**解答思路**

1. 先给出清晰定义，明确这个问题所在的系统边界和输入输出。
2. 再拆成核心机制、工程实现、风险控制三个层次回答，避免只背概念。
3. 最后结合生产场景说明如何评估效果、如何兜底，以及如何做取舍。

**参考答案**

这类问题回答时不要停留在名词解释，而要把它放到一个真实 AI Agent 系统里看。首先要明确目标：Agent 不是单次 LLM 调用，而是围绕任务目标进行推理、状态维护、工具调用和结果校验的闭环系统。因此回答时应说明该能力在闭环中的位置，例如是在输入理解阶段、计划生成阶段、工具执行阶段，还是结果评估阶段发挥作用。

工程实现上，可以按“策略层 + 执行层 + 保护层”展开。策略层负责判断是否需要该能力以及何时触发；执行层负责把策略落到具体组件，例如检索器、工具注册表、状态机、任务队列或评测器；保护层负责处理异常，包括参数校验、超时重试、权限检查、循环终止、低置信度拒答和人工升级。对于面试题中涉及框架或协议的场景，还要说明为什么选择它，而不是只说“用 LangChain/LangGraph/MCP 就可以”。

生产级答案还需要补充指标。效果类问题要看准确率、召回率、任务成功率、工具调用成功率和人工接管率；效率类问题要看端到端延迟、Token 成本、并发吞吐和失败重试次数；安全类问题要看越权调用、Prompt Injection、危险操作拦截率和审计日志完整性。只有把机制、实现和指标连起来，才说明候选人真正做过或认真设计过 Agent 系统。

**加分项：** 能主动指出边界条件和 trade-off，例如更强的 Agent 自主性会带来更高成本和更难调试的状态空间；更严格的安全策略会降低自动化率；更长上下文不等于更高准确率，仍然需要检索、压缩和评测闭环。

---

### Q28：Memory 在 Agent 里扮演什么角色？

**考察点**

考察候选人在Agent 架构设计类上的理解深度，尤其是Agent 的规划、记忆、状态流转、框架选型和复杂任务拆解能力。

**解答思路**

1. 先给出清晰定义，明确这个问题所在的系统边界和输入输出。
2. 再拆成核心机制、工程实现、风险控制三个层次回答，避免只背概念。
3. 最后结合生产场景说明如何评估效果、如何兜底，以及如何做取舍。

**参考答案**

这类问题回答时不要停留在名词解释，而要把它放到一个真实 AI Agent 系统里看。首先要明确目标：Agent 不是单次 LLM 调用，而是围绕任务目标进行推理、状态维护、工具调用和结果校验的闭环系统。因此回答时应说明该能力在闭环中的位置，例如是在输入理解阶段、计划生成阶段、工具执行阶段，还是结果评估阶段发挥作用。

工程实现上，可以按“策略层 + 执行层 + 保护层”展开。策略层负责判断是否需要该能力以及何时触发；执行层负责把策略落到具体组件，例如检索器、工具注册表、状态机、任务队列或评测器；保护层负责处理异常，包括参数校验、超时重试、权限检查、循环终止、低置信度拒答和人工升级。对于面试题中涉及框架或协议的场景，还要说明为什么选择它，而不是只说“用 LangChain/LangGraph/MCP 就可以”。

生产级答案还需要补充指标。效果类问题要看准确率、召回率、任务成功率、工具调用成功率和人工接管率；效率类问题要看端到端延迟、Token 成本、并发吞吐和失败重试次数；安全类问题要看越权调用、Prompt Injection、危险操作拦截率和审计日志完整性。只有把机制、实现和指标连起来，才说明候选人真正做过或认真设计过 Agent 系统。

**加分项：** 能主动指出边界条件和 trade-off，例如更强的 Agent 自主性会带来更高成本和更难调试的状态空间；更严格的安全策略会降低自动化率；更长上下文不等于更高准确率，仍然需要检索、压缩和评测闭环。

---

### Q29：Agent 的反思机制是什么？有没有让模型在回答之前先自查语气是否专业？

**考察点**

考察候选人在Agent 架构设计类上的理解深度，尤其是Agent 的规划、记忆、状态流转、框架选型和复杂任务拆解能力。

**解答思路**

1. 先给出清晰定义，明确这个问题所在的系统边界和输入输出。
2. 再拆成核心机制、工程实现、风险控制三个层次回答，避免只背概念。
3. 最后结合生产场景说明如何评估效果、如何兜底，以及如何做取舍。

**参考答案**

这类问题回答时不要停留在名词解释，而要把它放到一个真实 AI Agent 系统里看。首先要明确目标：Agent 不是单次 LLM 调用，而是围绕任务目标进行推理、状态维护、工具调用和结果校验的闭环系统。因此回答时应说明该能力在闭环中的位置，例如是在输入理解阶段、计划生成阶段、工具执行阶段，还是结果评估阶段发挥作用。

工程实现上，可以按“策略层 + 执行层 + 保护层”展开。策略层负责判断是否需要该能力以及何时触发；执行层负责把策略落到具体组件，例如检索器、工具注册表、状态机、任务队列或评测器；保护层负责处理异常，包括参数校验、超时重试、权限检查、循环终止、低置信度拒答和人工升级。对于面试题中涉及框架或协议的场景，还要说明为什么选择它，而不是只说“用 LangChain/LangGraph/MCP 就可以”。

生产级答案还需要补充指标。效果类问题要看准确率、召回率、任务成功率、工具调用成功率和人工接管率；效率类问题要看端到端延迟、Token 成本、并发吞吐和失败重试次数；安全类问题要看越权调用、Prompt Injection、危险操作拦截率和审计日志完整性。只有把机制、实现和指标连起来，才说明候选人真正做过或认真设计过 Agent 系统。

**加分项：** 能主动指出边界条件和 trade-off，例如更强的 Agent 自主性会带来更高成本和更难调试的状态空间；更严格的安全策略会降低自动化率；更长上下文不等于更高准确率，仍然需要检索、压缩和评测闭环。

---

### Q30：AI Agent 项目被要求投屏演示时，系统结构、设计思路和 README 应该如何准备？

**考察点**

考察候选人在Agent 架构设计类上的理解深度，尤其是Agent 的规划、记忆、状态流转、框架选型和复杂任务拆解能力。

**解答思路**

1. 先给出清晰定义，明确这个问题所在的系统边界和输入输出。
2. 再拆成核心机制、工程实现、风险控制三个层次回答，避免只背概念。
3. 最后结合生产场景说明如何评估效果、如何兜底，以及如何做取舍。

**参考答案**

这类问题回答时不要停留在名词解释，而要把它放到一个真实 AI Agent 系统里看。首先要明确目标：Agent 不是单次 LLM 调用，而是围绕任务目标进行推理、状态维护、工具调用和结果校验的闭环系统。因此回答时应说明该能力在闭环中的位置，例如是在输入理解阶段、计划生成阶段、工具执行阶段，还是结果评估阶段发挥作用。

工程实现上，可以按“策略层 + 执行层 + 保护层”展开。策略层负责判断是否需要该能力以及何时触发；执行层负责把策略落到具体组件，例如检索器、工具注册表、状态机、任务队列或评测器；保护层负责处理异常，包括参数校验、超时重试、权限检查、循环终止、低置信度拒答和人工升级。对于面试题中涉及框架或协议的场景，还要说明为什么选择它，而不是只说“用 LangChain/LangGraph/MCP 就可以”。

生产级答案还需要补充指标。效果类问题要看准确率、召回率、任务成功率、工具调用成功率和人工接管率；效率类问题要看端到端延迟、Token 成本、并发吞吐和失败重试次数；安全类问题要看越权调用、Prompt Injection、危险操作拦截率和审计日志完整性。只有把机制、实现和指标连起来，才说明候选人真正做过或认真设计过 Agent 系统。

**加分项：** 能主动指出边界条件和 trade-off，例如更强的 Agent 自主性会带来更高成本和更难调试的状态空间；更严格的安全策略会降低自动化率；更长上下文不等于更高准确率，仍然需要检索、压缩和评测闭环。

---

### Q31：如果要做目标部门某个功能，你会怎么设计 Agent 流程？

**考察点**

考察候选人在Agent 架构设计类上的理解深度，尤其是Agent 的规划、记忆、状态流转、框架选型和复杂任务拆解能力。

**解答思路**

1. 先给出清晰定义，明确这个问题所在的系统边界和输入输出。
2. 再拆成核心机制、工程实现、风险控制三个层次回答，避免只背概念。
3. 最后结合生产场景说明如何评估效果、如何兜底，以及如何做取舍。

**参考答案**

这类问题回答时不要停留在名词解释，而要把它放到一个真实 AI Agent 系统里看。首先要明确目标：Agent 不是单次 LLM 调用，而是围绕任务目标进行推理、状态维护、工具调用和结果校验的闭环系统。因此回答时应说明该能力在闭环中的位置，例如是在输入理解阶段、计划生成阶段、工具执行阶段，还是结果评估阶段发挥作用。

工程实现上，可以按“策略层 + 执行层 + 保护层”展开。策略层负责判断是否需要该能力以及何时触发；执行层负责把策略落到具体组件，例如检索器、工具注册表、状态机、任务队列或评测器；保护层负责处理异常，包括参数校验、超时重试、权限检查、循环终止、低置信度拒答和人工升级。对于面试题中涉及框架或协议的场景，还要说明为什么选择它，而不是只说“用 LangChain/LangGraph/MCP 就可以”。

生产级答案还需要补充指标。效果类问题要看准确率、召回率、任务成功率、工具调用成功率和人工接管率；效率类问题要看端到端延迟、Token 成本、并发吞吐和失败重试次数；安全类问题要看越权调用、Prompt Injection、危险操作拦截率和审计日志完整性。只有把机制、实现和指标连起来，才说明候选人真正做过或认真设计过 Agent 系统。

**加分项：** 能主动指出边界条件和 trade-off，例如更强的 Agent 自主性会带来更高成本和更难调试的状态空间；更严格的安全策略会降低自动化率；更长上下文不等于更高准确率，仍然需要检索、压缩和评测闭环。

---

### Q32：简历上的 AI Native 游戏 / Agent 项目，面试官会如何深挖细节？

**考察点**

考察候选人在Agent 架构设计类上的理解深度，尤其是Agent 的规划、记忆、状态流转、框架选型和复杂任务拆解能力。

**解答思路**

1. 先给出清晰定义，明确这个问题所在的系统边界和输入输出。
2. 再拆成核心机制、工程实现、风险控制三个层次回答，避免只背概念。
3. 最后结合生产场景说明如何评估效果、如何兜底，以及如何做取舍。

**参考答案**

这类问题回答时不要停留在名词解释，而要把它放到一个真实 AI Agent 系统里看。首先要明确目标：Agent 不是单次 LLM 调用，而是围绕任务目标进行推理、状态维护、工具调用和结果校验的闭环系统。因此回答时应说明该能力在闭环中的位置，例如是在输入理解阶段、计划生成阶段、工具执行阶段，还是结果评估阶段发挥作用。

工程实现上，可以按“策略层 + 执行层 + 保护层”展开。策略层负责判断是否需要该能力以及何时触发；执行层负责把策略落到具体组件，例如检索器、工具注册表、状态机、任务队列或评测器；保护层负责处理异常，包括参数校验、超时重试、权限检查、循环终止、低置信度拒答和人工升级。对于面试题中涉及框架或协议的场景，还要说明为什么选择它，而不是只说“用 LangChain/LangGraph/MCP 就可以”。

生产级答案还需要补充指标。效果类问题要看准确率、召回率、任务成功率、工具调用成功率和人工接管率；效率类问题要看端到端延迟、Token 成本、并发吞吐和失败重试次数；安全类问题要看越权调用、Prompt Injection、危险操作拦截率和审计日志完整性。只有把机制、实现和指标连起来，才说明候选人真正做过或认真设计过 Agent 系统。

**加分项：** 能主动指出边界条件和 trade-off，例如更强的 Agent 自主性会带来更高成本和更难调试的状态空间；更严格的安全策略会降低自动化率；更长上下文不等于更高准确率，仍然需要检索、压缩和评测闭环。

---

### Q33：LLM 应用工程中的结构化输出、Few-shot、指令遵循优化、API 集成如何落地？

**考察点**

考察候选人在Agent 架构设计类上的理解深度，尤其是Agent 的规划、记忆、状态流转、框架选型和复杂任务拆解能力。

**解答思路**

1. 先给出清晰定义，明确这个问题所在的系统边界和输入输出。
2. 再拆成核心机制、工程实现、风险控制三个层次回答，避免只背概念。
3. 最后结合生产场景说明如何评估效果、如何兜底，以及如何做取舍。

**参考答案**

这类问题回答时不要停留在名词解释，而要把它放到一个真实 AI Agent 系统里看。首先要明确目标：Agent 不是单次 LLM 调用，而是围绕任务目标进行推理、状态维护、工具调用和结果校验的闭环系统。因此回答时应说明该能力在闭环中的位置，例如是在输入理解阶段、计划生成阶段、工具执行阶段，还是结果评估阶段发挥作用。

工程实现上，可以按“策略层 + 执行层 + 保护层”展开。策略层负责判断是否需要该能力以及何时触发；执行层负责把策略落到具体组件，例如检索器、工具注册表、状态机、任务队列或评测器；保护层负责处理异常，包括参数校验、超时重试、权限检查、循环终止、低置信度拒答和人工升级。对于面试题中涉及框架或协议的场景，还要说明为什么选择它，而不是只说“用 LangChain/LangGraph/MCP 就可以”。

生产级答案还需要补充指标。效果类问题要看准确率、召回率、任务成功率、工具调用成功率和人工接管率；效率类问题要看端到端延迟、Token 成本、并发吞吐和失败重试次数；安全类问题要看越权调用、Prompt Injection、危险操作拦截率和审计日志完整性。只有把机制、实现和指标连起来，才说明候选人真正做过或认真设计过 Agent 系统。

**加分项：** 能主动指出边界条件和 trade-off，例如更强的 Agent 自主性会带来更高成本和更难调试的状态空间；更严格的安全策略会降低自动化率；更长上下文不等于更高准确率，仍然需要检索、压缩和评测闭环。

---

### Q34：假设开发美团智能客服 Agent，如何设计多轮对话流程？

**考察点**

考察候选人在Agent 架构设计类上的理解深度，尤其是Agent 的规划、记忆、状态流转、框架选型和复杂任务拆解能力。

**解答思路**

1. 先给出清晰定义，明确这个问题所在的系统边界和输入输出。
2. 再拆成核心机制、工程实现、风险控制三个层次回答，避免只背概念。
3. 最后结合生产场景说明如何评估效果、如何兜底，以及如何做取舍。

**参考答案**

这类问题回答时不要停留在名词解释，而要把它放到一个真实 AI Agent 系统里看。首先要明确目标：Agent 不是单次 LLM 调用，而是围绕任务目标进行推理、状态维护、工具调用和结果校验的闭环系统。因此回答时应说明该能力在闭环中的位置，例如是在输入理解阶段、计划生成阶段、工具执行阶段，还是结果评估阶段发挥作用。

工程实现上，可以按“策略层 + 执行层 + 保护层”展开。策略层负责判断是否需要该能力以及何时触发；执行层负责把策略落到具体组件，例如检索器、工具注册表、状态机、任务队列或评测器；保护层负责处理异常，包括参数校验、超时重试、权限检查、循环终止、低置信度拒答和人工升级。对于面试题中涉及框架或协议的场景，还要说明为什么选择它，而不是只说“用 LangChain/LangGraph/MCP 就可以”。

生产级答案还需要补充指标。效果类问题要看准确率、召回率、任务成功率、工具调用成功率和人工接管率；效率类问题要看端到端延迟、Token 成本、并发吞吐和失败重试次数；安全类问题要看越权调用、Prompt Injection、危险操作拦截率和审计日志完整性。只有把机制、实现和指标连起来，才说明候选人真正做过或认真设计过 Agent 系统。

**加分项：** 能主动指出边界条件和 trade-off，例如更强的 Agent 自主性会带来更高成本和更难调试的状态空间；更严格的安全策略会降低自动化率；更长上下文不等于更高准确率，仍然需要检索、压缩和评测闭环。

---

### Q35：多轮对话里会使用哪些对话状态跟踪方法？

**考察点**

考察候选人在Agent 架构设计类上的理解深度，尤其是Agent 的规划、记忆、状态流转、框架选型和复杂任务拆解能力。

**解答思路**

1. 先给出清晰定义，明确这个问题所在的系统边界和输入输出。
2. 再拆成核心机制、工程实现、风险控制三个层次回答，避免只背概念。
3. 最后结合生产场景说明如何评估效果、如何兜底，以及如何做取舍。

**参考答案**

这类问题回答时不要停留在名词解释，而要把它放到一个真实 AI Agent 系统里看。首先要明确目标：Agent 不是单次 LLM 调用，而是围绕任务目标进行推理、状态维护、工具调用和结果校验的闭环系统。因此回答时应说明该能力在闭环中的位置，例如是在输入理解阶段、计划生成阶段、工具执行阶段，还是结果评估阶段发挥作用。

工程实现上，可以按“策略层 + 执行层 + 保护层”展开。策略层负责判断是否需要该能力以及何时触发；执行层负责把策略落到具体组件，例如检索器、工具注册表、状态机、任务队列或评测器；保护层负责处理异常，包括参数校验、超时重试、权限检查、循环终止、低置信度拒答和人工升级。对于面试题中涉及框架或协议的场景，还要说明为什么选择它，而不是只说“用 LangChain/LangGraph/MCP 就可以”。

生产级答案还需要补充指标。效果类问题要看准确率、召回率、任务成功率、工具调用成功率和人工接管率；效率类问题要看端到端延迟、Token 成本、并发吞吐和失败重试次数；安全类问题要看越权调用、Prompt Injection、危险操作拦截率和审计日志完整性。只有把机制、实现和指标连起来，才说明候选人真正做过或认真设计过 Agent 系统。

**加分项：** 能主动指出边界条件和 trade-off，例如更强的 Agent 自主性会带来更高成本和更难调试的状态空间；更严格的安全策略会降低自动化率；更长上下文不等于更高准确率，仍然需要检索、压缩和评测闭环。

---

### Q36：如何处理用户意图模糊的情况？

**考察点**

考察候选人在Agent 架构设计类上的理解深度，尤其是Agent 的规划、记忆、状态流转、框架选型和复杂任务拆解能力。

**解答思路**

1. 先给出清晰定义，明确这个问题所在的系统边界和输入输出。
2. 再拆成核心机制、工程实现、风险控制三个层次回答，避免只背概念。
3. 最后结合生产场景说明如何评估效果、如何兜底，以及如何做取舍。

**参考答案**

这类问题回答时不要停留在名词解释，而要把它放到一个真实 AI Agent 系统里看。首先要明确目标：Agent 不是单次 LLM 调用，而是围绕任务目标进行推理、状态维护、工具调用和结果校验的闭环系统。因此回答时应说明该能力在闭环中的位置，例如是在输入理解阶段、计划生成阶段、工具执行阶段，还是结果评估阶段发挥作用。

工程实现上，可以按“策略层 + 执行层 + 保护层”展开。策略层负责判断是否需要该能力以及何时触发；执行层负责把策略落到具体组件，例如检索器、工具注册表、状态机、任务队列或评测器；保护层负责处理异常，包括参数校验、超时重试、权限检查、循环终止、低置信度拒答和人工升级。对于面试题中涉及框架或协议的场景，还要说明为什么选择它，而不是只说“用 LangChain/LangGraph/MCP 就可以”。

生产级答案还需要补充指标。效果类问题要看准确率、召回率、任务成功率、工具调用成功率和人工接管率；效率类问题要看端到端延迟、Token 成本、并发吞吐和失败重试次数；安全类问题要看越权调用、Prompt Injection、危险操作拦截率和审计日志完整性。只有把机制、实现和指标连起来，才说明候选人真正做过或认真设计过 Agent 系统。

**加分项：** 能主动指出边界条件和 trade-off，例如更强的 Agent 自主性会带来更高成本和更难调试的状态空间；更严格的安全策略会降低自动化率；更长上下文不等于更高准确率，仍然需要检索、压缩和评测闭环。

---

### Q37：如何解释 AI Agent 的规划能力？如何实现多任务协同（点餐 + 支付 + 售后）？

**考察点**

考察候选人在Agent 架构设计类上的理解深度，尤其是Agent 的规划、记忆、状态流转、框架选型和复杂任务拆解能力。

**解答思路**

1. 先给出清晰定义，明确这个问题所在的系统边界和输入输出。
2. 再拆成核心机制、工程实现、风险控制三个层次回答，避免只背概念。
3. 最后结合生产场景说明如何评估效果、如何兜底，以及如何做取舍。

**参考答案**

这类问题回答时不要停留在名词解释，而要把它放到一个真实 AI Agent 系统里看。首先要明确目标：Agent 不是单次 LLM 调用，而是围绕任务目标进行推理、状态维护、工具调用和结果校验的闭环系统。因此回答时应说明该能力在闭环中的位置，例如是在输入理解阶段、计划生成阶段、工具执行阶段，还是结果评估阶段发挥作用。

工程实现上，可以按“策略层 + 执行层 + 保护层”展开。策略层负责判断是否需要该能力以及何时触发；执行层负责把策略落到具体组件，例如检索器、工具注册表、状态机、任务队列或评测器；保护层负责处理异常，包括参数校验、超时重试、权限检查、循环终止、低置信度拒答和人工升级。对于面试题中涉及框架或协议的场景，还要说明为什么选择它，而不是只说“用 LangChain/LangGraph/MCP 就可以”。

生产级答案还需要补充指标。效果类问题要看准确率、召回率、任务成功率、工具调用成功率和人工接管率；效率类问题要看端到端延迟、Token 成本、并发吞吐和失败重试次数；安全类问题要看越权调用、Prompt Injection、危险操作拦截率和审计日志完整性。只有把机制、实现和指标连起来，才说明候选人真正做过或认真设计过 Agent 系统。

**加分项：** 能主动指出边界条件和 trade-off，例如更强的 Agent 自主性会带来更高成本和更难调试的状态空间；更严格的安全策略会降低自动化率；更长上下文不等于更高准确率，仍然需要检索、压缩和评测闭环。

---

### Q38：Agent Memory 怎么设计？

**考察点**

考察候选人在Agent 架构设计类上的理解深度，尤其是Agent 的规划、记忆、状态流转、框架选型和复杂任务拆解能力。

**解答思路**

1. 先给出清晰定义，明确这个问题所在的系统边界和输入输出。
2. 再拆成核心机制、工程实现、风险控制三个层次回答，避免只背概念。
3. 最后结合生产场景说明如何评估效果、如何兜底，以及如何做取舍。

**参考答案**

这类问题回答时不要停留在名词解释，而要把它放到一个真实 AI Agent 系统里看。首先要明确目标：Agent 不是单次 LLM 调用，而是围绕任务目标进行推理、状态维护、工具调用和结果校验的闭环系统。因此回答时应说明该能力在闭环中的位置，例如是在输入理解阶段、计划生成阶段、工具执行阶段，还是结果评估阶段发挥作用。

工程实现上，可以按“策略层 + 执行层 + 保护层”展开。策略层负责判断是否需要该能力以及何时触发；执行层负责把策略落到具体组件，例如检索器、工具注册表、状态机、任务队列或评测器；保护层负责处理异常，包括参数校验、超时重试、权限检查、循环终止、低置信度拒答和人工升级。对于面试题中涉及框架或协议的场景，还要说明为什么选择它，而不是只说“用 LangChain/LangGraph/MCP 就可以”。

生产级答案还需要补充指标。效果类问题要看准确率、召回率、任务成功率、工具调用成功率和人工接管率；效率类问题要看端到端延迟、Token 成本、并发吞吐和失败重试次数；安全类问题要看越权调用、Prompt Injection、危险操作拦截率和审计日志完整性。只有把机制、实现和指标连起来，才说明候选人真正做过或认真设计过 Agent 系统。

**加分项：** 能主动指出边界条件和 trade-off，例如更强的 Agent 自主性会带来更高成本和更难调试的状态空间；更严格的安全策略会降低自动化率；更长上下文不等于更高准确率，仍然需要检索、压缩和评测闭环。

---

### Q39：项目里怎么设计 Agent 上下文维护机制？

**考察点**

考察候选人在Agent 架构设计类上的理解深度，尤其是Agent 的规划、记忆、状态流转、框架选型和复杂任务拆解能力。

**解答思路**

1. 先给出清晰定义，明确这个问题所在的系统边界和输入输出。
2. 再拆成核心机制、工程实现、风险控制三个层次回答，避免只背概念。
3. 最后结合生产场景说明如何评估效果、如何兜底，以及如何做取舍。

**参考答案**

这类问题回答时不要停留在名词解释，而要把它放到一个真实 AI Agent 系统里看。首先要明确目标：Agent 不是单次 LLM 调用，而是围绕任务目标进行推理、状态维护、工具调用和结果校验的闭环系统。因此回答时应说明该能力在闭环中的位置，例如是在输入理解阶段、计划生成阶段、工具执行阶段，还是结果评估阶段发挥作用。

工程实现上，可以按“策略层 + 执行层 + 保护层”展开。策略层负责判断是否需要该能力以及何时触发；执行层负责把策略落到具体组件，例如检索器、工具注册表、状态机、任务队列或评测器；保护层负责处理异常，包括参数校验、超时重试、权限检查、循环终止、低置信度拒答和人工升级。对于面试题中涉及框架或协议的场景，还要说明为什么选择它，而不是只说“用 LangChain/LangGraph/MCP 就可以”。

生产级答案还需要补充指标。效果类问题要看准确率、召回率、任务成功率、工具调用成功率和人工接管率；效率类问题要看端到端延迟、Token 成本、并发吞吐和失败重试次数；安全类问题要看越权调用、Prompt Injection、危险操作拦截率和审计日志完整性。只有把机制、实现和指标连起来，才说明候选人真正做过或认真设计过 Agent 系统。

**加分项：** 能主动指出边界条件和 trade-off，例如更强的 Agent 自主性会带来更高成本和更难调试的状态空间；更严格的安全策略会降低自动化率；更长上下文不等于更高准确率，仍然需要检索、压缩和评测闭环。

---

### Q40：Agent 规划器怎么避免路径震荡？

**考察点**

考察候选人在Agent 架构设计类上的理解深度，尤其是Agent 的规划、记忆、状态流转、框架选型和复杂任务拆解能力。

**解答思路**

1. 先给出清晰定义，明确这个问题所在的系统边界和输入输出。
2. 再拆成核心机制、工程实现、风险控制三个层次回答，避免只背概念。
3. 最后结合生产场景说明如何评估效果、如何兜底，以及如何做取舍。

**参考答案**

这类问题回答时不要停留在名词解释，而要把它放到一个真实 AI Agent 系统里看。首先要明确目标：Agent 不是单次 LLM 调用，而是围绕任务目标进行推理、状态维护、工具调用和结果校验的闭环系统。因此回答时应说明该能力在闭环中的位置，例如是在输入理解阶段、计划生成阶段、工具执行阶段，还是结果评估阶段发挥作用。

工程实现上，可以按“策略层 + 执行层 + 保护层”展开。策略层负责判断是否需要该能力以及何时触发；执行层负责把策略落到具体组件，例如检索器、工具注册表、状态机、任务队列或评测器；保护层负责处理异常，包括参数校验、超时重试、权限检查、循环终止、低置信度拒答和人工升级。对于面试题中涉及框架或协议的场景，还要说明为什么选择它，而不是只说“用 LangChain/LangGraph/MCP 就可以”。

生产级答案还需要补充指标。效果类问题要看准确率、召回率、任务成功率、工具调用成功率和人工接管率；效率类问题要看端到端延迟、Token 成本、并发吞吐和失败重试次数；安全类问题要看越权调用、Prompt Injection、危险操作拦截率和审计日志完整性。只有把机制、实现和指标连起来，才说明候选人真正做过或认真设计过 Agent 系统。

**加分项：** 能主动指出边界条件和 trade-off，例如更强的 Agent 自主性会带来更高成本和更难调试的状态空间；更严格的安全策略会降低自动化率；更长上下文不等于更高准确率，仍然需要检索、压缩和评测闭环。

---

### Q41：办公 Agent 的多轮对话管理模块，怎么保障长程对话中的逻辑一致性与上下文记忆力？

**考察点**

考察候选人在Agent 架构设计类上的理解深度，尤其是Agent 的规划、记忆、状态流转、框架选型和复杂任务拆解能力。

**解答思路**

1. 先给出清晰定义，明确这个问题所在的系统边界和输入输出。
2. 再拆成核心机制、工程实现、风险控制三个层次回答，避免只背概念。
3. 最后结合生产场景说明如何评估效果、如何兜底，以及如何做取舍。

**参考答案**

这类问题回答时不要停留在名词解释，而要把它放到一个真实 AI Agent 系统里看。首先要明确目标：Agent 不是单次 LLM 调用，而是围绕任务目标进行推理、状态维护、工具调用和结果校验的闭环系统。因此回答时应说明该能力在闭环中的位置，例如是在输入理解阶段、计划生成阶段、工具执行阶段，还是结果评估阶段发挥作用。

工程实现上，可以按“策略层 + 执行层 + 保护层”展开。策略层负责判断是否需要该能力以及何时触发；执行层负责把策略落到具体组件，例如检索器、工具注册表、状态机、任务队列或评测器；保护层负责处理异常，包括参数校验、超时重试、权限检查、循环终止、低置信度拒答和人工升级。对于面试题中涉及框架或协议的场景，还要说明为什么选择它，而不是只说“用 LangChain/LangGraph/MCP 就可以”。

生产级答案还需要补充指标。效果类问题要看准确率、召回率、任务成功率、工具调用成功率和人工接管率；效率类问题要看端到端延迟、Token 成本、并发吞吐和失败重试次数；安全类问题要看越权调用、Prompt Injection、危险操作拦截率和审计日志完整性。只有把机制、实现和指标连起来，才说明候选人真正做过或认真设计过 Agent 系统。

**加分项：** 能主动指出边界条件和 trade-off，例如更强的 Agent 自主性会带来更高成本和更难调试的状态空间；更严格的安全策略会降低自动化率；更长上下文不等于更高准确率，仍然需要检索、压缩和评测闭环。

---

### Q42：LangChain 和 LangGraph 分别适合什么场景？

**考察点**

考察候选人在Agent 架构设计类上的理解深度，尤其是Agent 的规划、记忆、状态流转、框架选型和复杂任务拆解能力。

**解答思路**

1. 先给出清晰定义，明确这个问题所在的系统边界和输入输出。
2. 再拆成核心机制、工程实现、风险控制三个层次回答，避免只背概念。
3. 最后结合生产场景说明如何评估效果、如何兜底，以及如何做取舍。

**参考答案**

这类问题回答时不要停留在名词解释，而要把它放到一个真实 AI Agent 系统里看。首先要明确目标：Agent 不是单次 LLM 调用，而是围绕任务目标进行推理、状态维护、工具调用和结果校验的闭环系统。因此回答时应说明该能力在闭环中的位置，例如是在输入理解阶段、计划生成阶段、工具执行阶段，还是结果评估阶段发挥作用。

工程实现上，可以按“策略层 + 执行层 + 保护层”展开。策略层负责判断是否需要该能力以及何时触发；执行层负责把策略落到具体组件，例如检索器、工具注册表、状态机、任务队列或评测器；保护层负责处理异常，包括参数校验、超时重试、权限检查、循环终止、低置信度拒答和人工升级。对于面试题中涉及框架或协议的场景，还要说明为什么选择它，而不是只说“用 LangChain/LangGraph/MCP 就可以”。

生产级答案还需要补充指标。效果类问题要看准确率、召回率、任务成功率、工具调用成功率和人工接管率；效率类问题要看端到端延迟、Token 成本、并发吞吐和失败重试次数；安全类问题要看越权调用、Prompt Injection、危险操作拦截率和审计日志完整性。只有把机制、实现和指标连起来，才说明候选人真正做过或认真设计过 Agent 系统。

**加分项：** 能主动指出边界条件和 trade-off，例如更强的 Agent 自主性会带来更高成本和更难调试的状态空间；更严格的安全策略会降低自动化率；更长上下文不等于更高准确率，仍然需要检索、压缩和评测闭环。

---

### Q43：LangChain 的核心概念是什么？Model、Prompt、Chain、Agent、Tool、Memory、Retrieval 分别承担什么角色？

**考察点**

考察候选人在Agent 架构设计类上的理解深度，尤其是Agent 的规划、记忆、状态流转、框架选型和复杂任务拆解能力。

**解答思路**

1. 先给出清晰定义，明确这个问题所在的系统边界和输入输出。
2. 再拆成核心机制、工程实现、风险控制三个层次回答，避免只背概念。
3. 最后结合生产场景说明如何评估效果、如何兜底，以及如何做取舍。

**参考答案**

这类问题回答时不要停留在名词解释，而要把它放到一个真实 AI Agent 系统里看。首先要明确目标：Agent 不是单次 LLM 调用，而是围绕任务目标进行推理、状态维护、工具调用和结果校验的闭环系统。因此回答时应说明该能力在闭环中的位置，例如是在输入理解阶段、计划生成阶段、工具执行阶段，还是结果评估阶段发挥作用。

工程实现上，可以按“策略层 + 执行层 + 保护层”展开。策略层负责判断是否需要该能力以及何时触发；执行层负责把策略落到具体组件，例如检索器、工具注册表、状态机、任务队列或评测器；保护层负责处理异常，包括参数校验、超时重试、权限检查、循环终止、低置信度拒答和人工升级。对于面试题中涉及框架或协议的场景，还要说明为什么选择它，而不是只说“用 LangChain/LangGraph/MCP 就可以”。

生产级答案还需要补充指标。效果类问题要看准确率、召回率、任务成功率、工具调用成功率和人工接管率；效率类问题要看端到端延迟、Token 成本、并发吞吐和失败重试次数；安全类问题要看越权调用、Prompt Injection、危险操作拦截率和审计日志完整性。只有把机制、实现和指标连起来，才说明候选人真正做过或认真设计过 Agent 系统。

**加分项：** 能主动指出边界条件和 trade-off，例如更强的 Agent 自主性会带来更高成本和更难调试的状态空间；更严格的安全策略会降低自动化率；更长上下文不等于更高准确率，仍然需要检索、压缩和评测闭环。

---

### Q44：Chain 和 Agent 的区别是什么？什么时候用 Chain，什么时候用 Agent？

**考察点**

考察候选人在Agent 架构设计类上的理解深度，尤其是Agent 的规划、记忆、状态流转、框架选型和复杂任务拆解能力。

**解答思路**

1. 先给出清晰定义，明确这个问题所在的系统边界和输入输出。
2. 再拆成核心机制、工程实现、风险控制三个层次回答，避免只背概念。
3. 最后结合生产场景说明如何评估效果、如何兜底，以及如何做取舍。

**参考答案**

这类问题回答时不要停留在名词解释，而要把它放到一个真实 AI Agent 系统里看。首先要明确目标：Agent 不是单次 LLM 调用，而是围绕任务目标进行推理、状态维护、工具调用和结果校验的闭环系统。因此回答时应说明该能力在闭环中的位置，例如是在输入理解阶段、计划生成阶段、工具执行阶段，还是结果评估阶段发挥作用。

工程实现上，可以按“策略层 + 执行层 + 保护层”展开。策略层负责判断是否需要该能力以及何时触发；执行层负责把策略落到具体组件，例如检索器、工具注册表、状态机、任务队列或评测器；保护层负责处理异常，包括参数校验、超时重试、权限检查、循环终止、低置信度拒答和人工升级。对于面试题中涉及框架或协议的场景，还要说明为什么选择它，而不是只说“用 LangChain/LangGraph/MCP 就可以”。

生产级答案还需要补充指标。效果类问题要看准确率、召回率、任务成功率、工具调用成功率和人工接管率；效率类问题要看端到端延迟、Token 成本、并发吞吐和失败重试次数；安全类问题要看越权调用、Prompt Injection、危险操作拦截率和审计日志完整性。只有把机制、实现和指标连起来，才说明候选人真正做过或认真设计过 Agent 系统。

**加分项：** 能主动指出边界条件和 trade-off，例如更强的 Agent 自主性会带来更高成本和更难调试的状态空间；更严格的安全策略会降低自动化率；更长上下文不等于更高准确率，仍然需要检索、压缩和评测闭环。

---

### Q45：Agent Loop 的步骤是什么？实际应用中会遇到哪些风险或问题？

**考察点**

考察候选人在Agent 架构设计类上的理解深度，尤其是Agent 的规划、记忆、状态流转、框架选型和复杂任务拆解能力。

**解答思路**

1. 先给出清晰定义，明确这个问题所在的系统边界和输入输出。
2. 再拆成核心机制、工程实现、风险控制三个层次回答，避免只背概念。
3. 最后结合生产场景说明如何评估效果、如何兜底，以及如何做取舍。

**参考答案**

这类问题回答时不要停留在名词解释，而要把它放到一个真实 AI Agent 系统里看。首先要明确目标：Agent 不是单次 LLM 调用，而是围绕任务目标进行推理、状态维护、工具调用和结果校验的闭环系统。因此回答时应说明该能力在闭环中的位置，例如是在输入理解阶段、计划生成阶段、工具执行阶段，还是结果评估阶段发挥作用。

工程实现上，可以按“策略层 + 执行层 + 保护层”展开。策略层负责判断是否需要该能力以及何时触发；执行层负责把策略落到具体组件，例如检索器、工具注册表、状态机、任务队列或评测器；保护层负责处理异常，包括参数校验、超时重试、权限检查、循环终止、低置信度拒答和人工升级。对于面试题中涉及框架或协议的场景，还要说明为什么选择它，而不是只说“用 LangChain/LangGraph/MCP 就可以”。

生产级答案还需要补充指标。效果类问题要看准确率、召回率、任务成功率、工具调用成功率和人工接管率；效率类问题要看端到端延迟、Token 成本、并发吞吐和失败重试次数；安全类问题要看越权调用、Prompt Injection、危险操作拦截率和审计日志完整性。只有把机制、实现和指标连起来，才说明候选人真正做过或认真设计过 Agent 系统。

**加分项：** 能主动指出边界条件和 trade-off，例如更强的 Agent 自主性会带来更高成本和更难调试的状态空间；更严格的安全策略会降低自动化率；更长上下文不等于更高准确率，仍然需要检索、压缩和评测闭环。

---

### Q46：Agent 记忆框架怎么选？常见范式有哪些？

**考察点**

考察候选人在Agent 架构设计类上的理解深度，尤其是Agent 的规划、记忆、状态流转、框架选型和复杂任务拆解能力。

**解答思路**

1. 先给出清晰定义，明确这个问题所在的系统边界和输入输出。
2. 再拆成核心机制、工程实现、风险控制三个层次回答，避免只背概念。
3. 最后结合生产场景说明如何评估效果、如何兜底，以及如何做取舍。

**参考答案**

这类问题回答时不要停留在名词解释，而要把它放到一个真实 AI Agent 系统里看。首先要明确目标：Agent 不是单次 LLM 调用，而是围绕任务目标进行推理、状态维护、工具调用和结果校验的闭环系统。因此回答时应说明该能力在闭环中的位置，例如是在输入理解阶段、计划生成阶段、工具执行阶段，还是结果评估阶段发挥作用。

工程实现上，可以按“策略层 + 执行层 + 保护层”展开。策略层负责判断是否需要该能力以及何时触发；执行层负责把策略落到具体组件，例如检索器、工具注册表、状态机、任务队列或评测器；保护层负责处理异常，包括参数校验、超时重试、权限检查、循环终止、低置信度拒答和人工升级。对于面试题中涉及框架或协议的场景，还要说明为什么选择它，而不是只说“用 LangChain/LangGraph/MCP 就可以”。

生产级答案还需要补充指标。效果类问题要看准确率、召回率、任务成功率、工具调用成功率和人工接管率；效率类问题要看端到端延迟、Token 成本、并发吞吐和失败重试次数；安全类问题要看越权调用、Prompt Injection、危险操作拦截率和审计日志完整性。只有把机制、实现和指标连起来，才说明候选人真正做过或认真设计过 Agent 系统。

**加分项：** 能主动指出边界条件和 trade-off，例如更强的 Agent 自主性会带来更高成本和更难调试的状态空间；更严格的安全策略会降低自动化率；更长上下文不等于更高准确率，仍然需要检索、压缩和评测闭环。

---

### Q47：业务不允许过长 Prompt 时，如何设计提示词压缩方案？

**考察点**

考察候选人在Agent 架构设计类上的理解深度，尤其是Agent 的规划、记忆、状态流转、框架选型和复杂任务拆解能力。

**解答思路**

1. 先给出清晰定义，明确这个问题所在的系统边界和输入输出。
2. 再拆成核心机制、工程实现、风险控制三个层次回答，避免只背概念。
3. 最后结合生产场景说明如何评估效果、如何兜底，以及如何做取舍。

**参考答案**

这类问题回答时不要停留在名词解释，而要把它放到一个真实 AI Agent 系统里看。首先要明确目标：Agent 不是单次 LLM 调用，而是围绕任务目标进行推理、状态维护、工具调用和结果校验的闭环系统。因此回答时应说明该能力在闭环中的位置，例如是在输入理解阶段、计划生成阶段、工具执行阶段，还是结果评估阶段发挥作用。

工程实现上，可以按“策略层 + 执行层 + 保护层”展开。策略层负责判断是否需要该能力以及何时触发；执行层负责把策略落到具体组件，例如检索器、工具注册表、状态机、任务队列或评测器；保护层负责处理异常，包括参数校验、超时重试、权限检查、循环终止、低置信度拒答和人工升级。对于面试题中涉及框架或协议的场景，还要说明为什么选择它，而不是只说“用 LangChain/LangGraph/MCP 就可以”。

生产级答案还需要补充指标。效果类问题要看准确率、召回率、任务成功率、工具调用成功率和人工接管率；效率类问题要看端到端延迟、Token 成本、并发吞吐和失败重试次数；安全类问题要看越权调用、Prompt Injection、危险操作拦截率和审计日志完整性。只有把机制、实现和指标连起来，才说明候选人真正做过或认真设计过 Agent 系统。

**加分项：** 能主动指出边界条件和 trade-off，例如更强的 Agent 自主性会带来更高成本和更难调试的状态空间；更严格的安全策略会降低自动化率；更长上下文不等于更高准确率，仍然需要检索、压缩和评测闭环。

---

### Q48：Agent 的基本架构由哪些核心组件构成？

**考察点**

考察候选人在Agent 架构设计类上的理解深度，尤其是Agent 的规划、记忆、状态流转、框架选型和复杂任务拆解能力。

**解答思路**

1. 先给出清晰定义，明确这个问题所在的系统边界和输入输出。
2. 再拆成核心机制、工程实现、风险控制三个层次回答，避免只背概念。
3. 最后结合生产场景说明如何评估效果、如何兜底，以及如何做取舍。

**参考答案**

这类问题回答时不要停留在名词解释，而要把它放到一个真实 AI Agent 系统里看。首先要明确目标：Agent 不是单次 LLM 调用，而是围绕任务目标进行推理、状态维护、工具调用和结果校验的闭环系统。因此回答时应说明该能力在闭环中的位置，例如是在输入理解阶段、计划生成阶段、工具执行阶段，还是结果评估阶段发挥作用。

工程实现上，可以按“策略层 + 执行层 + 保护层”展开。策略层负责判断是否需要该能力以及何时触发；执行层负责把策略落到具体组件，例如检索器、工具注册表、状态机、任务队列或评测器；保护层负责处理异常，包括参数校验、超时重试、权限检查、循环终止、低置信度拒答和人工升级。对于面试题中涉及框架或协议的场景，还要说明为什么选择它，而不是只说“用 LangChain/LangGraph/MCP 就可以”。

生产级答案还需要补充指标。效果类问题要看准确率、召回率、任务成功率、工具调用成功率和人工接管率；效率类问题要看端到端延迟、Token 成本、并发吞吐和失败重试次数；安全类问题要看越权调用、Prompt Injection、危险操作拦截率和审计日志完整性。只有把机制、实现和指标连起来，才说明候选人真正做过或认真设计过 Agent 系统。

**加分项：** 能主动指出边界条件和 trade-off，例如更强的 Agent 自主性会带来更高成本和更难调试的状态空间；更严格的安全策略会降低自动化率；更长上下文不等于更高准确率，仍然需要检索、压缩和评测闭环。

---

### Q49：在构建长期陪伴型 AI 角色时，如何设计记忆机制？

**考察点**

考察候选人在Agent 架构设计类上的理解深度，尤其是Agent 的规划、记忆、状态流转、框架选型和复杂任务拆解能力。

**解答思路**

1. 先给出清晰定义，明确这个问题所在的系统边界和输入输出。
2. 再拆成核心机制、工程实现、风险控制三个层次回答，避免只背概念。
3. 最后结合生产场景说明如何评估效果、如何兜底，以及如何做取舍。

**参考答案**

这类问题回答时不要停留在名词解释，而要把它放到一个真实 AI Agent 系统里看。首先要明确目标：Agent 不是单次 LLM 调用，而是围绕任务目标进行推理、状态维护、工具调用和结果校验的闭环系统。因此回答时应说明该能力在闭环中的位置，例如是在输入理解阶段、计划生成阶段、工具执行阶段，还是结果评估阶段发挥作用。

工程实现上，可以按“策略层 + 执行层 + 保护层”展开。策略层负责判断是否需要该能力以及何时触发；执行层负责把策略落到具体组件，例如检索器、工具注册表、状态机、任务队列或评测器；保护层负责处理异常，包括参数校验、超时重试、权限检查、循环终止、低置信度拒答和人工升级。对于面试题中涉及框架或协议的场景，还要说明为什么选择它，而不是只说“用 LangChain/LangGraph/MCP 就可以”。

生产级答案还需要补充指标。效果类问题要看准确率、召回率、任务成功率、工具调用成功率和人工接管率；效率类问题要看端到端延迟、Token 成本、并发吞吐和失败重试次数；安全类问题要看越权调用、Prompt Injection、危险操作拦截率和审计日志完整性。只有把机制、实现和指标连起来，才说明候选人真正做过或认真设计过 Agent 系统。

**加分项：** 能主动指出边界条件和 trade-off，例如更强的 Agent 自主性会带来更高成本和更难调试的状态空间；更严格的安全策略会降低自动化率；更长上下文不等于更高准确率，仍然需要检索、压缩和评测闭环。

---

### Q50：LangGraph 中如何构建有记忆、可恢复的智能体？

**考察点**

考察候选人在Agent 架构设计类上的理解深度，尤其是Agent 的规划、记忆、状态流转、框架选型和复杂任务拆解能力。

**解答思路**

1. 先给出清晰定义，明确这个问题所在的系统边界和输入输出。
2. 再拆成核心机制、工程实现、风险控制三个层次回答，避免只背概念。
3. 最后结合生产场景说明如何评估效果、如何兜底，以及如何做取舍。

**参考答案**

这类问题回答时不要停留在名词解释，而要把它放到一个真实 AI Agent 系统里看。首先要明确目标：Agent 不是单次 LLM 调用，而是围绕任务目标进行推理、状态维护、工具调用和结果校验的闭环系统。因此回答时应说明该能力在闭环中的位置，例如是在输入理解阶段、计划生成阶段、工具执行阶段，还是结果评估阶段发挥作用。

工程实现上，可以按“策略层 + 执行层 + 保护层”展开。策略层负责判断是否需要该能力以及何时触发；执行层负责把策略落到具体组件，例如检索器、工具注册表、状态机、任务队列或评测器；保护层负责处理异常，包括参数校验、超时重试、权限检查、循环终止、低置信度拒答和人工升级。对于面试题中涉及框架或协议的场景，还要说明为什么选择它，而不是只说“用 LangChain/LangGraph/MCP 就可以”。

生产级答案还需要补充指标。效果类问题要看准确率、召回率、任务成功率、工具调用成功率和人工接管率；效率类问题要看端到端延迟、Token 成本、并发吞吐和失败重试次数；安全类问题要看越权调用、Prompt Injection、危险操作拦截率和审计日志完整性。只有把机制、实现和指标连起来，才说明候选人真正做过或认真设计过 Agent 系统。

**加分项：** 能主动指出边界条件和 trade-off，例如更强的 Agent 自主性会带来更高成本和更难调试的状态空间；更严格的安全策略会降低自动化率；更长上下文不等于更高准确率，仍然需要检索、压缩和评测闭环。

---

### Q51：Harness Engineering 的核心思想是什么？和传统 Agent 编排有什么区别？

**考察点**

考察候选人在Agent 架构设计类上的理解深度，尤其是Agent 的规划、记忆、状态流转、框架选型和复杂任务拆解能力。

**解答思路**

1. 先给出清晰定义，明确这个问题所在的系统边界和输入输出。
2. 再拆成核心机制、工程实现、风险控制三个层次回答，避免只背概念。
3. 最后结合生产场景说明如何评估效果、如何兜底，以及如何做取舍。

**参考答案**

这类问题回答时不要停留在名词解释，而要把它放到一个真实 AI Agent 系统里看。首先要明确目标：Agent 不是单次 LLM 调用，而是围绕任务目标进行推理、状态维护、工具调用和结果校验的闭环系统。因此回答时应说明该能力在闭环中的位置，例如是在输入理解阶段、计划生成阶段、工具执行阶段，还是结果评估阶段发挥作用。

工程实现上，可以按“策略层 + 执行层 + 保护层”展开。策略层负责判断是否需要该能力以及何时触发；执行层负责把策略落到具体组件，例如检索器、工具注册表、状态机、任务队列或评测器；保护层负责处理异常，包括参数校验、超时重试、权限检查、循环终止、低置信度拒答和人工升级。对于面试题中涉及框架或协议的场景，还要说明为什么选择它，而不是只说“用 LangChain/LangGraph/MCP 就可以”。

生产级答案还需要补充指标。效果类问题要看准确率、召回率、任务成功率、工具调用成功率和人工接管率；效率类问题要看端到端延迟、Token 成本、并发吞吐和失败重试次数；安全类问题要看越权调用、Prompt Injection、危险操作拦截率和审计日志完整性。只有把机制、实现和指标连起来，才说明候选人真正做过或认真设计过 Agent 系统。

**加分项：** 能主动指出边界条件和 trade-off，例如更强的 Agent 自主性会带来更高成本和更难调试的状态空间；更严格的安全策略会降低自动化率；更长上下文不等于更高准确率，仍然需要检索、压缩和评测闭环。

---

### Q52：Agent 设计范式有哪些？Plan-Execute、ReAct、Multi-Agent、Reflexion、Memory、State Machine 分别怎么用？

**考察点**

考察候选人在Agent 架构设计类上的理解深度，尤其是Agent 的规划、记忆、状态流转、框架选型和复杂任务拆解能力。

**解答思路**

1. 先给出清晰定义，明确这个问题所在的系统边界和输入输出。
2. 再拆成核心机制、工程实现、风险控制三个层次回答，避免只背概念。
3. 最后结合生产场景说明如何评估效果、如何兜底，以及如何做取舍。

**参考答案**

这类问题回答时不要停留在名词解释，而要把它放到一个真实 AI Agent 系统里看。首先要明确目标：Agent 不是单次 LLM 调用，而是围绕任务目标进行推理、状态维护、工具调用和结果校验的闭环系统。因此回答时应说明该能力在闭环中的位置，例如是在输入理解阶段、计划生成阶段、工具执行阶段，还是结果评估阶段发挥作用。

工程实现上，可以按“策略层 + 执行层 + 保护层”展开。策略层负责判断是否需要该能力以及何时触发；执行层负责把策略落到具体组件，例如检索器、工具注册表、状态机、任务队列或评测器；保护层负责处理异常，包括参数校验、超时重试、权限检查、循环终止、低置信度拒答和人工升级。对于面试题中涉及框架或协议的场景，还要说明为什么选择它，而不是只说“用 LangChain/LangGraph/MCP 就可以”。

生产级答案还需要补充指标。效果类问题要看准确率、召回率、任务成功率、工具调用成功率和人工接管率；效率类问题要看端到端延迟、Token 成本、并发吞吐和失败重试次数；安全类问题要看越权调用、Prompt Injection、危险操作拦截率和审计日志完整性。只有把机制、实现和指标连起来，才说明候选人真正做过或认真设计过 Agent 系统。

**加分项：** 能主动指出边界条件和 trade-off，例如更强的 Agent 自主性会带来更高成本和更难调试的状态空间；更严格的安全策略会降低自动化率；更长上下文不等于更高准确率，仍然需要检索、压缩和评测闭环。

---

### Q53：Manus 的原理是什么？它用了哪些 Agent 设计范式和流程？

**考察点**

考察候选人在Agent 架构设计类上的理解深度，尤其是Agent 的规划、记忆、状态流转、框架选型和复杂任务拆解能力。

**解答思路**

1. 先给出清晰定义，明确这个问题所在的系统边界和输入输出。
2. 再拆成核心机制、工程实现、风险控制三个层次回答，避免只背概念。
3. 最后结合生产场景说明如何评估效果、如何兜底，以及如何做取舍。

**参考答案**

这类问题回答时不要停留在名词解释，而要把它放到一个真实 AI Agent 系统里看。首先要明确目标：Agent 不是单次 LLM 调用，而是围绕任务目标进行推理、状态维护、工具调用和结果校验的闭环系统。因此回答时应说明该能力在闭环中的位置，例如是在输入理解阶段、计划生成阶段、工具执行阶段，还是结果评估阶段发挥作用。

工程实现上，可以按“策略层 + 执行层 + 保护层”展开。策略层负责判断是否需要该能力以及何时触发；执行层负责把策略落到具体组件，例如检索器、工具注册表、状态机、任务队列或评测器；保护层负责处理异常，包括参数校验、超时重试、权限检查、循环终止、低置信度拒答和人工升级。对于面试题中涉及框架或协议的场景，还要说明为什么选择它，而不是只说“用 LangChain/LangGraph/MCP 就可以”。

生产级答案还需要补充指标。效果类问题要看准确率、召回率、任务成功率、工具调用成功率和人工接管率；效率类问题要看端到端延迟、Token 成本、并发吞吐和失败重试次数；安全类问题要看越权调用、Prompt Injection、危险操作拦截率和审计日志完整性。只有把机制、实现和指标连起来，才说明候选人真正做过或认真设计过 Agent 系统。

**加分项：** 能主动指出边界条件和 trade-off，例如更强的 Agent 自主性会带来更高成本和更难调试的状态空间；更严格的安全策略会降低自动化率；更长上下文不等于更高准确率，仍然需要检索、压缩和评测闭环。

---

### Q54：面向亿级用户的 C 端 Agent，如何设计 Planning、Memory、Context Optimization 和个性化能力？

**考察点**

考察候选人在Agent 架构设计类上的理解深度，尤其是Agent 的规划、记忆、状态流转、框架选型和复杂任务拆解能力。

**解答思路**

1. 先给出清晰定义，明确这个问题所在的系统边界和输入输出。
2. 再拆成核心机制、工程实现、风险控制三个层次回答，避免只背概念。
3. 最后结合生产场景说明如何评估效果、如何兜底，以及如何做取舍。

**参考答案**

这类问题回答时不要停留在名词解释，而要把它放到一个真实 AI Agent 系统里看。首先要明确目标：Agent 不是单次 LLM 调用，而是围绕任务目标进行推理、状态维护、工具调用和结果校验的闭环系统。因此回答时应说明该能力在闭环中的位置，例如是在输入理解阶段、计划生成阶段、工具执行阶段，还是结果评估阶段发挥作用。

工程实现上，可以按“策略层 + 执行层 + 保护层”展开。策略层负责判断是否需要该能力以及何时触发；执行层负责把策略落到具体组件，例如检索器、工具注册表、状态机、任务队列或评测器；保护层负责处理异常，包括参数校验、超时重试、权限检查、循环终止、低置信度拒答和人工升级。对于面试题中涉及框架或协议的场景，还要说明为什么选择它，而不是只说“用 LangChain/LangGraph/MCP 就可以”。

生产级答案还需要补充指标。效果类问题要看准确率、召回率、任务成功率、工具调用成功率和人工接管率；效率类问题要看端到端延迟、Token 成本、并发吞吐和失败重试次数；安全类问题要看越权调用、Prompt Injection、危险操作拦截率和审计日志完整性。只有把机制、实现和指标连起来，才说明候选人真正做过或认真设计过 Agent 系统。

**加分项：** 能主动指出边界条件和 trade-off，例如更强的 Agent 自主性会带来更高成本和更难调试的状态空间；更严格的安全策略会降低自动化率；更长上下文不等于更高准确率，仍然需要检索、压缩和评测闭环。

---

### Q55：ReAct、PlanAct、CodeAct 在 Agent 架构中的差异是什么？各自适合什么任务？

**考察点**

考察候选人在Agent 架构设计类上的理解深度，尤其是Agent 的规划、记忆、状态流转、框架选型和复杂任务拆解能力。

**解答思路**

1. 先给出清晰定义，明确这个问题所在的系统边界和输入输出。
2. 再拆成核心机制、工程实现、风险控制三个层次回答，避免只背概念。
3. 最后结合生产场景说明如何评估效果、如何兜底，以及如何做取舍。

**参考答案**

这类问题回答时不要停留在名词解释，而要把它放到一个真实 AI Agent 系统里看。首先要明确目标：Agent 不是单次 LLM 调用，而是围绕任务目标进行推理、状态维护、工具调用和结果校验的闭环系统。因此回答时应说明该能力在闭环中的位置，例如是在输入理解阶段、计划生成阶段、工具执行阶段，还是结果评估阶段发挥作用。

工程实现上，可以按“策略层 + 执行层 + 保护层”展开。策略层负责判断是否需要该能力以及何时触发；执行层负责把策略落到具体组件，例如检索器、工具注册表、状态机、任务队列或评测器；保护层负责处理异常，包括参数校验、超时重试、权限检查、循环终止、低置信度拒答和人工升级。对于面试题中涉及框架或协议的场景，还要说明为什么选择它，而不是只说“用 LangChain/LangGraph/MCP 就可以”。

生产级答案还需要补充指标。效果类问题要看准确率、召回率、任务成功率、工具调用成功率和人工接管率；效率类问题要看端到端延迟、Token 成本、并发吞吐和失败重试次数；安全类问题要看越权调用、Prompt Injection、危险操作拦截率和审计日志完整性。只有把机制、实现和指标连起来，才说明候选人真正做过或认真设计过 Agent 系统。

**加分项：** 能主动指出边界条件和 trade-off，例如更强的 Agent 自主性会带来更高成本和更难调试的状态空间；更严格的安全策略会降低自动化率；更长上下文不等于更高准确率，仍然需要检索、压缩和评测闭环。

---

### Q56：LangGraph 中如何构建多智能体协作系统？

**考察点**

考察候选人在Agent 架构设计类上的理解深度，尤其是Agent 的规划、记忆、状态流转、框架选型和复杂任务拆解能力。

**解答思路**

1. 先给出清晰定义，明确这个问题所在的系统边界和输入输出。
2. 再拆成核心机制、工程实现、风险控制三个层次回答，避免只背概念。
3. 最后结合生产场景说明如何评估效果、如何兜底，以及如何做取舍。

**参考答案**

这类问题回答时不要停留在名词解释，而要把它放到一个真实 AI Agent 系统里看。首先要明确目标：Agent 不是单次 LLM 调用，而是围绕任务目标进行推理、状态维护、工具调用和结果校验的闭环系统。因此回答时应说明该能力在闭环中的位置，例如是在输入理解阶段、计划生成阶段、工具执行阶段，还是结果评估阶段发挥作用。

工程实现上，可以按“策略层 + 执行层 + 保护层”展开。策略层负责判断是否需要该能力以及何时触发；执行层负责把策略落到具体组件，例如检索器、工具注册表、状态机、任务队列或评测器；保护层负责处理异常，包括参数校验、超时重试、权限检查、循环终止、低置信度拒答和人工升级。对于面试题中涉及框架或协议的场景，还要说明为什么选择它，而不是只说“用 LangChain/LangGraph/MCP 就可以”。

生产级答案还需要补充指标。效果类问题要看准确率、召回率、任务成功率、工具调用成功率和人工接管率；效率类问题要看端到端延迟、Token 成本、并发吞吐和失败重试次数；安全类问题要看越权调用、Prompt Injection、危险操作拦截率和审计日志完整性。只有把机制、实现和指标连起来，才说明候选人真正做过或认真设计过 Agent 系统。

**加分项：** 能主动指出边界条件和 trade-off，例如更强的 Agent 自主性会带来更高成本和更难调试的状态空间；更严格的安全策略会降低自动化率；更长上下文不等于更高准确率，仍然需要检索、压缩和评测闭环。

---

### Q57：全模态 Agent 长程任务中，RL 算法和工程 Co-Design 应如何配合？

**考察点**

考察候选人在Agent 架构设计类上的理解深度，尤其是Agent 的规划、记忆、状态流转、框架选型和复杂任务拆解能力。

**解答思路**

1. 先给出清晰定义，明确这个问题所在的系统边界和输入输出。
2. 再拆成核心机制、工程实现、风险控制三个层次回答，避免只背概念。
3. 最后结合生产场景说明如何评估效果、如何兜底，以及如何做取舍。

**参考答案**

这类问题回答时不要停留在名词解释，而要把它放到一个真实 AI Agent 系统里看。首先要明确目标：Agent 不是单次 LLM 调用，而是围绕任务目标进行推理、状态维护、工具调用和结果校验的闭环系统。因此回答时应说明该能力在闭环中的位置，例如是在输入理解阶段、计划生成阶段、工具执行阶段，还是结果评估阶段发挥作用。

工程实现上，可以按“策略层 + 执行层 + 保护层”展开。策略层负责判断是否需要该能力以及何时触发；执行层负责把策略落到具体组件，例如检索器、工具注册表、状态机、任务队列或评测器；保护层负责处理异常，包括参数校验、超时重试、权限检查、循环终止、低置信度拒答和人工升级。对于面试题中涉及框架或协议的场景，还要说明为什么选择它，而不是只说“用 LangChain/LangGraph/MCP 就可以”。

生产级答案还需要补充指标。效果类问题要看准确率、召回率、任务成功率、工具调用成功率和人工接管率；效率类问题要看端到端延迟、Token 成本、并发吞吐和失败重试次数；安全类问题要看越权调用、Prompt Injection、危险操作拦截率和审计日志完整性。只有把机制、实现和指标连起来，才说明候选人真正做过或认真设计过 Agent 系统。

**加分项：** 能主动指出边界条件和 trade-off，例如更强的 Agent 自主性会带来更高成本和更难调试的状态空间；更严格的安全策略会降低自动化率；更长上下文不等于更高准确率，仍然需要检索、压缩和评测闭环。

---

### Q58：设计一个企业级 Agent 系统，需要考虑哪些工具管理、记忆状态、可靠性、安全和可观测性问题？

**考察点**

考察候选人在Agent 架构设计类上的理解深度，尤其是Agent 的规划、记忆、状态流转、框架选型和复杂任务拆解能力。

**解答思路**

1. 先给出清晰定义，明确这个问题所在的系统边界和输入输出。
2. 再拆成核心机制、工程实现、风险控制三个层次回答，避免只背概念。
3. 最后结合生产场景说明如何评估效果、如何兜底，以及如何做取舍。

**参考答案**

这类问题回答时不要停留在名词解释，而要把它放到一个真实 AI Agent 系统里看。首先要明确目标：Agent 不是单次 LLM 调用，而是围绕任务目标进行推理、状态维护、工具调用和结果校验的闭环系统。因此回答时应说明该能力在闭环中的位置，例如是在输入理解阶段、计划生成阶段、工具执行阶段，还是结果评估阶段发挥作用。

工程实现上，可以按“策略层 + 执行层 + 保护层”展开。策略层负责判断是否需要该能力以及何时触发；执行层负责把策略落到具体组件，例如检索器、工具注册表、状态机、任务队列或评测器；保护层负责处理异常，包括参数校验、超时重试、权限检查、循环终止、低置信度拒答和人工升级。对于面试题中涉及框架或协议的场景，还要说明为什么选择它，而不是只说“用 LangChain/LangGraph/MCP 就可以”。

生产级答案还需要补充指标。效果类问题要看准确率、召回率、任务成功率、工具调用成功率和人工接管率；效率类问题要看端到端延迟、Token 成本、并发吞吐和失败重试次数；安全类问题要看越权调用、Prompt Injection、危险操作拦截率和审计日志完整性。只有把机制、实现和指标连起来，才说明候选人真正做过或认真设计过 Agent 系统。

**加分项：** 能主动指出边界条件和 trade-off，例如更强的 Agent 自主性会带来更高成本和更难调试的状态空间；更严格的安全策略会降低自动化率；更长上下文不等于更高准确率，仍然需要检索、压缩和评测闭环。

---

### Q59：在真实复杂业务场景中，如何推动 Agent 算法效果落地并快速迭代？

**考察点**

考察候选人在Agent 架构设计类上的理解深度，尤其是Agent 的规划、记忆、状态流转、框架选型和复杂任务拆解能力。

**解答思路**

1. 先给出清晰定义，明确这个问题所在的系统边界和输入输出。
2. 再拆成核心机制、工程实现、风险控制三个层次回答，避免只背概念。
3. 最后结合生产场景说明如何评估效果、如何兜底，以及如何做取舍。

**参考答案**

这类问题回答时不要停留在名词解释，而要把它放到一个真实 AI Agent 系统里看。首先要明确目标：Agent 不是单次 LLM 调用，而是围绕任务目标进行推理、状态维护、工具调用和结果校验的闭环系统。因此回答时应说明该能力在闭环中的位置，例如是在输入理解阶段、计划生成阶段、工具执行阶段，还是结果评估阶段发挥作用。

工程实现上，可以按“策略层 + 执行层 + 保护层”展开。策略层负责判断是否需要该能力以及何时触发；执行层负责把策略落到具体组件，例如检索器、工具注册表、状态机、任务队列或评测器；保护层负责处理异常，包括参数校验、超时重试、权限检查、循环终止、低置信度拒答和人工升级。对于面试题中涉及框架或协议的场景，还要说明为什么选择它，而不是只说“用 LangChain/LangGraph/MCP 就可以”。

生产级答案还需要补充指标。效果类问题要看准确率、召回率、任务成功率、工具调用成功率和人工接管率；效率类问题要看端到端延迟、Token 成本、并发吞吐和失败重试次数；安全类问题要看越权调用、Prompt Injection、危险操作拦截率和审计日志完整性。只有把机制、实现和指标连起来，才说明候选人真正做过或认真设计过 Agent 系统。

**加分项：** 能主动指出边界条件和 trade-off，例如更强的 Agent 自主性会带来更高成本和更难调试的状态空间；更严格的安全策略会降低自动化率；更长上下文不等于更高准确率，仍然需要检索、压缩和评测闭环。

---

### Q60：Agent 的 Token 消耗很大，如何从工具选择、模式选择、上下文压缩、模型路由和缓存角度优化成本？

**考察点**

考察候选人在Agent 架构设计类上的理解深度，尤其是Agent 的规划、记忆、状态流转、框架选型和复杂任务拆解能力。

**解答思路**

1. 先给出清晰定义，明确这个问题所在的系统边界和输入输出。
2. 再拆成核心机制、工程实现、风险控制三个层次回答，避免只背概念。
3. 最后结合生产场景说明如何评估效果、如何兜底，以及如何做取舍。

**参考答案**

这类问题回答时不要停留在名词解释，而要把它放到一个真实 AI Agent 系统里看。首先要明确目标：Agent 不是单次 LLM 调用，而是围绕任务目标进行推理、状态维护、工具调用和结果校验的闭环系统。因此回答时应说明该能力在闭环中的位置，例如是在输入理解阶段、计划生成阶段、工具执行阶段，还是结果评估阶段发挥作用。

工程实现上，可以按“策略层 + 执行层 + 保护层”展开。策略层负责判断是否需要该能力以及何时触发；执行层负责把策略落到具体组件，例如检索器、工具注册表、状态机、任务队列或评测器；保护层负责处理异常，包括参数校验、超时重试、权限检查、循环终止、低置信度拒答和人工升级。对于面试题中涉及框架或协议的场景，还要说明为什么选择它，而不是只说“用 LangChain/LangGraph/MCP 就可以”。

生产级答案还需要补充指标。效果类问题要看准确率、召回率、任务成功率、工具调用成功率和人工接管率；效率类问题要看端到端延迟、Token 成本、并发吞吐和失败重试次数；安全类问题要看越权调用、Prompt Injection、危险操作拦截率和审计日志完整性。只有把机制、实现和指标连起来，才说明候选人真正做过或认真设计过 Agent 系统。

**加分项：** 能主动指出边界条件和 trade-off，例如更强的 Agent 自主性会带来更高成本和更难调试的状态空间；更严格的安全策略会降低自动化率；更长上下文不等于更高准确率，仍然需要检索、压缩和评测闭环。

---

### Q61：Prompt Injection 如何防御？数据/指令分离、输入过滤、模板隔离和上下文标记怎么落地？

**考察点**

考察候选人在Agent 架构设计类上的理解深度，尤其是Agent 的规划、记忆、状态流转、框架选型和复杂任务拆解能力。

**解答思路**

1. 先给出清晰定义，明确这个问题所在的系统边界和输入输出。
2. 再拆成核心机制、工程实现、风险控制三个层次回答，避免只背概念。
3. 最后结合生产场景说明如何评估效果、如何兜底，以及如何做取舍。

**参考答案**

这类问题回答时不要停留在名词解释，而要把它放到一个真实 AI Agent 系统里看。首先要明确目标：Agent 不是单次 LLM 调用，而是围绕任务目标进行推理、状态维护、工具调用和结果校验的闭环系统。因此回答时应说明该能力在闭环中的位置，例如是在输入理解阶段、计划生成阶段、工具执行阶段，还是结果评估阶段发挥作用。

工程实现上，可以按“策略层 + 执行层 + 保护层”展开。策略层负责判断是否需要该能力以及何时触发；执行层负责把策略落到具体组件，例如检索器、工具注册表、状态机、任务队列或评测器；保护层负责处理异常，包括参数校验、超时重试、权限检查、循环终止、低置信度拒答和人工升级。对于面试题中涉及框架或协议的场景，还要说明为什么选择它，而不是只说“用 LangChain/LangGraph/MCP 就可以”。

生产级答案还需要补充指标。效果类问题要看准确率、召回率、任务成功率、工具调用成功率和人工接管率；效率类问题要看端到端延迟、Token 成本、并发吞吐和失败重试次数；安全类问题要看越权调用、Prompt Injection、危险操作拦截率和审计日志完整性。只有把机制、实现和指标连起来，才说明候选人真正做过或认真设计过 Agent 系统。

**加分项：** 能主动指出边界条件和 trade-off，例如更强的 Agent 自主性会带来更高成本和更难调试的状态空间；更严格的安全策略会降低自动化率；更长上下文不等于更高准确率，仍然需要检索、压缩和评测闭环。

---

### Q62：LangGraph / LangChain Agent 在生产环境部署时，需要哪些状态持久化、恢复和监控机制？

**考察点**

考察候选人在Agent 架构设计类上的理解深度，尤其是Agent 的规划、记忆、状态流转、框架选型和复杂任务拆解能力。

**解答思路**

1. 先给出清晰定义，明确这个问题所在的系统边界和输入输出。
2. 再拆成核心机制、工程实现、风险控制三个层次回答，避免只背概念。
3. 最后结合生产场景说明如何评估效果、如何兜底，以及如何做取舍。

**参考答案**

这类问题回答时不要停留在名词解释，而要把它放到一个真实 AI Agent 系统里看。首先要明确目标：Agent 不是单次 LLM 调用，而是围绕任务目标进行推理、状态维护、工具调用和结果校验的闭环系统。因此回答时应说明该能力在闭环中的位置，例如是在输入理解阶段、计划生成阶段、工具执行阶段，还是结果评估阶段发挥作用。

工程实现上，可以按“策略层 + 执行层 + 保护层”展开。策略层负责判断是否需要该能力以及何时触发；执行层负责把策略落到具体组件，例如检索器、工具注册表、状态机、任务队列或评测器；保护层负责处理异常，包括参数校验、超时重试、权限检查、循环终止、低置信度拒答和人工升级。对于面试题中涉及框架或协议的场景，还要说明为什么选择它，而不是只说“用 LangChain/LangGraph/MCP 就可以”。

生产级答案还需要补充指标。效果类问题要看准确率、召回率、任务成功率、工具调用成功率和人工接管率；效率类问题要看端到端延迟、Token 成本、并发吞吐和失败重试次数；安全类问题要看越权调用、Prompt Injection、危险操作拦截率和审计日志完整性。只有把机制、实现和指标连起来，才说明候选人真正做过或认真设计过 Agent 系统。

**加分项：** 能主动指出边界条件和 trade-off，例如更强的 Agent 自主性会带来更高成本和更难调试的状态空间；更严格的安全策略会降低自动化率；更长上下文不等于更高准确率，仍然需要检索、压缩和评测闭环。

---
