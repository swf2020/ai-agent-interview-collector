# 工具调用类 - 面试题解答

> 生成日期：2026-05-14 | 共 28 题

---

## Q1：MCP（模型上下文协议）和 Function Calling 有什么区别？什么时候用哪个？在构建复杂 AI 应用时如何选择或结合使用它们？

### 考察点
考察候选人对 Agent 工具调用机制深度的理解：是否理解 MCP 作为协议标准的定位与 Function Calling 作为模型原生能力的关系，能否在生产环境中做出正确的技术选型。

### 解答思路
1. 先厘清二者定位：Function Calling 是模型层面的能力，MCP 是工具集成层面的协议标准。
2. 用 N x M 问题解释 MCP 解决的核心痛点；用对比表格讲清差异。
3. 结合工程实践给出选型建议与结合方案，体现生产级经验。

### 参考答案

**一、定位差异**

Function Calling 是 LLM 提供的一种原生能力：模型根据用户意图，从预先注册的工具定义中选择合适的函数并生成结构化参数，由客户端执行后把结果返回给模型继续推理。它是 OpenAI、Anthropic、Qwen 等模型厂商各自实现的模型侧特性。

MCP（Model Context Protocol）是 Anthropic 于 2024 年 11 月开源的标准化协议，定义了 AI 应用与外部工具/数据源之间统一的通信接口。它基于 JSON-RPC 2.0，采用 Client-Server 架构，抽象出 Tools、Resources、Prompts 三大原语。

**二、MCP 解决了什么问题：N x M 爆炸**

传统的 Function Calling 模式中，每接入一个新工具，开发者在代码中手动编写工具定义（name、description、parameters JSON Schema），且每个 AI 应用都要重复编写适配层。如果有 N 个 AI 应用和 M 个外部工具，工作量就是 N x M。MCP 通过"一次编写 Server，所有 Client 复用"的模式将其降为 N + M，本质是用协议标准化解耦了工具提供方与工具消费方。

**三、核心差异对比**

| 维度 | Function Calling | MCP |
|------|-----------------|-----|
| 层次 | 模型能力（LLM 侧） | 通信协议（传输层） |
| 工具定义 | 每次调用手动传 tools 数组 | Server 动态注册，运行时发现 |
| 标准化 | 各厂商格式有差异 | JSON-RPC 2.0 统一协议 |
| 复用性 | 每个应用独立实现 | 一次构建，多应用复用 |
| 安全模型 | 依赖应用层控制 | 支持 OAuth 2.0、传输层加密 |
| 动态能力 | 工具列表固定 | 运行时 Tools/Resources/Prompts 变更通知 |

**四、选型建议**

- **团队 ≤5 人、工具 ≤10 个、单应用**：直接 Function Calling 即可，协议层开销不值得。
- **工具跨多个应用复用、或需要动态发现**：用 MCP 封装为 Server，所有应用通过同一客户端接入。例如公司内部统一的 Jira/数据库/Slack 工具集。
- **两者结合是生产环境最佳实践**：底层工具通过 MCP Server 提供，Agent 框架通过 MCP Client 动态发现工具列表后，自动注入到 Function Calling 的 `tools` 参数中。这既保证了工具集的标准化复用，又利用了模型原生的工具选择推理能力。

```
// 生产环境中的结合模式
// 1. MCP Client 启动时连接所有 Server，发现工具
const tools = await mcpClient.listTools(); 
// 2. 将 MCP 工具转换为 OpenAI 格式的 Function Calling tools 数组
const openaiTools = tools.map(t => ({ type:'function', function: t }));
// 3. 注入到 LLM 请求中，由模型做工具选择与参数生成
const response = await openai.chat.completions.create({ tools: openaiTools });
// 4. 调用 LLM 返回的 function_call 后执行时，通过 MCP Client 调用对应 Server
const result = await mcpClient.callTool(toolName, args);
```

**加分项：**

- MCP 的 Resources（资源暴露，如文件/数据库 schema）和 Prompts（预置提示模板）原语使 Agent 不仅能"调用工具"，还能"感知上下文"，这是纯 Function Calling 不具备的能力。
- MCP 2025 年 3 月更新的 Streamable HTTP 传输方式支持服务器主动推送和流式响应，解决了早期 stdio/SSE 传输在生产环境（多实例部署、无状态容器）中的连接管理问题。
- Function Calling 的 vendor-lock 问题可通过 MCP 的模型无关性天然规避，换模型厂商时工具集成层不需要重构。

---

## Q2：Agent 工具调用失败了怎么办？你的错误处理和重试策略是什么？如果同时触发多个 Function Call 怎么处理？

### 考察点
考察候选人在生产环境中对工具调用容错机制的工程化设计能力，包括失败分类、重试策略、并发编排等核心议题。

### 解答思路
1. 先对工具调用失败进行分类（可重试 vs 不可重试），提出分级处理策略。
2. 阐述重试机制的具体设计：指数退避、熔断、超时控制。
3. 针对多 Function Call 并发场景，给出串行/并行的选择依据与最终状态一致的保障方案。

### 参考答案

**一、失败分类与处理策略**

工具调用失败需要按错误类型分级处理：

- **参数错误（不可重试）**：LLM 生成的参数格式不正确、必填字段缺失。将错误信息回传模型，让模型自行修正参数后重试，通常 1-2 轮即可纠正。这是最有效的修复方式——模型理解自己的错误并调整。
- **网络/超时错误（可重试）**：API 瞬时不可达。使用指数退避重试（初始 1s，倍增，上限 30s），最多 3 次。配合 jitter 避免惊群效应。
- **业务逻辑错误（不可重试）**：如数据库记录不存在、权限不足。直接返回可读错误给模型，让模型生成用户友好的自然语言回复，不暴露系统内部错误。
- **速率限制**：429 响应遵守 Retry-After 头，配合令牌桶或滑动窗口做客户端限流，避免触发服务端限流。

**二、重试策略设计**

```
重试伪代码：
- maxRetries = 3
- backoff = exponential(initial=1s, multiplier=2, max=30s) + random jitter(0~1s)
- 熔断器：连续失败 5 次 → 熔断开启 30s → 半开探测 → 恢复或重新熔断
- 超时：每个工具调用设置 timeout（如 30s），超时视为可重试失败
```

不可重试的错误绝对不要自动重试，否则浪费 token 和加重下游压力。可重试错误要注意幂等性：对非幂等写操作（如创建订单），需要先去重查询确认状态。

**三、多个 Function Call 的处理**

模型一次返回多个 tool_calls 时：
- **无依赖关系**：并行执行所有调用（Promise.all / asyncio.gather），执行时间取决于最慢的那个。
- **有依赖关系**：需要额外一轮 LLM 推理。第一轮只能拿到前置工具的调用参数，执行后将结果回传，模型在下一轮基于结果决定后续调用。这是当前机制的内在限制——单轮 tool_calls 彼此看不到对方的结果。
- **读写冲突**：如果两个工具操作同一资源（如一个读一个写同一个数据库表），需要控制并发顺序或加锁。推荐做法是在工具定义的 description 中明确声明工具的副作用（是否写操作、是否依赖前置结果），由 Agent 框架解析后决定串行还是并行。

**加分项：**
- 实现"自我修复循环"：模型调用工具 → 失败 → 错误信息回传模型 → 模型修正调用 → 再执行，最多 2-3 轮，这是远比固定重试更智能的容错方式。
- 添加调用链追踪（trace），每次工具调用记录调用时间、参数、结果、耗时，方便定位"慢工具"和"高失败率工具"。
- 熔断器状态对模型透明：当工具被熔断时，提前告知模型"当前工具不可用"，让模型选择替代方案，而不是等到调用失败再处理。

---

## Q3：MCP 的交互流程是怎样的？Agent 如何与 MCP Server 连接通信？MCP 提供了哪些能力（Tools/Resources/Prompts）？

### 考察点
考察候选人对 MCP 协议架构和运行时交互机制的深入理解，是否真正实践过 MCP 的集成开发。

### 解答思路
1. 概述 MCP 的 Client-Server 架构与 JSON-RPC 2.0 基础，勾勒出整体交互框架。
2. 分三个阶段详述生命周期（初始化-协商-消息交换），并结合 Tools/Resources/Prompts 三个原语说明各自用途。
3. 横向对比三种传输方式的适用场景与局限性。

### 参考答案

**一、协议基础**

MCP 基于 JSON-RPC 2.0 协议，采用 Client-Server 架构。Host（如 Claude Desktop、VS Code）内嵌 MCP Client，负责管理与多个 MCP Server 的连接；MCP Server 是轻量级服务，暴露特定能力（如文件系统、数据库、外部 API）。连接建立后，Client 与 Server 之间通过 JSON-RPC 请求/响应/通知三种消息类型进行双向通信。

**二、生命周期三阶段**

1. **初始化阶段（Initialize）**：Client 发送 `initialize` 请求，携带自身协议版本和能力声明；Server 返回 `initialize` 响应，包含自身协议版本和能力列表。这是能力协商（capability negotiation）的核心环节，双方据此决定后续可使用哪些交互模式。

2. **协商阶段（Negotiated）**：初始化完成后，Client 发送 `notifications/initialized` 通知。此后双方可基于协商结果进行交互——如 Client 通过 `tools/list` 发现 Server 提供的所有工具及其 JSON Schema 定义。

3. **消息交换阶段（Message Exchange）**：
   - `tools/list`：请求 Server 返回工具列表
   - `tools/call`：调用指定工具并获取结果
   - `resources/list` / `resources/read`：暴露和读取 Server 端资源
   - `prompts/list` / `prompts/get`：获取预定义的提示模板
   - `notifications/tools/list_changed`：Server 主动通知工具列表变更（运行时动态注册/卸载）

**三、三大原语**

- **Tools（工具）**：模型可调用的可执行函数，类似 Function Calling 的函数定义。每个 Tool 包含 name、description、inputSchema（JSON Schema），Server 负责执行并返回结构化结果。
- **Resources（资源）**：Server 暴露的只读数据源，如文件内容、数据库表结构、API 文档。Agent 可在不调用工具的情况下读取资源来获取上下文，这是 MCP 区别于纯 Function Calling 的独特能力。
- **Prompts（提示模板）**：预定义的提示模板，支持参数化和多轮对话结构。用户或 Agent 可动态选择并填充模板，实现可复用的提示工程。

**四、三种传输方式对比**

| 传输方式 | 适用场景 | 特点 | 局限 |
|---------|---------|------|------|
| stdio | 本地进程通信 | 零网络开销、简单可靠 | 仅限本机、单实例 |
| SSE（HTTP） | 远程服务 | 支持远程、标准 HTTP | 单向推送、连接管理复杂 |
| Streamable HTTP | 生产环境 | 双向流式、支持多实例 | 实现复杂度较高 |

Streamable HTTP 是 2025 年 3 月更新的新模式，解决了 SSE 在生产环境（负载均衡、无状态容器）中的连接保活和双向推送问题。

**加分项：**
- 能力协商机制使得 Client 和 Server 可以渐进式支持协议特性，向后兼容。
- MCP Server 可以用任意语言实现（Python SDK、TypeScript SDK、Java SDK 均已官方支持），真正跨语言复用。
- Resources 支持 `uri://` 定位方式，使 Agent 可以像访问 Web 资源一样访问内部数据源，实现统一资源模型。

---

## Q4：Agent 工具太多时怎么管理？工具路由怎么做？设计有 100 个 Tool 的 Agent 你会怎么设计？

### 考察点
考察候选人大规模工具管理架构设计能力：工具描述冲突、上下文窗口限制、工具选择效率、意图路由等技术挑战的解决方案。

### 解答思路
1. 先明确 100 个工具面临的核心瓶颈（上下文窗口长度、模型选择准确率、token 成本）。
2. 从三个层面给出解决方案：工具分组/命名空间、语义路由、分层过滤。
3. 勾勒整体架构图，体现工程可行性。

### 参考答案

**一、核心瓶颈分析**

100 个工具同时注入 LLM 会出现三个严重问题：
- **上下文窗口爆炸**：每个 Tool 的 JSON Schema 定义（含 description）平均 200-500 token，100 个工具仅定义就占用 2-5 万 token，压榨了对话历史空间。
- **工具选择准确率下降**：模型在 100 个工具中选对的难度远比 10 个中选对高，容易"张冠李戴"，尤其在工具描述相似时（如 `search_users` vs `search_employees`）。
- **token 成本线性增长**：每次请求都携带全部工具定义，成本不可控。

**二、三层架构设计**

**第一层：意图识别 + 工具分组**

将工具按领域/功能分为工具组（Tool Group），每组不超过 15 个：

```
工具组示例：
- filesystem_group: [read_file, write_file, list_dir, search_file, ...]
- database_group: [query_sql, list_tables, describe_table, insert_row, ...]
- communication_group: [send_email, send_slack, create_jira, ...]
- web_group: [search_web, fetch_url, summarize_page, ...]
```

用户请求进来后，先用一个轻量级的"路由模型"（或同模型的一轮轻量 reasoning）判断意图属于哪些工具组，只加载匹配的组的工具定义。将 100 个工具的选择问题降维度为"选组 + 组内选工具"。

**第二层：语义检索匹配**

对工具做向量化（Embedding）：将每个工具的 name + description 通过 Embedding 模型编码为向量。用户意图同样编码后，使用向量相似度检索 Top-K（如 Top 20）最相关的工具。这种方法天然支持模糊匹配——用户说"帮我查订单"能匹配到 `query_order_table`，即使描述中没有"查订单"三个字。

**第三层：命名空间 + 工具前缀**

用命名空间避免工具名冲突，如 `/filesystem/read_file`、`/database/query_sql`。清晰的分组命名也是给 LLM 的结构化暗示，帮助模型更好地定位工具。

**三、整体架构流程**

```
用户请求 → 1.意图路由（快速判断属于哪个 Tool Group）
       → 2.加载目标 Group 的工具定义（≤15 个）
       → 3.注入 LLM 进行 Function Calling
       → 4.执行工具调用
       → 5.如果工具返回"未找到所需功能"或模型认为缺少工具
          → 返回第 2 步，加载更多 Group 或使用语义检索补充
```

在实际工程中，LangChain 的 Tool 抽象层、Semantic Kernel 的 Plugin 机制都支持类似设计。如果你的 Agent 真的管理 100 个工具，用 3 层分组后，实际注入模型的工具定义通常控制在 15-25 个之间，token 成本和选择准确率都在可接受范围。

**加分项：**
- 引入"工具使用频率"的热度权重：高频工具常驻，低频工具按需加载（类似 CPU 缓存的冷热分离思路）。
- 工具描述加入"触发条件"字段（如 `trigger_keywords: ["查订单", "order", "query_order"]`），提升语义检索的召回精度。
- 运行时监控工具调用失败率和响应时间，自动标记"高延迟工具"或"高错误率工具"，在路由时降权或降级。

---

## Q5：Function Call 的底层实现流程是什么？模型如何知道该调用哪个工具？LLM 自己执行 Function Call 吗？

### 考察点
考察候选人对 Function Calling 底层原理的掌握程度，能否区分"模型推理"与"客户端执行"的边界，是否理解工具选择的内部机制。

### 解答思路
1. 完整描述 Function Call 的全链路：从用户输入到工具执行再到结果回传，厘清每一步的职责边界。
2. 解释模型如何从 tools 定义中选择工具并生成参数的内部机制（不是魔法，是训练 + Schema 约束）。
3. 明确强调：LLM 不自己执行 Function Call，只输出调用意图和参数，实际执行由客户端完成。

### 参考答案

**一、全链路流程（五步）**

```
1. [客户端] 构建请求：将 tools 定义（name + description + parameters JSON Schema）
   注入请求体，同用户消息和对话历史一起发送给 LLM。

2. [LLM 推理] 模型接收完整上下文后，根据语义理解和 tools 定义进行推理：
   - 决定是否需要调用工具（finish_reason = "tool_calls"）
   - 如果调用，选择一个或多个 tool + 生成符合 JSON Schema 的参数

3. [LLM 输出] 返回 response，其中 finish_reason = "tool_calls"，
   携带 tool_calls 数组：[{id, type: "function", function: {name, arguments}}]
   注意：arguments 是 JSON 字符串，不是已解析对象。

4. [客户端执行] 客户端解析 tool_calls：
   - 根据 function.name 找到对应的本地函数实现
   - 将 function.arguments 反序列化后传入函数执行
   - 拿到函数返回结果

5. [客户端回传] 将工具执行结果以 role = "tool" 消息追加到对话历史，
   关联对应的 tool_call_id，发送回 LLM 使其基于结果生成最终回复。
```

**二、模型如何知道该调用哪个工具？**

这不是"硬编码路由"或"关键词匹配"，而是通过以下机制：
- **训练阶段**：模型在预训练/微调阶段，训练数据中包含大量函数调用示例，使模型学会"用户意图 → 函数名 + 参数"的语义映射。模型将工具定义视为特殊的系统提示，在推理时基于语义理解做匹配。
- **推理阶段**：工具定义（name + description + parameters）是注入到上下文的"元信息"。模型在自回归生成中，attention 机制同时对用户消息和工具定义进行注意力计算，综合判断应该选择哪个工具、填充什么参数。description 字段是模型选择工具的关键依据——写得越清晰、越具体，模型的选择准确率越高。
- **参数生成**：模型基于 JSON Schema 约束生成参数字符串。OpenAI / Anthropic 等服务端在推理时会对输出做 schema 校验和 constrained decoding（如 grammar-based sampling），确保生成的 JSON 合法，但不保证业务语义正确。

