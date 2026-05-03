# Module 3 - 工具调用类（Tool Calling）面试题解答

---

## 1. LLM 是如何学会调用外部 API 或工具的？

### 核心原理

LLM 学会工具调用并非通过"理解 API"，而是通过 **预训练 + 指令微调 + 上下文学习** 的叠加：

**（1）预训练阶段：语法与结构模式学习**

- 大模型在海量代码、API 文档、技术文档中预训练时，已经学会了 JSON、XML、函数签名等结构化表达。
- 模型天然具备"给定一段描述，输出对应结构化数据"的能力。

**（2）指令微调（Supervised Fine-Tuning, SFT）**

- 使用高质量的工具调用示例数据（tool-use trajectories）进行微调。
- 每条数据包含：用户问题 + 工具描述（名称、参数、功能说明）+ 正确的调用格式。
- 模型学会在特定触发条件下输出工具调用结构。

**（3）上下文学习（In-Context Learning）**

- System Prompt / Tool Definitions 中注入工具的 JSON Schema 描述。
- 模型在推理时，将这些描述视为"规则说明书"，按格式输出调用请求。
- 不需要额外训练，零样本即可调用新工具。

**（4）强化学习对齐（RLHF / RLAIF）**

- 部分模型通过 RLHF 进一步优化：正确调用工具得到正奖励，不调用或错误调用得到负奖励。
- 提升工具调用的意愿和准确率。

### 参考回答

> LLM 学会工具调用主要经过三个阶段：预训练阶段从代码和技术文档中学习结构化表达；指令微调阶段使用大量工具调用示例（包括工具描述、调用时机、参数格式）进行 SFT 训练，让模型掌握"何时调用、如何调用"；推理阶段通过 System Prompt 中的工具定义（JSON Schema），模型以 In-Context Learning 的方式理解新工具并输出合法调用。部分模型还会通过 RLHF 来进一步提升调用意愿和准确率。

---

## 2. Function Calling 的底层实现原理是什么？

### 实现流程

Function Calling 本质上是 **受控的结构化输出生成**，核心流程如下：

```
用户请求 → System Prompt 注入工具定义 → 模型生成 → 解析工具调用 → 执行工具 → 返回结果 → 模型继续生成
```

**（1）工具定义注入**

- 工具以 JSON Schema 格式（名称、描述、参数列表、参数类型、必填字段）注入到 System Prompt。
- 示例（OpenAI 格式）：

```json
{
  "name": "get_weather",
  "description": "获取指定城市的天气信息",
  "parameters": {
    "type": "object",
    "properties": {
      "city": { "type": "string", "description": "城市名称" }
    },
    "required": ["city"]
  }
}
```

**（2）受控解码（Constrained Decoding）**

- 模型在生成时，工具名称从预定义的函数列表中通过 **分类器 / logit bias / 受限采样** 方式选取。
- 参数部分强制按 JSON Schema 约束生成，部分框架使用 grammar-based decoding（如 GBNF、outlines）保证格式合法。

**（3）解析与执行**

- API 返回格式标记为 `tool_calls`（而非普通 `content`）。
- 宿主程序解析 `tool_calls`，调用对应工具函数。
- 将工具返回结果以 `tool_message` 格式注入上下文。

**（4）多轮迭代**

- 模型收到工具结果后，可选择继续调用其他工具或直接回答用户。
- 支持多工具链式调用和并行调用。

### 底层关键技术

| 技术 | 说明 |
|------|------|
| JSON Schema 约束 | 定义工具的输入结构，模型据此生成参数 |
| Logit Bias / Logit Masking | 限制模型只能在指定工具名中选择 |
| Grammar-based Decoding | 强制生成符合指定语法的输出（JSON Schema -> Grammar） |
| Token-level 分类 | 部分实现在关键决策点做工具选择分类 |
| 结构化输出解析 | 自动从模型输出中提取 tool_call ID、function name、arguments |

### 参考回答

