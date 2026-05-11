# Module 3：工具调用类 - 新增题目解答

> 生成日期：2026-05-11 | 共 12 题

---

## Q1：MCP 的传输协议有哪些？stdio vs SSE vs Streamable HTTP 的区别？

### 考察点

- 对 MCP 协议传输层底层机制的深度理解（不仅仅是听说过）
- 三种传输协议各自的适用场景、优缺点、底层通信模型
- 能否结合生产环境经验讲清楚选型理由

### 解答思路

1. **先罗列 MCP 目前支持的三种传输协议**：stdio（标准输入输出）、SSE（Server-Sent Events）、Streamable HTTP。
2. **从通信方向、连接模型、性能、安全、适用场景五个维度逐一对比**，说明各自的底层原理。
3. **给出生产选型建议**：本地开发/IDE 场景用 stdio，远程服务用 SSE 或 Streamable HTTP，2025 年后新项目优先选 Streamable HTTP。

### 参考答案

MCP 的传输层协议当前有三种选择，分别在 2024 年底到 2025 年逐步完善：

**stdio（标准输入输出）**
- 原理：MCP Server 作为子进程启动，Client 通过 stdin/stdout 与之通信，每条 JSON-RPC 消息以换行符分隔。
- 优点：零网络延迟、无需身份认证、部署简单、天然隔离。
- 缺点：仅限本地进程，无法跨网络；Server 崩溃会导致整个连接丢失；不适用于分布式部署。
- 适用场景：IDE 插件本地工具（文件系统、本地数据库）、开发调试。

**SSE（Server-Sent Events）**
- 原理：Client 通过 HTTP GET 建立 SSE 长连接，Server 向 Client 推送 JSON-RPC 响应和通知；Client 通过 HTTP POST 向 Server 发送请求，两条通道组合使用。
- 优点：兼容现有 HTTP 基础设施（CDN、负载均衡、反向代理）；支持远程部署和流式传输。
- 缺点：半双工（请求和响应走不同通道），连接管理复杂；SSE 不支持二进制帧；断线重连需要自行实现状态恢复；POST + SSE 拆成两条连接对负载均衡器不友好。
- 适用场景：2024-2025 年初的主流远程部署方案。

**Streamable HTTP（2025 年新增）**
- 原理：单一 HTTP 端点同时处理请求和响应。普通请求走标准 HTTP POST/GET；需要流式传输时，Server 在响应中设置 `Content-Type: text/event-stream` 并返回 SSE 流；支持 session 管理和断线重连。
- 优点：真正的全双工单端口通信，大幅简化部署；改进的鉴权机制（标准 HTTP Authorization header）；session 管理内置，支持断线重连和状态恢复；对负载均衡器/反向代理友好。
- 缺点：相对较新（2025 年进入正式规范），部分 SDK 生态仍在适配中；需要 Server 支持 session 保持。
- 适用场景：2025 年后的推荐方案，生产级远程 MCP 服务首选。

**一句话总结**：stdio 是"本机进程专线"，SSE 是"半双工远程通信"，Streamable HTTP 是"全双工远程通信的未来标准"。

### 加分项

- 能说出 Streamable HTTP 的 session 管理机制（`Mcp-Session-Id` header），以及它如何解决 SSE 模式下 POST 请求丢失 session 上下文的问题
- 了解 JSON-RPC 2.0 在三种传输层上的消息定界方式：stdio 用换行符，SSE/Streamable HTTP 用 `event:` / `data:` 字段
- 实际踩过 SSE 模式下反向代理（如 Nginx）连接超时导致通知丢失的坑

---

## Q2：MCP Server 暴露的是哪些能力（Tools/Resources/Prompts）？

### 考察点

- 是否理解 MCP Server 的三种核心能力及其各自语义
- 能否区分"工具调用"（主动执行）和"资源读取"（被动获取）的本质差异
- 在实际项目中的使用经验（何时用 Tool，何时用 Resource）

### 解答思路

1. **明确三种能力的定义和协议方法**。
2. **对比 Tools 和 Resources 的核心区别**：一个是"操作"（执行），一个是"数据"（读取）。
3. **说明 Prompts 的价值**：将提示词模板从 Client 中抽离到 Server 端，实现可复用和可组合。

### 参考答案

MCP Server 主要暴露三类核心能力：

**1. Tools（工具）**
- 定义：模型可主动调用的函数/操作，本质是"Server 提供可执行动作，模型决定何时执行"。
- 协议方法：`tools/list`（列出工具列表，返回每个工具的名称/描述/参数 JSON Schema）；`tools/call`（模型发起调用，传入工具名和参数 JSON，返回结构化结果）。
- 核心特征：有副作用（可能修改状态），需要模型主动决策调用时机。
- 典型场景：数据库写入、发送邮件、创建工单、调用外部 API。
- 设计要点：工具描述要精确说明"何时调用"而不是仅仅"能做什么"；参数 Schema 中 `required` 字段要准确标记；返回结果需要同时包含 `content`（可读文本）和结构化数据。

**2. Resources（资源）**
- 定义：模型可读取的数据内容，本质是"Server 提供数据源，模型按需消费"。
- 协议方法：`resources/list`（列出可用资源 URI 列表）；`resources/read`（通过 URI 读取资源内容，支持 MIME 类型）；`resources/subscribe`（订阅资源变更，Server 主动推送更新）；`resources/templates`（参数化资源模板，如 `file://{path}`）。
- 核心特征：无副作用（只读），支持 URI 寻址和 MIME 类型标注，支持订阅式变更通知。
- 典型场景：读取本地文件、查阅数据库表结构、获取知识库文档、读取用户配置。
- 与 Tools 的本质区别：Resource 是被读取的"东西"，Tool 是被执行的"动作"。一个比喻：Resource 像书本（阅读），Tool 像工具（使用）。

**3. Prompts（提示词模板）**
- 定义：Server 端预定义的可复用提示词模板，Client 可直接调用并组装到模型上下文。
- 协议方法：`prompts/list`（列出可用模板）；`prompts/get`（获取具体模板内容，支持参数填充）。
- 核心特征：将提示词工程从 Client 端解耦到 Server 端，由工具提供方维护最优 Prompt，减少 Client 端硬编码。
- 典型场景：代码审查模板（`review_code` 接受 `language` 和 `focus_area` 参数）、SQL 优化分析模板、摘要模板。

**Tools vs Resources 判断口诀**：有副作用的选 Tool，纯读取的选 Resource；如果数据需要版本追踪/变更通知，用 Resource + subscribe；如果操作需要参数校验和事务，用 Tool + 结构化返回。

### 加分项

- 能详细说明 `resources/list` 返回的 URI 模板机制（RFC 6570），以及它如何支持动态参数（如 `postgres://{host}/{table}`）
- 了解 `resources/subscribe` 的变更推送机制，以及 `notifications/resources/updated` 通知的实际应用
- 知道除了这三种能力外，MCP 还支持 Sampling（Server 请求 Client 让模型推理）和 Roots（Client 声明可访问的文件系统边界）