**三、LLM 自己执行 Function Call 吗？**

**不，LLM 不执行任何代码**。模型只是一个"意图识别器 + 参数生成器"，它输出的是结构化的调用指令（"我建议调用 X 工具，参数是 Y"），真正的执行操作——访问数据库、调用 API、修改文件——完全由客户端的 Agent 运行时（如 LangChain Agent、OpenAI SDK、Anthropic SDK）完成。

可以这样理解：LLM 是"大脑"（决定做什么），Agent Runtime 是"双手"（实际执行）。这个分工是安全的底层保证——否则模型直接写文件、调用支付接口、删除数据库的风险不可控。

**加分项：**
- 部分推理引擎（如 llama.cpp、vLLM）支持 constrained decoding，在采样阶段约束 token 选择范围，保证生成的 JSON 严格符合 Schema，从概率层面消除格式错误。
- tool_choice 参数允许指定 "auto"/"none"/"required" 或强制指定某个工具，给开发者精细控制工具调用行为的自由度。
- 并行 function calling 的实现原理：模型在单次推理中生成多个 tool_calls（通过特殊的 token 序列分隔），而非多次串行推理，这是 token 级别的并行编排。

---

## Q6：MCP 和 A2A 都是协议，它们有什么区别？为什么 MCP 解决不了 A2A 要解决的问题？

### 考察点
考察候选人对 Agent 生态中不同协议定位的理解深度，能否区分"工具集成协议"与"Agent 间通信协议"的不同层次和使用场景。

### 解答思路
1. 明确两者定位：MCP = 连接工具和资源，A2A = 连接 Agent 和 Agent。
2. 从架构层次、通信模式、发现机制、安全模型等维度进行对比。
3. 用具体场景说明为什么 MCP 解决不了多 Agent 协作问题。

### 参考答案

**一、本质定位差异**

- **MCP（Model Context Protocol）**：连接 Agent 与外部工具/资源的协议。它解决的是"一个 Agent 如何发现和使用工具、数据源、提示模板"的问题，核心是 Agent ↔ Tool/Data 的交互。
- **A2A（Agent-to-Agent）**：Google 于 2025 年 4 月发布的 Agent 间通信协议。它解决的是"多个 Agent 如何协作完成任务"的问题，核心是 Agent ↔ Agent 的交互。

可以理解为 OSI 模型不同层次的协议：MCP 更接近"设备驱动层"（Agent 与外部世界），A2A 更接近"应用层协议"（Agent 之间的协作编排）。

**二、核心差异对比**

| 维度 | MCP | A2A |
|------|-----|-----|
| 通信对象 | Agent ↔ Tool/Resource | Agent ↔ Agent |
| 核心原语 | Tools, Resources, Prompts | Task, Message, Artifact |
| 发现机制 | 工具列表注册 + 能力协商 | Agent Card（JSON 描述文件，类似 OpenAPI） |
| 任务模型 | 无（单次工具调用） | 长期任务、支持多轮对话和流式交互 |
| 安全模型 | OAuth 2.0 | OAuth 2.0 + Agent 身份认证 |
| 标准化程度 | 工具定义标准化 | 任务状态、消息格式、能力声明标准化 |

**三、为什么 MCP 解决不了 A2A 的问题？**

- **任务抽象缺失**：MCP 只有"调用工具-返回结果"的同步模型，没有长期任务的概念。A2A 定义了任务的生命周期（创建、进行中、完成、失败、取消），支持跨多轮对话的协作过程。
- **Agent 发现与协商**：MCP 的工具发现是针对确定性的工具列表；A2A 的 Agent Card 描述的是一个 Agent 的"技能画像"，其他 Agent 通过读取这个卡牌理解该 Agent 的能力边界和交互方式。
- **流式协作**：两个 Agent 协作时，一个 Agent 可能需要边生成边传递中间产物（Artifact）。MCP 的工具调用是 request-response 模式，不支持这种渐进式协同。
- **多主体身份**：MCP 中天然是"一个 Client 调用一个 Server"。A2A 需要处理"谁是任务的发起者、谁是任务的执行者、谁是协调者"等多角色关系。

**四、两者是互补关系**

一个典型的 Agent 团队协作场景中，MCP 和 A2A 各司其职：
- Agent A 通过 MCP 从数据库获取数据（MCP Resources）
- Agent A 通过 MCP 调用分析工具（MCP Tools）
- Agent A 通过 A2A 将分析任务委托给 Agent B
- Agent B 通过 MCP 操作文件系统，完成后通过 A2A 回传结果

MCP 是 Agent 的"感官和四肢"（感知与操作外部世界），A2A 是 Agent 的"语言和耳朵"（Agent 之间的交流协作）。

**加分项：**
- A2A 的 Agent Card 是机器可读的 JSON 文件，可以被 Agent 自动发现和解析，不依赖人工注册。
- 两者可以叠加使用：A2A Client/Server 内部各自使用 MCP 来管理自己的工具和资源。
- Google 在设计 A2A 时明确表示"不替代 MCP，而是补充 MCP 未覆盖的 Agent 间通信层"。

---

## Q7：MCP 的 Tool/Resource/Prompt 概念是什么？MCP 的工具发现机制是什么？

### 考察点
考察候选人对 MCP 三大原语的语义理解以及运行时工具发现机制的技术细节，能否清晰区分 Tool 和 Resource 的使用场景。

### 解答思路
1. 分别解释 Tool、Resource、Prompt 三个概念的定义、用途和典型应用场景。
2. 详细说明 MCP 的工具发现机制（静态声明 + 动态通知）。
3. 强调三者之间的协作关系，回答何时用 Tool 何时用 Resource 的选型问题。

### 参考答案

**一、三大核心原语**

**Tool（工具）**：Agent 可以调用的可执行操作。每个 Tool 包含 `name`（全局唯一标识）、`description`（自然语言描述，供 LLM 理解用途）、`inputSchema`（JSON Schema 定义的参数规范）。当 LLM 需要执行某个操作时——如发送查询、创建文件、调用 API——通过 Tool 完成。Tool 是"行为"的抽象。

典型 Tool 示例：`weather.get_forecast`（参数 `{city: string, days: number}`）、`database.query`（参数 `{sql: string}`）。

**Resource（资源）**：Agent 可以读取的只读数据暴露。每个 Resource 通过 `uri` 定位（如 `file:///docs/readme.txt`、`postgres://database/schema/`），包含 `name`、`description`、`mimeType`。Resource 不执行操作，只提供上下文信息——如文档内容、数据库 schema、API 参考文档。Agent 可以直接"读"资源来理解环境，无需"调用"工具。

典型 Resource 示例：文件系统文件、数据库表结构、API Swagger 文档、组织架构图。

**Prompt（提示模板）**：预定义的对话模板，支持参数化（如 `{name}`、`{language}`）。Prompt 可以包含多轮对话结构（system + user messages），帮助 Agent 快速进入特定工作模式。开发者可将经过验证的最佳提示（如代码审查模板、SQL 生成模板）封装为 Prompt，供 Agent 或 End User 选择使用。

**二、Tool vs Resource 的选型决策**

| 选择 Tool | 选择 Resource |
|-----------|---------------|
| 需要执行副作用操作（写数据库、发邮件、创建文件） | 只需要读取信息，无副作用 |
| 操作有参数依赖、需要 LLM 动态决定参数 | 数据是静态或准静态的（如配置文件、schema） |
| 操作结果不稳定，依赖请求参数 | 内容是确定性的、可缓存的 |

一种常见的最佳实践：用 Resource 暴露数据库表结构（静态），用 Tool 执行 SQL 查询（动态），让 LLM 先通过 Resource 了解数据模型，再通过 Tool 生成正确的查询。

**三、工具发现机制**

MCP 的工具发现是"声明 + 事件驱动"的双机制：

1. **协议级声明**：Client 在建立连接后，通过 `tools/list` 请求获取 Server 当前提供的所有工具列表。每个工具的完整定义（name、description、inputSchema）在此阶段一次性返回。这是离线/静态发现。

2. **运行时变更通知**：Server 可通过 `notifications/tools/list_changed` 主动推送工具列表变更事件。典型场景：用户安装了新插件，Server 动态加载了新工具，通知 Client 重新调用 `tools/list` 获取最新列表。这是在线/动态发现。

3. **能力协商**（initialize 阶段附带）：Client 和 Server 在初始化握手时声明各自支持的协议能力。Server 可以声明"我提供 Tools"、"我提供 Resources"、"我提供 Prompts"，Client 据此决定后续交互策略。

**四、三者协作关系**

一个典型的 Agent 工作流中三者协同：
1. Agent 通过 Prompts 获取特定领域的 prompt 模板（如"SQL 专家"模板）
2. Agent 通过 Resources 读取目标数据库的表结构
3. Agent 通过 Tool 执行 SQL 查询并获取结果数据

三层递进：Prompt 定义"怎么思考" → Resource 提供"理解什么" → Tool 执行"做什么"。

**加分项：**
- MCP 的设计哲学之一是"Server 是无状态的"，Tool 的执行不该依赖 Server 端 session，每次调用应是幂等或独立可重复的。
- Resource 支持模板 URI（如 `users://{userId}/profile`），让资源暴露支持参数化，客户端根据上下文动态填充。
- 最新的 MCP 规范支持 Resource 的订阅机制（`resources/subscribe`），当资源内容变更时 Server 主动推送更新，这对实时性要求高的场景（如监控仪表盘）非常有用。

---

## Q8：Parallel Tool Calling 是怎么实现的？有什么注意事项？多个工具怎么并行执行？顺序怎么确定？

### 考察点
考察候选人对并行工具调用机制的实现原理、依赖关系处理、一致性问题等生产级工程挑战的掌握程度。

### 解答思路
1. 先解释模型侧并行工具调用的生成机制（单次推理输出多个 tool_calls）。
2. 说明客户端侧并行执行策略和依赖关系处理。
3. 讨论并行执行的工程注意事项：顺序依赖、资源竞争、错误传播等。

### 参考答案

**一、模型侧实现原理**

Parallel Tool Calling 的核心原理是：模型在单次推理中同时生成多个 `tool_calls`，而非分多次串行推理。从 token 序列看，模型生成一个 tool_call 后，不输出结束标记，而是继续生成下一个 tool_call 的分隔符和内容。OpenAI 在 2023 年 11 月 DevDay 正式支持此能力，Anthropic 的 Claude 也在原生支持。

关键技术细节：
- 模型在训练/对齐阶段被训练为：当遇到需要多工具协作且无数据依赖的场景时，一次性输出所有 tool_calls。
- `parallel_tool_calls` 参数（OpenAI）允许开发者显式禁用并行调用（设为 false 时模型每次只输出一个 tool_call）。
- 并行调用的决策完全由模型自主做出——它基于当前上下文判断工具之间"是否互不依赖"。

**二、客户端执行策略**

客户端收到 tool_calls 数组后的处理逻辑：

```
// 核心判断：工具间是否有依赖关系？
有依赖关系的判断依据：
1. 工具 B 的参数需要工具 A 的返回结果 → A 必须先于 B 执行
2. 工具 A 和工具 B 操作同一资源且有读写冲突 → 需要顺序控制

两种执行模式：

// 模式一：预期并行（默认，无依赖）
const results = await Promise.all(
  toolCalls.map(tc => executeTool(tc.function.name, JSON.parse(tc.function.arguments)))
);

// 模式二：强制串行（指定顺序或有资源竞争）
for (const tc of toolCalls) {
  const result = await executeTool(tc.function.name, JSON.parse(tc.function.arguments));
  // 可在此处基于前一个结果决定是否继续执行后续工具
}
```

**三、顺序确定原则**

模型在单轮 tool_calls 中输出的多个工具调用**没有执行顺序保证**——它们都是基于同一轮上下文推断的，彼此不知对方的存在。所以：
- 默认行为是将所有 tool_calls 并行执行，因为它们互不依赖。
- 如果模型认为工具 A 的结果是工具 B 的参数来源，它**不会**在同一轮中输出 A 和 B（因为没有 A 的结果就生成不了 B 的参数）。这种情况下模型会分两轮：第一轮输出 A → 客户端执行 → 结果回传 → 第二轮输出 B。
- 如果确实需要控制顺序（如工具 A 写入、工具 B 读取），可在 tool description 中声明依赖关系或副作用，Agent 框架据此编排。

**四、三个关键注意事项**

1. **错误传播与部分失败**：5 个并行工具中 1 个失败，其余 4 个已成功执行。需要决定是回滚成功的（用 Sagas 模式补偿事务），还是将部分失败结果连同错误信息一起回传模型。推荐后者——让模型理解"哪些成功了哪些失败了"并决定下一步动作，更符合 Agent 的自主性。

2. **资源竞争**：两个工具同时读写同一文件/数据库记录可能导致竞态条件。要么在工具定义层面声明资源的读写锁（如 file_lock），要么设计工具本身为原子操作。

3. **结果顺序保证**：并行执行的结果返回顺序不确定，必须用 `tool_call_id` 做映射，将结果按 id 对应回 model 的 tool_calls，否则模型会混淆"这个结果对应哪个工具调用"。

**五、最佳实践**

- **工具设计遵循"单一职责"**：每个工具职责越小越明确，模型越容易判断哪些可以并行，且并行执行冲突越少。
- **description 中声明副作用**：如 `"SIDE EFFECT: Writes to database. Do NOT parallelize with other database write operations."`，Agent 框架可据此做并行度控制。
- **为写操作加幂等键**：对非幂等的写操作（创建订单、发送邮件），工具参数中加入 idempotency_key，防止并行重试导致数据重复。
- **监控并行度**：运行时记录每次 tool_calls 的并行数量和总耗时，帮助发现"假并行"（看起来并行但实际上工具间有隐性依赖导致等待）。

**加分项：**
- 某些 Agent 框架（如 LangChain 的 ToolExecutor）支持"依赖图"（DAG）模式：预先声明工具间的依赖关系，运行时自动拓扑排序后并行执行无依赖的组。
- 在 streaming 模式下，tool_calls 是增量输出的——先收到 tool_call 的 name，再收到 arguments 片段。客户端可以在 tool_call 完整性判断后尽早启动执行，不必等所有 tool_calls 都收齐。
- 对于纯读操作（read-only），并行执行是绝对安全的且应该尽可能并行，这是 Agent 性能优化的核心手段之一。

---

## Q9：如果 Agent 调用工具失败或超时，一般怎么处理？如何设计 Prompt 让 Agent 给用户合理的反馈？

### 考察点
考察候选人对工具调用异常场景的工程化处理能力，以及如何通过 Prompt 设计让 Agent 在故障时提供符合用户体验的自然语言反馈。

### 解答思路
1. 对工具调用异常做分级分类（参数错误/网络超时/业务异常/限流），分别给出处理策略。
2. 设计错误信息回传的格式约定，让模型基于结构化错误信息生成用户友好回复。
3. 给出 Prompt 设计模板，确保 Agent 在失败时"不甩锅、不暴露内部细节、给用户可操作建议"。

### 参考答案

**一、异常分级与处理策略**

工具调用异常需分层处理，不可一概而论：

- **参数错误（4xx 类）**：LLM 生成的参数不合法——类型错误、必填缺失、枚举越界。将校验失败详情（字段级）回传模型，让其基于错误描述自行修正参数后重试，通常 1-2 轮即可修复。这是最经济的修复路径——模型理解自己错在哪，修正成本远低于重新推理。
- **超时/网络错误（可重试）**：设置分级超时——连接超时 5s、读取超时 30s、总超时 60s。超时后指数退避重试（1s → 2s → 4s），最多 3 次。超过 3 次失败后不继续重试，转为"降级回复"模式。
- **业务异常（如查不到记录、权限不足）**：这是"正常"的失败，不是 bug。将业务错误码和描述结构化回传模型，让模型生成自然语言解释。
- **限流（429）**：遵守 Retry-After 头，同时在客户端侧做预限流（本地令牌桶），避免触发服务端限流。

**二、错误回传的结构化格式**

关键设计原则：不要把原始异常堆栈直接喂给模型。回传给模型的错误信息应当是结构化、可读、不含敏感信息的：

```
tool_result 的 error 字段格式：
{
  "success": false,
  "error_type": "API_TIMEOUT | INVALID_PARAM | RATE_LIMITED | BUSINESS_ERROR",
  "message": "查询订单超时，已重试 3 次均未成功",
  "retryable": false,
  "user_friendly_hint": "订单服务暂时繁忙，建议稍后重试或联系人工客服"
}
```

模型拿到这个结构后，不再需要"猜测"错误原因，而是基于 `user_friendly_hint` 直接组织回复语言，保证输出稳定性。

**三、Prompt 设计——失败时的反馈原则**

在 System Prompt 中明确加入工具失败时的行为约束：