> Function Calling 的底层是受控的结构化文本生成。首先将工具定义（名称、描述、参数的 JSON Schema）注入 System Prompt；模型在推理时，通过 JSON Schema 约束的解码策略，输出结构化的调用请求（包含工具名和参数）；宿主程序解析后执行对应函数，将结果以 tool_message 回注到上下文；模型根据结果继续生成或发起下一轮调用。关键技术包括 JSON Schema 约束解码、logit masking、grammar-based decoding 以及多轮上下文管理。

---

## 3. Function Calling 和 MCP（Model Context Protocol）的核心区别是什么？

### 对比维度

| 维度 | Function Calling | MCP |
|------|-----------------|-----|
| **定位** | 单次模型推理中的工具调用机制 | 标准化的工具/资源连接协议 |
| **通信方式** | 模型 API 内部的协议（HTTP 调用） | 独立的进程间通信协议（stdio / HTTP SSE） |
| **工具管理** | 工具定义内嵌在 API 请求中 | 工具由独立 MCP Server 管理，动态发现 |
| **复用性** | 耦合在特定模型 API 中 | 跨模型、跨平台、跨语言通用 |
| **连接模式** | 1 对 1（模型 -> 工具代码） | 1 对 N（Client -> 多个 MCP Server） |
| **能力范围** | 仅限工具调用 | 工具 + 资源 + Prompts + Sampling + Roots |
| **标准化程度** | 各厂商有自己的格式（OpenAI / Anthropic 不完全兼容） | 标准化协议，统一格式 |
| **生命周期** | 请求级别（无状态） | 可保持长连接、状态管理 |

### 核心区别一句话总结

> **Function Calling 是"怎么调用"的机制，MCP 是"怎么连接和管理"的协议。**
>
> Function Calling 解决的是模型如何结构化地发起一次工具调用；MCP 解决的是如何将模型生态中的工具、资源、提示词等能力以标准化的方式暴露和集成。

### 参考回答

> Function Calling 是模型 API 层面的工具调用机制，关注的是模型如何在单次请求中结构化地输出工具调用指令。MCP 是一个独立的标准协议，关注的是如何将工具、资源、Prompts 等能力以标准化的进程间通信方式暴露给模型客户端。简单说：Function Calling 解决"模型如何调用"，MCP 解决"生态如何连接"。MCP 可以看作是对 Function Calling 的补充和上层封装，MCP Server 内部仍然需要通过 Function Calling 来让模型发起调用。

---

## 4. MCP 五种 primitive（Tools / Resources / Prompts / Sampling / Roots）分别是什么？

### 详细说明

**（1）Tools（工具）**

- **定义**：模型可以主动调用的函数/操作，类似 Function Calling 的工具。
- **方向**：Server -> Client（Server 暴露工具，Client/模型调用）。
- **协议方法**：`tools/list`（列出可用工具）、`tools/call`（调用指定工具）。
- **典型场景**：搜索、数据库查询、API 调用、文件操作等。
- **特点**：支持输入参数（JSON Schema），返回结构化结果。

**（2）Resources（资源）**

- **定义**：模型可以读取的数据内容，如文件、数据库记录、网页内容。
- **方向**：Server -> Client（Server 提供资源，Client/模型读取）。
- **协议方法**：`resources/list`、`resources/read`、`resources/templates`。
- **典型场景**：读取本地文件、访问数据库记录、加载知识库内容。
- **特点**：类似 "URL" 的概念，通过 URI 引用，支持 MIME 类型，可主动推送更新（`resources/subscribe`）。

**（3）Prompts（提示词）**

- **定义**：Server 端预定义的提示词模板，供 Client 快速组装上下文。
- **方向**：Server -> Client（Server 定义模板，Client 使用）。
- **协议方法**：`prompts/list`、`prompts/get`。
- **典型场景**：代码审查模板、摘要模板、分析模板。
- **特点**：支持参数化，可组合多个提示词，减少 Client 端硬编码。

**（4）Sampling（采样）**

- **定义**：Server 请求 Client（模型）进行推理/生成。
- **方向**：Server -> Client -> Server（Server 发起采样请求，Client 调用模型，返回结果给 Server）。
- **协议方法**：`sampling/createMessage`。
- **典型场景**：MCP Server 内部需要做 AI 判断时（如智能过滤、分类），委托 Client 侧的模型完成。
- **特点**：这是**唯一从 Server 到 Client 的反向调用**，让 Server 可以利用 Client 的模型能力。