---

## Q3：MCP 上生产有哪些难点？（权限/稳定性/调试/版本兼容）

### 考察点

- 是否真正在生产环境落地过 MCP，而非停留在 Demo 阶段
- 能否系统性地思考一个协议从"能用"到"好用"的工程化差距
- 对权限模型、可观测性、版本管理的工程实践深度

### 解答思路

1. **按维度拆解生产化难点**：权限/安全、稳定性/容错、调试/可观测性、版本兼容/升级。
2. **每个维度给出具体的问题描述和解决思路**，避免空谈。
3. **总结为一张"生产 checklist"**，展示体系化思维。

### 参考答案

MCP 从 PoC 到生产落地，主要面临四大难点：

**1. 权限与安全（最难）**
- 问题：MCP Server 本质是拥有宿主环境权限的进程，stdio 模式下无原生鉴权，服务端任何 Tool 都暴露了操作能力。如果模型"幻觉"式地调用 `delete_all_records` 工具，后果严重。
- 解法：
  - **工具分级 + 用户确认**：将工具标记为 safe（读取类，自动执行）/ unsafe（写入类，需用户确认）。在 Host 层实现确认弹窗。
  - **OAuth 2.0 鉴权**：2025 年 MCP 规范已内置 OAuth 2.0 Authorization Code Grant，Server 可要求 Client 提供 Bearer Token。这是远程 MCP 服务的推荐鉴权方案。
  - **Roots 边界限制**：Client 通过 `roots/list` 向 Server 声明可访问的文件系统范围，Server 必须检查操作路径是否在 Roots 白名单内。
  - **最小权限原则**：每个 MCP Server 只授予完成任务所必需的最小权限，避免一个 Server 拥有所有能力。
  - **Human-in-the-Loop**：高危操作（如删除、发布）必须经过人工确认节点。

**2. 稳定性与容错**
- 问题：stdio 模式下 Server 进程可能崩溃、OOM、假死；SSE 连接可能超时断开；工具调用可能超时无响应。
- 解法：
  - **健康检查**：Client 端实现心跳/探活机制，检测到 Server 无响应时自动重启进程或重连。
  - **指数退避重连**：SSE/Streamable HTTP 断连后使用 exponential backoff（1s -> 2s -> 4s -> 8s, max 30s）重试。
  - **超时熔断**：每个工具调用设置独立超时（默认 30s），超时后返回结构化错误而非让模型无限等待。
  - **进程守护**：stdio Server 建议用 supervisord / systemd 管理进程生命周期，支持自动重启。
  - **优雅降级**：Server 不可用时，Host 应有降级策略（如使用缓存、返回"服务暂不可用"的友好提示）。

**3. 调试与可观测性**
- 问题：JSON-RPC 是二进制协议行为，出问题时难以定位。工具调用链路（模型 -> Client -> Server -> API -> 返回）很长，任何一环节出错都难以排查。
- 解法：
  - **结构化日志**：每个 JSON-RPC 请求/响应都记录 method、id、duration、error。建议使用 OpenTelemetry 分布式追踪。
  - **MCP Inspector**：社区调试工具（`npx @modelcontextprotocol/inspector`），可视化所有 JSON-RPC 消息，支持重放和模拟。
  - **全链路追踪**：将 trace_id 注入 JSON-RPC 消息，跨越 Client-Server 边界，关联模型推理和工具执行的完整链路。
  - **错误标准化**：Server 返回错误时使用 JSON-RPC 标准错误码（-32700 解析错误，-32601 方法不存在，-32602 参数无效），并附带人类可读的 `message` 字段。
  - **E2E 测试**：为每个 MCP Server 编写集成测试，Mock 模型调用，验证 tools/list -> tools/call 的完整流程。

**4. 版本兼容与升级**
- 问题：MCP Server 升级后工具签名变化、参数 Schema 变更，但 Client/Host 可能未同步更新，导致调用失败。
- 解法：
  - **Capability Negotiation**：MCP 初始化握手中 Server 宣告支持的 protocol version 和 capabilities，Client 据此调整行为。利用此机制做向后兼容。
  - **语义化版本管理**：Server 的 `name` 和 `version` 字段应遵循 semver。工具参数新增可选字段算 minor，移除/重命名必填字段算 major。
  - **灰度发布**：通过 MCP Server 的多实例部署 + 流量路由，对新版本 Server 做金丝雀测试。
  - **Schema 校验**：Client 端在调用前校验模型生成的参数是否符合工具的最新 JSON Schema，避免下游 Server 收到非法参数。

**生产 checklist 速查**：权限分层确认 / 心跳探活 / 自动重连 / 超时熔断 / 全链路追踪 / 结构化错误码 / 版本协商 / 灰度发布。

### 加分项

- 了解 MCP 规范 2025 中新增的 `elicitation` 机制（工具调用前的用户交互确认）
- 实际使用过 MCP Inspector 做交互式调试，或自建了 JSON-RPC 链路追踪看板
- 能对比 MCP OAuth 2.0 鉴权与传统 API Key 鉴权的优劣，说明为什么 Authorization Code Grant 更适合 MCP

---

## Q4：MCP 对于输入输出有没有什么规范？JSON 是由谁去构建？

### 考察点

- 对 JSON-RPC 2.0 协议规范的了解程度
- 理解 MCP 中"谁构建 JSON"的分工：Server 定义 Schema（What），模型生成参数值（How Much），Host 拼装 JSON-RPC 消息（How）
- 能否区分 MCP 协议层的 JSON-RPC 消息 vs 工具参数层的 JSON Schema vs 业务数据层的 JSON

### 解答思路

1. **分层说明 JSON 规范**：协议层（JSON-RPC 2.0）、参数层（JSON Schema）、结果层（结构化内容）。
2. **明确 JSON 构建的角色分工**：Server 定义 Schema，模型决定参数值，Host/Client 拼装完整的 JSON-RPC 消息。
3. **用示例展示一个完整的 tool call 生命周期中各环节的 JSON 长什么样**。

### 参考答案

MCP 对输入/输出有严格的分层规范，三个层级的 JSON 由不同角色构建：

**第一层：协议规范层（JSON-RPC 2.0）**

