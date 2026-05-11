# Module 5 & 6：多Agent + 工程落地 - 新增题目解答

> 生成日期：2026-05-11 | Module 5: 13 题 | Module 6: 19 题

---

## Module 5：多 Agent 设计类

### Q1：多 Agent 怎么编排？具体流程是什么？

**考察点**

候选人是否理解 Multi-Agent 编排的本质是"任务分解 + 执行调度 + 结果整合"的三段式流水线，能否区分 Orchestration（中心化编排）和 Choreography（去中心化协作）两种范式并给出具体实现。

**解答思路**

1. 先明确编排的两种范式（Orchestration vs Choreography），说明各自的适用场景和代表框架。
2. 然后展开 Orchestration 模式下的具体流程：任务接入 -> 意图解析 -> 计划生成 -> Agent 路由 -> 并行/串行调度 -> 结果收集 -> 质量校验 -> 最终输出。
3. 最后补充 Choreography 模式下基于事件总线的松耦合协作方式（如 AutoGen 的 GroupChat 模式）。

**参考答案**

多 Agent 编排的本质是将复杂任务分解为可独立执行的子任务，由编排器统一调度执行、收集结果并整合输出。

**范式一：Orchestration（中心化编排）**

核心是通过一个 Orchestrator/Manager Agent 控制全局。具体流程为：

1. **任务接入层**：接收用户请求，通过意图分类器确定任务类型（如代码生成、数据分析、文档撰写）。
2. **任务规划层**：Orchestrator 调用 Planner 将任务分解为 DAG（有向无环图），每个节点代表一个子任务，边代表依赖关系。例如 LangGraph 中用 `add_edge` 定义顺序，`add_conditional_edges` 定义分支。
3. **Agent 调度层**：根据子任务类型路由到对应的 Sub-Agent（如 CodeAgent、DataAgent、ReviewAgent）。支持并行调度（无依赖的节点同时执行用 `asyncio.gather`）和串行调度（有依赖的节点按拓扑序执行）。
4. **结果整合层**：Orchestrator 收集所有 Sub-Agent 的输出，执行格式对齐、冲突消解、冗余去重。如果是代码生成场景，还需要合并 diff 解决冲突。
5. **质量保证层**：最终输出经 Reviewer Agent 校验后返回用户。若不通过，回退到步骤 2 重新规划。

**范式二：Choreography（去中心化协作）**

AutoGen 的 GroupChat 模式为代表。Agent 之间平等通信，通过共享消息总线 + Speaker Selection 机制决定下一个发言者。无需中心编排器，适合探索性、开放式协作场景。

**加分项**

1. 能画出编排流程的 DAG 图，标注串行/并行节点。
2. 提到 LangGraph 的 `Send` API 实现 Map-Reduce 并行模式。
3. 讨论编排器的容错设计：Sub-Agent 超时时是 retry、fallback 到其他 Agent、还是降级为直接 LLM 回答。

---

### Q2：多 Agent 之间的数据传输/通信怎么做？

**考察点**

候选人是否理解 Multi-Agent 通信的数据结构设计、序列化协议选择、以及上下文传递中的信息保真度问题。

**解答思路**

1. 先给出通信的三种基本模式：共享内存（State）、消息传递（Message）、事件总线（Event Bus）。
2. 然后展开具体的数据格式和协议（JSON、结构化 Schema、A2A 协议）。
3. 最后讨论通信中的工程挑战：上下文窗口管理、消息压缩、版本兼容。

**参考答案**

多 Agent 间的数据传输/通信有三种主流模式：

**模式一：共享状态（Shared State）**

LangGraph 的核心机制。定义一个全局 `State` 对象（TypedDict 或 Pydantic Model），所有 Agent 通过读写 State 的特定字段完成通信。

```python
class AgentState(TypedDict):
    messages: Annotated[list, add_messages]  # 对话历史
    task_plan: list[dict]                     # 任务计划
    intermediate_results: dict                # 中间结果
    final_output: str                         # 最终输出
```

优势：通信开销低，无需序列化/反序列化。劣势：需要处理并发写入冲突（LangGraph 通过 reducer 函数解决，如 `add_messages` 实现 append-only 语义）。

**模式二：消息传递（Message Passing）**

AutoGen 的核心机制。Agent 之间通过结构化消息通信，每个消息包含 `sender`、`receiver`、`content`、`metadata`。消息体通常为 JSON 或结构化自然语言。

关键设计点：
- **消息压缩**：传递长对话历史前先用 LLM 做摘要压缩，避免 token 爆炸。例如只传递"当前子任务描述 + 关键上下文摘要"，而非完整对话历史。
- **结构化协议**：使用 A2A（Agent-to-Agent）协议标准化 Agent 间的通信格式。A2A 定义了 Agent Card（能力声明）、Task（任务描述）、Message（消息格式）、Artifact（产出物）等标准原语。
- **上下文隔离**：各 Sub-Agent 仅接收执行当前子任务所需的最小信息，而非全部上下文。

**模式三：事件总线（Event Bus）**

CrewAI 和 AutoGen 的 GroupChat 中隐含使用。Agent 发布事件到总线上（如 `task_completed`、`error_occurred`、`need_clarification`），其他 Agent 根据事件类型决定是否响应。适合松耦合的 Choreography 模式。

**数据格式最佳实践**：建议使用 Pydantic 强类型 Schema 而非自由 JSON，在数据传输层做校验，防止一个 Agent 的错误输出污染下游。

**加分项**

1. 提到 A2A 协议的具体字段设计（AgentCard、Task、Message、Artifact）。
2. 讨论消息大小约束策略：超过 4K token 的消息自动触发摘要压缩。
3. 提到 MCP 用于 Agent-工具通信（纵向），A2A 用于 Agent-Agent 通信（横向）的分工。

---

### Q3：Multi-Agent 三层架构（Router -> Manager -> Sub-Agent）如何设计？

**考察点**

候选人是否具备分层架构设计能力，理解每一层的职责边界、接口定义和故障隔离策略。

**解答思路**

1. 画架构分层图，明确每层的输入/输出/职责。
2. 重点讲 Router 层的意图识别与分流策略、Manager 层的 DAG 编排逻辑、Sub-Agent 层的执行与结果返回。
3. 讨论跨层通信协议和故障隔离。

**参考答案**

三层架构是 Multi-Agent 系统最经典的分层设计：

```
┌─────────────────────────────────────────┐
│  Layer 1: Router (路由层)               │
│  职责：意图识别 → 场景分流 → Agent 选择 │
│  输入：用户原始请求                      │
│  输出：(scene_type, routed_manager)      │
├─────────────────────────────────────────┤
│  Layer 2: Manager (编排层)              │
│  职责：任务规划 → DAG 编排 → 结果整合    │
│  输入：分类后的任务描述                  │
│  输出：整合后的最终结果                  │
├─────────────────────────────────────────┤
│  Layer 3: Sub-Agent (执行层)            │
│  职责：单一领域任务执行                  │
│  输入：子任务描述 + 必要上下文            │
│  输出：子任务结果                        │
└─────────────────────────────────────────┘
```

**Layer 1: Router 路由层**

- **意图分类**：使用轻量模型（如 Haiku、Qwen2.5-7B）或规则引擎 + embedding 相似度匹配，快速判断用户意图属于哪个业务域（代码生成、数据分析、文档撰写等），延迟控制在 200ms 以内。
- **复杂度评估**：判断任务是简单 QA（直接 LLM 回答）还是复杂任务（需要 Multi-Agent 编排）。简单任务走 fast path，避免不必要的编排开销。
- **分流策略**：将请求路由到对应的 Manager。可以按业务域（有不同 Manager）或按复杂度（简单/复杂走不同 Manager）分流。

**Layer 2: Manager 编排层**

- **计划生成**：接收路由后的任务，调用 Planner 生成子任务 DAG。使用 LangGraph 的 `StateGraph` 定义节点和边。
- **Agent 选择**：根据子任务类型从 Agent Pool 中选择最合适的 Sub-Agent。可以是规则匹配（子任务类型 -> Agent 映射表），也可以是 LLM 动态选择。
- **执行调度**：无依赖的子任务并行分发（`asyncio.gather`），有依赖的按拓扑序串行执行。支持超时控制（每个 Sub-Agent 设置 60s 超时）。
- **结果整合**：收集所有结果后，调用 Integrator Agent 做去重、冲突消解、格式对齐。
- **质量校验**：最终结果经 Reviewer Agent 校验后返回。若不通过（置信度 < 0.8），触发 replan。

**Layer 3: Sub-Agent 执行层**

- 每个 Sub-Agent 是独立的 Agent 实例，有专属 System Prompt、工具集、模型配置。
- 接收精确的上下文窗口（Manager 只传递必要信息），避免信息过载。
- 输出必须符合预定义的 Schema（Pydantic 校验），不符合则拒绝接受并要求重试。

**加分项**

1. 提到 Router 层的灰度能力：新 Manager 上线时，Router 可按比例（5% -> 20% -> 50% -> 100%）逐步切流。
2. 讨论 Agent Pool 的动态注册/发现机制（类似微服务中的服务注册中心）。
3. 给出 LangGraph 中实现三层架构的伪代码（StateGraph 嵌套使用，外层图做 Router/Manager，内层图做 Sub-Agent 的内部循环）。

---

### Q4：多 Agent 系统中幻觉放大问题怎么处理？五层防线怎么设计？

**考察点**

候选人是否理解 Multi-Agent 中幻觉的级联放大机制，并能设计多层防御体系而非单点修复。

**解答思路**

1. 先说明幻觉放大的机制（Agent A 的错误输出成为 Agent B 的输入，错误逐级放大）。
2. 然后按"源头控制 -> 传播阻断 -> 交叉验证 -> 最终校验 -> 兜底方案"五层防线逐层展开。
3. 每层给出具体技术手段而非抽象概念。

**参考答案**

Multi-Agent 中幻觉放大是指：上游 Agent 产生的错误信息作为下游 Agent 的输入，导致错误被继承、放大甚至产生"回音室效应"——多个 Agent 互相确认虚假信息。五层防线设计如下：

**第一层：源头精准控制（Input Quality Gate）**

- 每个 Sub-Agent 启动前，Manager 对其接收的上下文做事实锚定 —— 将外部检索到的 Ground Truth 信息以高优先级标签（如 `<fact>` 标签）注入，并附带来源 URL。
- 使用 RAG 检索的 chunk 附带 `confidence_score` 和 `source_timestamp`，Agent 被要求优先采信高置信度、新近的来源。
- Prompt 中明确要求："若信息无法从 <fact> 标签中验证，请标注 [uncertain] 而非自行补全。"

**第二层：传播过程阻断（Output Schema Enforcement）**

- 每个 Sub-Agent 的输出强制使用 Pydantic 结构化 Schema，Schema 中包含 `confidence` 字段（0-1）和 `evidence` 字段（引用来源）。
- Manager 检查 Sub-Agent 的输出：置信度 < 0.6 的结果丢弃并重新分派；evidence 字段为空但有明确事实断言的结果打回。
- 关键数据字段做类型约束和范围校验（如日期格式、数值范围、枚举值），防止 Agent "发明"不存在的数据。

**第三层：交叉验证（Cross-Validation）**

- 对关键事实性任务，同时分派给 2 个不同的 Sub-Agent（使用不同基座模型，如 GPT-4o + Claude Sonnet），Manager 对比两份结果。
- 两份结果一致（语义相似度 > 0.9）直接采纳；不一致时，由 Reviewer Agent 结合检索到的 Ground Truth 做裁决。
- 实现时注意：交叉验证增加成本（2x），只对关键任务启用，简单任务走单 Agent 路径。

**第四层：最终输出审查（Output Gate）**

- 所有整合后的结果在返回用户前，经独立的 FactChecker Agent 做最终审查。
- FactChecker 使用 NLI（自然语言推理）模型或 LLM-as-Judge 逐句检查输出与检索源的一致性。
- 使用 RAGAS 的 Faithfulness 指标做自动化评估：将输出分解为原子声明，逐条检查是否被检索上下文支撑。

**第五层：兜底策略（Fallback & Transparency）**

- 如果前三层均无法达成高置信度输出，系统执行降级策略：返回"抱歉，我无法确认以下信息"并附带相关检索片段让用户自行判断。
- 对不确定的内容主动标注 `[置信度: 低]`，而非强行给出看似确定的答案。
- 建立"幻觉回传"机制：用户纠错反馈自动入库，用于后续检索权重调整和 Prompt 优化。

**加分项**

1. 给出各层的具体延迟预算（如 Input Quality Gate < 100ms, Cross-Validation < 3s）。
2. 提到使用 LangFuse 对每层做独立的幻觉率监控（如第一层幻觉率 5%，经过五层后降至 0.5%）。
3. 讨论幻觉检测模型的选择：NLI 模型（如 RoBERTa-MNLI）vs LLM-as-Judge 的 cost/accuracy trade-off。

---

### Q5：Multi-Agent 通信模式有哪些？（广播/Hub-Spoke/点对点/层级传递）

**考察点**

候选人是否理解分布式系统中的经典通信拓扑在 Multi-Agent 场景下的映射，能否根据任务特征选择合适的通信模式。

**解答思路**