**（5）Roots（根目录）**

- **定义**：Client 告知 Server 哪些文件系统路径是"可访问的范围"。
- **方向**：Client -> Server（Client 声明根路径）。
- **协议方法**：`roots/list`、`notifications/roots/list_changed`。
- **典型场景**：IDE 插件告知 Server 当前项目的根目录，限制资源访问范围。
- **特点**：本质是**权限边界声明**，帮助 Server 知道可以操作哪些路径。

### 参考回答

> MCP 的五种 primitive 分别是：
>
> 1. **Tools**：Server 暴露的可调用操作，模型通过 Function Calling 发起调用，对应 tools/list 和 tools/call。
> 2. **Resources**：Server 提供的可读数据源，通过 URI 引用，支持订阅更新，对应 resources/list 和 resources/read。
> 3. **Prompts**：Server 端预定义的提示词模板，支持参数化，Client 可直接调用组装上下文。
> 4. **Sampling**：唯一从 Server 到 Client 的反向调用，Server 委托 Client 的模型进行推理生成。
> 5. **Roots**：Client 声明的文件系统根路径，定义 Server 的访问权限边界。
>
> 前三种（Tools/Resources/Prompts）是 Server 向 Client 暴露能力，Sampling 是 Server 向 Client 请求能力，Roots 是 Client 向 Server 声明范围。

---

## 5. MCP 的 Client-Host-Server 架构是怎样的？

### 架构图

```
┌─────────────────────────────────────────────────┐
│                   User / IDE                     │
├─────────────────────────────────────────────────┤
│                  MCP Host                        │
│  （IDE 扩展、桌面应用、Chat 应用等）               │
│  - 管理多个 MCP Client                           │
│  - 用户交互界面                                   │
│  - 上下文管理                                    │
├─────────────────────────────────────────────────┤
│                MCP Client(s)                     │
│  - 维护与 MCP Server 的独立连接                    │
│  - 协议协商（初始化、能力交换）                     │
│  - JSON-RPC 消息收发                              │
├──────────────┬──────────────────┬───────────────┤
│   stdio      │    HTTP/SSE      │    stdio       │
├──────────────┼──────────────────┼───────────────┤
│  MCP Server  │   MCP Server     │  MCP Server   │
│  (文件系统)   │   (数据库)        │  (搜索服务)    │
└──────────────┴──────────────────┴───────────────┘
```

### 三层角色

**（1）MCP Server**

- 实际提供工具、资源、Prompts 的服务进程。
- 每个 Server 专注于一个领域（文件系统、数据库、GitHub、Slack 等）。
- 通过 **stdio** 或 **HTTP + SSE** 与 Client 通信。
- 声明自己支持的 capabilities（`serverInfo`、`capabilities`）。

**（2）MCP Client**

- 与 Server 建立和管理一对一的连接。
- 处理 JSON-RPC 协议消息的发送和接收。
- 负责初始化握手、能力协商。
- 一个 Client 只连接一个 Server，保证隔离性。

**（3）MCP Host**

- 面向用户的应用层（IDE 插件、桌面应用、Web 应用）。
- 管理多个 MCP Client（即连接多个 MCP Server）。
- 负责将模型的工具调用路由到正确的 Client -> Server。
- 管理用户授权（同意哪些 Server 连接、授权哪些 Roots）。

### 通信协议

- 基于 **JSON-RPC 2.0**，所有消息都是 JSON 格式。
- 传输层支持：
  - **stdio**：本地进程通信，适合本地工具。
  - **HTTP + SSE**：远程服务通信，支持流式传输。
- 初始化流程：Client 发送 `initialize` -> Server 返回 capabilities -> Client 发送 `initialized` 确认。

### 参考回答

> MCP 采用三层架构：MCP Server 是实际提供工具/资源/提示词的服务进程，每个 Server 专注一个领域；MCP Client 与 Server 建立一对一的连接，处理 JSON-RPC 协议消息；MCP Host 是面向用户的应用层，管理多个 Client 并将模型的工具调用路由到正确的 Server。通信基于 JSON-RPC 2.0，传输层支持 stdio（本地）和 HTTP+SSE（远程）。这种架构的优势是：Server 高度解耦可复用，Client 隔离保证安全，Host 统一管理用户体验。