MCP 所有通信基于 JSON-RPC 2.0 协议，每一条消息必须包含：
```json
{
  "jsonrpc": "2.0",
  "id": 1,                    // 请求唯一标识，响应必须对等返回
  "method": "tools/call",     // 调用的方法名
  "params": { ... }           // 方法参数，结构由具体方法定义
}
```
响应消息结构：
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": { ... }           // 成功时返回
}
// 或
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {                  // 失败时返回
    "code": -32602,
    "message": "Invalid params",
    "data": { ... }
  }
}
```
**这层 JSON 由 MCP SDK（Client 端）自动构建**，开发者通常不需要手动拼装。

**第二层：工具参数规范层（JSON Schema）**

每个工具的输入输出参数由 MCP Server 通过 JSON Schema 声明。Server 在 `tools/list` 响应中返回：
```json
{
  "name": "search_documents",
  "description": "搜索文档库",
  "inputSchema": {
    "type": "object",
    "properties": {
      "query": { "type": "string", "description": "搜索关键词" },
      "max_results": { "type": "integer", "default": 10 }
    },
    "required": ["query"]
  }
}
```
**这层 Schema 由 MCP Server 开发者定义**，描述了"模型应该提供什么样的参数"。

**第三层：实际参数值（由模型确定）**

当模型决定调用工具时，它生成具体参数值（自然语言的语义提取结果）：
```json
{
  "query": "微服务架构最佳实践",
  "max_results": 5
}
```
**这层 JSON（参数值）由大模型生成**，这是 Function Calling 的核心能力——将自然语言意图映射为结构化的参数 JSON。

**整体流程中的角色分工**：
- **Server 开发者**：定义工具的 JSON Schema（inputSchema），以及返回结果的结构（结构化内容 + 人类可读文本）
- **大模型**：在推理阶段，根据用户输入和 Schema 描述，生成符合 Schema 的具体参数 JSON
- **MCP Client SDK**：将模型生成的参数 JSON 包装成 JSON-RPC 2.0 消息（`tools/call`），发送给 Server；将 Server 的 JSON-RPC 响应解析为模型可消费的 tool_result 格式
- **Host 应用**：管理整个流程，但通常不直接操作 JSON

此外，**工具返回结果**也有规范：Server 返回 `content` 数组，每个元素包含 `type`（text/image/resource）和对应的数据。推荐同时返回结构化的 `structuredContent` 字段（如 JSON 对象），便于模型精确消费。

### 加分项

- 能说明 JSON-RPC 2.0 的通知（Notification）机制——`id` 字段不设置时为通知，不需要响应，MCP 中用此机制实现 Server->Client 的推送
- 理解 inputSchema 使用的是 JSON Schema Draft 2020-12 标准，而非 OpenAI 的自定义 parameters 格式
- 知道 `tools/call` 返回结果中 `isError: true` 标志位的作用——标识工具执行失败但不是协议层错误，让模型能感知错误并进行修正

---

## Q5：Agent 工具太多时怎么管理？工具路由怎么做？

### 考察点

- 工具管理的工程化能力，不只是"传 tools 列表给模型"
- 对 Token 成本、模型性能退化、调用准确率的多维考量
- 路由器设计的架构思维

### 解答思路

1. **先分析"工具太多"带来的核心问题**：Token 爆炸、模型选择退化、安全性风险。
2. **给出分层管理方案**：工具分组 -> 意图路由 -> 动态注入。
3. **详解路由器的三种实现方案**：关键词匹配、轻量分类器、LLM-as-Router。

### 参考答案

当 Agent 接入 50+ 甚至 200+ 工具时，不能直接全部塞进 tools 列表。核心问题：每轮对话 Token 消耗巨大（200 个工具定义轻松占 5k+ tokens），且模型在过多工具中选择准确率显著下降（选择退化）。解决方案是"**工具分组 + 路由器 + 动态注入**"三层架构：

**第一层：工具注册与分组（Tool Registry）**

将所有工具按领域分组，每个工具附带元数据标签：
```python
TOOLS = [
    {"name": "get_weather", "group": "utility", "tags": ["天气", "实时"], "token_cost": 150},
    {"name": "search_kb", "group": "knowledge", "tags": ["搜索", "知识库"], "token_cost": 200},
    {"name": "create_ticket", "group": "ticketing", "tags": ["工单", "创建"], "token_cost": 300, "risk": "write"},
]
```
分组维度：领域（数据库/SaaS/文件），风险等级（safe/unsafe），Token 成本（轻量/重量）。

**第二层：工具路由（Tool Router）**

路由器的核心任务：根据用户意图，从全局工具池中筛选出本轮对话需要的子集（通常 3-10 个）。三种实现方案：

- **关键词/规则路由（最简单）**：基于正则或关键词匹配，`weather|天气` -> 注入天气工具组，`order|订单` -> 注入业务工具组。优点是零延迟、可解释，缺点是无法处理复杂意图和跨领域场景。适合作为第一级粗筛。
- **轻量分类器路由（推荐）**：训练一个 BERT-base / DistilBERT 级别的意图分类器，输出 Top-K 工具组。推理延迟 < 5ms，准确率 90%+。定期用线上数据做增量训练。
- **LLM-as-Router（最灵活）**：用一个轻量模型（如 GPT-4o-mini / Claude Haiku）做意图到工具组的映射，输入是用户问题，输出是推荐的工具组列表。延迟约 200-500ms，但最灵活。可与分类器组合：分类器处理高频场景，LLM 处理低置信度场景。

**第三层：动态工具注入（Dynamic Injection）**

路由完成后，只将被选中的工具组注入模型请求的 tools 列表。每次对话可能动态切换工具组：
- 第一轮：用户问"今天天气" -> 注入天气组 + 位置组（3 个工具）
- 第二轮：用户问"帮我创建出差申请" -> 根据上轮上下文，切换注入 OA 组 + 审批组（5 个工具）

**进阶技巧**：
- **工具描述压缩**：使用 LLM 对工具描述做摘要，将 200 字的描述压缩为 30 字的关键触发条件，在不损失意图匹配的前提下减少 Token。
- **二阶段选择**：第一阶段用 10 个工具做粗粒度选择，模型选出 1-2 个候选后，第二阶段展开为 20 个细粒度工具做精确选择。
- **Tool as Tool**：当工具数量极大时，把"工具发现"本身也做成一个工具——模型先调用 `search_tools(keyword)` 动态发现工具，再调用具体工具。这类似于 MCP Server 的 tools/list 机制，但更灵活。

### 加分项

- 实际使用过 LLM-as-Router 并做过延迟 vs 准确率的权衡分析
- 了解 OpenAI 的并行函数调用机制天然要求 tools 列表不能太大（否则并行选择质量下降）
- 提"Tool Discovery as a Service"的设计理念——将工具注册中心做成独立服务，支持动态注册和发现

---

## Q6：工具调用错误处理的三层策略是什么？临时错误 vs 永久错误怎么区分？

### 考察点

- 工程实践中的错误处理架构能力
- 对不同类型的工具错误有分类意识和分级响应策略
- 是否有生产环境中处理工具调用异常的实际经验

### 解答思路

1. **定义三层策略的职责边界**：基础设施层（自动重试）、模型感知层（告知模型修正）、业务兜底层（降级/人工介入）。
2. **建立错误分类框架**：从 HTTP 状态码、错误码、异常类型三个维度区分临时 vs 永久错误。
3. **给出实际代码示例**，展示一个完整的错误处理 Pipeline。

### 参考答案

工具调用错误处理的三层策略，本质是"渐进式容错"——尽可能在不中断用户体验的情况下处理异常：

**第一层：基础设施层重试（Infrastructure Retry）——对用户透明**

处理范围：网络超时、连接拒绝、DNS 解析失败、503 Service Unavailable、速率限制（429）等**短暂且可自愈**的错误。

策略：
- 指数退避：1s -> 2s -> 4s -> 8s（最大 30s），最多 3 次
- 抖动（Jitter）：在退避基础上加入 ±25% 随机偏移，避免惊群效应
- 幂等性保证：写操作的重复调用需要 Server 端支持幂等（通过 idempotency key）
- 断路器（Circuit Breaker）：连续失败 N 次后，暂时熔断该工具 30s，直接走降级，避免级联故障

```python
def infra_retry(tool_call, max_retries=3):
    for attempt in range(max_retries):
        try:
            return execute_tool(tool_call, timeout=30)
        except (TimeoutError, ConnectionError, ServiceUnavailable) as e:
            if attempt == max_retries - 1:
                raise  # 所有重试失败，上抛到第二层
            time.sleep((2 ** attempt) + random.uniform(0, 0.5))