```
## 工具调用失败处理规则

当工具返回 success=false 时，你必须遵守以下原则：

1. **不要暴露技术细节**：禁止在回复中出现"API 返回 500""数据库连接超时""JSON 解析错误"等技术术语。
2. **给出可操作建议**：告诉用户"你可以做什么"，而非仅仅说"出错了"。例如"订单查询暂时不可用，你可以 5 分钟后刷新页面重试，或联系客服热线 400-xxx"。
3. **提供替代方案**：如果存在能缓解当前问题的其他路径，主动建议。例如"当前无法查询实时物流，但你可以查看已缓存的预计到达时间"。
4. **区分暂时性和永久性失败**：暂时性失败用"稍后重试"，永久性失败（如权限不足）用"需要管理员授权"。
5. **保持语气温和**：使用"我们遇到了一些问题"而非"系统错误"，让用户感受到是服务在努力而非在推诿。
```

**四、降级策略**

当关键工具不可用时，准备降级路径：用缓存数据代替实时查询、跳过非核心功能、提供人工客服入口。降级方案应在工具注册时就定义好（`fallback_behavior` 字段），而非出问题时临时拼凑。

**加分项：**
- 实现"工具健康检查"：定期 ping 关键工具，提前感知不可用状态，避免用户发起调用后才失败。
- 对高频失败的工具设置自动熔断，熔断期间直接返回预设的降级回复，不再浪费 token 去尝试调用。
- 错误信息中加入 `retry_after_seconds` 字段，让模型给出的"稍后重试"建议有具体时间锚点。

---

## Q10：在设计 Agent 的工具调用能力时，你的技术方案是什么？如何选择合适的工具 API？会使用哪些函数调用框架？

### 考察点
考察候选人对 Agent 工具调用系统的全链路架构设计能力，以及在实际选型中对各种框架和 API 风格的理解深度。

### 解答思路
1. 从架构层面阐述工具调用系统的分层设计（协议层、执行层、编排层）。
2. 对比 REST API / gRPC / SDK / MCP 等工具接入方式的适用场景。
3. 横向对比主流函数调用框架（LangChain、Semantic Kernel、CrewAI、Dify、自研）的优劣与选型依据。

### 参考答案

**一、分层架构设计**

我通常将工具调用系统分为三层：

**协议层**：定义工具如何被描述和发现。统一用 JSON Schema 定义工具的 name、description、parameters，确保与 OpenAI/Anthropic 的 Function Calling 格式兼容。若需要跨应用复用工具，使用 MCP Server 封装，提供标准化的 `tools/list` + `tools/call` 接口。

**执行层**：负责工具的实际调用执行，包含超时控制、重试、熔断、结果序列化。每个工具的 handler 函数是无状态的纯函数或封装了外部 API 调用的薄层。通过装饰器/Pydantic 模型自动完成参数校验和类型转换。

**编排层**：控制 Agent 的推理-执行循环（Reasoning-Action Loop）。这层负责管理工具选择、结果回传、多工具并发/串行编排、失败重试轮次上限等逻辑。

```
用户请求
  → 编排层（Agent Loop）：构建 tools 定义 + system prompt
    → 协议层（Tool Registry）：按意图路由，加载相关工具组
      → LLM 推理：选择工具 + 生成参数
    → 执行层（Tool Executor）：参数校验、超时控制、重试、熔断
      → 实际工具/API 调用
    → 编排层：结果回传 LLM，判断是否继续推理
  → 最终回复
```

**二、工具 API 选择策略**

| API 风格 | 适用场景 | 优势 | 劣势 |
|---------|---------|------|------|
| REST API | 外部服务集成（天气、搜索、支付） | 生态最广、文档丰富 | 需手写 JSON Schema 描述 |
| gRPC | 内部微服务、高性能场景 | 强类型、自动生成 Schema | 生态窄、调试门槛高 |
| SDK 封装 | 自研内部系统 | 类型安全、版本管理好 | 需额外维护 SDK |
| MCP Server | 跨应用复用的工具集 | 一次构建多 Agent 复用 | 额外运维成本 |

选择原则：外部服务优先 REST API + 手写 JSON Schema；内部工具集（10 个以上、多 Agent 使用）封装为 MCP Server；核心业务系统用 SDK 封装保证类型安全。

**三、框架选型**

- **LangChain**：生态最完善，工具抽象清晰（`@tool` 装饰器、`StructuredTool`），社区活跃。适合需要丰富第三方工具集成的场景。但抽象层过厚，debug 困难，版本变更频繁。
- **Semantic Kernel（微软）**：Plugin 机制优雅，支持自动 Function Calling 编排。适合 .NET/C# 技术栈的团队，与 Azure 生态集成好。
- **OpenAI Assistants API**：开箱即用，无需自建编排层。适合快速原型验证，但定制性差、成本不透明。
- **CrewAI**：侧重多 Agent 协作中的工具共享，适合角色分工明确的多 Agent 场景。
- **自研轻量 Agent Runtime**：对于需要精细控制的场景，我倾向自研——用 200 行代码实现 Agent Loop（模型调用 → 解析 tool_calls → 执行 → 结果回传 → 循环），无框架黑盒。关键逻辑：工具注册表是 `Dict[str, Callable]`，Schema 注入用 Jinja2 模板，编排层是 `while not finished and round < max_rounds` 的简单循环。依赖少、可调试、可定制。

选型原则：早期验证用 OpenAI Assistants API；复杂工具生态用 LangChain；需要精细控制或长尾场景用自研。永远保留"随时放弃框架"的能力——框架是加速器，但不能成为镣铐。

**加分项：**
- 工具定义的生成尽量自动化：用 Pydantic BaseModel → JSON Schema 的自动转换，避免手写 Schema 出错。
- 工具执行链路加 OpenTelemetry trace，方便定位慢工具和高失败率工具。
- 用 feature flag 控制新工具的灰度上线，降低新工具引入的风险。

---

## Q11：Skills 和 System Prompt / Function Call 有什么区别？Tool 和 Skill 哪个更适合 Agent 演进方向？你会怎么设计一个 Skill？

### 考察点
考察候选人对 Agent 能力组织方式的演进趋势理解，能否区分"原子能力"和"组合能力"，以及对 Skill 这一新兴概念的设计能力。

### 解答思路
1. 厘清三者的定义层次：System Prompt 是静态规则、Function Call 是原子操作、Skill 是封装好的能力组合。
2. 从工程效率、可维护性、可复用性角度论述 Skill 更适合 Agent 演进。
3. 给出一个 Skill 的具体设计方案（结构、元数据、激活机制、生命周期）。

### 参考答案

**一、三者定义与区别**

**System Prompt**：静态的、全局的行为约束和角色定义，写在系统消息中。它定义了 Agent"是谁""怎么做"，但它是被动的——只是一个文本前缀，不具备主动执行能力。修改 System Prompt 需要改代码或配置，且随着能力增加越来越臃肿。

**Function Call / Tool**：最小粒度的可执行操作——查天气、搜文档、发邮件。它是原子性的：一次调用完成一个独立操作。Tool 之间彼此独立，由 LLM 在每次推理时动态选择和编排。问题是：100 个 Tool 的认知负载太高，且 LLM 编排复杂任务（需要多步骤、有条件分支、有状态记忆）时容易出错。

**Skill**：对"System Prompt 片段 + 一组相关 Tool + 任务流程模板"的封装。Skill 是一个带有明确边界的能力单元——比如"数据分析 Skill"包含了分析流程的 prompt 指引、数据处理相关 tools、以及输出格式规范。Skill 可以被动态加载、组合和卸载，实现 Agent 能力的模块化。

| 维度 | System Prompt | Function Call / Tool | Skill |
|------|--------------|---------------------|-------|
| 粒度 | 全局 | 原子操作 | 能力模块 |
| 可组合性 | 无（只能追加） | 通过 LLM 动态编排 | 可插拔、可嵌套 |
| 复用性 | 低（需复制粘贴） | 中（同一项目内复用） | 高（跨 Agent 共享） |
| 状态管理 | 无 | 无状态 | 可带上下文和工作记忆 |
| 激活方式 | 始终加载 | LLM 按需调用 | 按意图/场景动态加载 |

**二、Tool 和 Skill 哪个更适合 Agent 演进方向？**

Skill 更适合 Agent 的长期演进方向，原因有三：

1. **认知负载管理**：Agent 面对的 Tool 越来越多时，Skill 将"10 个分散的 Tool"封装为"1 个聚合的 Skill"，LLM 只需决定"用哪个 Skill"而非"用哪个 Tool"，决策空间指数级缩小。
2. **可组合与可复用**：Skill 可以像乐高一样组合——"数据分析 Skill + 报告生成 Skill = 自动周报能力"。Tool 不具备这种层级组合能力。
3. **专业化与领域知识**：Skill 可以内置领域最佳实践（prompt 模板、默认参数、错误处理策略），这些是零散的 Tool 定义无法承载的。例如一个"代码审查 Skill"内置了审查 checklist、常见问题模式、Git 操作流程，而非让 LLM 每次从零构思。

但 Tool 不会消失——Skill 内部仍然是基于 Tool 执行的。演进方向是：Tool 作为原子能力基石，Skill 作为面向场景的能力封装。类比：Tool 是 CPU 指令集，Skill 是函数库。

**三、如何设计一个 Skill**

一个 Skill 的完整设计包含以下要素：

```yaml
# Skill 元数据
name: "data_analysis"
version: "1.2.0"
description: "对结构化数据进行统计分析并生成可视化报告"
tags: ["data", "analysis", "reporting"]

# 激活条件（什么时候自动加载此 Skill）
activation:
  trigger_keywords: ["分析数据", "统计", "报表", "图表", "趋势"]
  require_confirmation: false  # 是否需用户确认才激活

# System Prompt 扩展（加载 Skill 时注入的上下文）
prompt_extension: |
  你现在是数据分析专家。分析数据时请遵循以下流程：
  1. 先理解数据结构和字段含义
  2. 进行数据质量检查（缺失值、异常值）
  3. 执行统计分析（描述统计、相关性、趋势）
  4. 用通俗语言解释分析结果
  输出格式要求：先给出核心结论（≤3 条），再展示详细分析过程。

# 绑定的工具集
tools:
  - name: "query_database"
    priority: high
  - name: "compute_statistics"
    priority: high
  - name: "generate_chart"
    priority: medium
  - name: "export_report"
    priority: low

# 工作流模板（可选，定义多步骤流程 skeleton）
workflow:
  steps:
    - id: "understand_data"
      description: "获取表结构和数据样本"
      tools: ["query_database"]
    - id: "quality_check"
      description: "检查数据质量"
      tools: ["compute_statistics"]
    - id: "analyze"
      description: "执行分析"
      tools: ["compute_statistics", "query_database"]
      condition: "quality_check.pass == true"
    - id: "report"
      description: "生成报告"
      tools: ["generate_chart", "export_report"]

# 约束与注意事项
constraints:
  max_rows: 10000
  timeout_seconds: 120
  require_data_confirmation: true  # 分析前需用户确认数据范围
```

Skill 的生命周期管理：注册 → 意图匹配激活 → 加载 prompt + tools → Agent 执行 → 结果输出 → 卸载（或保持热加载）。类似操作系统的进程调度——活跃 Skill 常驻，不活跃 Skill 休眠或卸载释放上下文窗口。

**加分项：**
- Skill 支持版本管理和灰度发布：新旧版本并行，通过 feature flag 控制流量分配。
- Skill 间的依赖声明和冲突检测：如 "data_analysis Skill 依赖 database Tool Group"，防止 Tool 未注册时 Skill 激活失败。
- Skill 的"热插拔"机制：参考 Claude Code 的 Skill 系统，通过声明式 YAML + MCP Server 实现 Skill 的运行时动态加载和卸载。

---

## Q12：MCP 基于什么协议实现的？MCP 如何保证安全性？

### 考察点
考察候选人对 MCP 底层协议基础和安全性设计的深入理解，能否解释 MCP 在真实生产环境中的安全保障机制。

### 解答思路
1. 说明 MCP 的协议基础是 JSON-RPC 2.0，并解释为什么选择它。
2. 从传输层、认证层、授权层、数据层四个层面阐述 MCP 的安全机制。
3. 结合实际部署场景（公网、内网、本地），给出对应的安全配置建议。

### 参考答案

**一、协议基础：JSON-RPC 2.0**

MCP 构建在 JSON-RPC 2.0 之上，这是一个轻量级、无状态、传输无关的远程过程调用协议。所有 MCP 消息都是合法的 JSON-RPC 2.0 消息：

- **请求（Request）**：`{"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": {...}}`，需要 Server 返回响应。
- **响应（Response）**：`{"jsonrpc": "2.0", "id": 1, "result": {...}}` 或 `{"jsonrpc": "2.0", "id": 1, "error": {"code": -32600, "message": "..."}}`。
- **通知（Notification）**：`{"jsonrpc": "2.0", "method": "notifications/tools/list_changed"}`，Server 主动推送，无需 Client 响应。

选择 JSON-RPC 2.0 的原因：完全传输无关（可跑在 stdio、HTTP、WebSocket 上）；规范简单，易于实现和调试；双向通信支持好（请求 + 通知）；生态成熟（被广泛使用和验证）。

**二、安全性设计的四个层面**

**传输层安全**：

- **stdio 模式**：仅限本机进程间通信，天然隔离。Server 进程与 Client 进程在同一信任边界内，通过操作系统进程隔离保证安全性。
- **SSE / Streamable HTTP 模式**：必须使用 HTTPS（TLS 1.2+），防止中间人攻击。生产环境强制 mTLS（双向 TLS 认证）——Client 验证 Server 证书，Server 也验证 Client 证书，确保双方身份可信。
- **网络隔离**：MCP Server 不应暴露在公网上，应部署在 VPN/VPC 内，只对同网络内的 Agent 实例可访问。

**认证层（Authentication）**：

- **OAuth 2.0 授权框架**：MCP 规范定义了标准的 OAuth 2.0 认证流程。Client 启动时需通过 Authorization Code Flow 获取 access token，后续每次请求在 HTTP Header 中携带 `Authorization: Bearer <token>`。
- **Token 管理**：access token 有有效期（通常 1 小时），过期后用 refresh token 续期。refresh token 的轮转机制（每次 refresh 返回新的 refresh token）防止 token 泄漏后被长期滥用。
- **API Key 模式**：对于内部工具，也可用预共享 API Key 做简单认证，配合 IP 白名单加固。

**授权层（Authorization）**：

- **工具级访问控制**：不是所有 Client 都能访问所有工具。Server 在 `tools/list` 响应中，基于 Client 的身份只返回其授权的工具子集。未经授权的工具对 Client 完全不可见。
- **参数级校验**：Server 在收到 `tools/call` 时做二次鉴权——即使 Client 知道工具存在，如果无权限调用，Server 返回 `-32001 UNAUTHORIZED` 错误码。
- **速率限制**：每个 Client 配置独立的调用配额（如每分钟 100 次），防止单个 Client 滥用导致服务降级。

**数据层安全**：

- **日志脱敏**：工具调用参数和结果中可能包含 PII（个人身份信息）或敏感业务数据。MCP Server 在记录日志前需做脱敏处理——对手机号、邮箱、身份证号等字段进行掩码。
- **输入校验**：所有来自 LLM 生成的参数都不可信——必须经过严格的类型校验、范围校验、注入攻击检测（SQL 注入、命令注入）。这是最后一道防线，因为 LLM 可能被 jailbreak 生成恶意参数。
- **审计追踪**：记录每次工具调用的时间、操作人（Agent 身份）、工具名、参数 hash、执行结果状态，保留至少 90 天用于审计和问题追溯。

**三、部署场景的安全配置**

| 场景 | 传输 | 认证 | 访问控制 |
|------|------|------|---------|
| 本地开发（个人使用） | stdio | 无需 | 本地文件系统权限 |
| 团队内网 | HTTPS + mTLS | API Key / OAuth | 按团队角色划分工具权限 |
| 生产环境（多租户） | HTTPS + mTLS | OAuth 2.0 + RBAC | 按租户 + 角色细粒度授权 |

**加分项：**
- MCP Server 启动时做"最小权限声明"：Server 在 initialize 时声明自身需要的权限范围，Client 据此决定是否信任该 Server。
- 工具定义中加入 `sensitivity_level` 字段（如 "low"/"medium"/"high"），让 Agent 框架在调用高敏感工具前触发用户二次确认（human-in-the-loop）。
- 实现"沙箱执行"：对高风险工具（如文件系统操作、shell 命令），在执行层做 chroot/jail/container 隔离，限制其可操作的目录范围和系统调用。

---

## Q13：如果 API 返回结果有字段缺失，或者有冗余内容，你会怎么处理？

### 考察点
考察候选人对 LLM 视角下工具返回结果质量的工程化处理能力——模型对输入噪声的容忍度、token 成本优化、以及 Schema 契约设计的工程素养。

### 解答思路
1. 区分两种场景：字段缺失（信息不足）和冗余内容（信息过载），分别给出处理策略。
2. 从"返回前处理"（工具执行层过滤）和"返回后处理"（结果后处理器）两个阶段设计处理方案。
3. 强调 Schema 契约设计的重要性——从源头减少异常。

### 参考答案

**一、问题分析：两种场景的处理逻辑不同**

**字段缺失**：API 返回的 JSON 缺少 LLM 需要处理的关键字段，比如查询订单 API 返回了订单号但缺少状态字段。如果不处理，LLM 会收到不完整的信息，要么说"我不知道"，要么更糟——凭空编造缺失的值（幻觉）。处理目标是"要么补全，要么明确告知缺失"。