---

## 6. A2A 协议和 MCP 的区别是什么？各自解决什么问题？

### A2A（Agent-to-Agent）协议

- **定义**：Google 提出的 Agent 间通信协议，用于不同 Agent 之间的互操作。
- **核心概念**：Agent Card（Agent 的能力描述）、Task（任务生命周期）、Message（消息传递）。
- **通信模式**：Agent A 发现 Agent B 的能力 -> 发起任务 -> 异步/同步获取结果。
- **解决的问题**：多个独立 Agent 之间的协作和任务委派。

### MCP（Model Context Protocol）

- **定义**：Anthropic 提出的模型与工具/资源的连接协议。
- **核心概念**：Tools、Resources、Prompts、Sampling、Roots。
- **通信模式**：Client 连接 Server，直接调用工具、读取资源。
- **解决的问题**：模型如何标准化地访问外部工具和数据源。

### 对比表

| 维度 | MCP | A2A |
|------|-----|-----|
| **提出方** | Anthropic | Google |
| **通信主体** | 模型 <-> 工具/资源 | Agent <-> Agent |
| **抽象层级** | 能力/接口级 | 任务/工作流级 |
| **粒度** | 细粒度（单个工具调用） | 粗粒度（完整任务委托） |
| **连接方式** | 长连接（stdio/HTTP） | HTTP（RESTful） |
| **核心场景** | 单个 Agent 的能力扩展 | 多 Agent 协作 |
| **生命周期** | 连接级 | 任务级（有明确状态机） |
| **发现机制** | Client 连接时自动发现 | Agent Card 注册/发现 |

### 类比

> - **MCP 像 USB 协议**：标准化接口，让模型这个"主机"可以插上各种"外设"（工具）。
> - **A2A 像网络协议**：标准化通信，让不同的"Agent"这个"独立个体"可以互相发请求、委派任务。

### 参考回答

> MCP 和 A2A 解决的是不同层面的问题。MCP 解决的是"模型如何标准化地连接和调用外部工具/资源"，关注的是单个 Agent 内部的能力扩展，类似 USB 协议，让模型可以即插即用地使用各种工具。A2A 解决的是"不同 Agent 之间如何通信和协作"，关注的是多 Agent 系统中的任务委派和工作流编排，类似微服务间的 RPC 协议。两者互补：一个 Agent 内部用 MCP 扩展能力，多个 Agent 之间用 A2A 进行协作。

---

## 7. 工具调用率核心提高了 15%，依赖的是什么手段？

> 注：这是一道典型的"追问式"面试题，需要结合实际项目经验回答。以下是常见的有效手段。

### 提升工具调用率的核心手段

**（1）优化 System Prompt 和工具描述**

- 将工具描述从"功能性描述"改为"场景化描述"，加入触发条件示例。
- 增加"何时应该调用此工具"的明确指引。
- 使用 Few-shot examples 展示正确的调用时机。

**（2）强化微调数据质量**

- 收集更多高质量的工具调用示例数据。
- 增加"边界场景"数据（用户模糊表达但实际需要调工具的场景）。
- 使用 Chain-of-Thought 数据，让模型学会先推理再调用。

**（3）调整 tool_choice 策略**

- 从 `auto` 改为 `required`（在明确需要调用的场景中）。
- 使用条件式 tool_choice：根据意图分类结果动态选择策略。

**（4）意图分类前置**

- 在调用模型前，先用轻量分类器判断是否需要工具调用。
- 需要调用的请求强制使用 `tool_choice: required`。
- 不需要的走纯对话路径，减少误判。

**（5）Prompt 中的"思考链"引导**

- 在 System Prompt 中加入："在回答前，请先判断是否需要调用工具获取最新/准确信息"。
- 增加 ReAct 模式：Thought -> Action -> Observation -> Thought -> Answer。

**（6）后处理兜底**