1. 列举四种通信拓扑并画 ASCII 架构图。
2. 对每种模式说明工作原理、适用场景、代表框架、优势和劣势。
3. 给出混合使用建议（实际生产中通常是多种模式的组合）。

**参考答案**

Multi-Agent 通信模式借鉴了分布式系统的经典拓扑，以下是四种核心模式：

**模式一：广播（Broadcast）**

```
Agent_A ──→ 所有 Agent（群发消息）
```

- 工作原理：一个 Agent 发送消息给所有其他 Agent，各 Agent 自行判断是否需要响应。
- 适用场景：任务公告、全局通知、状态同步。例如 Manager Agent 发布新任务时广播给所有 Worker，Worker 根据能力声明（Agent Card）决定是否认领。
- 代表实现：AutoGen 的 GroupChat 启动消息；CrewAI 的 `@broadcast`。
- 劣势：信息过载，无关 Agent 也被打扰；难以追踪响应者。
- 优化：广播消息附带 `target_capability` 标签，Agent 根据能力过滤。

**模式二：Hub-Spoke（中心辐射）**

```
             ┌──────────────┐
    ┌───────→│  Hub/Coord   │←───────┐
    │        └──────────────┘        │
    ▼                                ▼
┌──────┐                        ┌──────┐
│Spoke A│                       │Spoke B│
└──────┘                        └──────┘
```

- 工作原理：所有 Agent 只与中心 Coordinator 通信，Agent 之间不直接通信。Coordinator 负责消息路由、结果汇总、冲突调解。
- 适用场景：Orchestration 模式下的 Manager-Worker 架构。典型的 LangGraph Supervisor Agent 模式。
- 代表实现：LangGraph 的 Supervisor Agent + Worker Agent 的 `Send` API；CrewAI 的 Manager Agent 模式。
- 优势：中心化控制、易于调试、消息流清晰。
- 劣势：中心节点成为单点瓶颈和故障点。

**模式三：点对点（Peer-to-Peer）**

```
Agent_A ←──→ Agent_B ←──→ Agent_C
```

- 工作原理：Agent 之间建立直接通信通道，去中心化、无单点。
- 适用场景：辩论（Debate）模式、Generator-Reviewer 双人协作、Agent 之间的点对点协商。
- 代表实现：AutoGen 的 `a_initiate_chat` 双向对话；LangGraph 的 `add_edge("agent_a", "agent_b")` 单向边。
- 优势：低延迟、无需中介；适合密切协作的双 Agent 场景。
- 劣势：通信链路随 Agent 数量呈 O(N^2) 增长，不适合大规模 Agent 群。

**模式四：层级传递（Hierarchical）**

```
         ┌─────────┐
         │L1 Master│
         └────┬────┘
      ┌───────┼───────┐
   ┌──┴──┐  ┌──┴──┐  ┌──┴──┐
   │L2 Mgr│ │L2 Mgr│ │L2 Mgr│
   └──┬───┘ └──┬───┘ └──┬───┘
  ┌───┼───┐    │        │
┌┴─┐┌┴─┐┌┴─┐ ...
│SA││SA││SA│
```

- 工作原理：上一级 Manager 将任务分解给下一级 Manager，最终到达叶子 Sub-Agent。信息沿层级上下传递，同级 Agent 不直接通信。
- 适用场景：超大规模任务分解，如软件开发全流程（需求分析 -> 架构设计 -> 编码 -> 测试 -> 部署，每层有独立 Manager）。
- 代表实现：LangGraph 的嵌套子图（Subgraph）；AutoGen 的 NestedChat。
- 优势：可扩展性强，职责隔离清晰。
- 劣势：层级深时信息衰减严重，高层级延迟累积。

**混合使用建议**：实际系统中通常是组合使用。例如：顶层用 Hub-Spoke（Router -> 多个 Manager），Manager 和 Sub-Agent 之间用 Hub-Spoke，关键事实性任务用点对点交叉验证，全局状态变更用广播通知。

**加分项**

1. 能画出混合拓扑图，标注每种模式在系统中的位置。
2. 提到使用消息 TTL（Time-to-Live）防止广播风暴。
3. 讨论通信模式的选择决策树：Agent 数量（N<5 点对点，N>10 Hub-Spoke）和任务结构（层级化任务优先层级传递）。

---

### Q6：如何避免 Agent 间通信的 Token 爆炸？

**考察点**

候选人是否理解 Token 爆炸的根因（全量上下文传递 + 多轮转发 + 无边界对话），并能从数据结构和通信协议层面给出压缩策略。

**解答思路**

1. 先诊断 Token 爆炸的具体来源：System Prompt 重复开销、全量历史透传、Agent 间无约束对话。
2. 然后逐一给出针对性策略：上下文窗口隔离、消息摘要压缩、结构化最小值传递、硬性轮次限制。
3. 最后给出量化效果（压缩比）和监控手段。

**参考答案**

Multi-Agent 通信中 Token 爆炸的三大来源及应对策略：

**来源一：System Prompt 重复开销**

每个 Sub-Agent 都有独立的 System Prompt（200-2000 token），N 个 Agent 串行执行时 System Prompt 累计开销 = N * sys_prompt_tokens。应对：

- **共享前缀缓存**：将公共部分的 System Prompt（如公司背景、用户信息、输出规范）抽取为共享模板，利用 Prompt Caching 机制（Anthropic/OpenAI 均支持）缓存后仅首次付费。实测节省 50%-80% 的 System Prompt 成本。
- **延迟注入 System Prompt**：Sub-Agent 的 System Prompt 中仅包含该 Agent 特有的领域指令，通用规则在 Manager 层统一处理。

**来源二：全量上下文透传**

Manager 将完整对话历史或其他 Agent 的原始输出传给 Sub-Agent，每条消息经过多个 Agent 时会反复出现在上下文中。应对：

- **上下文窗口隔离**：Sub-Agent 仅接收"当前子任务描述 + 必要输入数据 + 简明上下文摘要"，不接收完整的历史对话。例如：不是把 10 轮用户对话全传过去，而是传一句话摘要"用户想要分析 Q2 销售额下降原因，已确认数据范围为 2025 年 1-6 月"。
- **消息摘要压缩**：当一个 Agent 的输出超过 500 token 时，Manager 调用轻量模型（如 Haiku）对其做结构化摘要后再传递给下游。压缩比通常 3:1 到 5:1。
- **结构化最小值传递**：Sub-Agent 间的传递物应该是结构化数据（如 `{"sql_query": "SELECT ...", "result_rows": 42, "confidence": 0.9}`），而非自然语言描述（"我查了一下数据库，发现..."）。

**来源三：无边界对话**

Agent 间无限循环讨论或辩论轮次过多。应对：

- **硬性轮次限制**：设置每个 Agent 的最大对话轮次（如 5 轮），超限后强制产出 best-effort 结果。
- **收敛检测**：当连续 2 轮输出语义相似度 > 0.95 时，认为对话已收敛，强制终止。
- **令牌预算（Token Budget）**：为每个任务设置总 token 预算（如 50K token），Manager 实时追踪消耗，达到 80% 时触发压缩策略，达到 100% 时强制返回当前最佳结果。

**量化效果**：通过上述策略，一个典型的 5-Agent 编排任务的 Token 消耗可从 25K token 压缩至 8K token（压缩比约 3:1）。

**监控**：在 LangFuse trace 中标记 `agent_to_agent_tokens` 指标，设置告警阈值（单次 > 10K token 触发）。

**加分项**

1. 提到 Anthropic 的 Prompt Caching 具体命中条件和定价模型。
2. 讨论基于 Token 成本的 Agent 路由：当某个 Sub-Agent 的模型太贵时，自动降级到更便宜的模型。
3. 给出 LangGraph 中实现上下文隔离的代码片段（State 字段中只传递必要信息）。

---

### Q7：CrewAI vs AutoGen vs LangGraph 怎么选？各自的定位与使用场景？

**考察点**

候选人是否深入使用过这三个框架，理解它们的设计哲学差异——CrewAI 面向业务角色建模、AutoGen 面向对话与聊天、LangGraph 面向流程控制——并能根据业务需求做出合理的框架选型。

**解答思路**

1. 用一个对比表格快速展示三者的核心差异（设计哲学、编排方式、通信机制、学习曲线）。
2. 分别展开三个框架的核心优势、代码风格和典型使用场景。
3. 给出具体的选型决策树或决策矩阵。

**参考答案**

| 维度 | CrewAI | AutoGen (0.4+) | LangGraph |
|------|--------|----------------|-----------|
| **设计哲学** | 角色驱动，模拟人类团队协作 | 对话驱动，多 Agent 聊天 | 状态机驱动，有向图流程 |
| **编排方式** | 顺序/层级（Sequential/Hierarchical） | GroupChat + Speaker Selection | 自定义 DAG（节点 + 边） |
| **通信机制** | Task 对象在 Agent 间传递 | 对话消息流（ChatMessage） | 共享 State，Reducer 控制合并 |
| **Agent 定义** | Role + Goal + Backstory | AssistantAgent 注册 | 普通函数/可调用对象包装为 Node |
| **学习曲线** | 低，Pythonic API | 中，对话模型需理解 | 高，需理解图、状态、边 |
| **灵活性** | 中，预定义协作模式 | 高，对话流可灵活控制 | 极高，完全自定义 |
| **核心场景** | 内容创作、研究分析、团队模拟 | 多 Agent 对话、代码生成、教学 | 复杂工作流、有分支/回退/条件逻辑的生产系统 |

**CrewAI — 最适合快速搭建角色化 Multi-Agent 原型**

```python
researcher = Agent(role="研究员", goal="收集信息", backstory="...")
writer = Agent(role="写手", goal="撰写报告", backstory="...")
crew = Crew(agents=[researcher, writer], tasks=[...], process=Process.sequential)
```

- 优势：角色建模直观（Role/Goal/Backstory 三元组），开箱即用的任务委派机制，支持 Sequential 和 Hierarchical 两种流程。
- 劣势：灵活性差，不支持复杂的条件分支和循环。底层仍是顺序执行，不是真正并行的。
- 适合：内容生成、研究报告、角色扮演类应用。快速 POC 验证 Multi-Agent 可行性。

**AutoGen (v0.4+, 即 autogen-agentchat) — 最适合以对话为中心的 Multi-Agent 交互**

```python
assistant = AssistantAgent("assistant", llm_config=...)
coder = AssistantAgent("coder", llm_config=...)
groupchat = GroupChat(agents=[assistant, coder], messages=[], max_round=10)
```

- 优势：对话模型原生，GroupChat 的 Speaker Selection 机制（RoundRobin/LLM/Auto）灵活。支持嵌套对话（NestedChat）用于子任务。支持代码执行沙箱。
- 劣势：v0.4 重构后 API 有 breaking changes，文档和社区尚在追赶。对话驱动的模型对非对话类任务不够自然。
- 适合：代码生成+审查双人组、多专家会诊、需要对话历史管理的场景。微软生态。

**LangGraph — 最适合生产级复杂工作流**

```python
graph = StateGraph(AgentState)
graph.add_node("router", router_node)
graph.add_node("coder", coder_node)
graph.add_conditional_edges("router", route, {"code": "coder", "answer": END})
```

- 优势：完全自定义的 DAG 流程控制，支持条件分支、循环、人工介入（Human-in-the-Loop）、持久化 Checkpoint。State 的不可变性 + Reducer 机制保证并发安全。LangSmith 集成做可观测性。
- 劣势：学习曲线陡峭，概念多（State、Node、Edge、Checkpoint、Send）。简单任务用 LangGraph 显得 over-engineering。
- 适合：有复杂分支回退逻辑的生产 Agent 系统、需要人工审批节点的流程、对可观测性和状态持久化有高要求的场景。

**选型决策树**：

1. 只是想做内容生成/报告撰写的多角色协作？-> CrewAI
2. 需要 Agent 之间自然对话、多轮讨论？-> AutoGen
3. 需要复杂流程控制（条件分支、循环、回退、人工审批）？-> LangGraph
4. 需要将 Agent 集成到已有的微服务架构中？-> LangGraph（原生 LangServe 部署）
5. 团队刚开始探索 Multi-Agent？-> CrewAI 做 POC，验证价值后再迁移到 LangGraph

**加分项**

1. 提到三个框架可以混合使用（如 LangGraph 做顶层编排，内部调用 AutoGen 的 GroupChat 做子任务讨论）。
2. 给出三个框架在同一个任务（如"写一篇技术博客"）上的代码对比。
3. 讨论框架的社区活跃度、维护状态、生产案例数量。

---

### Q8：多个 Agent 并发操作数据库/文件怎么处理？

**考察点**

候选人是否理解分布式并发控制（CC）在 Agent 系统中的适用性，能否区分"Agent 层面的并发协调"和"资源层面的锁机制"。

**解答思路**

1. 先识别并发冲突的具体场景（读写冲突、写写冲突、文件系统并发写入）。
2. 然后分两个层面给出方案：Agent 编排层（Manager 做顺序化编排避免冲突）+ 资源层（数据库锁、乐观锁、文件锁）。
3. 最后给出实际工程中的推荐方案（事务 + 乐观锁 + version 字段）。

**参考答案**