**冗余内容**：API 返回了大量无关字段（如完整的数据库行包括 `created_at`、`updated_at`、`internal_id` 等），占用了宝贵的上下文窗口 token。更严重的是，冗余信息可能干扰 LLM 的注意力，让它关注到不相关的内容而偏离用户意图。处理目标是"精简化，只保留 LLM 需要的字段"。

**二、处理方案：工具执行层的两层过滤**

**第一层：Schema 契约定义（源头控制）**

在定义每个工具的返回格式时，显式声明哪些字段是"LLM 可见"的，而非直接把 API 原始响应丢给模型：

```python
# 使用 Pydantic 定义工具返回的"模型可见视图"
class OrderToolResult(BaseModel):
    """发给 LLM 的结构化订单信息"""
    order_id: str
    status: str
    total_amount: float
    estimated_delivery: Optional[str] = None  # 可选字段显式声明

    @classmethod
    def from_api_response(cls, raw: dict) -> "OrderToolResult":
        """从原始 API 响应中提取 LLM 需要的字段"""
        return cls(
            order_id=raw.get("id", "UNKNOWN"),
            status=raw.get("order_status") or "STATUS_NOT_AVAILABLE",
            total_amount=float(raw.get("amount", 0)),
            estimated_delivery=raw.get("delivery", {}).get("eta"),
        )
```

这里做了三件事：过滤冗余字段（只提取 4 个必要字段）、处理缺失值（用 `"UNKNOWN"` 或 `"NOT_AVAILABLE"` 占位，而不是 None/null）、嵌套字段扁平化（`delivery.eta` 提升为顶层字段）。

**第二层：结果后处理器（运行时保障）**

在工具执行后、结果注入 LLM 上下文前，插入一个通用后处理器：

1. **字段缺失检测**：对比 `期望字段列表` 和 `实际返回字段`，缺失的字段用约定占位符填充（如 `[NOT PROVIDED]`），让 LLM 明确知道"这个字段确实没有，不是我漏看了"。
2. **敏感字段脱敏**：对手机号、邮箱、身份证号做自动化脱敏，防止敏感数据进入 LLM 上下文。
3. **体积裁剪**：设置单次工具返回的最大 token 数（如 2000 tokens）。超过阈值时优先保留关键字段（按优先级排序），末尾加 truncation 标记 `[结果已截断，共 X 条记录]`。
4. **格式规范化**：统一日期格式（ISO 8601）、统一布尔值表示（true/false 而非 1/0）、统一空值表示。

```python
def post_process_tool_result(raw_result: dict, tool_schema: ToolSchema) -> dict:
    """工具结果后处理管道"""
    result = {}
    for field in tool_schema.expected_fields:
        if field.name in raw_result:
            result[field.name] = sanitize(raw_result[field.name], field.sensitive)
        else:
            result[field.name] = "[FIELD_NOT_AVAILABLE]"
    
    # Token 长度控制
    serialized = json.dumps(result, ensure_ascii=False)
    if len(serialized) > MAX_RESULT_CHARS:
        result = truncate_by_priority(result, tool_schema.field_priorities)
        result["_truncated"] = True
    
    return result
```

**三、Prompt 层面的配合**

在 System Prompt 中告知 LLM 字段缺失和截断的语义：

```
当工具返回中出现 "[FIELD_NOT_AVAILABLE]" 时，表示该字段数据不可用。
你必须告知用户该信息当前无法获取，绝对不要自行补全或推测该字段的值。

当工具返回出现 "_truncated": true 时，表示结果因长度限制被截断。
你可以告知用户"查询结果较多，已返回前 N 条"，并建议用户缩小查询范围获取完整结果。
```

**四、冗余内容的长文本策略**

对于 API 返回了长文本（如网页抓取、PDF 解析结果），采用"分层摘要"策略而非直接丢弃：
- 第一层：返回精简摘要（200 字以内）给 LLM 做快速判断
- 第二层：LLM 认为信息不够时，再请求完整内容（按需加载）

这样既能控制 token 成本，又不丢失信息的完整性。

**加分项：**
- 在工具定义中声明 `expected_result_schema`，使自动化检测成为可能——框架可自动对比实际返回和期望 Schema 的差异。
- 字段缺失率作为工具健康度监控指标：如果某个 API 的 `estimated_delivery` 字段缺失率突然从 5% 飙升到 80%，触发告警排查上游数据质量问题。
- 对列表型结果实现"流式分页返回"：不是一次性返回 1000 条，而是先返回前 20 条 + 总数，LLM 按需请求后续页。

---

## Q14：你对 MCP 了解多吗？有没有写过相关的 MCP Server？

### 考察点
考察候选人对 MCP 的实际工程经验——不是仅停留在概念层面，而是亲手写过 MCP Server，能说出实战中的关键细节和踩过的坑。

### 解答思路
1. 先概述对 MCP 知识的广度覆盖（协议规范、传输方式、SDK 生态），证明理论基础扎实。
2. 给出一个或多个实际的 MCP Server 开发案例，包含技术栈、实现要点、遇到的困难和解决方案。
3. 总结 MCP Server 开发的最佳实践和架构建议。

### 参考答案

**一、整体了解程度**

我对 MCP 有比较全面的了解，从协议规范到 SDK 实现都实际使用过。熟悉的核心知识点包括：

- 协议基础：JSON-RPC 2.0 消息格式、请求/响应/通知三种消息类型、initialize 能力协商流程。
- 三大原语：Tools（可执行函数）、Resources（只读数据暴露）、Prompts（参数化提示模板）。
- 三种传输方式：stdio（本地进程通信）、SSE over HTTP（远程单向流）、Streamable HTTP（2025 年 3 月新增，双向流式，生产环境首选）。
- 生命周期管理：initialize → initialized → tools/list → tools/call → notifications 变更通知。
- Python SDK（`mcp`）和 TypeScript SDK（`@modelcontextprotocol/sdk`）的使用经验。
- MCP 与 LangChain、OpenAI Agents SDK 等框架的集成方式。

**二、实际开发过的 MCP Server**

**案例一：企业内部知识库 MCP Server**

技术栈：Python + `mcp` SDK + FastAPI，对外通过 Streamable HTTP 暴露。

核心实现：
- **Resources**：暴露 Confluence 空间、语雀知识库的文档目录树，通过 `resources/read` 返回 Markdown 格式的文档内容。用后台定时任务做增量同步，保证知识内容的时效性。
- **Tools**：提供 `search_knowledge_base(query, top_k)` 工具，底层用 Embedding + 向量数据库做语义检索，返回最相关的文档片段。
- **Prompts**：预置了"技术支持回复模板""新员工入职指南模板"——参数化模板降低了 Agent 生成回复时的上下文构建成本。

遇到并解决的关键问题：
- **连接池耗尽**：高峰期同时有 50+ Agent 实例连接，SSE 长连接占满数据库连接池。解决：引入连接池管理 + 数据库查询缓存（Redis），将数据库连接数从 50 降到 5。
- **大文档超时**：Confluence 空间导出时，有些文档超过 10 万 token，resources/read 超时。解决：先返回文档目录和摘要，支持"按章节懒加载"——LLM 只请求当前相关的章节内容。
- **权限穿透**：知识库有权限控制，某些文档只有特定团队可读。解决：Client 请求时透传用户身份（通过 Header），Server 在做 `resources/list` 时基于用户权限过滤可见文档。

**案例二：自动化测试工具 MCP Server**

技术栈：TypeScript + `@modelcontextprotocol/sdk` + Playwright，通过 stdio 与 Claude Desktop 集成。

功能：提供 `run_e2e_test(url, test_steps)` 工具，LLM 生成测试步骤的 JSON 描述，Server 用 Playwright 执行浏览器自动化，截图并返回结果。

**三、MCP Server 开发最佳实践**

1. **优雅的错误处理**：Server 端所有异常都要捕获并转换为标准 JSON-RPC error response（带 `code` + `message`），绝不能把 Python/Node.js 堆栈 trace 暴露给 Client。错误码遵循 JSON-RPC 标准（-32700 解析错误、-32601 方法未找到、-32602 无效参数），业务错误用 -32000 到 -32099 自定义段。

2. **参数校验的两道防线**：`inputSchema` 的 JSON Schema 是给 LLM 看的约束；Server 端还要用 Pydantic/Zod 做服务端校验——LLM 生成的参数不可信，必须服务端二次校验。

3. **工具描述的写法直接影响 LLM 选择准确率**：description 要包括"这个工具做什么""什么时候用（触发场景）""什么时候不要用（反例）""返回什么"。反例描述能显著减少误调用。

4. **Stdio 模式的生产局限**：stdio 适合本地开发和桌面应用，但不适合多实例服务端部署。如果要在服务器集群中部署 MCP Server，用 Streamable HTTP + 无状态设计。

5. **资源缓存**：Resource 的内容（尤其是静态的文档、Schema）要加缓存头（ETag / Cache-Control），减少重复读取的成本。

**加分项：**
- MCP Server 实现"渐进式能力声明"：在 `initialize` 响应中声明支持的工具/资源/提示能力范围，旧版 Client 自动降级到兼容模式。
- 多 MCP Server 的编排：用一个 "MCP Proxy / Gateway" 作为统一入口，聚合多个 Server 的工具列表、做访问控制、流量路由和熔断。
- 输出了 MCP Server 开发的脚手架模板，新项目 10 分钟即可搭建可运行的 Server。

---

## Q15：如何让 Qwen 模型正常使用相关工具，具体实现方式是什么？

### 考察点
考察候选人对国产模型（Qwen/通义千问）的工具调用机制的实际掌握程度，能否区分 Qwen 与 OpenAI 在 Function Calling 上的实现差异并正确对接。

### 解答思路
1. 说明 Qwen 系列模型对工具调用的支持方式——原生 Function Calling 能力及其与 OpenAI 的对齐程度。
2. 给出具体的代码实现方案：工具定义格式、API 调用方式、结果回传循环。
3. 列举 Qwen 工具调用的常见陷阱和解决方案（参数格式、特殊 token、本地部署注意事项等）。

### 参考答案

**一、Qwen 模型的工具调用支持**

Qwen 系列模型（Qwen2.5+、Qwen3）原生支持 Function Calling（千问官方称为"工具调用/函数调用"）。核心模型包括：

- **Qwen2.5-7B/14B/32B/72B-Instruct**：从 Qwen2.5 版本开始系统性支持 Function Calling，训练数据中包含了大量工具调用示例。
- **Qwen3 系列**：支持 thinking 模式 + 工具调用的深度结合，工具调用能力进一步增强。
- **Qwen-Max / Qwen-Plus / Qwen-Turbo（DashScope API）**：云端 API 版本，工具调用接口与 OpenAI 高度对齐。

Qwen 的工具调用接口设计有意向 OpenAI 兼容，从 DashScope（阿里云灵积）API 或本地部署（vLLM / llama.cpp）调用时，工具定义的 JSON Schema 格式与 OpenAI 基本一致。这意味着大部分基于 OpenAI SDK 编写的 Agent 代码，改一下 `base_url` 和 `api_key` 即可切换到 Qwen。

**二、具体实现方式**

**方式一：通过 DashScope API 调用（推荐，生产环境首选）**

```python
from openai import OpenAI

client = OpenAI(
    api_key="your-dashscope-api-key",
    base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
)

# 工具定义（格式与 OpenAI 完全兼容）
tools = [
    {
        "type": "function",
        "function": {
            "name": "get_weather",
            "description": "查询指定城市的实时天气",
            "parameters": {
                "type": "object",
                "properties": {
                    "city": {
                        "type": "string",
                        "description": "城市名称，如'北京'、'上海'"
                    },
                    "unit": {
                        "type": "string",
                        "enum": ["celsius", "fahrenheit"],
                        "description": "温度单位"
                    }
                },
                "required": ["city"]
            }
        }
    }
]

messages = [{"role": "user", "content": "北京今天天气怎么样？"}]

# 第一轮：模型决定是否调用工具
response = client.chat.completions.create(
    model="qwen-max",  # 或 qwen-plus / qwen-turbo
    messages=messages,
    tools=tools,
    tool_choice="auto",  # 与 OpenAI 相同的控制参数
)
```

**Agent 循环的核心代码**：

```python
def qwen_agent_loop(user_query: str, tools: list, tool_handlers: dict):
    messages = [{"role": "user", "content": user_query}]
    
    for round_idx in range(MAX_ROUNDS):
        response = client.chat.completions.create(
            model="qwen-max",
            messages=messages,
            tools=tools,
            tool_choice="auto",
        )
        
        msg = response.choices[0].message
        
        # 如果模型决定直接回复（不调用工具）
        if msg.content and not msg.tool_calls:
            return msg.content
        
        # 如果模型决定调用工具
        if msg.tool_calls:
            # 1. 将 assistant 消息加入历史
            messages.append(msg.model_dump())
            
            # 2. 执行每个工具调用（并行）
            for tool_call in msg.tool_calls:
                func_name = tool_call.function.name
                func_args = json.loads(tool_call.function.arguments)
                
                handler = tool_handlers.get(func_name)
                result = handler(**func_args) if handler else "Tool not found"
                
                # 3. 将工具结果以 tool 角色回传
                messages.append({
                    "role": "tool",
                    "tool_call_id": tool_call.id,
                    "content": json.dumps(result, ensure_ascii=False),
                })
            
            # 4. 继续下一轮推理（模型基于工具结果生成回复或再次调用工具）
            continue
    
    return "达到最大推理轮数"
```

**方式二：本地部署（vLLM + Qwen）**

如果不想依赖 DashScope API，可以本地部署 Qwen 模型：

```python
# vLLM 部署命令
# vllm serve Qwen/Qwen2.5-32B-Instruct \
#   --tool-call-parser hermes \
#   --enable-auto-tool-choice

from openai import OpenAI

local_client = OpenAI(
    base_url="http://localhost:8000/v1",
    api_key="not-needed",
)

# 工具调用方式与 OpenAI 完全一样
response = local_client.chat.completions.create(
    model="Qwen/Qwen2.5-32B-Instruct",
    messages=messages,
    tools=tools,
)
```

关键配置点：vLLM 需要使用 `--tool-call-parser hermes` 参数，这是 vLLM 内置的能解析 Qwen 工具调用格式的解析器。如果不加这个参数，vLLM 无法正确解析模型输出的 tool_calls。

**三、Qwen 工具调用的常见问题与解决**

1. **参数格式问题**：Qwen 在某些版本中，`tool_call.function.arguments` 可能包含额外的空白字符或非标准 JSON 格式。解决方法是加防御性解析：

```python
import json

def safe_parse_args(args_str: str) -> dict:
    """防御性解析 Qwen 返回的参数 JSON"""
    try:
        return json.loads(args_str)
    except json.JSONDecodeError:
        # 尝试修复常见格式问题
        import re
        # 去除 JSON 外的多余文本（Qwen 有时会在参数外包裹解释文字）
        match = re.search(r'\{.*\}', args_str, re.DOTALL)
        if match:
            return json.loads(match.group())
        raise
```

2. **中英文混用的 Tool Description**：Qwen 对中文描述的匹配更准确。如果工具描述是中英混合或者纯英文，Qwen 的选择准确率可能略低于用中文描述。建议在用 Qwen 时工具 description 使用中文，参数名保持英文。

3. **System Prompt 中明确工具调用行为**：在使用 Qwen 本地部署模型时，建议在 System Prompt 中加入工具调用的行为指引：

```
你是一个能够使用工具的 AI 助手。
当需要查询实时信息或执行特定操作时，请调用相应的工具函数。
调用工具时，请确保参数完整且符合格式要求。
如果工具调用失败，请根据错误信息调整参数后重试。
```

4. **Qwen3 的 Thinking + Tool Calling 模式**：Qwen3 系列支持先思考再调用工具的模式。在请求中设置 `extra_body={"enable_thinking": True}` 可开启 —— 模型会先在内部推理是否需要工具、需要哪个工具，再输出 tool_call。这能显著提高工具选择的准确率，但会增加推理延迟和 token 消耗。

5. **DashScope API 的并发限制**：DashScope 对并发请求有限制（免费版通常 5 QPS），高频使用需要加客户端限流（令牌桶）和重试队列。

**四、与 OpenAI 的差异总结**

| 维度 | OpenAI | Qwen |
|------|--------|------|
| 工具定义格式 | `{"type": "function", "function": {...}}` | 完全兼容 |
| tool_choice | auto / none / required / 指定工具 | 兼容（但本地部署某些版本需额外配置） |
| parallel_tool_calls | 支持 | 支持（Qwen2.5+） |
| 参数校验 | 服务端 constrained decoding | API 版本支持，本地部署版本依赖推理引擎 |
| 特有能力 | streaming tool_calls | Qwen3 Thinking + Tool Calling 结合 |
| 中文工具描述匹配 | 良好 | 更优（中文训练数据更多） |

**加分项：**
- Qwen-Agent 是阿里官方开源的 Agent 框架（`qwen-agent` Python 包），内置了对 Qwen 工具调用的优化，包括自动参数校验、retry 机制和工具调用 trace 追踪。
- 对于本地部署的 Qwen 模型，建议使用 AWQ/GPTQ 量化版（如 Qwen2.5-32B-Instruct-AWQ）来降低显存占用，同时保持工具调用能力不退化。
- Qwen2.5-VL 多模态模型也支持工具调用，可以基于图片内容决定调用哪个工具（如"识别这张照片中的植物并查询其信息"），这是纯文本模型不具备的能力。