- 对模型输出进行意图分析，发现"应该调用但未调用"的情况时自动触发重试。
- 使用规则/分类器对低置信度的结果做二次判断。

### 参考回答

> 工具调用率提升 15% 主要来自几个方面的综合优化：
>
> 1. **工具描述优化**：将工具描述从纯功能说明改为"场景+触发条件+示例"的结构化描述，让模型更容易匹配到调用时机。
> 2. **意图前置分类**：在调用大模型前增加一个轻量意图分类器，对明确需要工具的场景强制设置 tool_choice: required，减少了漏调。
> 3. **SFT 数据增强**：补充了大量边界场景的工具调用示例和 CoT 推理数据，特别是用户表达模糊但实际需要调工具的场景。
> 4. **Prompt 优化**：加入 ReAct 思考链引导，让模型先推理再决定是否调用。
>
> 其中意图前置分类贡献最大（约 8%），工具描述优化贡献约 4%，SFT 数据和 Prompt 优化贡献约 3%。

---

## 8. 意图不太明确的时候，Agent 显著调用的是什么？

### 典型行为

当用户意图不明确时，Agent 倾向于调用以下类型的工具：

**（1）搜索类工具**

- 通用搜索、知识库查询、FAQ 检索。
- 原因：搜索是"万能工具"，可以覆盖最广泛的意图。
- 模型行为：当不确定该做什么时，优先搜索相关信息来辅助判断。

**（2）意图澄清工具**

- 主动反问用户的工具。
- 部分 Agent 框架中内置了"多轮澄清"机制。

**（3）通用信息获取工具**

- 用户画像查询、上下文获取、历史对话检索。
- 目的：获取更多信息来缩小意图范围。

**（4）多路并行调用**

- 部分高级 Agent 会同时调用多个工具（如搜索 + 知识库 + 用户画像），综合多个结果后再判断。

### 技术原因

- **训练数据偏差**：SFT 数据中"搜索"类工具的调用示例最多，模型有先验偏好。
- **信息增益最大化**：搜索类工具能带来最大的信息增益，是"最安全的赌注"。
- **Prompt 引导**：如果 System Prompt 中搜索工具排在前面或描述更详细，模型倾向于选择它。

### 参考回答

> 当意图不明确时，Agent 最显著调用的是搜索类工具（通用搜索、知识库检索、FAQ 匹配）。原因有三：一是搜索是最通用的能力，可以覆盖大多数不确定的场景；二是训练数据中搜索类工具的示例最多，模型有先验偏好；三是搜索能带来最大的信息增益，是"最安全的策略"。此外，部分 Agent 会同时调用多路工具（搜索+画像+上下文）来综合判断，或者调用反问工具主动澄清用户意图。

---

## 9. 命中率是用什么指标来衡量的？有线上数据吗？

### 核心指标定义

**（1）工具调用命中率（Tool Call Hit Rate）**

$$
\text{命中率} = \frac{\text{正确调用工具的请求数}}{\text{应该调用工具的总请求数}}
$$

- 分子：人工标注或规则判定为"应该调用工具且模型确实调用了"的请求。
- 分母：所有"应该调用工具"的请求（包括模型正确调用和漏调的）。

**（2）工具选择准确率（Tool Selection Accuracy）**

$$
\text{选择准确率} = \frac{\text{选对工具的请求数}}{\text{发起工具调用的请求数}}
$$

- 衡量模型在发起调用时，是否选对了工具。

**（3）参数填充准确率（Parameter Filling Accuracy）**

$$
\text{参数准确率} = \frac{\text{参数填写正确的请求数}}{\text{发起工具调用的请求数}}
$$

- 字段级：每个参数是否正确填写。
- 请求级：所有参数都正确才算正确。

**（4）端到端成功率（End-to-End Success Rate）**

- 从工具调用到最终回答完整的成功率。
- 包含：调用成功 + 参数正确 + 结果利用正确 + 回答质量达标。

### 线上常用指标