```

**第二层：模型感知层修正（Model-Aware Correction）——让模型自我修复**

第一层用尽重试仍失败，或第一层判定为"参数问题无需重试"时，进入第二层。

核心思想：将**结构化的错误信息**返回给模型，让模型自动修正参数或切换工具。

- 参数错误：如 `"city '北亰' not found. Did you mean '北京'?"` -> 模型修正参数后重试
- 工具不存在：如 `"Tool 'delete_user' is not available in this environment"` -> 模型换用 `deactivate_user`
- 权限不足：如 `"Permission denied: requires admin role"` -> 模型向用户解释并请求授权

关键点：错误信息必须是**人类可读 + 模型可理解**的格式，包含错误原因、修正建议、可替代的工具名。

```python
def return_error_to_model(error):
    return {
        "is_error": True,
        "content": f"工具调用失败: {error.message}。{error.suggestion}",
        "error_type": error.type,       # "param_error" / "auth_error" / "not_found"
        "suggested_fix": error.suggestion
    }
```

**第三层：业务兜底层降级（Business Fallback）——保证用户不感知**

前两层都失败后的最后防线：

- 备选工具降级：主工具（实时 API）不可用，切换为缓存数据或备选工具
- 能力降级：工具完全不可用，模型用自身知识回答并标注"该信息可能不是最新的"
- 人工兜底：资金/安全关键操作失败，转人工处理，不自动做任何决策
- 优雅失败：返回友好的用户提示，不暴露技术错误细节

**临时错误 vs 永久错误的区分标准**：

| 错误类型 | 示例 | 分类 | 处理策略 |
|---------|------|------|---------|
| 网络超时 | `ETIMEDOUT`, `Connection reset` | **临时** | 指数退避重试 |
| 服务不可用 | HTTP 503, `Service Unavailable` | **临时** | 退避重试 + 断路器 |
| 速率限制 | HTTP 429, `Rate limit exceeded` | **临时** | 等待 Retry-After 后重试 |
| 参数非法 | HTTP 400, `Invalid city name` | **永久** | 返回模型修正，不重试 |
| 认证失败 | HTTP 401, `Invalid token` | **永久** | 不重试，触发 re-auth |
| 权限不足 | HTTP 403, `Permission denied` | **永久** | 不重试，告知模型/用户 |
| 资源不存在 | HTTP 404, `User 123 not found` | **永久** | 不重试，模型调整参数 |
| 工具不存在 | MCP error -32601 | **永久** | 不重试，走降级 |
| 参数 Schema 不匹配 | MCP error -32602 | **永久** | 不重试，返回模型修正 |

**判断依据**：看同一请求在稍后时间重试是否有合理的成功可能。有 -> 临时，无 -> 永久。服务器返回的 `Retry-After` header 是最明确的信号。

### 加分项

- 实际使用过断路器（Circuit Breaker）模式，能说明半开状态（Half-Open）的工作原理和参数配置
- 实现了"错误预算"机制——为每个工具设置每日最大失败次数，超限后自动降级并告警
- 了解 MCP 协议中 `tools/call` 返回的 `isError: true` 机制，以及它如何与模型自我修正协同工作

---

## Q7：Parallel Tool Calling 的原理？什么场景该用并行调用？

### 考察点

- 对 Function Calling 多工具调用机制的本质理解
- 能否判断工具间的依赖关系，正确决策串行 vs 并行
- 对并发安全、资源竞争、超时管理等工程细节的把握

### 解答思路

1. **解释原理**：模型在一次推理中输出多个 `tool_calls`，引擎并发执行这些调用。
2. **给出判定框架**：依赖分析矩阵，DAG 模型判断哪些工具可以并行。
3. **说明不适合并行的场景和工程注意事项**。

### 参考答案

**原理**

Parallel Tool Calling 的核心原理是：模型在单次推理中，可以同时输出多个独立的工具调用（而非一次只输出一个）。宿主程序/引擎在收到模型的完整响应后，并发执行这些工具调用（而非串行等待），然后将所有结果一次性返回给模型。

技术实现上：
- OpenAI：模型返回的 message 中 `tool_calls` 数组可以包含多个元素，每个元素有独立的 `id`、`function.name`、`function.arguments`。宿主程序对它们并发执行。
- Anthropic：模型返回的 content 数组中可能包含多个 `type: "tool_use"` 的内容块。Claude 的并行调用是通过在一次响应中返回多个 tool_use block 实现的，所有 block 独立执行，结果以对应数量的 `tool_result` block 返回。
- 引擎/SDK 使用 `Promise.all` / `asyncio.gather` / 线程池并发调度，等待所有调用完成后统一返回给模型。

```
传统串行：
  模型推理 -> 调用工具A -> 等待结果 -> 模型推理 -> 调用工具B -> 等待结果 -> 模型推理 -> 回答

并行模式：
  模型推理 -> [调用工具A, 调用工具B, 调用工具C] -> 并发执行(同时等待) -> 收集所有结果 -> 模型推理 -> 回答