---

## Q16：用户如何自定义 Agent 与 MCP？流程是什么？

### 考察点
考察候选人对 Agent 可定制性设计以及 MCP 用户侧集成流程的理解，能否从"使用者视角"讲清自定义的维度和完整操作链路。

### 解答思路
1. 先梳理用户自定义 Agent 的多个维度（行为、知识、工具、界面），说明各自的作用边界。
2. 重点详述 MCP Server 的接入流程——从用户发现到 Agent 可用工具的全链路。
3. 给出一个完整的端到端自定义流程图，体现从配置到运行时的全过程。

### 参考答案

**一、自定义 Agent 的四个维度**

用户自定义 Agent 通常围绕四个维度展开：

- **行为定义（System Prompt）**：用户编写或选择角色的系统提示词，定义 Agent 的身份、语气、行为边界、输出格式。这是最基础的自定义——例如"你是一个 SRE 值班助手，回复需包含严重等级和影响范围"。
- **知识注入（Knowledge Base / Resources）**：用户上传私有文档、连接内部知识库（Confluence、语雀），或通过 MCP Resources 暴露数据库 Schema、API 文档等结构化上下文。
- **工具接入（Tools / MCP Servers）**：用户通过两种路径接入工具：直接注册 Function Call 工具（适合临时或一次性使用的工具），或连接 MCP Server（适合需要复用的标准化工具集）。
- **界面与交互（UI / Workflow）**：用户选择 Agent 的交互方式（聊天、API、定时任务），配置审批节点（如敏感操作需人工确认）和通知渠道。

**二、MCP Server 接入的完整流程**

用户接入 MCP Server 的典型流程如下：

1. **发现 MCP Server**：用户从内部 MCP 市场、GitHub 开源仓库或团队共享中找到需要的 MCP Server（如 "database-explorer"、"jira-server"）。Server 需提供连接信息：传输方式（stdio/HTTP）、端点地址、认证方式。
2. **配置连接**：用户在 Agent 平台上（如 Claude Desktop 的 `claude_desktop_config.json`、企业内部 Agent 管理后台）添加 MCP Server 配置：
   ```json
   {
     "mcpServers": {
       "database": {
         "command": "npx",
         "args": ["-y", "@company/mcp-database"],
         "env": { "DB_URL": "postgres://..." }
       }
     }
   }
   ```
3. **认证授权**：用户完成 OAuth 2.0 授权流程（或配置 API Key），Agent Client 获取 access token。如果是 stdio 本地模式，进程权限由操作系统管控；如果是远程 HTTP 模式，需完成 token 交换。
4. **能力发现**：Agent 启动时，MCP Client 自动连接所有已配置的 Server，调用 `initialize` 完成能力协商，然后通过 `tools/list`、`resources/list` 获取该 Server 提供的全部工具和资源。
5. **Agent 运行时使用**：在对话过程中，LLM 根据用户意图自动选择并调用 MCP Server 提供的工具，用户无需手动指定"用哪个工具"——整个过程对用户透明。

**三、端到端自定义流程总结**

```
用户操作 → 1. 编写/选择 System Prompt（定义角色）
         2. 上传知识文档或连接知识库（注入知识）
         3. 配置 MCP Server 连接（接入工具）
         4. 设置交互参数（审批、通知、权限）
       → Agent 启动 → MCP Client 连接所有 Server → 工具发现
       → 运行时：用户提问 → LLM 推理 → 自动选择合适的工具 → 执行 → 回复
```

整个流程的设计哲学是"配置即自定义"——用户不需要写代码，通过声明式配置即可完成 Agent 的个性化定制。Claude Code 的 Skill 系统和 MCP 配置机制是这一理念的典型实践。

**加分项：**
- 支持"渐进式自定义"：初级用户只写 System Prompt 即可使用，高级用户可以编写自定义 MCP Server 扩展能力。
- MCP Server 的热加载：用户新增 Server 配置后无需重启 Agent，Client 可动态建立连接并触发 `tools/list_changed` 通知。
- 多 MCP Server 的冲突管理：当两个 Server 提供同名工具时，通过优先级或命名空间解决冲突，类似于操作系统的 PATH 优先级。

---

## Q17：Agent skill 开发是怎么做的？什么是计划模式（Plan Mode）？

### 考察点
考察候选人对 Agent Skill 这一新兴能力封装范式的实践理解，以及 Plan Mode（计划模式）作为 Agent 推理策略的概念深度。

### 解答思路
1. 解释 Agent Skill 的概念、结构要素和开发流程，与普通 Tool 的区别。
2. 定义 Plan Mode 的内涵——Agent 先规划后执行的工作模式。
3. 阐述 Skill 与 Plan Mode 的协同关系，如何在 Skill 中利用 Plan Mode 提升复杂任务完成率。

### 参考答案

**一、Agent Skill 的开发范式**

Skill 是比 Tool 更高层级的能力封装单元，它将 System Prompt 片段、一组相关 Tool、任务流程模板和领域知识打包为一个可插拔模块。开发一个 Skill 的核心步骤：

1. **定义 Skill 元数据**：声明 name、description、version、tags、触发条件（trigger_keywords）。元数据决定了 Skill 何时被激活。
2. **编写 Prompt Extension**：这是 Skill 的核心——定义当 Skill 激活时注入到 Agent 上下文的额外指令。包括该领域的工作流程、输出规范、注意事项和约束条件。
3. **绑定工具集**：声明该 Skill 依赖哪些 Tools（可以是 MCP Tools 或本地 Functions），并标注优先级。例如"数据分析 Skill"绑定 `query_database`（高优先级）、`compute_statistics`（高优先级）、`generate_chart`（中优先级）。
4. **定义工作流模板（可选）**：对于复杂任务，可提供步骤骨架（workflow steps），引导 LLM 按照最佳实践路径执行。这不是硬约束，而是推荐的执行蓝图。
5. **注册与生命周期管理**：将 Skill 注册到 Agent 的 Skill Registry，定义其加载策略（按意图触发/始终加载/手动激活）和卸载时机（任务完成/会话结束）。

与 Tool 的本质区别：Tool 是"螺丝刀"（原子操作），Skill 是"宜家安装说明书 + 全套工具"（任务能力包）。Skill 解决的是"LLM 面对复杂任务时不知道从哪里开始"的问题。

**二、计划模式（Plan Mode）**

Plan Mode 是一种 Agent 推理策略：Agent 在动手执行之前，先生成一个完整的执行计划，经用户确认（或自动校验）后再逐步执行。它的核心特征：

- **先规划、后执行**：Agent 收到复杂任务后，不直接调用工具，而是先输出步骤列表——"我计划分 3 步完成：1. 查询数据 → 2. 分析趋势 → 3. 生成报告，预计需要 5 分钟，是否继续？"
- **计划可审查可修改**：用户可以在 Agent 执行前审查计划并进行调整（"第二步加一个同比对比"），避免 Agent 走弯路。
- **执行追踪**：Plan Mode 通常配合 TodoList 或进度追踪机制，实时反馈"第 2/3 步进行中"。

Plan Mode 的适用场景：多步骤复杂任务、高风险操作（涉及生产环境变更）、需要用户协同的任务（如撰写需要多次反馈的长文档）。简单任务不建议用 Plan Mode，会增加不必要的交互轮次和 token 消耗。

**三、Skill + Plan Mode 的协同**

一个设计良好的 Skill 可以内置 Plan Mode 行为。例如"生产环境部署 Skill"的 Prompt Extension 中明确写入："在执行任何部署操作前，先生成部署计划并列出受影响的服务清单，等待用户确认后再执行。"这样 Skill 封装了"什么时候该用 Plan Mode"的判断逻辑，而不依赖 LLM 每次都自己决定。

Claude Code 的 Skill 系统是这个方向的典型实践——Skill 通过 YAML 声明式定义 + 动态注入上下文，天然支持与 Plan Mode 的协同工作。

**加分项：**
- Plan Mode 支持"计划模板"：某些常见任务（如发布上线、数据迁移）可预置计划模板，Agent 仅需填充参数值，大幅降低规划出错概率。
- 计划的"断点续传"：执行到第 3 步失败时，Plan Mode 保存已完成步骤的状态，用户修正后可从中断点继续，而非从头重来。
- Skill 的热更新：修改 Skill 的 Prompt Extension 后，新的 Agent 会话立即生效，无需重启服务。

---

## Q18：请解释 MCP 的概念。在火山引擎这样的云平台上，提供一个 MCP Server 管理的解决方案，您会考虑哪些关键模块？

### 考察点
考察候选人对 MCP 概念的理解深度，以及将协议理论落地到具体云平台产品中的架构设计能力——这是从"会用 MCP"到"能设计 MCP 平台"的能力跃迁。

### 解答思路
1. 用简洁精准的语言定义 MCP 的概念和核心价值。
2. 站在云平台产品设计者的角度，拆解 MCP Server 管理所需的关键模块。
3. 分模块描述设计要点，体现从接入到运维的全生命周期覆盖。

### 参考答案

**一、MCP 概念解释**

MCP（Model Context Protocol）是 Anthropic 于 2024 年 11 月开源的标准协议，定义了 AI 应用（Host/Client）与外部工具和数据源（Server）之间的统一通信接口。它基于 JSON-RPC 2.0，采用 Client-Server 架构，抽象出 Tools（可调用工具）、Resources（只读数据暴露）、Prompts（参数化提示模板）三大原语。

MCP 的核心价值在于解决 N x M 集成爆炸问题：过去每接入一个新工具，每个 AI 应用都需要手写适配代码，工作量为 N x M；MCP 通过标准化协议实现"一次编写 Server，所有 Client 复用"，将工作量降为 N + M。同时，MCP 的运行时工具发现能力（`tools/list`）和变更通知机制（`notifications/tools/list_changed`）使工具集可以动态扩展，无需应用重启。

**二、火山引擎上 MCP Server 管理平台的关键模块**

在火山引擎这样的云平台上构建 MCP Server 管理解决方案，我会设计以下关键模块：

**模块一：MCP Server 注册中心（Registry）**

所有 MCP Server 在此注册，提交元信息：
- Server 标识（全局唯一 name + version）
- 传输方式声明（stdio / SSE / Streamable HTTP）+ 端点地址
- 认证方式声明（OAuth 2.0 endpoints、API Key 模式、IAM 角色）
- 能力声明（提供哪些 Tools/Resources/Prompts，及各自的 Schema）
- 运行环境要求（如需要访问的 VPC、数据库实例等资源）

注册中心还需要支持 Server 的健康探活（定期 ping Server 端点）和版本管理（多版本并存、灰度发布）。

**模块二：统一认证与授权网关**

作为所有 MCP 流量的入口，负责：
- **认证（Authentication）**：基于火山引擎 IAM 体系，支持账号密钥 + STS 临时令牌。MCP Client 使用火山引擎 AK/SK 换取短期 token，后续请求携带 Bearer token。
- **授权（Authorization）**：基于 RBAC + ABAC 的细粒度授权。管理员可为不同角色/用户/团队配置"可发现哪些 Server"和"可调用哪些 Tool"。工具级权限（tool-level ACL）颗粒度到单个工具——用户 A 可调用 `database.query`，但不能调用 `database.delete`。
- **流量管控**：限流（按用户/按工具）、熔断（Server 故障时自动隔离）、降级（返回预设兜底结果）。

**模块三：MCP Server 托管与运行环境**

为降低用户运维负担，平台提供 Server 的托管运行环境：
- **Server 部署**：用户上传代码（Python/Node.js/Java）或镜像，平台自动构建并在 Serverless 容器（如火山引擎 veFaaS）中运行。
- **自动扩缩容**：根据工具调用 QPS 自动扩缩容实例，支持缩容到 0（无调用时不消耗资源）。
- **日志与监控**：自动采集 Server 运行日志、工具调用耗时、错误率、资源消耗等指标，接入火山引擎云监控和日志服务。

**模块四：MCP 市场（Marketplace）**

一个 Server 的发现和共享平台：
- 支持发布官方/第三方 MCP Server，附带文档和使用示例。
- 评价和评分体系（可靠性、响应速度、文档质量）。
- 一键安装到用户的 Agent 实例——从市场选择 Server → 授权相关权限 → 自动配置到用户 Agent 的连接列表。

**模块五：Agent 编排引擎集成**

MCP Server 管理的最终目的是让 Agent 使用工具。此模块负责：
- 为火山引擎上的 Agent 实例提供统一的 MCP Client SDK，封装连接管理、工具发现、调用执行、错误重试。
- 工具 Schema 自动转换：将 MCP 工具的 inputSchema 自动转换为各模型厂商（豆包、DeepSeek、Qwen 等）的 Function Calling 格式。
- 沙箱执行：对高风险工具（文件操作、Shell 命令）在容器沙箱中执行，限制网络访问和文件系统范围。

**模块六：运营与分析面板**

- 工具热度排行榜：哪个 Server 的哪个工具被调用最多。
- 质量大盘：各 Server 的成功率、P99 延迟、错误分布。
- 成本分析：每次工具调用的资源消耗和费用分摊。
- 安全审计：完整的工具调用记录（谁、何时、调用了什么、参数 hash、结果摘要），支持追溯和合规。

这 6 个模块覆盖了 MCP Server 从接入、运行、使用到运维的完整生命周期，基于火山引擎的 IAM、容器服务、监控、日志等基础设施，可以构建一个完整的 MCP 平台。

**加分项：**
- 支持"私有 MCP Server"（仅用户自己可见）和"团队/公司级 MCP Server"（组织内共享）以及"公开 MCP Server"（对全平台开放）三种可见性级别。
- MCP Server 的自动化测试框架：在注册时自动运行 smoke test（调用 Server 的每个 Tool 并验证返回格式），确保质量。
- 与火山引擎豆包大模型的深度集成：MCP 工具调用与豆包的 Function Calling 原生对齐，零转换损耗。

---

## Q19：请描述您之前设计和实现的一个 Agent 系统。在实现工具调用时，您是如何解决工具选择和参数校验这两个关键问题的？

### 考察点
考察候选人的 Agent 系统工程实践经验——能否陈述一个具体项目的架构设计，并深入讲解工具选择和参数校验这两个核心挑战的解决方案。重点验证候选人不是在"复述概念"，而是"真的做过"。

### 解答思路
1. 先简要描述一个自己设计实现的 Agent 系统（场景、架构、技术栈），让回答有真实感。
2. 分别深入讲解工具选择的解决方案（路由策略、语义匹配、分组分层）。
3. 然后讲解参数校验的解决方案（Schema 约束、服务端二次校验、错误回传自修复）。

### 参考答案

**一、项目背景：智能运维助手 Agent**

我曾设计和实现一个面向 SRE 团队的智能运维助手 Agent，技术栈为 Python + LangChain + OpenAI/Claude API + MCP。主要功能：接收自然语言运维请求（如"帮我查一下 gateway-prod 服务最近 1 小时的错误日志，分析趋势并给出处理建议"），自动调用日志查询、监控指标、告警平台、工单系统等工具完成分析并生成报告。

系统架构分为四层：接入层（飞书 Bot + Web 控制台）、编排层（Agent Loop + 意图路由）、工具执行层（MCP Client + 本地工具）、数据层（日志/监控/告警/工单系统）。

**二、工具选择的解决方案**

系统面临约 30 个工具的选择问题。我采用了三层递进策略：

**第一层：意图-工具组路由。** 将 30 个工具按领域分为 5 组（日志组、监控组、告警组、工单组、知识库组），每组 5-8 个工具。用户请求先经过一个轻量级的意图分类（用同一 LLM 做一轮极短推理，prompt 只包含工具组的名称和描述），确定归属的工具组后，只加载该组的工具定义注入 LLM。这使模型每次只需从 5-8 个中选择，而非 30 个，选择准确率从约 75% 提升到约 92%。

**第二层：工具描述优化。** 我花了很多精力在工具 description 的精准度上——每个 description 不仅写"做什么"，还写"什么时候用"和"什么时候不要用"，并加入触发场景的关键词锚点。例如："批量查询错误日志【当你需要查询某个服务在某个时间段内的错误日志时使用】。不要用于实时指标查询（应用 `query_metrics` 工具）。"反例描述显著减少了误调用。

**第三层：运行时 Fallback。** 当工具返回结果明显不匹配用户意图（如用户要查"CPU 使用率"但模型调用了日志查询工具），我设计了一个"结果合理性检查器"——检测返回数据中是否包含用户意图相关的关键词或字段。检查不通过时，自动向模型追加提示"当前工具返回的结果可能不匹配用户需求，请重新选择合适的工具"。

**三、参数校验的解决方案**

参数校验是比工具选择更隐蔽但也更致命的坑——LLM 生成的参数格式正确不代表语义正确。

**第一道防线：JSON Schema 约束。** 每个工具的参数通过 JSON Schema 严格定义（type、required、enum、format 等），并在 tool definition 中由 LLM 在推理时自我约束。OpenAI 和 Claude 的服务端 constrained decoding 能保证 JSON 格式合法。

**第二道防线：Pydantic 服务端二次校验。** LLM 不可信——服务端必须对每次参数做校验：