| 指标 | 说明 | 典型值 |
|------|------|--------|
| 工具调用率 | 有工具调用的请求占比 | 20%~50% |
| 调用命中率 | 该调工具时调了的占比 | 75%~92% |
| 选择准确率 | 选对工具的占比 | 85%~96% |
| 参数准确率 | 参数填写正确的占比 | 80%~95% |
| 端到端成功率 | 完整链路成功的占比 | 70%~88% |
| 误调率 | 不该调却调了的占比 | 3%~10% |

### 数据采集方式

- **线上埋点**：记录每次请求的 tool_choice、实际调用、执行结果、最终回答。
- **离线评估集**：人工标注的标准测试集，定期回归测试。
- **用户反馈**：点赞/点踩、重新提问等隐式信号。
- **A/B 实验**：对比不同策略下的命中率变化。

### 参考回答

> 命中率主要通过三个层级来衡量：第一层是调用命中率，即该调用工具时模型是否调用了；第二层是工具选择准确率，即选的工具对不对；第三层是参数填充准确率，即参数填得对不对。线上还会追踪端到端成功率，即从调用到最终回答完整的成功率。数据采集通过线上埋点（记录每次调用的完整链路）和离线标注集（定期回归评估）结合。典型线上命中率在 85%~92% 区间，选择准确率 90%+，参数准确率 85%+。

---

## 10. 工具调用失败时，如何做重试和降级？

### 重试策略

**（1）自动重试（Automatic Retry）**

```
调用失败 → 检查错误类型 → 决定是否重试 → 重试（带退避策略） → 最多 N 次
```

- **指数退避（Exponential Backoff）**：第 1 次等 1s，第 2 次等 2s，第 3 次等 4s。
- **最大重试次数**：通常 2~3 次，避免无限循环。
- **错误分类重试**：
  - 网络超时 / 5xx 错误 → 重试。
  - 参数错误 / 4xx 错误 → 不重试，直接报错。
  - 工具不存在 → 不重试，降级。

**（2）模型感知重试（Model-Aware Retry）**

- 将错误信息返回给模型，让模型自行修正参数后重试。
- 示例：

```
模型：调用 search(city="北亰")
结果：错误，城市名不存在
模型收到错误 → 修正为 search(city="北京") → 再次调用
```

### 降级策略

**（1）工具降级**

- 主工具不可用 → 切换到备用工具。
- 示例：实时天气 API 挂了 → 使用缓存的天气数据 → 使用通用知识回答。

**（2）能力降级**

- 工具完全不可用 → 模型用自身知识回答，并标注"信息可能不是最新的"。

**（3）功能降级**

- 多步骤工具链中某步失败 → 跳过该步骤，用已有信息继续。

**（4）超时降级**

- 工具调用超过阈值时间 → 中断调用，使用降级方案。

### 实现框架示例

```python
class ToolCallManager:
    def execute_with_retry(self, tool_call, max_retries=3):
        for attempt in range(max_retries):
            try:
                result = tool_call.execute(timeout=5.0)
                return result
            except NetworkError:
                if attempt < max_retries - 1:
                    time.sleep(2 ** attempt)  # 指数退避
                    continue
            except ParameterError as e:
                # 返回错误给模型，让模型修正
                return self.return_error_to_model(e)
            except ToolNotFoundError:
                return self.fallback(tool_call)

        # 所有重试失败，走降级
        return self.fallback(tool_call)

    def fallback(self, tool_call):
        """降级策略"""
        backup = self.get_backup_tool(tool_call)
        if backup:
            return backup.execute(tool_call.args)
        return self.use_model_knowledge(tool_call)
```

### 参考回答

> 工具调用失败的处理分重试和降级两层。重试方面：对网络超时等暂时性错误做指数退避重试（2~3 次）；对参数错误等确定性错误不重试，而是把错误信息返回给模型让其修正参数；工具不存在则直接降级。降级方面：优先使用备用工具，其次使用缓存数据，最后用模型自身知识兜底并提示用户信息可能不是最新的。超时场景下直接中断并走降级流程。整体原则是：能重试的自动重试，不能重试的快速降级，不让用户感知到长时间等待。

---

## 11. 如何评估 Function Calling 的准确率？

### 评估维度

**（1）意图识别准确率（Intent Detection）**

- 该调用工具的场景，模型是否识别为需要调用。
- 评估集：人工标注的"应该调用" vs "不应该调用"的样本。
- 指标：Precision / Recall / F1。