多个 Agent 并发操作共享资源时，核心挑战是保证 ACID 语义在 Agent 系统中的实现：

**场景一：数据库并发操作**

当两个 Sub-Agent 同时操作同一张表的同一行数据时，需要以下机制：

1. **乐观锁（Optimistic Locking）**：在数据行中增加 `version` 字段。Agent A 读取数据（version=1），修改后尝试写入 `WHERE version=1` 并将 version 更新为 2。Agent B 同时读取（version=1），修改后尝试写入时发现 version 已变更，写入失败触发重试。这是最推荐的方案，因为 Agent 操作往往是读-思考-写模式，持有锁时间无法预估，悲观锁容易导致长锁等待。

2. **Manager 编排层防冲突**：在任务规划阶段，Manager 分析 DAG 中哪些节点会访问相同资源，主动将其串行化。例如 Agent A 写用户表、Agent B 也写用户表，Manager 在 DAG 中显式添加依赖边 `Agent_A -> Agent_B`，保证执行顺序。

3. **工具层事务包装**：数据库操作的工具函数内部使用事务包装。例如 Sub-Agent 的 `update_user` 工具，内部用 `BEGIN...COMMIT` 包裹。如果工具执行到一半 Agent 超时或异常，事务回滚。

4. **分布式锁（最后手段）**：对于无法用乐观锁的场景（如 schema 变更），使用 Redis `SETNX` 或 etcd 做分布式锁。Agent 操作前获取锁，操作后释放。设置 TTL 防死锁。

**场景二：文件系统并发操作**

1. **Git 式分支策略**：每个 Agent 在独立的工作副本中操作（类似 Git worktree），完成后的变更由 Manager Agent 合并。冲突时由 ConflictResolver Agent 处理合并冲突。
2. **文件锁**：Linux 的 `flock` 或 Python 的 `fcntl.lockf` 用于文件级别互斥。但仅适用于同一台机器上的 Agent。
3. **对象存储 + 版本控制**：使用 S3/MinIO 的对象版本控制，Agent 读取特定版本的对象，生成新版本上传，由 Merge Agent 做版本合并。这是云原生场景的推荐方案。

**核心原则**：

- Agent 不要直接操作原始数据/文件，而是通过工具函数（Tool）操作，工具函数内部做好并发控制。
- 能乐观锁不用悲观锁，因为 Agent 的"思考时间"不可控。
- 能在编排层解决的问题不放到底层，因为编排层有全局视角。

**加分项**

1. 提到使用 PostgreSQL 的 `SELECT FOR UPDATE SKIP LOCKED` 做任务队列的并发消费。
2. 讨论 Agent 超时导致数据库连接泄漏的处理（连接池超时 + 事务超时）。
3. 给出 LangGraph 中实现"先检查数据依赖后串行化执行"的伪代码。

---

### Q9：如果 Agent 是异步执行的怎么协调？

**考察点**

候选人是否理解异步 Agent 系统中的消息传递、结果收集、超时处理和依赖管理，能否设计一个异步执行的 Agent 调度框架。

**解答思路**

1. 先说明异步 Agent 的典型场景（如多个 Agent 并行分析数据、Agent 调用外部异步 API）。
2. 给出异步协调的三个核心机制：Future/Promise 等待、事件驱动回调、消息队列解耦。
3. 补充异步执行中的工程挑战：超时处理、依赖关系表示、结果顺序性。

**参考答案**

异步 Agent 执行指多个 Agent 同时运行，执行时间不可预知，协调器需要在所有必要结果就绪后继续推进。三种核心方案：

**方案一：Future/Promise 模式（编程语言原生）**

```python
async def coordinator():
    # 并行启动三个 Agent，无依赖关系
    task_a = asyncio.create_task(agent_a.run(input_a))
    task_b = asyncio.create_task(agent_b.run(input_b))
    task_c = asyncio.create_task(agent_c.run(input_c))

    # 收集所有结果，任一失败即抛异常
    results = await asyncio.gather(task_a, task_b, task_c, return_exceptions=True)

    # 处理部分失败
    valid_results = [r for r in results if not isinstance(r, Exception)]
```

- 适用：同一进程内的 Agent 异步执行，Agent 间无依赖或全依赖（等所有结果）。
- 关键点：`asyncio.gather`  + `return_exceptions=True` 允许部分失败时仍能收集成功结果。
- 局限：不支持复杂的 DAG 依赖关系（如 agent_c 只依赖于 agent_a，而不需要等 agent_b）。

**方案二：DAG + 拓扑排序（复杂依赖）**

当 Agent 间存在复杂依赖关系（agent_c 依赖 agent_a 和 agent_b，agent_d 仅依赖 agent_a），使用 DAG 调度器：

```python
class AsyncDAGScheduler:
    def __init__(self, dag: dict[str, list[str]]):
        self.dag = dag  # {"agent_a": [], "agent_b": [], "agent_c": ["agent_a", "agent_b"]}
        self.results: dict[str, Any] = {}
        self.ready_queue = asyncio.Queue()

    async def execute(self):
        # 找到所有入度为 0 的节点，启动执行
        # 每个节点完成后，将结果存入 self.results，检查其下游节点是否就绪
        # 就绪的下游节点加入 ready_queue，继续执行
        # 直到所有节点完成或超时
```

- LangGraph 的 `Send` API 原生支持这种模式：`Send("agent_c", arg=result_a)` 即当上游完成时自动触发下游。

**方案三：消息队列解耦（跨进程/跨服务）**

当 Agent 部署在不同服务中（微服务架构），使用消息队列协调：

```
Agent_A (Pod-1) --完成--> Kafka Topic: agent_a_done
Agent_B (Pod-2) --完成--> Kafka Topic: agent_b_done
Coordinator -------监听---> 当 agent_a_done AND agent_b_done 都收到时
                             -> 触发 Agent_C
```

- 使用 Kafka/RabbitMQ/Redis Stream 作为消息通道。
- Coordinator 维护一个"等待表"：记录每个任务需要哪些上游结果，当所有上游就绪时触发下游。
- 需要考虑消息重复/丢失的去重和重试。

**工程挑战与对策**：

1. **超时处理**：为每个异步 Agent 设置 `timeout`，超时后的处理策略：
   - 降级：使用缓存结果或默认值替代。
   - 重试：重新分配（可能需要选不同模型或不同 Agent）。
   - 跳过：如果该结果不是必需的，跳过继续执行。
2. **结果顺序性**：异步执行的结果返回顺序不确定，需要为每个结果标记 `task_id` 和 `timestamp`，Coordinator 按 DAG 结构而非时间顺序消费结果。
3. **背压控制**：使用 Semaphore 限制并发 Agent 数量，避免资源耗尽。

**加分项**

1. 给出使用 `asyncio.Semaphore(5)` 限制并发 Agent 数量的代码示例。
2. 讨论 LangGraph 的 Checkpoint 机制如何天然支持异步 Agent 的中断恢复。
3. 提到 Temporal/Prefect 等工作流引擎做长时间运行的异步 Agent 编排。

---

### Q10：MCP 与多 Agent 框架（LangGraph/CrewAI/AutoGen）如何集成？

**考察点**

候选人是否理解 MCP（Model Context Protocol）作为"工具标准化协议"的定位，以及它在 Multi-Agent 框架中的集成位置和最佳实践。

**解答思路**

1. 先澄清 MCP 的定位（连接 Agent 与外部工具的标准化协议，而非 Agent 编排协议）。
2. 然后给出 MCP 在三大框架中的具体集成方式。
3. 最后讨论 MCP + Multi-Agent 的架构模式和实际落地注意事项。

**参考答案**

MCP 解决的是 Agent 与工具的标准化连接问题，Multi-Agent 框架解决的是多 Agent 间的编排协作问题——两者是互补关系，不是替代关系。MCP 在 Multi-Agent 系统中的核心价值是：让不同的 Agent 可以通过统一的协议访问共享的工具集，无需每个 Agent 单独集成。

**集成架构：MCP 作为工具层**

```
┌────────────────────────────────────────────┐
│  Multi-Agent 编排层                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐ │
│  │ Agent A  │  │ Agent B  │  │ Agent C  │ │
│  │(CrewAI)  │  │(AutoGen) │  │(LangGraph)│ │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘ │
│       │              │              │       │
│       └──────────────┼──────────────┘       │
│                      │                      │
│              MCP Client Layer               │
│                      │                      │
├──────────────────────┼──────────────────────┤
│  MCP Server 工具层   │                      │
│  ┌─────────┐  ┌──────┴────┐  ┌───────────┐ │
│  │Database │  │File System│  │API Gateway│ │
│  │ MCP Svr │  │ MCP Svr  │  │  MCP Svr  │ │
│  └─────────┘  └───────────┘  └───────────┘ │
└────────────────────────────────────────────┘
```

**LangGraph 集成 MCP**：

```python
from langchain_mcp_adapters.client import MultiServerMCPClient

async def create_mcp_tools():
    client = MultiServerMCPClient({
        "database": {
            "command": "python", "args": ["-m", "mcp_server_db"],
            "transport": "stdio"
        },
        "filesystem": {
            "command": "npx", "args": ["@modelcontextprotocol/server-filesystem", "/data"],
            "transport": "stdio"
        }
    })
    tools = await client.get_tools()
    return tools

# 将 MCP 工具绑定到 LangGraph Agent 节点
tools = await create_mcp_tools()
agent_node = create_react_agent(llm, tools)
```

LangChain 提供了 `langchain-mcp-adapters` 包，可以将 MCP Server 暴露的工具转换为 LangChain Tool 对象，直接注入到 LangGraph Agent 中。

**CrewAI 集成 MCP**：

```python
from mcp import ClientSession, StdioServerParameters

# 创建 MCP Client 连接数据库 Server
server_params = StdioServerParameters(command="python", args=["mcp_server_db.py"])
async with ClientSession(server_params) as session:
    mcp_tools = await session.list_tools()
    # 将 MCP tools 包装为 CrewAI Tool 对象
    crewai_tools = [McpToolAdapter(t) for t in mcp_tools]
    agent = Agent(role="分析师", tools=crewai_tools, ...)
```

CrewAI 目前没有官方 MCP adapter，需要自行封装适配层。未来预计会有社区或官方的集成方案。

**AutoGen 集成 MCP**：

```python
# AutoGen 的 AssistantAgent 支持注册自定义 tool
# 将 MCP Server 的 tool 注册为 AutoGen tool function
async def register_mcp_tool(session, tool_name: str):
    tool_schema = await session.get_tool_schema(tool_name)
    # 生成符合 AutoGen tool schema 的函数并注册
    ...
```

**关键架构决策**：

1. **共享 MCP Server vs 独立 MCP Server**：Agent 间共享同一组 MCP Server 时，需注意工具权限隔离 —— 敏感工具的访问应限制在特定 Agent。
2. **MCP 传输选择**：stdio 适合同机器 Agent（低成本、简单），SSE/Streamable HTTP 适合跨网络 Agent 和远程工具。
3. **工具发现**：Manager Agent 可通过 MCP 的 `list_tools()` 动态发现可用工具，根据子任务类型动态分配工具给 Sub-Agent。

**加分项**

1. 提到 MCP 的 Streamable HTTP 传输模式在 2025 年成为主流，解决了 SSE 的单向性和重连问题。
2. 讨论 MCP Server 在多租户场景下的权限隔离：每个 Agent 只能访问被授权的一组 MCP Server。
3. 给出 MCP + LangGraph 的端到端集成代码（从启动 MCP Server 到 Agent 调用工具）。

---

### Q11：Multi-Agent 落地核心设计要点：角色边界怎么定义？

**考察点**

候选人是否理解角色边界定义是 Multi-Agent 系统设计中最关键的架构决策之一，能否给出可操作的边界划分方法论而非空谈原则。

**解答思路**

1. 先说明角色边界模糊的后果（职责重叠导致踢皮球、输出冲突、成本浪费）。
2. 给出角色边界定义的可操作方法论：基于能力矩阵的边界划分、基于工具集的边界划分、基于评估标准的边界划分。
3. 补充边界校验策略和边界模糊时的仲裁机制。

**参考答案**

角色边界定义是 Multi-Agent 系统工程落地的最核心设计决策。边界模糊会导致：Agent A 和 Agent B 争着做同一件事（成本浪费）、都不做某件事（遗漏）、输出相互矛盾（需要额外仲裁开销）。

**方法论一：基于能力矩阵的边界划分**

构建 N x K 矩阵，N 个 Agent，K 个能力维度（知识域、工具访问、输出类型、质量要求），每个单元格标 1（胜任）/0.5（辅助）/0（不参与）。

| 能力维度 | 研究员 | 分析师 | 写手 | 审查员 |
|----------|--------|--------|------|--------|
| 信息检索 | 1 | 0.5 | 0 | 0 |
| 数据分析 | 0 | 1 | 0 | 0.5 |
| 内容撰写 | 0 | 0 | 1 | 0 |
| 事实核查 | 0.5 | 0 | 0.5 | 1 |

当矩阵中出现两个 Agent 同为 1 的能力维度时，需要进一步细化边界（如按子领域、按数据源、按输出格式）。

**方法论二：基于工具集的边界划分**