```

**什么场景该用并行调用？**

核心判断标准：**工具之间是否有数据依赖**。

适合并行的典型场景：
- **多源信息聚合**：同时查天气 A、查股票 B、查新闻 C（三者无依赖）
- **多路检索比对**：同时在向量库、ES、知识图谱中搜索同一个 query
- **独立实体操作**：同时查"用户 123 的订单"和"用户 123 的积分"（两个独立查询）
- **批量同构操作**：同时翻译 5 段独立文本，或同时获取 3 个城市的天气
- **预热/预加载**：在模型分析问题时，提前并行加载可能需要的数据

不适合并行的场景（必须串行）：
- **链式依赖**：工具 B 的入参依赖工具 A 的返回结果（如 A 查用户 ID -> B 用 ID 查订单）
- **有状态操作**：先创建订单 -> 再支付订单（有严格的先后顺序）
- **共享资源写入**：多工具同时写同一资源且不支持事务（可能导致数据不一致）

**判定框架：构建依赖图**
```
工具调用依赖矩阵：
          A    B    C
    A     -    N    N    (N=无依赖, Y=有依赖)
    B     Y    -    N
    C     N    Y    -

结论：A 和 C 可以并行；B 依赖 A 的返回，必须等 A 完成后再执行。
```

**工程注意事项**：
- **并发数上限**：建议控制 max_parallel_calls ≤ 8，避免下游服务被打垮
- **独立超时**：每个并行调用应有独立超时（而非全局超时），防止一个慢调用阻塞所有
- **部分失败处理**：并行中某工具失败，其他成功的结果仍应返回给模型，让模型决定是否重试失败的
- **资源限制**：并行调用会瞬间放大 QPS（一次模型推理 -> N 次工具调用），需要评估下游承载能力
- **Token 消耗**：并行调用的多个返回结果会一次性注入上下文，可能导致上下文快速膨胀

### 加分项

- 能说明 OpenAI 的 `parallel_tool_calls` 参数（默认为 true），以及关闭后如何退化为串行
- 了解 Anthropic Claude 的 tool_use 并行机制——多个 tool_use block 在同一消息中返回，且每个 block 有独立的 tool_use_id
- 实际优化过并行调用对延迟的影响：比如 3 个 500ms 的工具串行是 1500ms，并行只需 max(500ms) = 500ms

---

## Q8：OpenAI 和 Anthropic Tool Schema 的 6 处结构差异是什么？

### 考察点

- 对两大主流模型 API 规范的深入了解，不只是"用过"，而是做过兼容适配
- 对跨模型迁移/统一的实际经验
- Schema 层面的细节敏感度

### 解答思路

1. **逐一列出 6 处关键差异**，每一处给出两个平台的实际 JSON 示例。
2. **说明跨平台兼容的实现思路**：统一 Schema -> 分别转换 -> 适配各平台。
3. **补充第 7 处 bonus 差异**（严格模式、Prompt Caching 等）。

### 参考答案

OpenAI 和 Anthropic 的工具调用 Schema 存在显著的结构差异，直接导致"写成 OpenAI 格式的 Agent 代码不能直接对接 Claude"：

**差异 1：工具定义的嵌套结构不同**

- **OpenAI**：工具定义采用双层嵌套，外层是 `type: "function"`，内层是 `function: {...}`
  ```json
  {
    "type": "function",
    "function": {
      "name": "get_weather",
      "description": "获取天气",
      "parameters": { "type": "object", "properties": {...}, "required": [...] }
    }
  }
  ```
- **Anthropic**：工具定义采用扁平单层结构，直接使用顶层的 `name`, `description`, `input_schema`
  ```json
  {
    "name": "get_weather",
    "description": "获取天气",
    "input_schema": { "type": "object", "properties": {...}, "required": [...] }
  }
  ```

**差异 2：参数 Schema 的字段名不同**

- **OpenAI**：使用 `parameters` 字段描述工具的输入 Schema
- **Anthropic**：使用 `input_schema` 字段描述工具的输入 Schema
- 虽然两者都是 JSON Schema 格式，但字段名不同意味着直接复制会失败。

**差异 3：工具调用响应（模型输出）的数据结构不同**

- **OpenAI**：在 message 对象中返回 `tool_calls` 数组，每个元素包含：
  ```json
  {
    "id": "call_abc123",           // 唯一调用 ID
    "type": "function",             // 固定为 "function"
    "function": {
      "name": "get_weather",        // 工具名
      "arguments": "{\"city\":\"北京\"}"  // ⚠️ JSON 字符串 (需要 JSON.parse)
    }
  }
  ```
- **Anthropic**：在 content 数组中返回 `tool_use` 类型的内容块：
  ```json
  {
    "type": "tool_use",             // 固定为 "tool_use"
    "id": "toolu_abc123",           // 唯一调用 ID
    "name": "get_weather",          // 工具名
    "input": { "city": "北京" }      // ⚠️ 已解析的 JSON 对象 (不需要 parse)
  }
  ```

**差异 4：arguments/input 的数据类型不同**

- **OpenAI** 的 `function.arguments` 是一个 **JSON 字符串**，需要调用方手动 `JSON.parse()` 才能使用
- **Anthropic** 的 `input` 是一个 **已解析的 JSON 对象**，可以直接使用
- 这是最容易被忽略的差异——许多跨平台适配 bug 源于忘记对 OpenAI 的 arguments 做解析

**差异 5：工具执行结果的提交格式不同**

- **OpenAI**：以 role 为 `"tool"` 的消息形式提交，绑定 `tool_call_id`
  ```json
  {
    "role": "tool",
    "tool_call_id": "call_abc123",
    "content": "北京今天晴，25°C"
  }
  ```
- **Anthropic**：以 `tool_result` 类型的内容块提交，绑定 `tool_use_id`
  ```json
  {
    "type": "tool_result",
    "tool_use_id": "toolu_abc123",
    "content": "北京今天晴，25°C"
  }
  ```

**差异 6：tool_choice 模式的值和语义不同**

- **OpenAI**：`"none"`（禁止调用）、`"auto"`（模型自行决定）、`"required"`（必须调用）、`{"type": "function", "function": {"name": "xxx"}}`（指定工具）
- **Anthropic**：`"auto"`（模型自行决定）、`"any"`（必须调用至少一个工具）、`{"type": "tool", "name": "xxx"}`（指定工具）、`{"type": "tool", "name": "xxx", "disable_parallel_tool_use": true}`（指定工具并禁用并行）
- 关键差异：OpenAI 用 `required`，Anthropic 用 `any`；Anthropic 还多了一个 `disable_parallel_tool_use` 子选项

**跨平台兼容的推荐做法**：定义一套内部的中立 Tool Schema（比如一个 Tool 对象包含 name/description/inputSchema），然后分别实现 `to_openai_format()` 和 `to_anthropic_format()` 转换器，以及对应的 `parse_openai_response()` 和 `parse_anthropic_response()` 解析器。注意对 OpenAI arguments 字符串做 `JSON.parse`，对 Anthropic tool_choice 做 `required -> any` 的映射。

### 加分项

- **差异 7**：OpenAI 支持 `strict: true` 参数，开启后模型保证输出严格符合 JSON Schema（通过 constrained decoding 或后处理校验实现）；Anthropic 无 strict 概念，但通过原生 tool_use 训练保证输出质量
- **差异 8**：Anthropic 支持在工具定义上设置 `cache_control: {"type": "ephemeral"}` 实现 Prompt Caching，减少重复工具定义的 Token 消耗；OpenAI 不支持工具定义级别的缓存控制
- **差异 9**：Anthropic 的 tool_use 和 text 内容块可以自由混合在 content 数组中（模型可以在调用工具的同时输出解释文本）；OpenAI 的 tool_calls 和 content 是互斥的——有 tool_calls 时 content 为空或只有简短过渡文本

---

## Q9：MCP 和 A2A 协议的分工：竖向（Agent↔工具）vs 横向（Agent↔Agent）？

### 考察点

- 对两大协议的技术定位有清晰的全局认知
- 能从架构层面说清何时用 MCP、何时用 A2A、何时两者结合
- 具备多 Agent 系统设计的架构视野

### 解答思路

1. **定义"竖向"和"横向"的物理含义**：竖向是 Agent 调用底层能力（Tools/Resources），横向是 Agent 之间的对等通信（任务委派/协作）。
2. **对比协议的核心差异**：通信主体、抽象层级、发现机制、生命周期。
3. **给出结合使用方案**：在一个复杂 Agent 系统中，MCP 负责"手脚"（执行能力），A2A 负责"大脑"（协作协调）。

### 参考答案

MCP 和 A2A 解决的是不同维度的问题，两者垂直正交、互相补充：

**竖向分工：MCP（Agent <-> 工具/资源）**

MCP 解决的是"单个 Agent 如何能力最大化"的问题。它像一个即插即用的外设标准：
- 通信方向：Agent（上层）调用 MCP Server（下层）暴露的能力
- 关系模型：Client-Server，有明确的调用方和被调用方
- 核心操作：列出工具 -> 调用工具 -> 读取资源 -> 获取提示词模板
- 协议粒度：单个工具调用 / 单次资源读取（细粒度，毫秒级）
- 类比：USB 协议——电脑（Agent）插上一个 U 盘（MCP Server），自动识别并读写数据
- 典型场景：Agent 需要查询数据库、发送邮件、读取文件、搜索知识库

**横向分工：A2A（Agent <-> Agent）**

A2A 解决的是"多个 Agent 如何高效协作"的问题。它像微服务间的通信标准：
- 通信方向：Agent 之间对等通信（可以是双向任务委派）
- 关系模型：Peer-to-Peer，每个 Agent 都是独立的决策单元
- 核心操作：发送任务 -> 接收任务 -> 流式返回结果 -> 任务状态同步
- 协议粒度：完整任务委托（粗粒度，秒到分钟级）
- 类比：HTTP/REST——微服务 A 向微服务 B 发起请求完成任务
- 典型场景：主 Agent 把"代码审查"委派给 Reviewer Agent，把"测试生成"委派给 Tester Agent

**核心差异对照表**：

| 维度 | MCP | A2A |
|------|-----|-----|
| 提出方 | Anthropic | Google |
| 通信主体 | Agent <-> Tool/Resource | Agent <-> Agent |
| 抽象层级 | 能力/接口层 | 任务/工作流层 |
| 协议粒度 | 单次调用（ms） | 完整任务（s-min） |
| 角色关系 | Client-Server（非对称） | Peer-to-Peer（对称） |
| 发现机制 | tools/list 自动发现 | Agent Card 注册中心 |
| 通信协议 | JSON-RPC 2.0 | HTTP + JSON（RESTful） |
| 状态管理 | 连接级（有状态长连接） | 任务级（任务状态机） |
| 核心问题 | "模型如何标准化地调用工具" | "Agent 如何标准化地协作" |

**两者如何结合**：

在一个生产级多 Agent 系统中，两者各司其职：

```
┌─────────────────────────────────────────────────┐
│  Orchestrator Agent                              │
│  (A2A 协议：向子 Agent 委派任务)                    │
├──────────────┬──────────────┬───────────────────┤
│  Code Agent  │ Review Agent │  Deploy Agent     │
│  ┌─────────┐ │  ┌─────────┐ │  ┌──────────────┐ │
│  │   MCP   │ │  │   MCP   │ │  │     MCP      │ │
│  │ Server  │ │  │ Server  │ │  │   Server     │ │
│  │(Git/IDE)│ │  │(Linter) │ │  │(K8s/CI/CD)  │ │
│  └─────────┘ │  └─────────┘ │  └──────────────┘ │
└──────────────┴──────────────┴───────────────────┘
         ↑ 竖向(MCP)：Agent 调工具    ← 横向(A2A)：Agent 间协作