```python
from pydantic import BaseModel, Field, validator

class QueryLogsParams(BaseModel):
    service_name: str = Field(..., pattern=r'^[a-z][a-z0-9-]*$')
    time_range_hours: int = Field(..., ge=1, le=72)
    log_level: str = Field(default="ERROR", pattern=r'^(DEBUG|INFO|WARN|ERROR|FATAL)$')
    
    @validator('service_name')
    def service_must_exist(cls, v):
        if v not in KNOWN_SERVICES:
            raise ValueError(f"服务 '{v}' 不在已知服务列表中")
        return v
```

Pydantic 校验失败时，不直接返回异常堆栈，而是生成结构化错误信息，回传给 LLM，让其基于具体错误自行修正——这种"自我修复循环"比固定重试高效得多，通常 1-2 轮即可修正。

**第三道防线：业务语义校验。** 即使参数类型合法，也可能语义错误——如查询时间范围跨度过大（一次拉取半年日志会导致 OOM）。我在 tool handler 中嵌入业务规则校验（如单次查询不超过 10000 条、时间跨度不超过 7 天），违反时返回明确的限制说明，让 LLM 调整查询策略（如缩小时间范围、增加过滤条件）。

**关键经验总结**：工具选择的核心不是"让模型更聪明"，而是"帮模型缩小选择范围 + 写好工具描述"；参数校验的核心是"不要信任 LLM 的输出 + 给模型自我修正的机会"。这两点做到位，工具调用的可用性能达到生产级标准。

**加分项：**
- 记录每次工具选择的置信度（通过模型的 logprobs），低置信度选择触发人工审核。
- 参数校验失败率作为工具质量的核心指标——如果某个工具的校验失败率超过 10%，说明工具描述和 Schema 设计有问题需要优化。
- 对高频使用的工具做参数缓存模板——用户说"和上次一样查日志"，Agent 自动复用上次的参数（时间范围平移即可）。

---

## Q20：Function Call 和普通的 Prompt + 正则解析有什么区别？

### 考察点
考察候选人对原生 Function Calling 机制与早期 Prompt Engineering 方案的工程差异理解，能否从可靠性、结构化、安全性等角度论证"为什么需要 Function Calling"而不是"Prompt 里把格式要求写好就行"。

### 解答思路
1. 先描述两种方案的工作方式差异——本质上是"模型内建能力"vs"外部后处理"的区别。
2. 从结构可靠性、工具选择准确率、安全性、工程可维护性四个维度对比。
3. 用一个具体例子展示正则解析方案在生产中的脆弱性，证明 Function Calling 是工程化的必然选择。

### 参考答案

**一、两种方案的工作方式**

**Prompt + 正则解析**：开发者将工具调用格式说明写在 System Prompt 中——"当你需要调用工具时，请按以下格式输出：`<tool>tool_name</tool><params>{"key": "value"}</params>`"。LLM 生成文本后，客户端用正则表达式提取工具名和参数 JSON，执行后再把结果拼回对话。

**Function Calling**：开发者在 API 请求中通过 `tools` 参数传入结构化的工具定义（JSON Schema），模型在推理时原生解析这些定义，在输出中通过专用的 `tool_calls` 字段返回结构化的调用指令（而非自由文本）。这是模型训练时内建的能力，不是 Prompt 指令层的约定。

**二、核心差异对比**

| 维度 | Prompt + 正则解析 | Function Calling |
|------|-------------------|------------------|
| 结构化输出 | 依赖 LLM 遵循文本格式约定，可能产生格式偏差（多余空格、换行、编码异常） | 模型输出专用结构化字段 `tool_calls`，格式由模型推理机制保证，不是文本约定 |
| 工具选择准确率 | 模型需要"记住"Prompt 中写的工具描述，Attention 在长上下文中可能丢失 | 工具定义通过专用参数注入，模型训练时就学习了工具选择机制，准确率显著更高 |
| 约束解码 | 无——模型生成什么样的 JSON 完全是自由文本，可能生成非法 JSON | 服务端支持 constrained decoding，在采样阶段约束 token 选择，保证参数格式合法 |
| 并行调用 | 无标准——需要自己在 Prompt 中约定多工具格式，解析复杂度随工具数量线性增长 | 模型原生支持 parallel tool calls，一次推理输出多个调用 |
| 安全性 | 高风险——自由文本中难以区分"真正的工具调用"和"用户消息中的类似文本" | tool_calls 字段与文本内容完全分离，不存在注入风险 |
| 上下文管理 | 工具调用历史是自由文本，难以结构化追踪 | tool role 消息与 tool_call_id 精确关联，上下文可结构化查询 |
| 多厂商兼容 | 每个模型需要单独调整正则 | 格式趋同（OpenAI 兼容已成为事实标准） |

**三、一个真实场景的对比**

场景：用户说"帮我查一下北京今天天气，然后计算 38 * 47"。

Prompt + 正则方案的典型失败路径：
1. LLM 输出可能是：`我需要先查天气。调用工具：get_weather，城市是北京` —— 正则匹配 `<tool>` 标签失败，因为模型没用标签格式。
2. 即使设置了 strict 格式要求，LLM 可能输出：`<tool>get_weather</tool><params>{"city":"北京"}</params>`，但 `params` 中混入了中文全角引号，JSON.parse 失败。
3. 计算 38*47 时，LLM 可能直接算出答案作为文本输出，但被正则误判为工具调用，导致执行错误。

Function Calling 方案下：模型返回 `tool_calls: [{function: {name: "get_weather", arguments: '{"city":"北京"}'}}, {function: {name: "calculator", arguments: '{"expression":"38*47"}'}}]`——结构化、可解析、格式保证、支持并行执行两个独立工具。

**四、工程结论**

Prompt + 正则解析是早期 LLM 能力不足时的"取巧"方案，适合 demo 和内部小工具。但当系统需要集成 10+ 工具、服务生产用户、或追求可用性超过 99% 时，Function Calling 是工程化的必然选择。正则方案的最大问题是"概率性的正确"——今天可以，明天切换 model 后就不行；而 Function Calling 的正确性是训练保证的结构化承诺。

**加分项：**
- 早期 OpenAI API 也不支持 Function Calling（2023 年 6 月才发布），2023 年上半年很多 Agent 项目确实在用 Prompt + 正则，但该方案已基本被行业淘汰。
- 正则解析方案在"模型微调"后能提升稳定性（用大量格式样本微调），但微调成本和维护成本远高于直接使用原生 Function Calling。
- 在 streaming 场景下，正则解析需要"等待完整回复"后才能做提取，而 Function Calling 的 tool_calls 可以增量解析并提前启动工具调用，提升响应速度。

---

## Q21：如果你要给团队接入 10 个外部工具，你会用 MCP 还是直接写 Function Call？为什么？

### 考察点
考察候选人在具体场景下做技术选型的思维过程——不是简单站队，而是能根据团队规模、工具复用性、维护成本等因素做 rational decision。

### 解答思路
1. 先说明"没有银弹"，选型取决于上下文（团队规模、工具复用需求、时间成本、未来扩展计划）。
2. 构建一个决策矩阵，分别列出各场景下 MCP 和直接 Function Call 的优劣。
3. 给出首选方案和分阶段落地建议，体现工程务实思维。

### 参考答案

我的回答是"看情况，但我倾向于用 MCP 封装，再通过 Function Calling 调用"。

**一、决策依据**

| 考量维度 | 如果选直接 Function Call | 如果选 MCP |
|---------|------------------------|-----------|
| 初期开发速度 | 快——直接写 tools 数组，10 个工具的 Schema 定义 2-3 天搞定 | 慢——需要为每个工具编写 MCP Server、处理连接和传输 |
| 团队内部复用 | 差——另一个团队要接入相同工具，需要复制粘贴 Schema 并各自维护 | 好——Server 写一次，所有团队通过同一 Client SDK 接入 |
| 长期维护成本 | 高——工具 API 变更时，所有接入该工具的 Agent 项目都要手动更新 | 低——只需更新 MCP Server，所有 Client 自动获得最新工具定义 |
| 跨语言复用 | 不支持——Python Agent 和 Node.js Agent 各写一套 | 天然支持——MCP 协议与语言无关 |
| 运维复杂度 | 低——无额外服务需要维护 | 中——需要运维 MCP Server 的部署、监控、扩缩容 |
| 多模型适配 | 每个模型可能要微调格式 | MCP Client 层做一次格式转换即可 |

**二、我的推荐方案：MCP 封装 + Function Calling 调用**

对于团队接入 10 个外部工具的场景，我推荐"用 MCP 封装工具，再通过 Function Calling 调用"的混合方案：

1. **每个外部工具封装为一个 MCP Server**：10 个工具对应 10 个轻量级 MCP Server（或按领域分组，如"开发者工具 Server"包含 Git、Jira、CI/CD）。使用 stdio 模式（如果都在本地）或 Streamable HTTP（如果需要远程访问）。这一步的工作量是投资性的：10 个 MCP Server 的开发成本约 1-2 周，但它确保了工具的长期可复用性。

2. **Agent 框架通过 MCP Client 发现工具**：Agent 启动时连接所有 Server，通过 `tools/list` 获取完整工具列表和 Schema。

3. **注入 Function Calling**：将 MCP 工具定义转换为 OpenAI 兼容的 tools 数组，注入 LLM 请求。模型的工具选择和参数生成能力毫不损失。

4. **工具执行通过 MCP Client 回调**：`tools/call` 执行，结果通过 MCP Client 回传。

这个方案兼顾了两者的优势：MCP 的标准化复用能力 + Function Calling 的模型原生推理能力。同时，未来如果有 20 个工具或 3 个团队需要复用，MCP 层已就绪，只需横向扩展。

**三、什么情况下我会不选 MCP**

- 团队只有 1-2 个 Agent 项目，且明确不会有复用需求（如内部一次性 Hackathon 项目）。
- 10 个工具中有 7 个以上是简单的 HTTP API（如天气查询、汇率转换），直接用 Function Call 写 50 行代码即可，MCP 的协议层开销不值得。
- 时间极端紧迫（1 天内必须上线），MCP 开发调试时间不够。可先直接用 Function Call 上线，后续用 MCP 重构。

**四、分阶段落地建议**

```
第一阶段（1-2 周）：3-5 个核心工具用 MCP 封装（如数据库查询、文档搜索、消息通知）
第二阶段（2-3 周）：其余工具补充封装，建立 MCP Server 开发模板
第三阶段（持续）：MCP Server 市场/注册中心，支持团队自助接入新工具
```

**加分项：**
- 写一个 MCP Server 脚手架（cookiecutter 模板），团队新增工具时 10 分钟搭好骨架，只需填充业务逻辑，大幅降低 MCP 的初期成本。
- 如果使用 LangChain / Semantic Kernel 等框架，它们已内置 MCP Client 适配器，集成成本更低——框架自动完成 MCP Tool → Framework Tool 的转换。
- MCP 的 Resources 原语可以让工具不仅"可调用"，还能"被感知"——例如数据库 MCP Server 可以暴露表结构作为 Resource，让 LLM 在写 SQL 之前先理解数据模型，这是纯 Function Call 做不到的。

---

## Q22：为什么说 Function Call 是 Agent 的基石？

### 考察点
考察候选人对 Agent 本质的理解深度——能否从"推理-行动"循环的逻辑底层解释为什么 Function Call 是 Agent 架构中不可替代的核心组件，而非仅仅是"一个 API 特性"。

### 解答思路
1. 先定义 Agent 的核心能力循环（Reasoning → Action → Observation），指出 Function Call 在这个循环中的关键位置。
2. 从"架起推理与行动的桥梁""结构化交互接口""自主决策的使能器"三个角度论证。
3. 反证：没有 Function Call 的 Agent 会退化到什么程度，以此凸显其基石地位。

### 参考答案

**一、Agent 的本质是"推理-行动"循环**

一个真正的 Agent 不是"回答问题"的聊天机器人，而是能够"感知环境 → 推理决策 → 执行行动 → 观察结果 → 继续推理"的自主系统。这个循环中，Action（行动）是区分 Agent 和普通 Chatbot 的分水岭——Chatbot 只能"说"，Agent 能"做"。而 Function Call 正是 Agent 从"说"到"做"的桥梁。

**二、Function Call 作为基石的三个论证**

**论证一：架起"推理"与"行动"的桥梁。** LLM 是一个推理引擎，它在向量空间中做概率计算，天然不具备执行外部操作的能力（调用 API、操作数据库、修改文件）。Function Call 为 LLM 提供了一种结构化的"表达意图"的机制——模型不需要执行，只需要生成"我想调用 X 工具，参数是 Y"的结构化指令。客户端依据指令执行，将结果返回给模型继续推理。这个机制让 LLM 从"思想"走向"行动"，这是 Agent 得以存在的前提。

**论证二：提供唯一的结构化交互接口。** Agent 与外部世界的交互需要精确性——工具名不能错一个字符，参数类型必须匹配。自然语言无法提供这种精确性（"帮我查一下天气"可以说出 100 种变体）。Function Call 通过 JSON Schema 定义工具接口，通过模型的结构化输出（tool_calls 字段）保证接口调用的确定性。它是 LLM 这个"模糊推理引擎"与外部世界"精确接口"之间的适配层。

**论证三：实现自主决策与工具编排。** Function Call 不是单纯的"参数映射"——模型基于上下文自主决定：要不要调用工具、调用哪个、用什么参数、是否并行调用多个。这个"自主决策"是 Agent 智能的核心体现。没有 Function Call，工具调用只能是硬编码的 if-else 路由（"用户说了'天气'就调天气工具"），完全丧失了 Agent 的灵活性和通用性。

**三、反证：没有 Function Call 的 Agent 是什么样**

如果移除 Function Call，Agent 必须退化到以下模式：
- **Prompt 约定模式**：在 System Prompt 中写"当你需要搜索时，输出 `<search>关键词</search>`"。这不是真正的 Agent，是"文本格式约定 + 正则解析"，完全依赖 LLM 遵守约定的概率，毫无可靠性保证。
- **硬编码路由**：用关键词或意图分类模型预先判断用户要做什么，然后调用对应 API。这不是 Agent，是传统的规则引擎 + 聊天机器人。

这两种模式的共同问题是 AI 失去了"自主决策能力"——调用什么工具、何时调用、怎么调用都被预先写死，Agent 退化为一个 API Gateway 前面的 NLU 引擎。

**四、基石不等于全部**

Function Call 是 Agent 的基石，但它不是 Agent 的全部。一个完整的 Agent 还需要：记忆管理（短期/长期）、规划能力（Plan Mode）、错误恢复、多工具编排、安全边界、人机协同等。但所有这些上层能力都构建在 Function Call 这个"行动接口"之上——就像操作系统构建在 CPU 指令集之上一样。没有 Function Call，Agent 的"行动能力"缺失，所有高级能力都是空中楼阁。

**加分项：**
- 从行业时间线看，Agent 的爆发与 Function Calling 的发布高度同步——OpenAI 在 2023 年 6 月发布 Function Calling 后，LangChain、AutoGPT 等 Agent 框架才真正进入可用阶段，这从行业演进的侧面印证了它的基石地位。
- Function Call 的并行调用能力（parallel tool calls）进一步提升了 Agent 的效率——传统规则引擎需要串行调用多个 API，Agent 可以在单轮推理中并行规划并执行多个独立工具，这是自动化程度的一次跃升。
- 未来的演进方向（如 A2A 协议、MCP）不是替代 Function Call，而是围绕 Function Call 构建更上层的能力——A2A 让多个 Agent 的 Function Call 能力可以协作，MCP 让 Function Call 的工具接入更标准化。

---

## Q23：Function Calling 为 LLM 应用带来了哪些好处？同时又引入了哪些新的挑战或限制？

### 考察点
考察候选人对 Function Calling 两面性的辩证理解——不仅能说清它解决了什么问题，也能清醒认识到它引入了哪些新难题，体现工程思维的全面性。

### 解答思路
1. 先系统梳理 Function Calling 为 LLM 应用带来的核心好处（能力扩展、结构化交互、自主决策、工程标准化）。
2. 再客观分析引入的新挑战（可靠性、安全性、成本控制、复杂调试、厂商绑定风险）。
3. 给出平衡观点：好处是革命性的，挑战是可工程化治理的。

### 参考答案

**一、Function Calling 带来的核心好处**

**能力边界突破**：LLM 本身是纯文本推理引擎，无法感知实时信息或操作外部系统。Function Calling 使其能"伸手"到外部世界——查数据库、调 API、发邮件、操作文件——将 LLM 从"知识问答机"升级为"行动代理"。这是 Agent 从概念走向工程落地的关键使能技术。

**结构化交互接口**：相比早期在 Prompt 中约定文本格式（"请用 `<tool>xxx</tool>` 格式输出"），Function Calling 通过 `tools` 参数和 `tool_calls` 字段提供了确定性的交互机制。JSON Schema 定义工具接口，constrained decoding 保证参数格式合法，tool_call_id 精确关联调用与结果。这是从"概率性约定"到"确定性协议"的质变。

**自主决策与工具编排**：模型基于上下文自主决定"是否调用、调用哪个、用什么参数、是否并行"，而非硬编码的 if-else 路由。用户可以说"帮我查天气，如果下雨就提醒我带伞"，Agent 自主编排"查天气 → 判断是否下雨 → 条件性发送提醒"——这种动态决策能力是传统规则引擎无法实现的。