每个 Agent 的工具集应该是互斥的。如果一个工具同时出现在两个 Agent 的工具清单中，说明边界存在重叠。检查规则：
- 数据库写权限只能分配给一个 Agent（DataWriter Agent）。
- 外部 API 调用可按 API 类别划分（Slack Agent 只能调用 Slack API，GitHub Agent 只能调用 GitHub API）。

**方法论三：基于"单一失败点"的边界划分**

识别任务链路中不能被两个 Agent 同时操作的关键节点（如数据库写入、文件提交、审批操作），明确这些节点的唯一负责人。原则：一个关键资源只能有一个 Owner Agent。

**边界校验策略**：

1. **Prompt 交叉检查**：将两个 Agent 的 System Prompt 放在一起给 LLM 读取，问 LLM"这两个 Agent 的职责是否有重叠？"，用 LLM 辅助检测 Prompt 冲突。
2. **测试驱动边界**：构造边界场景的测试用例。如"请帮我分析这份数据并生成报告"——这个请求应该触发 Researcher -> Analyst -> Writer 串行，如果 Researcher 直接生成报告了，说明边界被突破。
3. **线上监控**：统计每个 Agent 的工具调用分布。如果发现 Researcher Agent 频繁调用了 Analyst Agent 的工具，说明边界在运行时被突破。

**边界模糊时的仲裁机制**：

当两个 Agent 的输出冲突时（如 Researcher 推荐方案 A，Analyst 推荐方案 B）：
- **置信度裁决**：选择 confidence 更高的结果。
- **来源裁决**：选择信息来源更权威的结果（如有原始数据支撑 > 纯推理）。
- **上级裁决**：由 Manager Agent 或 Human Reviewer 做最终决定。
- **冲突记录**：将冲突案例记录到知识库，用于后续边界优化。

**加分项**

1. 给出真实的 Agent 角色定义模板（Agent Card 格式，包含 Capabilities、Tools、Input Schema、Output Schema、Constraints）。
2. 讨论 Agent 能力的版本管理：当 Agent 能力升级时，如何版本化并做 AB 测试。
3. 提到 Claude Code / Cursor 等实际产品中如何定义 Agent 角色边界。

---

### Q12：辩论模式（Debate）在 Multi-Agent 系统中如何实现？适用什么场景？

**考察点**

候选人是否理解辩论模式的实现机制（多轮对抗、视角切换、共识达成），能否识别辩论模式的适用场景和不适用场景，以及成本-收益分析。

**解答思路**

1. 先定义辩论模式的工作原理（多个 Agent 持有不同立场，通过多轮论证-反驳-修正来提升输出质量）。
2. 给出具体的实现方案：轮次控制、仲裁机制、共识判定。
3. 讨论适用场景（高 stakes 决策、创意生成、安全审查）和不适用场景（简单事实查询、延迟敏感任务、低成本任务）。

**参考答案**

辩论模式是让多个 Agent 就某个问题持不同立场进行多轮论证和反驳，通过对抗性审查提升最终输出质量。其核心假设是：单一 Agent 易产生偏见或盲点，而多方辩论可以暴露隐性假设、发现逻辑漏洞。

**实现方案**：

```
Round 1: Agent A (正方) 生成初始方案
Round 2: Agent B (反方) 对该方案进行批判，指出弱点
Round 3: Agent A 回应 B 的批判，改进方案
Round 4: Agent B 再次审查改进后的方案
Round N: Judge Agent 汇总双方观点，给出最终裁决
```

具体实现代码结构（LangGraph 为例）：

```python
class DebateState(TypedDict):
    topic: str
    rounds: int
    max_rounds: int  # 硬性上限，防止无限辩论
    proponent_args: list[str]  # 正方论据
    opponent_args: list[str]   # 反方论据
    consensus_reached: bool
    final_output: str

def should_continue(state: DebateState) -> str:
    if state["rounds"] >= state["max_rounds"]:
        return "judge"  # 达到最大轮次，强制裁决
    if state["consensus_reached"]:
        return "judge"  # 已达成共识，进入裁决
    return "continue"   # 继续辩论

graph = StateGraph(DebateState)
graph.add_node("proponent", proponent_node)  # 正方
graph.add_node("opponent", opponent_node)    # 反方
graph.add_node("judge", judge_node)          # 裁判
graph.add_conditional_edges("opponent", should_continue, {
    "continue": "proponent", "judge": "judge"
})
```

**关键设计点**：

1. **角色设定**：正方和反方的 System Prompt 需精心设计。正方指令为"为方案辩护，回应批评"，反方指令为"找出方案的弱点、遗漏、逻辑矛盾"。反方需要"刻薄"一些，不能太轻易被说服。

2. **轮次控制**：
   - 硬性上限：最多 3-5 轮，防止无限辩论。
   - 收敛检测：当连续 2 轮双方的论点语义相似度 > 0.90 时，认为辩论已穷尽。
   - Token 预算：为辩论分配独立 Token 预算（如 10K token），消耗完毕即强制裁决。

3. **裁判机制（Judge Agent）**：
   - 职责：汇总双方论据，识别关键分歧点，给出最终裁决和理由。
   - Judge 的 System Prompt 中应要求"基于论据质量而非论据数量给出裁决"。
   - 可选的增强：让 Judge 自己查证争议事实（调用 Search Tool），降低"胡言乱语互相确认"的风险。

4. **多视角辩论（2+ Agent）**：不限于正方/反方二选一，可引入更多视角。例如：
   - 技术可行性 Agent
   - 成本效益 Agent
   - 用户体验 Agent
   - 安全合规 Agent
   四个 Agent 从各自视角论证，Judge 做多目标权衡。

**适用场景**：

| 场景 | 说明 | 效果 |
|------|------|------|
| 高风险决策 | 资金配置、技术架构选型、安全策略 | 降低单一视角的盲点风险 |
| 创意生成与优化 | 产品名、品牌 slogan、文案优化 | 多轮打磨提升创意质量 |
| 安全检查 | 对 Agent 输出做安全审查，红队/蓝队对抗 | 发现隐性的安全漏洞 |
| 复杂推理任务 | 数学证明、逻辑推理 | 互相检查推理步骤，类似 peer review |

**不适用场景**：

- 简单事实查询（"今天天气怎么样"——不需要辩论）
- 延迟敏感任务（辩论增加 3-5 倍延迟）
- 低成本任务（辩论的 Token 消耗是单 Agent 的 3-8 倍）
- 主观偏好问题（"哪个颜色好看"——没有客观标准）

**成本-收益评估**：辩论模式 Token 消耗 = 单 Agent 的 4-8 倍，延迟 = 单 Agent 的 3-5 倍。仅当任务错误成本 > 辩论额外成本时才应启用。

**加分项**

1. 提到 DeepMind 的"Multi-Agent Debate"论文中的多轮辩论评分提升实验数据。
2. 给出 Judge Agent 的具体 Prompt 模板（含评分维度：逻辑一致性、事实准确性、完备性、创新性）。
3. 讨论辩论模式的变体：Panel（多方平行发言后汇总，无对抗）、Adversarial（纯对抗，适合安全测试）。

---

## Module 6：工程落地类

### Q13：生产级 Agent 系统的 Guardrail 体系怎么设计？输入安检/输出过滤/兜底拒答？

**考察点**

候选人是否理解 Guardrail 是一个贯穿请求全生命周期的多层防护体系，而非单一模块，能否区分输入安检、输出过滤、兜底拒答三个阶段的职责和技术手段。

**解答思路**

1. 先画出 Guardrail 在请求生命周期中的位置图（输入 -> 处理 -> 输出），标注每一层的 guard。
2. 逐层展开：输入安检（4 道检查）、运行时管控（工具权限 + 行为监控）、输出过滤（内容审查 + 格式校验）、兜底拒答。
3. 给出具体的技术选型（开源工具 + 自研模块）。

**参考答案**

Guardrail 体系是生产级 Agent 系统的安全基础设施，覆盖请求全生命周期：

```
用户输入
  │
  ▼
┌─────────────────────────────┐
│  输入 Guardrail              │
│  ① 注入攻击检测              │
│  ② 敏感内容检测              │
│  ③ 意图合法性校验            │
│  ④ 输入长度/格式校验         │
│  → 不通过: 直接拒答           │
└─────────────┬───────────────┘
              ▼
┌─────────────────────────────┐
│  Agent 执行（含运行时 Guard） │
│  ⑤ 工具调用权限校验          │
│  ⑥ 工具参数合法性检查        │
│  ⑦ 行为异常监控              │
│  → 违规: 中断执行，回滚操作   │
└─────────────┬───────────────┘
              ▼
┌─────────────────────────────┐
│  输出 Guardrail              │
│  ⑧ 内容安全审查              │
│  ⑨ 事实准确性检查            │
│  ⑩ 合规性校验 + 格式检查     │
│  → 不通过: 拒答/改写          │
└─────────────┬───────────────┘
              ▼
          返回用户
```

**输入安检层（Input Guard）**

1. **Prompt Injection 检测**：使用专用分类器识别注入攻击。可选用 `deberta-v3-base-prompt-injection` 等开源模型，或 OpenAI Moderation API。检测到注入 -> 直接拒答（返回预设安全回复模板）。
2. **敏感内容检测**：政治敏感、暴力色情、违法内容等。使用 LlamaGuard 3（Meta 开源，8B 参数，支持 14 类危害分类）或阿里云内容安全 API。对检测到的高风险内容，直接拒绝并记录审计日志。
3. **意图合法性校验**：使用轻量级分类模型判断用户意图是否在系统支持范围内。明确的恶意意图（如"帮我生成诈骗邮件"）直接拒绝。模糊意图走正常流程，但在 System Prompt 中强化安全约束。
4. **输入长度/格式校验**：限制输入长度上限（如 10K 字符），超出部分截断并提示。对明显的格式异常（如全特殊字符、二进制数据）直接拒绝。

**运行时管控层（Runtime Guard）**

5. **工具调用权限校验**：每次工具调用前检查 Agent 是否有该工具的调用权限（RBAC），以及调用参数是否在允许范围内（如 SQL 仅允许 SELECT，禁止 DROP/ALTER）。
6. **工具参数安全检查**：对工具参数做白名单/黑名单校验。如文件工具只允许访问 `/data/workspace` 目录；网络工具只允许访问白名单域名。
7. **行为异常监控**：监控 Agent 的工具调用频率、Token 消耗速度、循环次数。异常行为（如 1 分钟内调用 100 次工具、Token 消耗超过预算 2 倍）触发熔断。

**输出过滤层（Output Guard）**

8. **内容安全审查**：使用和输入层相同的安全分类器检查输出，防止 Agent 生成有害内容（包括 Indirect Injection 导致的污染输出）。
9. **事实准确性检查**：对包含事实断言的输出，调用 NLI 模型或二次 LLM 验证（交叉检查检索源）。使用 RAGAS Faithfulness 评分（< 0.6 触发改写或拒答）。
10. **合规性校验**：行业特定合规规则（如金融领域的合规话术、医疗领域的免责声明）。对不符合格式要求的输出做二次修正或拒答。

**兜底拒答策略**：

- 三层渐进式拒答：
  - L1（输入不合规）：返回通用拒答模板"抱歉，我无法处理此请求"。
  - L2（输出不合规且无法修正）：返回"我无法给出符合要求的回答，建议您..."并给出替代建议。
  - L3（系统异常/超时）：返回 fallback 回复"系统繁忙，请稍后重试"并记录异常 trace。
- 所有拒答事件上报监控系统，P0 安全事件触发 On-call 告警。

**技术选型建议**：

| 能力 | 开源方案 | 商业方案 |
|------|---------|---------|
| 注入检测 | deberta-v3-base | OpenAI Moderation |
| 安全分类 | LlamaGuard 3, ShieldGemma | Azure Content Safety |
| Guardrail 框架 | Guardrails AI, NeMo Guardrails | LangSmith Guardrails |
| 内容审核 | Perspective API (部分开源) | 阿里云/腾讯云内容安全 |

**加分项**

1. 给出 Guardrails AI 的 RAIL spec 配置示例（输入/输出 guard 的定义）。
2. 讨论 Guardrail 的延迟预算：输入安检 < 100ms, 运行时校验 < 10ms, 输出过滤 < 500ms。
3. 提到 Guardrail 的灰度策略：先在 5% 流量上启用，确认无误报后逐步加至 100%。

---

### Q14：多模型智能混排怎么做？根据延迟/成本/效果动态选择最优模型？

**考察点**

候选人是否理解模型路由（Model Router）的核心设计，能否从延迟、成本、效果三个维度构建路由决策模型，并给出实际可行的混排架构。

**解答思路**

1. 先定义混排的目标函数（Minimize: cost + latency_penalty, Subject to: quality >= threshold）。
2. 给出三种路由策略：规则路由、ML 路由（基于任务特征预测最优模型）、自适应路由（实时反馈调整）。
3. 补充工程实现中的关键细节：模型池管理、灰度切流、回退策略。

**参考答案**

多模型智能混排的核心是根据任务特征（复杂度、领域、延迟要求、预算限制）动态选择最优模型，在保证质量的前提下最小化成本和延迟。

**混排架构**：