```

- MCP 让每个 Agent 拥有**执行能力**（调用工具、访问资源）
- A2A 让多个 Agent 实现**分工协作**（任务委派、结果汇总）
- 一句话：MCP 管"手脚"，A2A 管"大脑之间的对话"

### 加分项

- 了解 A2A 协议的 Agent Card 机制（`/.well-known/agent-card.json`），以及如何通过此机制实现 Agent 动态发现
- 实际做过 MCP + A2A 的联合架构设计，能说明通信边界（哪些消息走 MCP，哪些走 A2A）
- 能对比 A2A 和 MCP 的鉴权差异：A2A 默认使用 Service Account + OAuth 2.0，MCP 也引入 OAuth 2.0 标准化

---

## Q10：MCP 介绍，原理和为什么选择 MCP？MCP 和 Function Call 的区别？

### 考察点

- 对 MCP 协议的系统性理解（不只是定义）
- 能清晰区分"协议标准"和"模型能力"的层次
- 有说服力地阐述 MCP 的价值主张

### 解答思路

1. **先介绍 MCP 是什么**：一句话定义 + 核心价值。
2. **解释原理**：JSON-RPC 2.0 + Client-Host-Server 架构 + Capability Negotiation。
3. **对比 Function Call**：从 6-7 个维度系统对比。
4. **说明为什么选择 MCP**：标准化、可复用、安全、生态。

### 参考答案

**MCP 是什么**

MCP（Model Context Protocol）是 Anthropic 于 2024 年 11 月开源的一个标准化协议，用于连接 AI 模型与外部工具、数据源。它的核心理念是"AI 世界的 USB-C 协议"——一套统一的标准，让任何 AI 应用（Client/Host）可以即插即用地接入任何工具服务（Server），无需定制开发。

**MCP 的原理**

1. **协议基础**：MCP 基于 JSON-RPC 2.0，所有通信都是结构化的 JSON 消息。JSON-RPC 提供了请求-响应的基本模式（method + params -> result/error）。
2. **三层架构**：
   - **MCP Host**：面向用户的应用（IDE / Chat 应用 / Claude Desktop），管理多个 Client
   - **MCP Client**：与单个 Server 维持一对一的协议连接，处理 JSON-RPC 消息收发
   - **MCP Server**：轻量级服务进程，暴露 Tools / Resources / Prompts 等能力
3. **初始化握手机制**：Client 连接 Server 时，先发送 `initialize` 请求 -> Server 返回 `serverInfo` 和 `capabilities`（声明自己支持的能 
力） -> Client 发送 `initialized` 通知确认。此后双方知道对方的能力边界，按需调用。
4. **传输层**：支持 stdio（本地进程通信）、SSE（HTTP 长连接）、Streamable HTTP（全双工）三种传输方式。

**MCP vs Function Call：本质区别**

Function Calling 是 LLM API 层面的一个功能特性——在单次 API 请求中告诉模型"你可以调用哪些工具"，模型返回结构化的调用指令。它是**用例级的能力**。

MCP 是独立的协议标准——定义了工具如何被描述、发现、连接、调用、管理的完整生命周期。它是**协议级的标准**。

| 维度 | Function Calling | MCP |
|------|-----------------|-----|
| **层级** | LLM API 特性（用例层） | 独立协议标准（协议层） |
| **工具定义** | 内嵌在每次 API 请求的 tools 参数中 | Server 端集中管理，tools/list 动态发现 |
| **复用性** | 绑定特定模型 API 格式 | 跨模型、跨平台、跨语言通用 |
| **工具管理** | 调用方手动维护 tools 列表 | Server 自身负责暴露和管理 |
| **安全性** | 无内建安全机制 | 支持 OAuth 2.0、Roots 边界、用户确认 |
| **连接模式** | 无状态（每次请求独立） | 有状态长连接 |
| **能力范围** | 仅工具调用 | 工具 + 资源 + 提示词 + 采样 + 根目录 |
| **生命周期** | 请求级（随 API 调用结束而结束） | 连接级（进程/会话级，持续可用） |
| **生态** | 每个应用自己写集成代码 | 标准化 Server 一次开发，到处使用 |

**为什么选择 MCP**

1. **一次开发，到处使用**：写一个 MCP Server（如 PostgreSQL Server），Claude Desktop、VS Code、Cursor、自研 Agent 等所有 MCP 兼容的应用皆可直接使用。
2. **解耦工具提供方和使用方**：工具开发团队维护 MCP Server（定义工具逻辑 + Schema），Agent 开发团队专注业务逻辑。协议约定的接口边界清晰。
3. **内建安全机制**：OAuth 2.0 鉴权、Roots 文件路径白名单、Human-in-the-Loop 确认，比裸 Function Call 安全得多。
4. **生态网络效应**：社区涌现大量开源 MCP Server（GitHub、Slack、PostgreSQL、Google Drive 等），Agent 开发者直接安装使用，无需重复造轮子。
5. **超越工具调用**：Resources（可读数据）+ Prompts（可复用模板）+ Sampling（Server 委托模型推理）提供了更丰富的能力组合。

### 加分项

- 能说明"Function Calling 也可以封装成 MCP Server"——MCP Server 内部仍然需要调用 LLM API 的 Function Calling 来实现模型对工具的调用决策
- 理解 MCP 不是 Function Calling 的替代品，而是上层封装——Function Calling 是底层机制，MCP 是标准化集成协议
- 实际对比过同一个工具（如天气查询）在 Function Calling 原生方式 vs MCP 方式下的代码量和维护成本

---

## Q11：MCP 有哪些通讯协议？SSE 的断点续传怎么实现？

### 考察点

- 对 SSE 协议的底层机制理解（不只是"用"过）
- 知道 EventSource API 的边界和限制
- 理解断点续传（Resume）的实现原理和工程挑战

### 解答思路

1. **先概述 MCP 的三种通讯协议**。
2. **重点深入 SSE 的断点续传**：Last-Event-ID 机制、Server 端事件缓冲、Session 管理。
3. **给出完整的实现链路**（代码级）。

### 参考答案

**MCP 的三种通讯协议**

1. **stdio**：标准输入输出，MCP Server 作为子进程启动，通过 stdin/stdout 传递 JSON-RPC 消息。适用于本地 IDE 插件和命令行工具，零网络延迟，无需鉴权。
2. **SSE（Server-Sent Events）**：HTTP 协议的扩展，Server 通过单一的 HTTP GET 长连接向 Client 流式推送事件。Client 到 Server 的通信走独立的 HTTP POST 请求。适用于远程部署场景，兼容现有 HTTP 基础设施。
3. **Streamable HTTP（2025 年新增，推荐）**：单一 HTTP 端点，同时支持普通请求和流式响应。解决了 SSE 的"半双工"痛点——请求和响应可走同一条连接，支持 session 管理和断线重连。

**SSE 的断点续传（Resume）实现原理**

SSE 断点续传的核心依赖于 `Last-Event-ID` HTTP header 和 Server 端的事件缓冲区。完整流程：

**Step 1：Server 端发送事件时附带 ID**
```
Server -> Client:
event: message
id: 1567              ← 每条事件分配单调递增的 ID
data: {"result": "..."}