**工程标准化**：OpenAI 的 Function Calling 格式已成为事实标准，Qwen、DeepSeek、Claude 等主流模型均向它对齐。开发者写一套工具定义即可跨模型使用，大幅降低了多模型适配成本。

**二、引入的新挑战与限制**

**可靠性挑战（幻觉的延续）**：模型可能选错工具（`search_users` vs `search_employees` 张冠李戴）、生成语义错误的参数（查订单时填了不存在的订单号）、或根本不该调用工具时强行调用。Function Calling 的准确率在 80%-95% 区间，对生产级应用来说"5% 的错误率"乘以"每天万次调用"就是 500 次故障。

**安全性风险**：LLM 生成的参数来自不可信的推理过程，可能被 jailbreak 注入恶意内容（SQL 注入、命令注入、越权操作）。传统 API 的参数来自前端表单提交，可以做客户端+服务端双重校验；LLM 生成的参数只有服务端一道防线，且攻击面更隐蔽（提示注入可以在用户消息的 2000 字中藏一句恶意指令）。

**成本控制难题**：每次 Function Calling 请求都要携带全部工具定义（100 个工具的定义占 2-4 万 token）。多轮工具调用（查数据 → 分析 → 生成报告，可能 5-8 轮推理）的 token 消耗远超单轮问答。加上 constrained decoding 的额外计算开销，成本可能是普通对话的 3-5 倍。

**调试复杂度爆炸**：传统调 API 的链路是"请求 → 响应"，Agent 的链路是"用户消息 → LLM 选工具 → 执行工具 → 结果回传 → LLM 再推理 → 可能再调工具 → 最终回复"。一个 3 轮工具调用的交互可能涉及 10+ 个步骤，任何一个环节出错都导致最终回复失败，定位根因需要全链路 trace。

**厂商绑定风险**：虽然各家格式趋同，但细节仍有差异（如 Anthropic 的 tool_use 与 OpenAI 的 tool_calls 在字段名、流式输出机制上不同）。深度依赖某个厂商的 Function Calling 实现后，切换到另一个厂商可能需要改造 Agent 编排逻辑，不是简单的 `base_url` 替换。

**上下文窗口压力**：工具定义 + 多轮调用结果 + 对话历史，三者竞争有限的上下文窗口。100K 窗口看似很大，10 个工具定义占 2 万、3 轮工具调用结果占 3 万、对话历史 1 万，留给模型推理的空间就只剩 4 万 token。

**三、平衡观点**

Function Calling 的好处是革命性的——它将 LLM 从"思想家"升级为"行动者"。但它引入的挑战也是实实在在的——可靠性、安全性、成本、调试，每一项都需要工程化手段来治理（重试与熔断、参数校验与沙箱、工具分组与路由优化、全链路 trace）。认识到这些挑战并建立对应的治理机制，是从"能用 Function Calling"到"在生产环境用好 Function Calling"的分水岭。

**加分项：**
- Function Calling 的"过度调用"问题：模型有时会倾向于频繁调用工具而非直接推理——比如明明训练数据中已知"地球到月球的距离"仍调用搜索工具。可通过 System Prompt 约束"对于训练数据中包含的常识性知识，直接回答，不要调用工具"。
- 工具结果对模型推理的"锚定效应"：模型的最终回复高度依赖工具返回的前几条结果，如果工具返回的信息有偏或不全，模型会被"锚定"在错误方向上。可在工具返回中增加置信度标注，让模型意识到信息可能有局限。
- 参数的空值语义混淆：`null` 可能表示"用户没提供"也可能表示"该字段不适用"。工具定义中应区分"缺失"和"空值"的语义，避免 LLM 填充错误默认值。

---

## Q24：在 Dify 中，如果你想让它调用一个外部的天气 API，应该如何实现？

### 考察点
考察候选人对 Dify 平台工具集成机制的实操理解——能否在可视化编排平台上完成外部 API 的接入配置，体现"低代码 Agent 开发"的实践经验。

### 解答思路
1. 先概述 Dify 的工具接入体系（内置工具、自定义 API 工具、工作流节点），定位天气 API 属于哪种接入方式。
2. 按操作步骤详细说明从创建自定义工具到在 Agent 中使用的完整流程。
3. 指出常见问题和注意事项（鉴权、参数映射、错误处理、大模型提示词配合）。

### 参考答案

**一、Dify 工具接入体系概览**

Dify 提供了三种层级的工具接入方式：
- **内置工具**：平台预置的 Google Search、Wikipedia、DALL-E 等，开箱即用。
- **自定义 API 工具**：用户通过声明式配置（填写 API 地址、参数、Headers）将外部 REST API 接入 Dify，Dify 自动将其转换为 Agent 可调用的工具。
- **代码工具（Code Tool）**：通过 Python/JavaScript 代码片段实现复杂逻辑的插件，适合需要对 API 响应做二次加工的场景。

调用外部天气 API 属于第二类——自定义 API 工具。这是最常用的外部服务接入方式。

**二、具体实现步骤**

**步骤一：创建自定义工具**

在 Dify 导航菜单进入「工具 → 自定义工具 → 创建自定义工具」，填写工具的元信息：
- 名称：`get_weather`（供 Agent 识别和调用）
- 描述：`查询指定城市的实时天气信息，包括温度、湿度、天气状况和风力`（这段描述会被注入 LLM 上下文，直接影响工具选择的准确率）

**步骤二：配置 API 端点**

在工具的 API 配置区域填写接口信息：
- **请求方法**：GET（天气查询通常是 GET 请求）
- **API 地址**：`https://api.openweathermap.org/data/2.5/weather?q=\{\{city\}\}&appid=\{\{api_key\}\}&units=metric`（Dify 使用 `\{\{变量名\}\}` 作为参数占位符）
- **认证方式**：选择 Bearer Token 或 API Key（在 Headers 或 Authorization 中配置），也可将 `appid` 作为查询参数

**步骤三：声明输入参数**

在参数配置面板中定义 LLM 需要填充的参数：
```
参数名：city
类型：string
描述：城市名称，支持中文（如"北京"）或英文（如"Beijing"）
必填：是

参数名：units
类型：string
描述：温度单位，metric（摄氏度）或 imperial（华氏度）
默认值：metric
必填：否
```

Dify 会自动将参数声明转换为 OpenAI 兼容的 tools JSON Schema，LLM 在推理时会看到这些参数定义并生成对应的值。

**步骤四：调试与测试**

Dify 提供了「发送测试」功能——手动填写参数值，点击发送，查看 API 返回的原始 JSON 响应。这一步验证三件事：网络连通性、认证是否正确、响应格式是否符合预期。

**步骤五：配置输出 Schema（关键步骤）**

这是很多开发者会忽略但至关重要的环节。API 返回的天气 JSON 可能包含 50+ 字段（气压、能见度、日出日落时间等），如果全部交给 LLM，会浪费大量 token 且可能干扰推理。应在 Dify 工具配置中截取核心字段作为输出 Schema：

```json
{
  "city": "\{\{name\}\}",
  "temperature": "\{\{main.temp\}\}",
  "humidity": "\{\{main.humidity\}\}",
  "weather": "\{\{weather[0].description\}\}",
  "wind_speed": "\{\{wind.speed\}\}"
}
```

**步骤六：在 Agent 中启用工具**

在 Dify 创建「Agent 应用」或「Chatflow 工作流」时，在工具选择面板中勾选刚创建的 `get_weather` 工具。添加 LLM 节点，在工具配置中将该工具添加到可用工具列表。Agent 便会在对话时基于用户意图自动调用该天气 API。

**步骤七（可选）：在工作流中编排**

如果天气查询只是多步骤任务的一环，可以在 Chatflow 中创建一个「工具节点」（Tool Node），将天气 API 工具作为独立节点插入工作流，配合条件分支（"如果下雨则执行提醒分支"）实现复杂逻辑编排。

**三、常见问题与注意事项**

- **鉴权信息勿暴露**：API Key 等敏感信息应使用 Dify 的「密钥管理」功能存储，不要硬编码在 API 地址中。在调试日志中确保密钥被自动脱敏。
- **描述措辞影响调用准确率**：工具描述建议包含三要素——这是做什么的、什么时候用它、什么时候别用它。例如"查询实时天气，用于获取当前天气信息。不要用于查询历史天气或未来天气预报（那是另外的工具）。"
- **API 超时处理**：外部 API 可能不稳定，建议在工具配置中设置合理的超时时间（5-10 秒），并在 Agent 的 System Prompt 中加入失败处理规则——"如果天气查询失败，告知用户暂时无法获取天气信息，建议稍后重试"。
- **与 LLM 提示词的配合**：在 Dify 的 Agent 提示词中明确告知"当用户询问天气时，调用 get_weather 工具"，可显著提高新模型的首次调用正确率，避免 LLM 用自己的训练知识"编造"天气信息。

**加分项：**
- Dify 支持通过 Swagger/OpenAPI 规范一键导入工具——如果天气 API 提供了 OpenAPI 文档，可直接导入而不必手动填写参数，大幅提高接入效率。
- 在 Dify 的「日志与标注」中查看每次工具调用的实际参数和返回结果，这是排查"为什么 Agent 没调天气工具"或"为什么调用参数不对"的关键数据源。
- 对于高频调用的外部 API，可配合 Dify 的缓存机制减少重复调用——同一城市 30 分钟内的天气查询直接返回缓存结果，降低 API 费用和延迟。

---

## Q25：A2A 和 MCP 的区别是什么？

### 考察点
考察候选人对 Agent 生态两大核心协议的定位、适用场景和技术边界的理解深度——能否讲清 MCP 是"工具链"协议而 A2A 是"Agent 通信"协议，并能用实际场景说明两者的互补关系。

### 解答思路
1. 用一句话点明本质差异：MCP 连接 Agent 与工具/数据源，A2A 连接 Agent 与 Agent。
2. 从通信对象、核心原语、任务模型、发现机制等多个维度做对比。
3. 用具体业务场景说明两者的分工与协作关系。

### 参考答案

**一、本质定位差异**

MCP（Model Context Protocol）和 A2A（Agent-to-Agent）是 Agent 生态中两个不同层次的协议，解决的是不同层面的标准化问题：

- **MCP**（Anthropic 2024 年 11 月发布）：连接 **Agent 与外部工具/数据源** 的协议。它标准化了 Agent 如何发现工具、调用 API、读取资源、获取提示模板，核心关系是 Agent ↔ Tool/Data。
- **A2A**（Google 2025 年 4 月发布）：连接 **Agent 与 Agent** 的协议。它标准化了多个 Agent 之间如何发现彼此、委派任务、传递中间产物、追踪任务状态，核心关系是 Agent ↔ Agent。

类比网络模型：MCP 类似 TCP/IP 的"传输层"——解决 Agent 如何与外部世界交互；A2A 类似"应用层协议"——解决 Agent 之间如何协作编排。

**二、多维度细节对比**

| 维度 | MCP | A2A |
|------|-----|-----|
| 通信对象 | Agent ↔ Tool/Resource | Agent ↔ Agent |
| 核心原语 | Tools（可执行函数）、Resources（只读数据）、Prompts（提示模板） | Task（长期任务）、Message（多轮消息）、Artifact（中间产物） |
| 任务模型 | 单次工具调用，同步 request-response | 长期任务，支持创建、进行中、完成、失败、取消等状态流转 |
| 发现机制 | `tools/list` + `resources/list`，Client 主动拉取工具列表 | Agent Card（JSON 描述文件，类似 OpenAPI），声明 Agent 技能画像 |
| 安全模型 | OAuth 2.0、API Key、传输层加密 | OAuth 2.0 + Agent 身份认证 + 任务级权限控制 |
| 流式支持 | Streamable HTTP 支持双向流式 | 原生支持流式交互和多轮渐进式协作 |
| 标准化组织 | Anthropic 主导，开源社区贡献 | Google 主导，开源协议 |

**三、为什么 MCP 解决不了 A2A 的问题**

- **任务抽象缺失**：MCP 只有"调用工具-返回结果"，没有长期任务的概念。两个 Agent 协作可能需要跨越数小时、数十轮交互，MCP 缺少任务生命周期管理机制。
- **Agent 能力发现不足**：MCP 的 `tools/list` 返回的是确定性工具列表（"我能做 SQL 查询、文件操作"），A2A 的 Agent Card 描述的是智能体的"技能画像"——"我能分析数据、能写代码、能在遇到不确定情况时主动提问"——这是更高级别的能力描述。
- **协作模式缺失**：两个 Agent 协作时可能需要一个思考、另一个执行，或者一个产出中间结果、另一个接力加工。MCP 是单向的客户端-服务器模型，A2A 支持点对点的双向协作模式。
- **多角色关系**：MCP 天然是一对多（一个 Client 调用多个 Server），A2A 必须处理多对多关系——谁发起任务、谁执行、谁协调、谁审批，关系网络远比 MCP 复杂。

**四、两者是互补关系，而非竞争**

在实际的企业 Agent 系统中，MCP 和 A2A 各司其职、协同工作：

一个典型的 SRE 运维协同场景：
1. **值班 Agent** 通过 MCP 调用监控系统（MCP Tool），查询告警数据（MCP Resource）
2. **值班 Agent** 通过 A2A 将"根因分析任务"委派给**诊断 Agent**
3. **诊断 Agent** 通过 MCP 查询日志系统（MCP Tool）、读取 Runbook 文档（MCP Resource）
4. **诊断 Agent** 通过 A2A 将分析结果和修复建议回传给**值班 Agent**
5. **值班 Agent** 通过 MCP 创建工单（MCP Tool），通过 A2A 通知**通知 Agent** 发送告警

这个场景中，MCP 是 Agent 的"感官与四肢"（感知外部世界 + 执行操作），A2A 是 Agent 的"语言与耳朵"（Agent 之间的交流协作）。两者叠加后，构成了完整的多 Agent 协作体系。

**加分项：**
- Google 在设计 A2A 时明确表示"不替代 MCP，而是补充 MCP 未覆盖的 Agent 间通信层"，两个协议在设计上就是互补关系。
- A2A 的 Agent Card 机制使得新 Agent 加入系统后可以被其他 Agent 自动发现和调用，无需人工注册，这是 MCP 不具备的能力。
- 在生产环境中，MCP Server 和 A2A Agent 可以嵌套——一个 A2A Agent 内部既是 A2A Client（与其他 Agent 通信），又是 MCP Client（调用工具），实现协议栈的叠加使用。

---

## Q26：MCP 是什么？解决了什么问题？（N x M 爆炸问题）

### 考察点
考察候选人对 MCP 核心价值和设计动机的深入理解——不是简单背定义，而是能讲清 MCP 究竟解决了什么工程痛点，以及为什么 N x M 问题是真实存在且需要用协议来解决的。

### 解答思路
1. 先用简洁语言定义 MCP，突出其"标准化协议"的定位。
2. 用具体例子说明 N x M 爆炸问题的本质——在传统 Function Calling 模式下，工具接入的工作量如何随着应用数量和工具数量线性乘法增长。
3. 解释 MCP 如何通过"一次编写 Server，所有 Client 复用"将 N x M 降为 N + M。

### 参考答案

**一、MCP 是什么**

MCP（Model Context Protocol，模型上下文协议）是 Anthropic 于 2024 年 11 月开源的一套标准化协议，定义了 AI 应用（Host/Client）与外部工具、数据源、提示模板（Server）之间统一的通信接口。它基于 JSON-RPC 2.0 协议，采用 Client-Server 架构，抽象出三大核心原语：Tools（可调用工具）、Resources（只读数据暴露）、Prompts（参数化提示模板）。

简单理解：MCP 是 AI 应用的"USB-C 接口"——无论另一端连接的是什么设备（数据库、文件系统、外部 API、知识库），Agent 只需通过同一套协议即可接入和使用。

**二、N x M 爆炸问题——MCP 解决的核心痛点**

在 MCP 出现之前，AI 应用接入外部工具的典型模式是"直接 Function Calling"：开发者在每个 AI 应用中手动编写工具的 JSON Schema 定义（name、description、parameters），并实现对应的 handler 函数。

假设一个公司内部有 N 个 AI 应用（如智能客服 Agent、SRE 运维 Agent、数据分析 Agent、代码审查 Agent...），和 M 个外部工具（如 Jira、GitLab、数据库、Slack、邮件服务、日志系统...）。

在传统的 Function Calling 模式下：
- 每个 Agent 都需要为每个工具编写独立的适配代码。Jira 工具的 Schema 定义和 handler 要在客服 Agent 中写一遍，在运维 Agent 中再写一遍，在数据分析 Agent 中又写一遍。
- 当 Jira 工具的 API 升级了（加了新字段、改了认证方式），所有 N 个 Agent 中对应的适配代码都要逐一排查和更新。
- 总工作量 = N x M——10 个 Agent x 20 个工具 = 200 套适配代码需要编写和维护。而且这是一个持续成本：每次新增工具（M+1），所有 N 个 Agent 都要更新；每次新增 Agent（N+1），所有 M 个工具都要重新接入一遍。

这是一个"组合爆炸"问题——随着 N 和 M 各自增长，总工作量呈乘法级膨胀。类比：如果每款手机 APP（N 个）都要为每个品牌的打印机（M 个）写一遍驱动，APP 开发和打印机厂商都会崩溃。