**（2）工具选择准确率（Tool Selection）**

- 模型选择的工具是否为正确工具。
- 多工具场景下，选择顺序是否合理。
- 指标：Top-1 Accuracy、Top-K Accuracy。

**（3）参数填充准确率（Parameter Extraction）**

- 必填参数是否都填了。
- 参数值是否正确（类型、格式、语义）。
- 指标：
  - Slot Filling F1（字段级）。
  - Request-level Accuracy（全对才算对）。

**（4）调用时机准确率（Timing Accuracy）**

- 模型是否在正确的轮次发起调用。
- 是否过早调用（信息不足）或过晚调用（多余操作）。

**（5）端到端准确率（End-to-End）**

- 工具调用 + 结果利用 + 最终回答质量的综合评估。
- 需要人工评估或 LLM-as-a-Judge。

### 评估方法

| 方法 | 说明 | 优点 | 缺点 |
|------|------|------|------|
| 人工标注评估 | 构建标准测试集，人工逐条评估 | 最准确 | 成本高 |
| LLM-as-a-Judge | 用强模型自动评估 | 可扩展 | 有偏差 |
| 线上 A/B 测试 | 对比不同版本的线上表现 | 真实 | 周期长 |
| 规则匹配 | 用正则/规则判断参数是否正确 | 快速 | 覆盖有限 |
| 回放测试 | 用线上日志回放到新模型 | 真实数据 | 需要基建 |

### 评估集构建要点

- 覆盖常见场景和边界场景。
- 包含单工具和多工具调用。
- 包含参数缺失、歧义、冲突等复杂情况。
- 定期更新以覆盖新上线的工具。
- 建议规模：核心场景 500~2000 条，全量场景 5000+ 条。

### 参考回答

> Function Calling 的评估需要从多个维度展开：意图识别层面看该不该调用（Precision/Recall/F1）；工具选择层面看选得对不对（Top-1/Top-K Accuracy）；参数填充层面看填得对不对（Slot Filling F1 和 Request-level Accuracy）；调用时机层面看是否在正确的轮次调用；端到端层面看从调用到回答完整的成功率。评估方法上，以人工标注的标准测试集为主（500~2000 条核心场景），辅以 LLM-as-a-Judge 自动化评估和线上 A/B 实验。关键是要覆盖边界场景和多工具组合场景。

---

## 12. 如何让大模型生产合法的 JSON？（Function Calling 输出格式保证）

### 方法层级（从弱到强）

**（1）Prompt 层面**

- 在 System Prompt 中明确要求输出 JSON 格式。
- 提供 JSON Schema 作为格式参考。
- 使用 Few-shot examples 展示正确格式。

```
请严格按照以下 JSON Schema 格式输出：
{
  "type": "object",
  "properties": {
    "city": {"type": "string"}
  },
  "required": ["city"]
}
不要输出任何其他内容。
```

**（2）API 参数层面**

- OpenAI 的 `response_format: { "type": "json_object" }`。
- Anthropic 的 `tool_use` block 格式。
- 强制模型输出符合 JSON 格式。

**（3）后处理层面**

- 自动修复常见 JSON 错误（尾逗号、未闭合引号等）。
- 使用 JSON 解析库尝试多种修复策略。

```python
import json
import re

def fix_json(text):
    # 移除 markdown 代码块标记
    text = re.sub(r'^```json\s*', '', text)
    text = re.sub(r'\s*```$', '', text)
    # 尝试解析
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        # 自动修复策略
        # 移除尾逗号
        text = re.sub(r',\s*}', '}', text)
        text = re.sub(r',\s*]', ']', text)
        return json.loads(text)
```

**（4）Grammar-based Constrained Decoding（最强保障）**

- 将 JSON Schema 转换为 Grammar（如 GBNF、LLBNF）。
- 在解码阶段，限制模型只能生成符合 Grammar 的 token。
- 工具库：`outlines`、`guidance`、`lm-format-enforcer`、`instructor`。

```python
import outlines
import json

schema = {
    "type": "object",
    "properties": {"city": {"type": "string"}},
    "required": ["city"]
}