event: message
id: 1568
data: {"result": "..."}
```

**Step 2：Client 记录最后收到的事件 ID**
- 浏览器原生 EventSource API 自动记录 `lastEventId`
- 自定义 Client 需要在内存中维护 `lastEventId` 变量，每次收到事件时更新

**Step 3：连接断开，Client 发起重连**
- 浏览器 EventSource 默认自动重连，会在重连请求中自动带上 `Last-Event-ID: 1568` header
- 自定义实现需要在建立新 SSE 连接时手动设置 header：
```javascript
const eventSource = new EventSource("/mcp/sse", {
  headers: { "Last-Event-ID": lastEventId.toString() }
});
```

**Step 4：Server 端从断点恢复**
```python
class MCPServer:
    def __init__(self):
        self.event_buffer = {}  # session_id -> deque of (event_id, event_data)
        self.buffer_max_size = 10000  # 最多缓存 10000 条事件

    async def handle_sse_connect(self, request):
        session_id = request.cookies.get("mcp_session_id")
        last_event_id = request.headers.get("Last-Event-ID", "0")

        if session_id in self.event_buffer:
            # 重放 last_event_id 之后的所有事件
            for event_id, event_data in self.event_buffer[session_id]:
                if event_id > int(last_event_id):
                    yield f"id: {event_id}\ndata: {event_data}\n\n"
        
        # 继续推送新事件...