**三、MCP 如何解决问题：N x M → N + M**

MCP 的解决思路是"解耦工具提供方与工具消费方"：

- **工具提供方（Server 侧）**：开发者只需为每个工具编写一个 MCP Server，Server 内部封装了工具的业务逻辑和 API 调用细节。Server 通过标准化的 JSON-RPC 接口对外暴露工具定义（`tools/list`）和执行能力（`tools/call`）。
- **工具消费方（Client 侧）**：所有 AI 应用只集成一套 MCP Client SDK，通过统一的协议与任何 MCP Server 通信。Agent 不需要知道 Server 内部如何实现——它只关心"有哪些工具可用"和"调用结果是什么"。

这样一来：
- 工具接入的工作量从 N x M 降为 N + M：M 个 Server 只需分别开发一次，N 个 Agent 只需分别集成一次 MCP Client。
- 工具升级时，只需更新对应的 MCP Server，所有 Agent 自动获得最新能力（因为 Agent 每次启动时通过 `tools/list` 动态获取工具定义，而非硬编码在代码中）。
- 新增工具时，写一个 MCP Server 后，所有 Agent 立即可用——不需要在 N 个项目中逐一添加。

**四、用数字具象化**

假设一个团队有 5 个 AI 应用和 15 个外部工具：

- **传统模式**：5 x 15 = 75 套适配代码，每套平均 100 行 = 7500 行代码需要维护。每次工具 API 变更，需要排查 5 个应用共约 75 处适配点。
- **MCP 模式**：15 个 MCP Server（每个约 150 行） + 5 个 Agent 集成 MCP Client（每个约 80 行）= 2650 行代码。工具变更只需改 1 个 Server，而非 5 个应用。

当团队扩展到 20 个应用时，传统模式变成 20 x 15 = 300 套适配 = 30000 行，MCP 模式变成 15 个 Server + 20 个 Client 集成 ≈ 3850 行——差距从 3 倍拉大到 8 倍。

**五、MCP 的额外价值**

除了解决 N x M 问题，MCP 还带来：
- **运行时工具发现**：Agent 启动时动态获取可用工具列表（`tools/list`），新增工具无需重启 Agent。
- **工具变更通知**：Server 可通过 `notifications/tools/list_changed` 实时告知 Client 工具列表已更新。
- **跨语言复用**：MCP Server 可用 Python 写，Node.js Agent 和 Java Agent 都可以通过相同的协议调用——这是 Function Calling 原生模式做不到的。
- **Resource 和 Prompt 原语**：Agent 不仅能调用工具，还能"感知上下文"（读取知识库、数据库 Schema）和使用预置提示模板，这些是纯 Function Calling 不具备的能力。

**加分项：**
- MCP 的协议设计灵感来自 LSP（Language Server Protocol）——LSP 用协议标准化解决了"每种编辑器都要为每种语言写插件"的 N x M 问题，MCP 用同样的思路解决了"每个 Agent 都要为每个工具写适配"的问题。
- MCP 不仅仅适用于 LLM Agent——任何需要与外部工具交互的 AI 应用（如图像生成服务、语音识别系统）都可以通过 MCP 统一接入工具。
- MCP 的 Server 可以互相组合——一个"高级分析 Server"可以内部调用"数据库 Server"和"图表 Server"，形成工具的层级复用网络。

---

## Q27：Function Call、MCP、Skills 三者的区别与协作？

### 考察点
考察候选人对 Agent 工具调用技术栈分层架构的系统性理解——能否清晰区分三个概念在 Agent 架构中的不同层次定位，并讲清它们的协作关系而非孤立看待。

### 解答思路
1. 先定义三者各自的层次定位：Function Call = 模型能力层，MCP = 协议/工具接入层，Skills = 能力封装/组织层。
2. 分析它们之间的区别——从抽象层级、复用粒度、动态性、标准化程度四个维度。
3. 用一个完整的协作场景展示三者如何协同工作，体现从上到下的分层架构设计。

### 参考答案

**一、三者的层次定位**

Function Call、MCP、Skills 是 Agent 工具调用技术栈中三个不同层次的概念，它们不是"三选一"的竞争关系，而是"底层到上层"的分层协作关系：

- **Function Call（模型能力层）**：LLM 原生提供的"表达工具调用意图"的能力。模型基于上下文理解用户需求，从可用工具列表中选择合适的工具，并生成结构化的调用参数（JSON）。它是 Agent "决定做什么"的推理层。

- **MCP（协议/接入层）**：标准化的工具集成协议，定义了 Agent 如何发现工具、连接工具、调用工具。它解决的是"工具从哪里来、如何统一接入"的问题。MCP 是"工具怎么接入"的传输层。

- **Skills（能力封装/组织层）**：面向场景的能力封装单元，将"System Prompt 片段 + 一组相关 Tool + 任务流程指引 + 领域知识"打包为可插拔模块。它解决的是"如何将零散的 Tool 组织成面向场景的完整能力"的问题。Skills 是"Agent 拥有什么能力"的组织层。

**二、三者之间的核心区别**

| 维度 | Function Call | MCP | Skills |
|------|--------------|-----|--------|
| 抽象层级 | 模型能力（推理层） | 通信协议（传输层） | 能力封装（组织层） |
| 粒度 | 最小原子操作（单次工具调用） | 协议标准（定义如何传输工具定义和调用） | 面向场景的能力模块（一组相关 Tool + Prompt） |
| 谁在使用 | LLM（推理时选择工具并生成参数） | Agent Runtime（通过 Client 连接 Server 获取工具） | Agent Runtime（按意图匹配激活，注入上下文） |
| 复用性 | 与模型绑定，格式因厂商而异 | 跨应用、跨语言复用工具 | 跨 Agent、跨场景复用能力模块 |
| 动态性 | 工具列表由开发者在请求中静态传入 | 运行时动态发现工具列表（`tools/list` + 变更通知） | 按场景/意图动态加载和卸载 |
| 标准化程度 | 厂商各自实现（OpenAI/Anthropic/Qwen 格式有细微差异） | JSON-RPC 2.0 标准协议 | 暂无统一标准（各框架有各自的 Skill 机制实现） |
| 典型问题 | "模型该调哪个工具、填什么参数" | "工具在哪里、怎么连接、怎么调用" | "这个场景需要哪些能力、怎么组合使用" |

**三、三者的协作关系**

三者不是替代关系，而是分层协作——每一层构建在下一层之上：

```
┌─────────────────────────────────────────────┐
│  Skills（组织层）                              │
│  "数据分析 Skill" = Prompt模板 + Tools组合     │
│  负责：按场景封装能力、管理上下文、引导流程     │
├─────────────────────────────────────────────┤
│  MCP（接入层）                                 │
│  "MCP Server" 提供 Tools/Resources/Prompts    │
│  负责：工具接入标准化、运行时发现、跨应用复用    │
├─────────────────────────────────────────────┤
│  Function Call（推理层）                       │
│  LLM 原生工具调用能力                           │
│  负责：意图理解 → 工具选择 → 参数生成            │
└─────────────────────────────────────────────┘
```

**具体协作流程**：

1. **Skills 决定"上下文"**：当用户说"帮我分析这份销售数据"时，Agent Runtime 识别意图，匹配并激活「数据分析 Skill」。Skill 将数据分析工作流程的 Prompt 指令、输出规范注入到 System Prompt 中。

2. **MCP 提供"工具"**：数据分析 Skill 绑定的工具（如 `query_database`、`compute_statistics`、`generate_chart`）由不同的 MCP Server 提供。Agent 通过 MCP Client 在启动时从各 Server 获取完整的工具定义列表。

3. **Function Call 执行"推理"**：LLM 接收到 Skill 注入的 Prompt + MCP 提供的工具定义 + 用户消息后，通过 Function Calling 能力自主决定：先调 `query_database` 提取数据 → 再调 `compute_statistics` 计算趋势 → 最后调 `generate_chart` 生成可视化，并在 System Prompt 指引下按规范格式输出分析报告。

整个流程是：**Skill 定义"怎么做事" → MCP 提供"做事工具" → Function Call 决定"每一步具体做什么"**。

**四、一个完整的类比理解**

- **Function Call** = 厨师的"烹饪决策能力"——面对食材（用户需求），决定做什么菜、用什么调料、掌握什么火候。
- **MCP** = 厨房的"标准化接口"——所有厨具（锅、刀、烤箱）通过统一标准接入厨房，无需每个厨师自己买一套。
- **Skills** = 菜谱——将"前菜+主菜+甜点"的搭配、每道菜的步骤、出品的摆盘标准封装为一套可复用的烹饪指南。

三者缺一不可：没有 Function Call，厨师不会做决策；没有 MCP，每个厨师需要自己打造厨具；没有 Skills，每做一顿饭都要从零构思菜单。

**加分项：**
- Skills 的"依赖声明"需要与 MCP 协作——Skill 元数据中声明"本 Skill 依赖 database MCP Server 的 `query_database` 工具"，Agent Runtime 在激活 Skill 前自动校验依赖的 MCP Server 是否已连接。
- 未来可能出现 MCP Skill Server——将 Skill 也通过 MCP 协议暴露，实现 Skill 的标准化复用，而不只是 Tool 层面的复用。
- Claude Code 的 Skill 系统是目前 Skill + MCP 协作的最成熟实践：Skill 通过 YAML 声明式定义能力模块，底层通过 MCP Server 接入工具，LLM 通过 Function Calling / tool_use 执行具体操作。

---

## Q28：Skills 是什么？和 Prompt/System Prompt/Few-shot 有什么区别？

### 考察点
考察候选人对 Agent 能力组织方式从"Prompt 工程"到"模块化 Skills"演进的趋势理解——能否讲清 Skills 不是 Prompt 的简单变体，而是一种面向 Agent 的新型能力封装范式。

### 解答思路
1. 先定义 Skills 的概念和核心构成要素，强调其"可插拔能力模块"的定位。
2. 逐一对比 Skills 与 Prompt、System Prompt、Few-shot 的差异——从作用范围、动态性、可组合性、生命周期四个维度。
3. 论证 Skills 代表了 Agent 能力组织方式的范式升级——从"静态提示词"到"动态能力模块"。

### 参考答案

**一、Skills 是什么**

Skills 是 Agent 系统中一种面向场景的**能力封装模块**，它将完成某类任务所需的全部上下文要素打包为一个可插拔单元。一个完整的 Skill 通常包含以下要素：

1. **元数据**：名称、描述、版本、标签、触发条件（trigger_keywords），用于 Skill 的发现、匹配和激活。
2. **Prompt 扩展片段**：当 Skill 被激活时注入 Agent 上下文的额外指令——包括该领域的工作流程、输出规范、注意事项和约束条件。
3. **工具集绑定**：声明该 Skill 依赖的工具集合（可以是 MCP Tools 或本地 Functions），并标注优先级。
4. **工作流模板（可选）**：复杂任务的步骤骨架，引导 LLM 按照最佳实践路径执行。
5. **领域知识（可选）**：Skill 内置的参考信息，如代码审查 Skill 携带的常见问题模式清单。

Skills 的核心设计理念是：**"配置即能力"**——通过声明式配置而非代码编写，实现 Agent 能力的模块化、可组合和可复用。

**二、Skills 与 Prompt/System Prompt/Few-shot 的详细对比**

**Prompt（提示词）**：单次对话的输入文本，告诉 LLM"这次要处理什么"。作用是临时的、一次性的——处理完当前对话就失效。Prompt 不包含工具绑定、不放工作流模板、不具备可复用性。

**System Prompt（系统提示词）**：全局的、持续生效的行为约束和角色定义，写在每条消息的最前面。它定义了 Agent"是谁"（角色）、"怎么做"（行为准则）、"有什么约束"（安全边界）。问题是：随着 Agent 能力增加，System Prompt 越来越臃肿（可能数千字），且内容是静态的——修改需要改代码或配置，所有对话都加载全部约束（不管当前场景是否需要）。System Prompt 是"全局常量"。

**Few-shot（少样本示例）**：在 Prompt 中提供输入-输出示例对，帮助模型理解期望的输出格式和行为模式。Few-shot 是"教学"手段——通过示例教模型怎么做。局限是示例是静态的（写死在 Prompt 中），无法根据场景动态调整，且对复杂多步骤任务的教学效果有限。

**Skills（技能模块）**：动态的、可插拔的、面向场景的能力封装。它与前三者的核心差异在于：

| 维度 | Prompt | System Prompt | Few-shot | Skills |
|------|--------|--------------|----------|--------|
| 作用范围 | 单次对话 | 全局、永久 | 当前 Prompt | 按场景激活 |
| 加载方式 | 每次请求携带 | 始终加载 | 写在 Prompt 中 | 按意图/场景动态加载 |
| 可组合性 | 无 | 无（只能追加） | 无 | 高（多个 Skill 可叠加） |
| 可复用性 | 无 | 低（需复制粘贴） | 低 | 高（跨 Agent 共享） |
| 工具绑定 | 无 | 无 | 无 | 有（绑定 Tool 集合） |
| 生命周期 | 用完即弃 | 随 Agent 启动到关闭 | 随 Prompt 用完即弃 | 注册→激活→执行→卸载 |
| 版本管理 | 无 | 困难 | 无 | 支持（version 字段） |
| 典型长度 | 几十到几百 token | 数百到数千 token | 几个示例 | 数千 token（完整能力包） |

**三、Skills 是 Agent 能力组织方式的范式升级**

System Prompt 模式的本质问题是"全局单例"——Agent 拥有的所有能力约束被扁平地罗列在一个 System Prompt 中。当 Agent 的能力从 3 个增长到 30 个时，System Prompt 膨胀到难以维护，且 LLM 需要在每次推理时处理大量不相关的约束信息，既浪费 token 又降低推理质量（注意力分散）。

Skills 模式将"扁平全局常量"升级为"按需加载的动态模块"：
- **Agent 启动时**：只加载基础 System Prompt（角色定义 + 通用行为准则），保持核心上下文简洁。
- **用户提出具体请求时**：Agent Runtime 根据意图匹配激活对应的 Skill（如"数据分析 Skill"、"代码审查 Skill"），将该 Skill 的 Prompt 扩展 + 工具绑定 + 工作流模板注入当前上下文。
- **任务完成后**：Skill 可被卸载或保持热加载（取决于使用频率），释放上下文窗口。

这种模式的核心优势：
1. **上下文窗口经济性**：按需加载意味着 LLM 不需要在每次推理时处理所有 30 种能力的约束——只需要处理当前场景相关的 1-3 个 Skill。这在高频使用场景下能节省 30%-50% 的 token 消耗。
2. **能力的模块化复用**：一个"代码审查 Skill"可以被所有需要做代码审查的 Agent 共享——只需注册同一个 Skill，无需在每个 Agent 的 System Prompt 中复制粘贴审查规则。
3. **渐进式能力扩展**：新增能力 = 新增一个 Skill 文件，无需修改现有 System Prompt 或 Agent 代码，实现能力的即插即用。
4. **专业化深度**：Skill 可以封装领域最佳实践（如"数据库优化 Skill"内置了慢查询模式、索引最佳实践），这些深度知识如果全部塞进 System Prompt，会让它变成一个"百科全书"而失去焦点。

**四、Few-shot 与 Skills 的关系**

Skills 可以包含 Few-shot 示例（作为 Skill Prompt 扩展的一部分），但 Skill 的能力远超出 Few-shot。Few-shot 教模型"什么样的输出格式对"，Skills 教模型"在这个场景下应该遵循什么流程、用哪些工具、注意什么陷阱、产出什么格式的结果"。Skills 是 Few-shot 在"纵深 + 系统化"方向的演进。

**五、举个具体例子**

一个"代码审查 Skill"包含：
- **Prompt 扩展**："你是一个高级代码审查专家，审查时请关注安全性、性能、可维护性。按以下结构输出审查报告：严重问题 → 改进建议 → 代码亮点。"
- **Few-shot 示例**：提供一段 Java 代码和对应的审查报告示例。
- **工具绑定**：绑定 `git_diff` 工具（获取代码变更）、`run_linter` 工具（自动静态检查）。
- **工作流模板**：1) 获取代码变更 → 2) 运行 Linter 做自动检查 → 3) 逐行审查变更 → 4) 输出结构化报告。
- **领域知识**：常见 SQL 注入模式清单、常见内存泄漏模式清单。

这个 Skill 如果拆散为 System Prompt + Few-shot + 手动调用工具，虽然也能实现类似功能，但 Skill 的优势在于：封装完整、按需加载、一次定义多处复用、版本可管理。

**加分项：**
- Skills 支持"嵌套"——一个"全栈项目 Agent"可以集成"代码审查 Skill" + "测试生成 Skill" + "部署编排 Skill"，每个子 Skill 独立维护和更新。
- Skills 的"冲突检测"机制：当两个激活的 Skill 给出了互相矛盾的指令（如 Skill A 要求"先查数据库再回复"，Skill B 要求"直接回复不要调用工具"），Agent Runtime 需要按优先级或时间顺序做冲突仲裁。
- Claude Code 是 Skill 模式的先锋实践——它通过 YAML 声明式 Skill + MCP Server 的组合，实现了 Skill 的运行时动态加载，用户可以"热插拔"式地为 Agent 添加新能力。

---