```
用户请求
    │
    ▼
┌──────────────┐
│  任务特征提取  │ ← 复杂度评分、领域分类、历史相似任务
│  (Task Featurizer) │
└──────┬───────┘
       ▼
┌──────────────┐
│  路由决策引擎  │ ← 规则引擎 + ML Router
│  (Model Router)│
└──────┬───────┘
       ├──→ Haiku (简单任务, $0.001, 200ms)
       ├──→ Sonnet (中等任务, $0.015, 800ms)
       ├──→ Opus (复杂任务, $0.075, 2s)
       └──→ GPT-4o (备选, 当 Opus 不可用时)
```

**路由策略一：基于规则的分级路由（最简单，推荐先行）**

```python
def route_by_rules(task: Task) -> str:
    if task.complexity_score < 0.3:
        return "haiku"        # 简单问答、格式转换
    elif task.complexity_score < 0.7:
        return "sonnet"       # 中等推理、代码生成
    elif task.budget_tier == "premium":
        return "opus"         # 高价值客户使用最强模型
    else:
        return "sonnet"       # 兜底
```

复杂度评分维度：任务类型（分类/推理/生成/创意）、历史数据量、预期推理步数、是否涉及多步工具调用。

**路由策略二：基于 ML 的路由（进阶）**

训练一个轻量级 Router 模型（如 DistilBERT 或 XGBoost），输入任务特征（embedding、关键词、用户 tier、历史复杂度），输出最优模型选择。训练数据来自历史任务的 A/B 实验标注（同样任务在各模型上的 quality/cost/latency 数据）。

- 特征工程：任务类型分类结果、输入 token 数、用户付费等级、时间敏感度、历史相似任务的模型表现。
- 标签构造：对历史任务做离线评估，标注每个模型在该任务上的 quality 评分，选择 quality >= 阈值中 cost 最低的模型作为标签。

**路由策略三：自适应实时反馈路由（最先进）**

对同一任务并行调用 2 个模型（如 Haiku + Sonnet），对比输出质量：
- 如果 Haiku 输出质量 >= Sonnet 的 95% -> 后续同类任务默认路由到 Haiku
- 如果 Haiku 输出明显偏差 -> 后续同类任务路由到 Sonnet

这种策略需要额外成本（双模型调用），但能持续优化路由准确度。建议对 5% 流量做探索性双调用。

**关键工程实现**：

1. **模型池管理**：维护一个模型注册表，每个模型标注能力（推理/code/多语言）、延迟特征（P50/P95/P99）、成本（input/output per 1K token）、当前可用性（健康检查）。
2. **灰度切换**：新增模型（如 ERNIE 4.0 替代 ERNIE 3.0）时，按 5% -> 20% -> 50% -> 100% 灰度切流，每阶段观察 quality 和 cost 指标至少 2 小时。
3. **回退链**：Router 选定模型后执行，若失败则沿回退链降级。如：Opus 超时 -> Sonnet -> Haiku + 简洁回复模板。
4. **成本监控**：实时追踪每个模型的 PPM（Price Per Million tokens）和日均消费，设置预算告警。

**效果评估**：对比混排前后的核心指标：日均 cost、P95 latency、质量评分。目标：cost 降低 30-50%，quality 持平或微降（< 2%），latency 不恶化。

**加分项**

1. 提到使用 Contextual Bandit 算法做模型选择的在线学习。
2. 讨论"模型蒸馏 Router"：用小模型预测大模型的输出质量，做离线批量路由。
3. 给出 OpenRouter / Martian 等第三方模型路由服务的对比分析。

---

### Q15：假设推荐系统从 ERNIE 3.0 灰度升级到 ERNIE 4.0，设计流量调度平台？

**考察点**

候选人是否具备真实的流量调度系统设计经验，理解灰度发布的全生命周期管理（从 5% 到 100% 的逐步切流、自动回滚、效果对比）。

**解答思路**

1. 先给出流量调度平台的整体架构（配置中心 -> 分流引擎 -> 效果采集 -> 决策引擎）。
2. 展开灰度策略的五个阶段（内部验证 -> 5% 金丝雀 -> 20% 扩大 -> 50% 半量 -> 100% 全量）。
3. 重点讲自动回滚的触发条件和效果对比的指标体系。

**参考答案**

**整体架构**：

```
┌──────────────────────────────────────────────────────┐
│                  流量调度平台                         │
│                                                      │
│  ┌──────────────┐    ┌──────────────┐                │
│  │  灰度配置中心  │    │  分流引擎     │                │
│  │  (规则+比例)  │───→│  (Nginx/Lua  │──→ ERNIE 3.0  │
│  │              │    │   或 SDK)    │──→ ERNIE 4.0  │
│  └──────────────┘    └──────┬───────┘                │
│                             │                        │
│  ┌──────────────┐    ┌──────┴───────┐                │
│  │  自动回滚引擎  │←───│  效果采集+对比│                │
│  │  (触发条件)   │    │  (指标看板)   │                │
│  └──────────────┘    └──────────────┘                │
└──────────────────────────────────────────────────────┘
```

**灰度五阶段策略**：

| 阶段 | 流量比例 | 时长 | 观察重点 | 通过条件 |
|------|---------|------|---------|---------|
| Phase 0: 内部验证 | 内部测试账号 100% 走 ERNIE 4.0 | 1 天 | 功能正确性、基础性能 | 无 P0/P1 bug |
| Phase 1: 金丝雀 | 1% -> 5% 真实流量 | 4 小时 | 错误率、P99 延迟 | 错误率 < 旧版 1.2x, P99 < 旧版 1.1x |
| Phase 2: 扩大 | 5% -> 20% | 8 小时 | 业务指标（点击率/转化率） | 业务指标 >= 旧版 0.98x |
| Phase 3: 半量 | 20% -> 50% | 24 小时 | 稳定性、成本 | 无异常告警，成本在预算内 |
| Phase 4: 全量 | 50% -> 100% | 持续 | 长期稳定性 | 持续稳定 |

**分流引擎实现**：

推荐使用一致性哈希确保同一用户始终路由到同一模型版本（避免用户在 ERNIE 3.0 和 4.0 之间频繁切换导致体验不一致）：

```python
def route(user_id: str, experiment_config: dict) -> str:
    # 一致性哈希分流
    bucket = hash(user_id) % 100  # 0-99
    v4_percentage = experiment_config["ernie_v4_pct"]
    if bucket < v4_percentage:
        return "ernie_4.0"
    return "ernie_3.0"
```

灰度配置存储在配置中心（如 Apollo/Nacos），支持动态修改、实时生效，无需重启服务。配置结构：

```json
{
  "experiment_id": "ernie_v4_rollout_20260511",
  "v4_percentage": 5,
  "whitelist_users": ["test_user_001"],
  "blacklist_users": [],
  "auto_rollback_enabled": true,
  "rollback_thresholds": {
    "error_rate_ratio": 2.0,
    "p99_latency_ratio": 1.5,
    "business_metric_ratio": 0.9
  }
}
```

**自动回滚机制**：

触发条件（任一满足即自动回滚）：
1. ERNIE 4.0 错误率 > ERNIE 3.0 错误率 * 2（如 0.5% -> 1.0%）
2. ERNIE 4.0 P99 延迟 > ERNIE 3.0 P99 延迟 * 1.5
3. 核心业务指标（如推荐点击率）下降超过 10%
4. 出现 P0 安全/合规事件
5. 成本超预算 20%

回滚操作：配置中心立即将 `v4_percentage` 置为 0，所有流量回归 ERNIE 3.0。回滚后自动创建事故报告并通知 On-call。

**效果对比指标体系**：

| 指标类别 | 具体指标 | 对比方式 |
|---------|---------|---------|
| 技术质量 | 推荐准确率、A/B 评分 | ERNIE 4.0 组 vs ERNIE 3.0 组 |
| 业务效果 | 点击率、转化率、用户停留时长 | 分流用户对比 |
| 性能 | P50/P95/P99 延迟、吞吐量 | 实时监控对比 |
| 成本 | per-request 成本、日均总成本 | 成本看板对比 |
| 稳定性 | 错误率、超时率、OOM 率 | 告警对比 |

统计显著性：使用 T-test 或 Bootstrap 方法验证指标差异是否显著，置信水平 95%。

**加分项**

1. 讨论如何用 Feature Flag 平台（如 LaunchDarkly、字节跳动的 TCE）做更精细的灰度控制（按用户群、地域、设备类型）。
2. 提到"回放验证"：用 ERNIE 3.0 的历史请求离线回放到 ERNIE 4.0，提前评估效果差异。
3. 给出灰度过程中发现异常的 RCA 流程（Trace 对比 -> 差异定位 -> 修复 -> 重新灰度）。

---

### Q16：LLM API 从 10 QPS 扩展到 10k QPS 的完整路径？

**考察点**

候选人是否具备大规模 LLM 服务的扩容经验，理解从应用层到 API 网关到模型层的全链路扩容路径和瓶颈分析。

**解答思路**

1. 先定位 10 QPS -> 10k QPS（1000x 增长）的核心瓶颈是什么（不是简单的加机器，而是涉及架构重构）。
2. 按"应用层 -> API 网关 -> 模型推理层 -> 基础设施层"四层逐层给出扩容方案。
3. 强调从 10 QPS 到 10k QPS 不是一条直线，中间需要在不同阶段切换架构。

**参考答案**

10 QPS -> 10k QPS（1000x 增长）是架构重构级别的扩容，不是简单加机器能解决的。核心瓶颈在三个地方：LLM API 速率限制（Rate Limit）、推理服务吞吐瓶颈、单点故障风险。

**第一阶段：10 -> 100 QPS（优化现有架构）**

- API 层优化：启用 HTTP/2 多路复用、连接池预热、减少 TLS 握手。使用 `httpx.AsyncClient` 的连接池复用。
- 缓存策略：对重复请求启用语义缓存（Redis + Vector），预期缓存命中率 20-40%。
- 速率限制处理：实现 Token Bucket 限流器 + 指数退避重试。记录 Rate Limit 响应头，动态调整发送速率。
- 负载均衡：如果使用自部署模型，部署多实例 + Nginx/Envoy 负载均衡。

**第二阶段：100 -> 1K QPS（引入异步架构 + 多模型池）**

- **异步架构**：从同步 FastAPI 迁移到 asyncio + FastAPI，使用 `BackgroundTasks` 处理长时间任务。请求接收和 LLM 调用解耦。
- **多模型池 + 跨厂商路由**：单一模型 API 有速率限制（如 OpenAI 的 Tier 5 大约 10K RPM ≈ 166 QPS），需要跨多个 API Key、跨多个厂商（OpenAI + Anthropic + Azure）做请求分发。
  ```python
  class MultiProviderRouter:
      def __init__(self):
          self.providers = [
              Provider("openai", keys=["key1", "key2", "key3"], max_qps_per_key=150),
              Provider("anthropic", keys=["key1", "key2"], max_qps_per_key=100),
              Provider("azure", keys=["key1"], max_qps_per_key=200),
          ]
      def route(self, request) -> Provider:
          # 选择当前 QPS 最低且有可用容量的 provider
  ```
- **请求队列**：当所有 Provider 都达到 Rate Limit 时，请求入 Redis 队列，按优先级 + FIFO 顺序消费。关键：设置队列超时和最大长度，超限请求直接返回 429 + 建议稍后重试。
- **分级响应**：按用户 tier 或任务优先级分级处理。VIP 用户走专用 key pool，普通用户共享 pool。

**第三阶段：1K -> 10K QPS（自部署推理集群 + 多级缓存 + 边缘部署）**

- **自部署推理集群**：1K QPS 以上，API 调用成本极高（每天数百万次调用），必须转向自部署。使用 vLLM / SGLang / TensorRT-LLM 部署推理服务。
  - vLLM 单卡 A100 80G 部署 Llama-3.1-8B：大约 50-100 QPS（取决于序列长度）。达到 10K QPS 需要 100-200 张 GPU（考虑冗余）。
  - 使用 PagedAttention + Continuous Batching 最大化吞吐。
  - 自适应批处理（Dynamic Batching）：将短时间窗口内的请求合并为 batch 推理。
- **多级缓存体系**：
  - L1：本地进程内 LRU Cache（< 1ms，适合热点请求）。
  - L2：Redis 语义缓存（1-5ms，命中率 20-30%，使用 embedding 相似度匹配）。
  - L3：精确匹配缓存（Hash 用户输入 -> 缓存结果，命中率 5-10%，适合高频固定 query）。
- **边缘部署**：在多个地域部署推理集群，用户就近接入，降低网络延迟。
- **降级熔断**：多级降级策略 — 如果 Opus 级模型队列过长，自动降级到 Sonnet；如果所有模型不可用，返回缓存结果或预设的静态回复。
- **弹性伸缩**：基于 GPU 利用率和请求队列深度做 HPA（Horizontal Pod Autoscaling）。使用 KEDA 根据 Kafka 消息堆积量触发扩容。

**全链路监控指标**：

| 层级 | 指标 | 告警阈值 |
|------|------|---------|
| 接入层 | QPS、4xx/5xx 比率 | 5xx > 1% |
| 队列层 | 队列深度、排队时间 | P99 排队 > 5s |
| 推理层 | GPU 利用率、TTFT、TPOT | GPU > 90%, P99 TTFT > 3s |
| 缓存层 | 命中率 | 缓存命中率 < 15% |
| 成本层 | per-request cost | 日均成本 > 预算 110% |