```

**工程中的关键挑战和解决方案**：

1. **缓冲区大小限制**：无限缓冲会导致 OOM。设置上限（如 10000 条或最近 5 分钟），超出后从最旧的事件开始丢弃。如果 Client 断开超过缓冲区窗口，只能全量重新连接（抛弃断点续传）。
2. **Session 标识**：需要稳定标识连接——Server 端生成 session_id，通过 Cookie 或 `Mcp-Session-Id` header 返回给 Client。Client 重连时携带此 ID。
3. **事件去重**：断点续传可能导致事件重复（Server 发送了事件但 Client 未收到 ACK）。方案：
   - Client 端以 event_id 做幂等去重
   - 对于工具调用类事件（有明确响应匹配），不依赖断点续传而是重新请求
4. **心跳保活**：定期发送 `event: heartbeat\ndata: \n\n` 保持连接，同时用于检测断线。如果超过 2 个心跳周期未收到数据，Client 主动断开并重连。
5. **Streamable HTTP 的替代**：2025 年 MCP 规范新增的 Streamable HTTP 内置了更好的 session 和 resume 机制——Server 在初始化时返回 `session_id`，后续所有请求（包括流式）携带此 ID，Server 自动处理断线重连，无需手动实现 Last-Event-ID 逻辑。

**断点续传 vs 全量重连的选择**：轻量信息（日志、进度通知）适合断点续传；关键操作（工具调用结果）建议不依赖断点续传，而是让 Client 在重连后重新查询当前状态。

### 加分项

- 实际使用过 Redis Pub/Sub 或 Kafka 作为 SSE 事件缓冲区，实现跨进程/多实例的断点续传
- 了解 SSE vs WebSocket 在 MCP 场景中的权衡，能说清为什么 MCP 早期选择 SSE 而非 WebSocket
- 知道 Streamable HTTP 模式下 `Mcp-Session-Id` header 的完整生命周期管理

---

## Q12：Function Calling 的完整四步流程：从工具定义到结果返回？

### 考察点

- 对 Function Calling 全链路的端到端理解
- 能否将概念性认知转化为具体的技术步骤和数据流转
- 对每一步的异常场景有思考

### 解答思路

1. **以一次完整调用为线索**，以具体 JSON 示例展示每一步的输入输出。
2. **明确每一步的职责和参与者**：开发者做什么、模型做什么、引擎做什么。
3. **点出每一步的常见坑**。

### 参考答案

Function Calling 的完整生命周期包含四个步骤，形成闭环：

**第一步：工具定义（Tool Definition）**

由**开发者**在发起 API 请求前完成。工具以结构化 Schema 形式描述，注入到请求的 `tools` 参数中。

```json
// 请求中注入的 tools 参数
{
  "model": "gpt-4o",
  "messages": [{"role": "user", "content": "北京今天天气怎么样？"}],
  "tools": [{
    "type": "function",
    "function": {
      "name": "get_weather",
      "description": "获取指定城市的实时天气信息，包括温度、湿度、天气状况。当用户询问某地天气时使用此工具。",
      "parameters": {
        "type": "object",
        "properties": {
          "city": {
            "type": "string",
            "description": "城市名称，使用中文全称，如'北京'、'上海'"
          }
        },
        "required": ["city"]
      }
    }
  }],
  "tool_choice": "auto"
}
```

关键点：`description` 不仅要说明工具能做什么，更要说明**何时应该调用**；`parameters` 是 JSON Schema 格式；必填字段要标 `required`。

**第二步：模型决策与参数生成（Model Reasoning & Generation）**

**模型**在推理阶段完成三项工作：
1. 判断用户意图是否匹配某个工具的触发条件
2. 从用户自然语言中提取参数值
3. 生成结构化的工具调用指令

模型返回的响应：
```json
{
  "role": "assistant",
  "content": null,           // 调工具时 content 通常为空
  "tool_calls": [{
    "id": "call_abc123",      // 本次调用的唯一标识
    "type": "function",
    "function": {
      "name": "get_weather",
      "arguments": "{\"city\":\"北京\"}"  // ⚠️ JSON 字符串
    }
  }]
}
```

常见坑：
- 模型可能不调用工具（`tool_calls` 为空），需要在后处理中检测
- 参数可能缺失必填字段（如只传了 `city: "北京"` 但 tool 还需要 `date`）
- 参数值可能不合规（如传了 `"beijing"` 而非 `"北京"`）
- 模型可能在不需要调用工具时强行调用（如果 tool_choice 设为 required）

**第三步：工具执行（Tool Execution）**

由**宿主程序/引擎**完成：
1. 解析模型的 `tool_calls` 响应
2. 根据 `function.name` 路由到正确的工具函数
3. 将 `function.arguments`（JSON 字符串）解析为对象
4. 调用实际的后端服务/函数
5. 收集返回结果

```python
import json

def execute_tool_call(tool_call):
    # 1. 解析 tool_call
    tool_name = tool_call["function"]["name"]
    arguments = json.loads(tool_call["function"]["arguments"])  # 字符串 -> 对象

    # 2. 路由到对应函数
    if tool_name == "get_weather":
        result = weather_api.get(city=arguments["city"])
        return {"temperature": 25, "condition": "晴", "city": "北京"}
```

常见坑：
- `arguments` 是 JSON 字符串，忘记 `JSON.parse` 会传字符串给函数
- 工具执行可能超时、抛异常、返回不符合预期的格式——需要统一的错误包装
- 写操作需要幂等性保证，防止模型重试导致重复执行

**第四步：结果返回与模型合成（Result Injection & Final Generation）**

宿主程序将工具执行结果以 `tool` 角色的消息形式注入对话上下文，**再次调用模型 API**：

```json
// 第二次 API 调用
{
  "model": "gpt-4o",
  "messages": [
    {"role": "user", "content": "北京今天天气怎么样？"},
    {"role": "assistant", "content": null, "tool_calls": [{"id": "call_abc123", ...}]},
    {"role": "tool", "tool_call_id": "call_abc123", "content": "北京今天晴，温度 25°C，湿度 40%"}
  ]
}
```

模型收到结果后，生成最终的自然语言回答：
```json
{
  "role": "assistant",
  "content": "北京今天天气晴朗，当前温度 25°C，湿度 40%，非常适合户外活动。"
}
```

这四步形成了一个完整的 **User -> Model -> Tool -> Model -> User** 闭环。关键在于每步之间的**数据格式转换**和**异常处理**：
- Step 1->2：模型是否准确理解工具触发条件
- Step 2->3：arguments 字符串解析是否正确，工具路由是否准确
- Step 3->4：工具结果格式是否符合模型的消费习惯，错误信息是否可被模型修正

**多轮/多工具调用**：如果模型的第二次推理发现仍需更多信息（如工具返回的数据不完整），可以继续发起新的工具调用，进入二轮循环。这也是 Function Calling 支持链式多工具调用和多轮迭代的基础。

### 加分项

- 能说明 Anthropic 格式下的对应四步流程（差异在：工具返回用 `tool_result` 而非 `tool` role；input 是已解析对象而非 JSON 字符串）
- 了解"工具结果过大"时的截断策略——对返回结果做摘要压缩，避免超出模型的 context window
- 实际设计过工具调用结果中包含 `isError: true` 标记，让模型主动识别失败并自我修正参数

---