# 使用 outlines 强制按 JSON Schema 生成
model = outlines.models.transformers("model_name")
generator = outlines.generate.json(model, schema)
result = generator("查询北京的天气")
# 保证输出是合法的 JSON 且符合 Schema
```

**（5）Token-level Masking**

- 在关键位置（如 `{"`、`"city":`）限制可选择的 token 集合。
- 部分厂商 API 内部已实现此机制。

### 方法对比

| 方法 | 合法性保证 | 性能开销 | 实施难度 |
|------|-----------|---------|---------|
| Prompt 约束 | 弱（模型可能不遵守） | 无 | 低 |
| API response_format | 中（格式保证，Schema 不保证） | 无 | 低 |
| 后处理修复 | 中（只能修复简单错误） | 低 | 中 |
| Grammar Decoding | **强（100% 合法）** | 中（解码稍慢） | 中 |
| Token Masking | **强（100% 合法）** | 低 | 高 |

### 参考回答

> 保证模型输出合法 JSON 有多个层级的方法：最弱的是 Prompt 约束，靠模型自觉遵守，可靠性有限；中等是 API 的 response_format 参数和后处理修复，能解决大部分问题但仍有边界情况；最强的是 Grammar-based Constrained Decoding，将 JSON Schema 转成文法，在解码阶段限制模型只能输出合法的 token，保证 100% 合法，常用工具包括 outlines、guidance、lm-format-enforcer。生产环境通常采用组合策略：Grammar Decoding 保证格式 + 后处理兜底 + 重试机制。

---

## 13. tool_choice 参数有哪几种模式？各自适用什么场景？

### OpenAI 格式的 tool_choice

**（1）`auto`（默认）**

- **行为**：模型自行决定是否调用工具，可以不调用。
- **适用场景**：
  - 混合场景（部分请求需要工具，部分不需要）。
  - 通用对话 + 工具调用混合。
  - 不确定用户意图时。
- **风险**：可能漏调（该调用时没调用）或误调（不该调用时调用了）。

**（2）`required` / `any`（强制调用）**

- **行为**：模型必须调用至少一个工具。
- **适用场景**：
  - 明确知道当前请求需要工具调用。
  - 意图分类器判定需要工具后。
  - 专用工具场景（如天气查询机器人）。
- **风险**：模型可能强行调用不合适的工具。

**（3）指定具体工具 `{"type": "function", "function": {"name": "get_weather"}}`**

- **行为**：模型必须调用指定的工具。
- **适用场景**：
  - 明确知道需要调用哪个具体工具。
  - 多轮对话中的固定流程。
  - 工具链编排中强制使用特定工具。
- **风险**：灵活性最低，不适用于需要模型判断的场景。

**（4）`none`（不调用）**

- **行为**：模型不能调用任何工具。
- **适用场景**：
  - 纯对话场景。
  - 不需要工具的业务流程。
  - 降级回退时使用。
- **注意**：OpenAI 较新版本中已较少使用，通常直接不传 tools 即可。

### 动态策略建议

```python
def get_tool_choice(intent_result):
    if intent_result == "need_tool":
        return "required"          # 明确需要 -> 强制调用
    elif intent_result == "specific_tool":
        return {"type": "function", "function": {"name": target_tool}}  # 指定工具
    elif intent_result == "conversation":
        return "none"              # 纯对话 -> 不调用
    else:
        return "auto"              # 不确定 -> 让模型决定
```

### 参考回答

> tool_choice 主要有四种模式：
>
> 1. **auto**（默认）：模型自行决定是否调用，适用于混合场景，但可能漏调或误调。
> 2. **required**：强制模型必须调用至少一个工具，适用于意图明确需要工具的场景。
> 3. **指定工具**：强制调用某个具体工具，适用于确定的工具链编排。
> 4. **none**：禁止调用任何工具，适用于纯对话场景。
>
> 生产环境最佳实践是：先用意图分类器判断意图类型，再动态选择 tool_choice 策略。明确需要工具时用 required，不确定时用 auto，纯对话时用 none 或不传 tools。这样可以在灵活性和可控性之间取得平衡。

---