**加分项**

1. 给出具体算力估算：10K QPS 的 Llama-3.1-8B 需要多少张 A100。
2. 讨论"异步批量推理"（Async Batching）的实现细节和延迟权衡。
3. 提到 Kubernetes + KEDA + vLLM 的自动扩缩容实践。

---

### Q17：Agent 超时/失败如何兜底？跨境汇款场景下如何保证资金安全？

**考察点**

候选人是否理解 Agent 异常处理的分层策略（瞬时失败 vs 永久失败的不同处理），以及在高金融安全场景下的特殊设计（幂等性、双人复核、人工确认、审计追溯）。

**解答思路**

1. 先区分 Agent 异常的类型（超时、工具调用失败、LLM 返回异常、业务逻辑错误），不同类型对应不同的兜底策略。
2. 然后专门讨论跨境汇款场景的资金安全保障：幂等性保证、金额上限、双人复核、人工审批节点、全链路审计。
3. 给出端到端的故障恢复流程。

**参考答案**

**通用兜底策略 — 按故障类型分类处理**：

| 故障类型 | 判断标准 | 兜底策略 | 重试逻辑 |
|---------|---------|---------|---------|
| LLM API 超时 | TTFB > 10s 或 Total > 60s | 降级到备用模型；返回"系统繁忙" | 指数退避，最多 2 次 |
| LLM 返回异常格式 | JSON parse 失败 | 重试 + 强化格式约束；3 次后返回错误 | 立即重试，最多 3 次 |
| 工具调用超时 | tool timeout > 30s | 降级到缓存结果；使用替代工具；跳过非必需工具 | 不重试（工具非幂等） |
| 工具返回错误 | tool error code | 根据错误类型分类处理（临时/永久） | 见下文 |
| Agent 陷入循环 | 循环次数 > max_iterations | 熔断，返回当前最佳结果 | 不重试 |
| 上游依赖失败 | Sub-Agent 失败 | 降级到轻量模型重试；跳过该步骤 | 1 次重试 |

**错误类型区分（临时 vs 永久）**：

```python
class ToolErrorClassifier:
    TEMPORARY_ERRORS = {
        "rate_limit", "timeout", "connection_error",
        "service_unavailable", "deadlock_detected"
    }
    PERMANENT_ERRORS = {
        "invalid_parameter", "permission_denied",
        "resource_not_found", "validation_error",
        "account_frozen"  # 跨境汇款场景：账户被冻结
    }

    def classify(self, error: ToolError) -> str:
        if error.code in self.TEMPORARY_ERRORS:
            return "retry"      # 指数退避重试
        elif error.code in self.PERMANENT_ERRORS:
            return "fail_fast"  # 立即失败，通知用户
        else:
            return "escalate"   # 升级给人工处理
```

**跨境汇款场景 — 资金安全保障**：

跨境汇款是金融级的高安全场景，Agent 的任何错误都可能直接造成资金损失。需要以下五层保障：

**第一层：幂等性保证（Idempotency）**

每笔汇款请求生成全局唯一的 `idempotency_key`（由 `user_id + timestamp + nonce` 的 SHA256 生成）。支付系统根据 `idempotency_key` 去重，确保同一笔汇款不会因 Agent 重试而被重复执行。

```python
async def execute_remittance(request: RemittanceRequest):
    idempotency_key = sha256(f"{request.user_id}:{request.timestamp}:{request.nonce}")
    # 先检查是否已处理
    existing = await db.find_one({"idempotency_key": idempotency_key})
    if existing:
        return existing["result"]  # 幂等返回
    # 标记为处理中
    await db.insert({"idempotency_key": idempotency_key, "status": "processing"})
    # ... 执行汇款
```

**第二层：金额控制（Amount Guard）**

- 单笔上限：Agent 自主发起的汇款不得超过预设阈值（如 $5,000），超过需要升级审批。
- 日累计上限：同一用户 Agent 发起的日累计汇款金额上限（如 $50,000），达到上限后当日冻结。
- 异常金额检测：如果汇款金额与用户历史行为模式的偏差超过 3 个标准差，触发人工审核。

**第三层：双人复核（Four-Eyes Principle）**

Agent 执行汇款前，关键信息（收款人姓名、账号、SWIFT Code、金额、币种）必须经第二个模型（或人工）交叉验证：

```python
# Agent A 生成汇款指令
remittance = agent_a.generate_remittance(user_request)
# Agent B (独立模型, 独立 system prompt) 审核
review = agent_b.review_remittance(remittance)
if review.approved and review.confidence > 0.95:
    execute(remittance)
else:
    escalate_to_human(remittance, review.concerns)
```

Agent B 的审核要点：信息一致性、合规性（反洗钱/制裁名单筛查）、合理性（金额是否符合上下文）。

**第四层：人工审批节点（Human-in-the-Loop）**

触发人工审批的条件：
- 金额超过 Agent 自主决策上限
- 收款方为新添加的账户（首次交易）
- 收款方所在国家为高风险地区（FATF 灰名单国家）
- Agent A 和 Agent B 意见不一致
- 交易触发了反洗钱规则（如大额拆分规避监控）

审批工作流：Agent 生成审批工单（包含完整上下文、风险提示） -> 推送到审批系统 -> 人工审批 -> 审批结果回传给 Agent 继续或终止。

**第五层：全链路审计（Audit Trail）**

每笔汇款操作记录不可篡改的审计日志：
- `who`: 哪个 Agent / 用户发起的操作
- `what`: 操作类型和参数
- `when`: 精确到毫秒的时间戳
- `why`: Agent 的决策理由（reasoning trace）
- `result`: 执行结果（成功/失败/待审批）
- `approvals`: 审批链（人工审批记录）

日志写入 WAL（Write-Ahead Log）并在汇款执行前 flush，确保即使系统崩溃也能追溯。使用区块链式哈希链保证日志不可篡改。

**加分项**

1. 给出跨境汇款 Agent 的有限状态机（FSM）图，标注每个状态的安全检查和转换条件。
2. 讨论"乐观执行 + 事后对账"模式：Agent 先执行小额预授权，银行最终结算时再做完整校验。
3. 提到 SOC2 / PCI-DSS 合规要求下的 Agent 审计设计。

---

### Q18：多租户 RAG 系统怎么设计？竞争对手的数据彼此不可见？

**考察点**

候选人是否理解多租户系统的数据隔离策略（物理隔离 vs 逻辑隔离），能否在 RAG 场景下实现严格的数据隔离和租户感知的检索。

**解答思路**

1. 先说明多租户 RAG 的核心挑战（数据隔离、检索隔离、权限校验、成本归因）。
2. 给出三种隔离方案（物理隔离/逻辑隔离/混合隔离）并分析各自的 cost-security trade-off。
3. 展开逻辑隔离的具体实现：向量级别的租户标签、查询时过滤、租户感知的 Embedding。

**参考答案**

多租户 RAG 系统要求确保租户 A 的知识库与租户 B 的知识库严格隔离，即使它们是商业竞争对手。

**方案一：物理隔离（最高安全，最高成本）**

每个租户拥有独立的：
- 向量数据库实例（独立的 Milvus Collection / pgvector Schema / Qdrant Collection）
- 文档存储（独立的 S3 Bucket 或文件目录）
- Embedding 计算资源（可选，防止侧信道攻击）

```python
class TenantRouter:
    def get_vector_store(self, tenant_id: str):
        collection_name = f"tenant_{tenant_id}_docs"
        return self.milvus.get_collection(collection_name)
```

优势：隔离性最强，一个租户的配置错误/性能问题不影响其他租户。劣势：租户数量多时管理成本爆炸（1000 个租户 = 1000 个 Collection），资源利用率低。

**方案二：逻辑隔离（最低成本，需要严格校验）**

所有租户共享同一个向量数据库 Collection，通过在每条向量记录中添加 `tenant_id` 字段，查询时强制过滤：

```python
class MultiTenantVectorStore:
    def search(self, tenant_id: str, query_vector, top_k: int):
        # 关键：每次查询必须带 tenant_id 过滤
        results = self.collection.search(
            query_vector,
            filter=f'tenant_id == "{tenant_id}"',  # Milvus Scalar Filtering
            limit=top_k
        )
        return results

    def insert(self, tenant_id: str, vectors, metadata):
        # 写入时强制注入 tenant_id
        for meta in metadata:
            meta["tenant_id"] = tenant_id
        self.collection.insert(vectors, metadata)
```

关键保障措施：
1. **中间件层强制注入**：在 API Gateway / 中间件层强制注入 `tenant_id`，应用层代码不能跳过。使用 AOP（Aspect-Oriented Programming）在 DAO 层统一拦截。
2. **SQL/Filter 注入防护**：`tenant_id` 的过滤条件使用参数化查询，防止租户通过特殊构造的请求绕过过滤。
3. **租户配额限制**：每个租户限制文档数量、检索频率、Token 消耗，防止一个租户的资源滥用影响他人。

**方案三：混合隔离（推荐）**

- 知识库数据：逻辑隔离（共享 Vector DB + tenant_id 过滤），满足 99% 的安全需求。
- 租户自定义配置（Prompt 模板、敏感凭证）：物理隔离。
- 高安全租户（金融/医疗）：物理隔离 Collection。
- 普通租户（SaaS 场景）：逻辑隔离。

**向量数据库层的具体实现（以 Milvus 为例）**：

```python
# 使用 Milvus 的 Partition Key 做高效租户隔离
schema = CollectionSchema([
    FieldSchema("id", DataType.INT64, is_primary=True),
    FieldSchema("tenant_id", DataType.VARCHAR, max_length=64, is_partition_key=True),
    FieldSchema("embedding", DataType.FLOAT_VECTOR, dim=1536),
    FieldSchema("text", DataType.VARCHAR, max_length=65535),
])
```

使用 Partition Key 的优势：Milvus 会根据 `tenant_id` 自动将数据分布到不同分区，查询时利用分区裁剪（Partition Pruning）大幅提升性能，同时天然保证隔离。

**安全加固清单**：

1. API 层鉴权：每个请求先验证 JWT Token 中的 `tenant_id`，确保请求的 `tenant_id` 与 Token 中的一致。
2. 查询强制过滤：在 ORM/DAO 层实现"自动过滤"装饰器，确保没有任何查询漏掉 `tenant_id`。
3. 日志审计：记录所有跨租户的异常访问尝试（如 tenant A 的请求尝试访问 tenant B 的知识库）。
4. 渗透测试：定期模拟跨租户攻击场景（如修改请求中的 `tenant_id` 参数），验证隔离有效性。
5. 数据导出控制：租户导出数据时，确认只能导出自己的数据（后台审核导出请求的 `tenant_id`）。

**成本归因**：每个租户的 Embedding 调用、向量存储、LLM Token 消耗独立计费，使用 `tenant_id` 标签在 LangFuse 中分组统计。

**加分项**

1. 给出使用 PostgreSQL Row-Level Security (RLS) 实现数据库层隔离的方案。
2. 讨论"加密向量检索"（Homomorphic Encryption + Vector Search）在极端安全场景的应用。
3. 提到数据面和控制面的分离：管理后台可跨租户操作（运维），数据面严格隔离（用户请求）。

---

### Q19：Agent 评估的 Eval 体系怎么设计？LLM-as-a-Judge 有哪些局限性？

**考察点**

候选人是否理解 Agent 评估的多维度体系（不只评输出，还要评过程），以及 LLM-as-a-Judge 的局限性及其缓解策略。

**解答思路**

1. 先按"效果 - 效率 - 安全 - 体验"四维构建完整的 Eval 指标体系。
2. 重点展开 LLM-as-a-Judge 的优势、局限性和缓解方案。
3. 给出完整的评估流水线设计（离线评测 + 线上评估 + 人工抽检）。

**参考答案**

**Agent 评估的完整指标体系**：

| 维度 | 一级指标 | 二级指标 | 评估方法 |
|------|---------|---------|---------|
| 效果 | 任务完成率 | 目标达成率、部分完成率、失败率 | 人工标注 + LLM Judge + 规则校验 |
| 效果 | 输出质量 | 准确性、相关性、完整性、流畅度 | LLM Judge + RAGAS（RAG 场景） |
| 效果 | 推理质量 | 步骤正确性、工具选择准确率、参数准确性 | Trace 分析 + LLM Judge |
| 效果 | 幻觉率 | Factual Hallucination、Loyalty Hallucination | RAGAS Faithfulness + 事实核查 |
| 效率 | 延迟 | TTFT、端到端延迟、工具调用延迟 | 线上监控（P50/P95/P99） |
| 效率 | Token 效率 | per-task tokens、压缩比、缓存命中率 | Token 计数 + 成本统计 |
| 安全 | 安全合规 | Refusal Rate、Toxicity、Bias | LlamaGuard + 安全分类器 |
| 安全 | 鲁棒性 | Prompt Injection 抵抗力、边界 Case 处理 | 对抗测试集 + 故障注入 |
| 体验 | 用户满意度 | CSAT、NPS、重复使用率 | 用户反馈 + 问卷调查 |

**LLM-as-a-Judge 的优势与局限性**：

**优势**：
1. 可扩展：自动化评估，支持大规模（数万条）评测。
2. 灵活性：无需预定义标准答案，可评估开放式任务。
3. 一致性：相比人工评估，同一 Judge 模型对相同输入的评分一致。

**局限性及缓解策略**：

| 局限性 | 表现 | 缓解策略 |
|--------|------|---------|
| **位置偏见** | 偏好第一个选项（Primacy Bias）或最后一个（Recency Bias） | 交换选项位置，取两次评分的平均值 |
| **长度偏见** | 倾向于给更长的回答更高分 | 在评分 prompt 中明确警告，使用长度归一化 |
| **自我偏好** | GPT-4 倾向于给 GPT-4 生成的回答更高分 | 使用不同模型族的 Judge（如用 Claude 评 GPT 输出） |
| **评分漂移** | 同一 Judge 在不同时间的评分标准不一致 | 使用锚定样本（Anchoring Examples）校准 |
| **无法判断事实** | Judge 模型自身也有幻觉，可能给错误答案高分 | 提供 Ground Truth 作为评分参考；结合 RAGAS Faithfulness |
| **对细微差异不敏感** | 5 分制中往往集中在 3-4 分 | 使用 Pairwise Comparison（A vs B）代替绝对评分 |
| **成本** | 大规模评估时 Judge 调用成本高 | 对简单项用规则引擎；对复杂项才用 LLM Judge |
| **指令敏感性** | 评分标准描述方式的微小变化导致评分差异 | 固定评分模板 + 定期校准 |

**LLM-as-a-Judge 最佳实践**：

```python
# 推荐：Pairwise + Position Swap
async def evaluate_pairwise(candidate_a, candidate_b, criteria):
    # 第一次：A 在前，B 在后
    result_1 = await judge.compare(A=candidate_a, B=candidate_b, criteria=criteria)
    # 第二次：B 在前，A 在后（消除位置偏见）
    result_2 = await judge.compare(A=candidate_b, B=candidate_a, criteria=criteria)
    if result_1 == "A" and result_2 == "B":  # 两次都选 A（原始）
        return "A"  # 确认 A 更好
    elif result_1 == "B" and result_2 == "A":  # 两次都选 B（原始）
        return "B"
    else:
        return "TIE"  # 位置偏见导致不一致
```

**评估流水线设计**：

1. **离线评估（开发阶段）**：
   - 构建 Golden Dataset（200-500 条人工标注的标准样例）
   - 每次 Agent 改动后跑全量离线评估
   - 通过标准：关键指标不下降 > 2%
2. **线上评估（灰度/生产阶段）**：
   - 5% 流量做 A/B 实验
   - 自动采集用户反馈信号（点赞/踩、复制率、重新生成率）
   - 使用 LangFuse 的 Score 功能记录每次请求的质量评分
3. **人工抽检（持续）**：
   - 每周随机抽样 100 条线上请求做人工评估
   - 标注维度：正确性、有用性、安全性、流畅度
   - 计算人工评分与 LLM Judge 评分的相关系数（Pearson/Spearman），监控 Judge 可靠性
4. **评估数据闭环**：
   - 用户反馈 + 人工标注 = 持续扩大 Golden Dataset
   - 低分案例自动添加到回归测试集
   - 评估结果反馈到 Prompt 优化和模型路由策略

**加分项**

1. 提到使用 DeepEval、RAGAS、LangSmith Evaluators 等开源评估框架的实践经验。
2. 讨论 MT-Bench / Chatbot Arena 等 Benchmark 的评分方式与实际业务的相关性。
3. 给出一个可落地的 Eval Pipeline 架构图（Golden Dataset -> Offline Eval -> CI Gate -> Online Eval -> Human Review）。

---

### Q20：Token 消耗怎么精细化管理？缓存策略/模型降级/预算告警？

**考察点**

候选人是否具备 Token 成本管理的落地经验，能否区分不同的缓存策略和模型降级方案，并给出可量化的成本优化效果。

**解答思路**

1. 先给出 Token 成本管理的三个维度：计量（计量准确）、控制（策略优化）、预警（预算管控）。
2. 分别展开缓存策略、模型降级策略、预算告警机制。
3. 给出量化效果数据（各策略能节省多少百分比）。

**参考答案**

Token 消耗管理需要在"质量-成本-延迟"三角中找到最优平衡点。核心公式：Minimize Cost, subject to Quality >= Q_threshold, Latency <= L_threshold。

**一、精准计量**

```python
class TokenTracker:
    def __init__(self):
        self.daily_budget = DailyBudget(limit=500000)  # 日预算 50 万 token
        self.per_request_tokens = Counter()  # 实时统计

    async def track(self, request_id, model, input_tokens, output_tokens):
        cost = self.calculate_cost(model, input_tokens, output_tokens)
        await self.db.insert({
            "request_id": request_id,
            "timestamp": now(),
            "model": model,
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "cost_usd": cost,
        })
        self.daily_budget.consume(cost)
        if self.daily_budget.remaining_pct() < 20:
            await self.send_budget_alert()
```

关键设计：
- 按 `request_id` 粒度记录每次 LLM 调用（精确到 input/output token 拆分）。
- 按标签（租户、Agent、任务类型）分组聚合，定位成本热点。
- 区分 Prompt Caching 命中/未命中的 token 计费（Anthropic: cache_write/cache_read/uncached 三种价格）。

**二、缓存策略（Token 节省 20-50%）**

| 缓存类型 | 工作原理 | 适用场景 | 预期节省 |
|---------|---------|---------|---------|
| **Prompt Cache** | LLM 厂商提供的 Prompt Caching，缓存 System Prompt 和长上下文前缀 | System Prompt、固定模板、多轮对话历史 | 50-80%（System Prompt 部分） |
| **精确匹配缓存** | Hash 用户输入，完全相同的 query 直接返回缓存结果 | FAQ、固定话术 | 5-10%（命中率低但成本为 0） |
| **语义缓存** | Embedding 相似度 > 0.95 视为相同语义，返回缓存结果 | 开放式问答、相似问题 | 20-40%（写入时存 embedding + response） |
| **中间结果缓存** | 缓存 Agent 多步推理的中间状态和工具调用结果 | 重复的 RAG 检索、API 调用 | 10-25% |

语义缓存实现要点：

```python
class SemanticCache:
    def __init__(self, redis_client, threshold=0.95):
        self.redis = redis_client
        self.threshold = threshold

    async def get(self, query_embedding):
        # Redis 向量相似度搜索 (Redis Stack 支持)
        results = self.redis.ft("cache_idx").search(
            Query(f"*=>[KNN 1 @embedding $vec AS score]")
            .return_fields("response", "score")
            .dialect(2),
            {"vec": query_embedding.tobytes()}
        )
        if results.docs and results.docs[0].score >= self.threshold:
            return results.docs[0].response
        return None
```

注意：语义缓存需要额外的 Embedding API 调用成本，需确保 Embedding 成本 << LLM 节省的成本。通常一个 Embedding 调用约 $0.0001，而一次 LLM 调用 $0.01-0.10，收益比 100:1 以上。

**三、模型降级策略（Token 节省 30-60%）**

```python
class ModelDegrader:
    TIERS = {
        "premium":  ["opus", "gpt-4o"],
        "standard": ["sonnet", "gpt-4o-mini"],
        "economy":  ["haiku", "gpt-4o-mini"],
    }

    def select(self, task: Task, budget_state: BudgetState) -> str:
        if budget_state == "normal":
            tier = task.priority_tier  # 任务自身的优先级
        elif budget_state == "warning":  # 预算消耗 > 70%
            tier = min(task.priority_tier, "standard")  # 降一档
        elif budget_state == "critical":  # 预算消耗 > 90%
            tier = "economy"  # 全部降级到最低档
        return self.route_to_available_model(self.TIERS[tier])
```

模型降级触发条件：
- 预算消耗 > 70%：非 VIP 任务降级一档
- 预算消耗 > 90%：所有任务降级到最便宜模型
- 单请求 Token 预估 > 10K：优先使用便宜模型（除非必需复杂推理）
- 夜间低峰期：自动降级（用户对延迟不敏感）

**四、预算告警与管控**

三层告警机制：
1. **预警（70% 日预算消耗）**：Slack/飞书通知，开启模型降级策略。
2. **告警（90% 日预算消耗）**：On-call 通知，所有非 VIP 请求降级到 cheapest 模型。
3. **熔断（100% 日预算消耗）**：VIP 用户继续服务，非 VIP 返回"系统繁忙"，防止账单爆炸。

预算维度：
- 日预算（防止单日异常）
- 周预算（允许日间波动）
- 租户预算（多租户场景）
- 任务预算（单个 Agent 任务的 Token 上限，如 50K token）

**量化效果总结**：

| 优化手段 | 成本节省幅度 | 质量影响 |
|---------|------------|---------|
| Prompt Caching | 30-50% | 无影响 |
| 语义缓存 | 15-30% | 微小（需调优阈值） |
| 模型降级（简单任务用 Haiku） | 40-60% | 简单任务无影响 |
| 上下文压缩（摘要后再传递） | 20-35% | 微小信息损失 |
| 预算管控（防止异常消费） | 风险管理 | 有损（降级时） |

综合上述策略，合理配置可降低 Token 成本 50-70%，同时保证核心业务质量。

**加分项**

1. 给出实际项目的成本优化案例（优化前 $X/月 vs 优化后 $Y/月）。
2. 讨论 Anthropic 的 Prompt Caching 三种计费模式（cache_write, cache_read, uncached）和最佳 cache 粒度设计。
3. 提到使用 LangFuse 的 Cost Tracking 功能做多模型成本的统一 dashboard。

---

### Q21：流式输出（SSE）在 Agent 系统中的实现细节？打字机效果怎么做？

**考察点**

候选人是否理解 SSE 协议在 Agent 系统中的完整实现链路（从 LLM API 到前端渲染），能否处理 Agent 场景下的特殊挑战（工具调用中断、并行流、SSE 重连）。

**解答思路**

1. 先给出完整的 SSE 架构链路（LLM SDK -> API Gateway -> 前端 EventSource）。
2. 重点展开 Agent 场景的特殊处理：工具调用的流式包裹、多步推理的流式衔接、打字机效果的实现。
3. 补充 SSE 的工程问题：断线重连、背压控制、与 WebSocket 的选型。

**参考答案**

**完整的 SSE 架构链路**：

```
LLM SDK (stream=True)
    │
    ├─ token by token ─→ async generator
    │
    ▼
FastAPI StreamingResponse
    │
    ├─ Server-Sent Events ─→
    │  data: {"type": "text", "content": "你好"}
    │  data: {"type": "tool_call", "name": "search", "args": {...}}
    │  data: {"type": "thinking", "content": "我需要先搜索..."}
    │  data: {"type": "done", "usage": {...}}
    │
    ▼
Nginx (禁用 buffering: proxy_buffering off)
    │
    ▼
Browser EventSource / fetch + ReadableStream
    │
    ▼
打字机效果渲染
```

**后端实现（FastAPI + Anthropic SDK）**：

```python
from fastapi import FastAPI
from fastapi.responses import StreamingResponse
import json

app = FastAPI()

async def generate_agent_stream(user_message: str):
    """Agent 流式输出的 async generator"""
    async with anthropic_client.messages.stream(
        model="claude-sonnet-4-20250514",
        max_tokens=4096,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_message}],
        tools=TOOLS,
    ) as stream:
        # 处理文本流
        async for text in stream.text_stream:
            yield f"data: {json.dumps({'type': 'text', 'content': text})}\n\n"

        # 处理工具调用（Agent 决定调用工具时）
        final_message = await stream.get_final_message()
        for block in final_message.content:
            if block.type == "tool_use":
                yield f"data: {json.dumps({'type': 'tool_call', 'name': block.name, 'input': block.input})}\n\n"
                # 执行工具
                tool_result = await execute_tool(block.name, block.input)
                yield f"data: {json.dumps({'type': 'tool_result', 'content': tool_result})}\n\n"
                # 继续流式生成（工具结果回传后）
                # ... 新一轮 stream

        yield f"data: {json.dumps({'type': 'done'})}\n\n"

@app.post("/chat/stream")
async def chat_stream(request: ChatRequest):
    return StreamingResponse(
        generate_agent_stream(request.message),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # 禁用 Nginx 缓冲
        }
    )
```

**Agent 场景的特殊处理**：

1. **工具调用的流式包裹**：当 Agent 准备调用工具时，SSE 推送 `type: "tool_call"` 事件，前端显示"正在查询数据库..."或"正在搜索..."。工具执行完成后推送 `type: "tool_result"` 事件，前端清除 loading 状态。

2. **思维链展示（Thinking Stream）**：
   - 如果使用支持 extended thinking 的模型（如 Claude），可以获取 `thinking` 类型事件流，前端渲染为折叠的"思考过程"区域。
   - 如果不支持原生 thinking，可以在 System Prompt 中要求 Agent 先输出 `<thought>...</thought>` 标记的思考内容。

3. **多步推理的流式衔接**：Agent 的多步推理在 SSE 层面表现为多个"文本流 -> 工具调用 -> 文本流"的衔接。前端需要维护一个消息列表，不断 append 新的 text delta 和 tool_call 消息。

**打字机效果的 SSE 协议设计**：

```json
// 逐字/逐词推送
{"type": "text", "content": "根"}      // 每个 SSE event 推一个或多个 token
{"type": "text", "content": "据"}
{"type": "text", "content": "您"}
{"type": "text", "content": "的"}
{"type": "text", "content": "问题"}

// 带速率的打字机效果（前端控制）
```

前端实现打字机效果的关键：
- 维护一个 buffer（累积接收到的 text delta）
- 使用 `requestAnimationFrame` 或 `setInterval` 控制渲染速率（如每 30ms 渲染一个字符）
- LLM 返回 token 的速度通常比人阅读速度快，前端可适当做延迟渲染营造"打字"感

**前端示例（React + fetch ReadableStream）**：

```typescript
async function* streamChat(message: string) {
  const response = await fetch("/chat/stream", {
    method: "POST",
    body: JSON.stringify({ message }),
    headers: { "Content-Type": "application/json" },
  });
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      if (line.startsWith("data: ")) {
        yield JSON.parse(line.slice(6));
      }
    }
  }
}
```

**SSE 工程要点**：

1. **断线重连**：浏览器原生 `EventSource` 支持自动重连（3s 默认间隔）。需要服务端支持 `Last-Event-ID` 头，从断点继续推送。自定义 fetch 实现时需要手动处理重连逻辑。
2. **Nginx 配置**：必须关闭 buffering（`proxy_buffering off`, `proxy_cache off`），否则 SSE 事件会被缓冲直到连接关闭才发送。
3. **背压控制**：如果前端消费速度慢于后端推送速度，使用背压队列（如内存中的 asyncio.Queue 限制最大长度）。
4. **SSE vs WebSocket 选型**：
   - SSE：单向（server -> client）、HTTP 原生、自动重连、适合流式文本推送
   - WebSocket：双向、需要额外握手、适合需要用户中途打断 Agent 的场景
   - 推荐：Agent 流式输出优先 SSE；需要用户实时交互（如终止生成）时用 WebSocket 或 fetch + AbortController

**加分项**

1. 给出 Nginx 的完整 SSE 配置（buffering, timeout, chunked_transfer_encoding）。
2. 讨论 SSE 的 MCP 传输模式（2025 年 MCP 支持 SSE transport）。
3. 提到使用 `AbortController` 实现用户点击"停止生成"的中断逻辑。

---

### Q22：LangSmith/LangFuse 等可观测性工具的核心能力？trace 链路怎么设计？

**考察点**

候选人是否理解 Agent 系统可观测性的三大支柱（Logging、Tracing、Metrics），并能设计一个完整的 trace 链路来追踪 Agent 的多步推理过程。

**解答思路**

1. 先说明 Agent 系统为什么需要专门的可观测性工具（传统 APM 不理解 LLM call 和 Agent loop）。
2. 给出 LangSmith 和 LangFuse 的核心能力对比。
3. 重点展开 trace 链路的数据模型设计（Span 层级、关键字段、与业务系统的集成）。

**参考答案**

**Agent 系统对可观测性的特殊需求**：

传统 APM（如 Datadog、Jaeger）可以追踪 HTTP 调用和数据库查询，但无法理解 LLM 调用的语义（prompt 是什么、生成了什么、token 用了多少）。Agent 可观测性需要特殊设计，因为：
- 一次 Agent 调用 = 多次 LLM 调用 + 多次工具调用 + 业务逻辑
- 需要追踪每一步的 cost（Token 消耗 + 延迟）
- 需要关联 Agent 决策过程与最终输出质量
- 需要支持 LLM-as-a-Judge 的在线评分

**LangSmith vs LangFuse 核心能力对比**：

| 能力 | LangSmith | LangFuse |
|------|-----------|----------|
| **Trace 自动采集** | LangChain/LangGraph 原生集成，自动采集 | 支持 LangChain、OpenAI SDK、自定义 SDK |
| **Prompt 管理** | Prompt Hub（版本管理 + A/B 测试） | Prompt 版本管理（支持 LangChain 模板） |
| **人工标注** | Annotation Queue（待审核队列） | 支持 Score API + 人工标注 |
| **评估** | 内置 Evaluators（正确性、有用性等） | 支持 LLM-as-Judge 评估 + 自定义评分 |
| **数据集管理** | Dataset（用于回归测试） | Dataset 功能 |
| **成本追踪** | 自动计算 Token 成本 | 自动计算 Token 成本，支持自定义定价 |
| **实验对比** | Compare Experiments（并排对比） | Experiment 功能 |
| **部署** | SaaS（LangChain 官方） | 开源自部署 / SaaS |
| **优势** | 与 LangChain 生态深度绑定 | 开源，可私有化部署，隐私友好 |

**Trace 链路数据模型设计**：

```
Trace (一次用户请求)
  ├── Span: Router (意图识别)
  │   ├── Span: LLM Call (意图分类)
  │   └── output: {intent: "data_analysis", confidence: 0.92}
  │
  ├── Span: Manager (任务编排)
  │   ├── Span: LLM Call (计划生成)
  │   └── output: {plan: [{agent: "Analyst", task: "..."}, ...]}
  │
  ├── Span: Sub-Agent: Analyst
  │   ├── Span: LLM Call (理解任务)
  │   ├── Span: Tool Call: SQL Query
  │   │   ├── input: {sql: "SELECT ...", params: {...}}
  │   │   ├── output: {rows: 42, elapsed: 0.3s}
  │   │   └── metadata: {db: "analytics_db", success: true}
  │   ├── Span: LLM Call (数据分析)
  │   └── Span: LLM Call (生成分析报告)
  │
  ├── Span: Sub-Agent: Reviewer
  │   ├── Span: LLM Call (质量审查)
  │   └── output: {approved: true, score: 0.88}
  │
  └── Span: Final Output
      └── metadata: {total_tokens: 8472, total_cost: 0.032, total_latency: 4.2s}
```

**每个 Span 的核心字段**：

```python
{
    "id": "span_abc123",
    "trace_id": "trace_xyz789",
    "parent_span_id": "span_parent_456",  # 构建树形结构
    "name": "LLM Call: GPT-4o",
    "type": "llm",  # llm | tool | agent | chain | retriever
    "start_time": "2026-05-11T10:30:00.000Z",
    "end_time": "2026-05-11T10:30:01.234Z",
    "input": {"messages": [...], "model": "gpt-4o"},
    "output": {"content": "...", "finish_reason": "stop"},
    "metadata": {
        "model": "gpt-4o-2024-08-06",
        "temperature": 0.7,
        "input_tokens": 1234,
        "output_tokens": 567,
        "cost_usd": 0.015,
        "prompt_template_version": "v3.2",
    },
    "level": "DEFAULT",  # DEBUG | DEFAULT | WARNING | ERROR
    "status": "OK",  # OK | ERROR
    "tags": ["production", "user_tier:premium"],
    "scores": [  # 线上评分
        {"name": "faithfulness", "value": 0.92},
        {"name": "user_satisfaction", "value": "thumbs_up"},
    ]
}
```

**LangFuse 集成示例**：

```python
from langfuse import Langfuse
from langfuse.decorators import observe, langfuse_context

langfuse = Langfuse(
    secret_key="sk-lf-...",
    public_key="pk-lf-...",
    host="https://cloud.langfuse.com",
)

@observe(as_type="generation")  # 自动创建 Span
async def call_llm(prompt: str, model: str):
    response = await openai_client.chat.completions.create(
        model=model, messages=[{"role": "user", "content": prompt}]
    )
    # LangFuse 自动注入 trace context，记录 input/output/tokens/cost
    langfuse_context.update_current_observation(
        model=model,
        usage={
            "input": response.usage.prompt_tokens,
            "output": response.usage.completion_tokens,
        }
    )
    return response

@observe()  # 创建父 Span
async def run_agent(user_input: str):
    langfuse_context.update_current_trace(
        user_id=user.id,
        session_id=session.id,
        tags=["production", f"agent:v2.1"],
    )
    result = await agent_loop(user_input)
    # 给整个 trace 打分
    langfuse.score(trace_id=langfuse_context.get_current_trace_id(),
                   name="user_feedback", value=1)  # 用户点赞
    return result
```

**可观测性 Dashboard 关键视图**：

1. **延迟分布**：按 Span 类型（llm/tool/agent）展示 P50/P95/P99 延迟
2. **Token 消耗**：按模型、按 Agent、按租户分组的日/周 Token 趋势
3. **错误分布**：按错误类型（timeout/rate_limit/parse_error/tool_error）的热力图
4. **质量趋势**：线上评分（faithfulness/correctness/user_satisfaction）随时间的变化
5. **成本热力图**：按模型、按 Agent 类型的日成本分布，快速定位成本异常

**加分项**

1. 讨论自研 Trace 方案（基于 OpenTelemetry + 自定义 Span Processor）vs 使用 LangFuse/LangSmith 的 trade-off。
2. 给出 LangFuse 的自定义评分（Custom Score）实现：LLM-as-Judge 评分自动写入 LangFuse。
3. 提到 Trace 数据的采样策略（100% 采集 vs 按比例采样 vs 按错误采样），避免可观测性本身成为性能瓶颈。

---

> 全文共 32 题 | Module 5: Q1-Q13 | Module 6: Q14-Q32

---


### Q23：多 Agent 系统是如何工作的？Agent 之间如何通信？

**考察点**

考察候选人在多 Agent 设计类上的理解深度，尤其是多 Agent 的分工、通信、编排、冲突消解和协作成本控制能力。

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

### Q24：如果要提升相关度，你会怎么做？

**考察点**

考察候选人在工程落地类上的理解深度，尤其是线上可靠性、评测、成本、安全、可观测性和持续迭代能力。

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

### Q25：如果要优化回答效果，有哪些思路？

**考察点**

考察候选人在工程落地类上的理解深度，尤其是线上可靠性、评测、成本、安全、可观测性和持续迭代能力。

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

### Q26：工业图纸识别如果大模型出现幻觉，在 Prompt 层或后处理层有什么应对方法？

**考察点**

考察候选人在工程落地类上的理解深度，尤其是线上可靠性、评测、成本、安全、可观测性和持续迭代能力。

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

### Q27：描述一次使用 LLM 开发智能助手的经历，遇到过哪些幻觉问题？

**考察点**

考察候选人在工程落地类上的理解深度，尤其是线上可靠性、评测、成本、安全、可观测性和持续迭代能力。

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

### Q28：如何从 0 到 1 设计一套自动化评估体系，确保 Agent 上线后业务不崩盘？

**考察点**

考察候选人在工程落地类上的理解深度，尤其是线上可靠性、评测、成本、安全、可观测性和持续迭代能力。

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

### Q29：Agent 上线后如何建立准确性、相关性、有用性和安全性的自动化评测体系？

**考察点**

考察候选人在工程落地类上的理解深度，尤其是线上可靠性、评测、成本、安全、可观测性和持续迭代能力。

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

### Q30：如何设计 Agent 自动化评测平台？LLM-as-a-Judge、离线评测、在线 A/B 实验分别怎么用？

**考察点**

考察候选人在工程落地类上的理解深度，尤其是线上可靠性、评测、成本、安全、可观测性和持续迭代能力。

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

### Q31：如果 Agent 要操作数据库，怎么保证它不会误删数据？

**考察点**

考察候选人在工程落地类上的理解深度，尤其是线上可靠性、评测、成本、安全、可观测性和持续迭代能力。

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

---

### Q32：Prompt 注入攻击如何防御？

**考察点**

考察候选人是否能把 Prompt Injection 当作工程安全问题处理，而不是只在提示词里加一句“不要被攻击”。

**解答思路**

1. 先区分用户指令、系统指令、工具返回内容和外部文档内容。
2. 再说明输入过滤、上下文隔离、权限控制、工具调用审批和输出校验。
3. 最后给出生产监控和审计方案。

**参考答案**

Prompt 注入攻击的本质是外部输入试图覆盖系统指令或诱导模型执行越权行为。防御不能只靠提示词，而要做分层安全设计。第一层是数据和指令分离：系统 Prompt、开发者指令、用户输入、RAG 文档、工具返回结果必须用明确边界标记，外部内容只能作为数据，不允许被解释为高优先级指令。

第二层是工具权限控制。Agent 调用工具前要做 allowlist 校验、参数 Schema 校验和租户权限校验。高风险工具如删除数据、转账、发邮件、改配置，应要求二次确认或人工审批。即使模型被诱导生成危险 tool call，执行层也应该拒绝。

第三层是检索和上下文治理。RAG 文档进入上下文前要过滤常见注入语句，例如“忽略以上规则”“泄露系统提示词”等；对网页、评论、用户上传文档这类不可信来源，需要降低信任等级。第四层是输出侧校验，检测是否包含系统提示词泄露、越权承诺、未经依据的敏感操作结果。

生产环境还要记录完整 trace：用户输入、检索片段、模型中间决策、工具参数和拦截原因，用于复盘攻击路径。

**加分项：** 能提到 capability-based security、最小权限原则、工具沙箱、策略即代码（Policy as Code）和红队评测集。
