# Module 1 - Prompt / LLM 原理类 - 面试题解答

> 生成日期：2026-05-02 | 共 12 题

---

## Q1：Transformer 的 Self-Attention 是怎么算的？为什么要除以根号 d_k？

### 考察点
候选人是否真正理解 Self-Attention 的数学本质和梯度稳定性设计动机，而非仅背诵公式。

### 解答思路
1. 从线性代数角度拆解 Self-Attention 的计算步骤（Q/K/V 生成 -> 点积 -> Softmax -> 加权求和）。
2. 重点解释缩放因子 `1/sqrt(d_k)` 的统计学意义：点积方差随维度增长导致 Softmax 梯度消失。
3. 给出直观的数量级示例，说明不缩放的后果。

### 参考答案

**Self-Attention 计算步骤：**

给定输入序列 X（shape: `[seq_len, d_model]`），通过三个可学习线性投影矩阵得到 Query、Key、Value：

```
Q = X @ W_Q    # shape: [seq_len, d_k]
K = X @ W_K    # shape: [seq_len, d_k]
V = X @ W_V    # shape: [seq_len, d_v]
```

注意力分数矩阵：

```
scores = Q @ K^T / sqrt(d_k)    # shape: [seq_len, seq_len]
attention_weights = softmax(scores, dim=-1)
output = attention_weights @ V
```

**为什么要除以 `sqrt(d_k)`：**

核心原因是防止 Softmax 进入梯度消失区域。假设 Q 和 K 的每个元素是均值为 0、方差为 1 的独立随机变量，则它们的点积 `q · k = sum(q_i * k_i)` 的期望为 0，方差为 `d_k`。当 `d_k` 较大时（如 64），点积的 std 约为 `sqrt(64) = 8`，导致 scores 分布很宽。

不缩放时，Softmax 会把大的正数放大到接近 1，负数压缩到接近 0，输出变成接近 one-hot 的极值分布，反向传播时梯度接近 0。除以 `sqrt(d_k)` 后，scores 的方差被重新归一化为 1，Softmax 的输入分布回到梯度敏感区域。

```python
# PyTorch 等价实现（scaled_dot_product_attention）
def attention(Q, K, V):
    d_k = Q.size(-1)
    scores = torch.matmul(Q, K.transpose(-2, -1)) / math.sqrt(d_k)
    attn_weights = F.softmax(scores, dim=-1)
    return torch.matmul(attn_weights, V)
```

**加分项：** 提到 Flash Attention 通过 IO-aware 分块计算在不改变数学结果的前提下优化了内存访问；提到现代实现中 `sqrt(d_k)` 已被 fuse 到 QK^T 的 matmul kernel 内部（如 cuDNN 的 `math_type = CUDNN_math_type` 参数）；指出当使用 QK 归一化（QK-norm）时，缩放因子的重要性会下降。

---

## Q2：Pre-Norm 和 Post-NNorm 哪个训练更稳定，为什么？

### 考察点
对 Transformer 训练动态和梯度传播机制的深层理解，以及实际训练中的坑点经验。

### 解答思路
1. 先给出两种结构的公式定义和残差连接中的位置差异。
2. 从梯度传播路径分析 Pre-Norm 为什么更稳定（残差恒等映射在前）。
3. 补充 Post-Norm 的优势（表示能力更强）和混合方案的实践。

### 参考答案

**结构定义：**

| 维度 | Post-Norm（原始 Transformer） | Pre-Norm |
|------|-------------------------------|----------|
| 公式 | `x = x + Sublayer(LN(x))` | `x = x + Sublayer(LN(x))` |
| 位置 | LN 在残差**之后**、下一个子层**之前** | LN 在残差**之前**、子层**之前** |
| 实际写法 | `x = LN(x + Sublayer(x))` | `x = x + Sublayer(LN(x))` |

**Pre-Norm 训练更稳定，原因：**

1. **梯度传播路径更短**。Pre-Norm 中，残差连接是纯恒等映射 `x + f(LN(x))`，梯度可以通过残差直接回传到浅层，等效于一条"高速公路"。Post-Norm 中，梯度必须经过 LN 的变换才能到达残差，增加了非线性变换层数，深层网络容易梯度消失。

2. **初始化时的行为**。Pre-Norm 在训练初始阶段，子层输出接近 0（权重初始化为小值），所以 `x + Sublayer(LN(x)) ≈ x`，前向输出和输入几乎相同，网络从恒等映射开始训练，非常稳定。Post-Norm 初始时没有这个保证。

3. **经验法则**。Post-Norm 通常需要 warmup 和精心调参才能收敛到 100+ 层；Pre-Norm 即使不 warmup 也能稳定训练极深网络。

**Post-Norm 的优势：** 表示能力更强，最终收敛质量通常略好（LN 放在最后起到全局归一化作用），但对超参数敏感。

**生产实践：** LLaMA / GPT 系列采用 Pre-Norm；GPT-3 使用 Pre-LN 配合 small residual initialization（将残差分支的最后一层初始化为 0），进一步提升了 Pre-Norm 的最终表示质量。

```python
# Pre-Norm 残差块
class PreNormBlock(nn.Module):
    def __init__(self, dim, sublayer):
        self.norm = nn.LayerNorm(dim)
        self.sublayer = sublayer

    def forward(self, x):
        return x + self.sublayer(self.norm(x))  # LN 在 sublayer 前
```

**加分项：** 提到 GPT-3 的 "small residual initialization"（将残差分支最后一层乘以 `1/sqrt(N_layers)`）弥补了 Pre-Norm 表示能力的不足；提到 DeepNet 提出的 Post-LN + 缩放残差的方案；指出 LLaMA 3 采用 RMSNorm 替代 LayerNorm 提升计算效率。

---

## Q3：RLHF 的训练流程是什么？

### 考察点
对对齐训练全链路的理解程度，包括数据、模型、优化方法的串联。

### 解答思路
1. 分阶段讲解：SFT -> Reward Model 训练 -> RL 优化（PPO/DPO）。
2. 每阶段说明输入数据、训练目标、输出产物。
3. 补充主流变体（DPO、ORPO）的对比。

### 参考答案

**RLHF 三阶段流程：**

**阶段 1：SFT（Supervised Fine-Tuning）**
- 输入：高质量的 prompt-response 对（人工标注或精选数据）
- 目标：用监督学习微调基座模型，使其学会遵循指令的格式
- 输出：一个能生成合规回答的 SFT 模型

**阶段 2：Reward Model（RM）训练**
- 输入：对同一 prompt 的多个回答，由人工标注偏好排序（chosen > rejected）
- 目标：训练一个打分模型，输出标量 reward，使得 `R(chosen) > R(rejected)`
- 损失函数：Pairwise ranking loss（Bradley-Terry 模型）
```
L_RM = -log(σ(r_chosen - r_rejected))
```
- 输出：Reward Model，用于替代人工标注自动打分

**阶段 3：RL 优化（PPO / DPO）**
- 用 PPO：SFT 模型作为 Policy，RM 作为环境奖励信号，通过 Proximal Policy Optimization 优化策略。引入 KL penalty 防止偏离 SFT 模型太远。
```
reward = R(y|x) - β * KL(π(y|x) || π_SFT(y|x))
```
- 用 DPO（Direct Preference Optimization）：跳过独立的 Reward Model，直接从偏好数据优化 Policy，将奖励建模和策略优化合并为一个步骤，数学上等价于隐式训练 RM 再做 RL。

**主流替代方案对比：**

| 方法 | 是否需要 RM | 计算量 | 稳定性 | 适用场景 |
|------|------------|--------|--------|----------|
| PPO | 是 | 高（4 个模型同时加载） | 中等，需要精细调参 | 资源充足，追求上限 |
| DPO | 否 | 中（2 个模型） | 高 | 工业主流首选 |
| ORPO | 否 | 低（1 个模型） | 高 | 合并 SFT + 对齐一步完成 |
| KTO | 否 | 低 | 高 | 只有单侧标注数据时 |

**生产经验：** PPO 的调参难度很高（learning rate 需要 ~1e-6 量级，KL coefficient 需要动态调整），大多数团队已转向 DPO。DPO 的 beta 参数通常设为 0.1~0.5，过大导致模型输出过于保守。

**加分项：** 提到 REINFORCE 作为 PPO 的轻量替代；提到 RLVR（Reinforcement Learning from Verifiable Rewards）在数学/code 领域的成功应用；提到 GRPO（Group Relative Policy Optimization）无需 Reward Model，通过组内相对排名优化；指出 RLHF 的数据质量远比算法选择重要。

---

## Q4：大模型的幻觉问题怎么缓解？

### 考察点
候选人是否具备生产环境处理 LLM 幻觉的系统性思维，能否从多个层面组合方案。

### 解答思路
1. 先定义幻觉的类型（事实性幻觉 vs 忠实性幻觉）。
2. 从训练时 / 推理时 / 系统层三个维度展开方案。
3. 强调"没有银弹"，需要多层防御体系。

### 参考答案

**幻觉类型：**
- **事实性幻觉**：模型生成与客观事实不符的内容（如编造历史事件、虚构论文引用）
- **忠实性幻觉**：模型的输出与用户指令不一致（如答非所问、忽略约束条件）

**缓解方案体系（按成本从低到高）：**

**推理时方案（不修改模型）：**
- **RAG（检索增强生成）**：从知识库检索相关文档，让模型基于检索结果回答。关键技巧包括 chunk 大小优化（200-500 tokens）、混合检索（BM25 + embedding）、重排序（cross-encoder re-ranker）。
- **Self-Consistency**：多次采样取多数投票，对推理任务有效。
- **Prompt 工程**：要求模型引用来源、标注置信度、输出 `I don't know` 选项。

**推理时方案（需额外模型）：**
- **Fact-Checking 模型**：用独立模型对生成内容进行事实核验。
- **Self-Correction / Self-Refine**：让模型对自己的输出进行审查和修改。

**训练时方案（需要微调）：**
- **SFT 阶段注入抗幻觉数据**：包含正确引用、拒绝回答等样本。
- **DPO/RLHF**：用偏好数据惩罚幻觉输出。
- **Knowledgable Adapter**：定期注入新知识，避免知识过时导致的幻觉。

**系统层方案：**
- **输出结构化约束**：用 JSON Schema / Grammar 约束输出格式，减少自由生成的幻觉空间。
- **置信度阈值**：对模型输出的 log-probs 进行监控，低置信度时回退到人工或规则系统。

**生产实践建议：** 首选 RAG + Prompt 约束 + 结构化输出，这三者组合可以解决 70%+ 的幻觉问题。只有在对准确性要求极高的场景（如医疗、金融）才需要投入训练时方案。

**加分项：** 提到 Self-RAG 框架（模型自己决定是否检索、何时检索）；提到 RAGAS / ARES 等幻觉评测框架；提到 Citation-augmented generation 和 Verifiable generation；指出"知识截止日期"本质上是训练数据的时间边界，不是幻觉。

---

## Q5：Decoder-only 结构为什么成为主流？和 Encoder-Decoder 比有什么优势？

### 考察点
对 Transformer 架构演进的宏观理解，以及架构选择对实际工程的影响。

### 解答思路
1. 简述三种 Transformer 变体的区别。
2. 从训练效率、推理模式、Scaling Law 角度分析。
3. 给出明确的取舍分析，不绝对化。

### 参考答案

**三种结构对比：**

| 维度 | Encoder-Decoder | Decoder-only | Encoder-only |
|------|----------------|--------------|--------------|
| 代表模型 | T5, BART | GPT, LLaMA | BERT |
| 注意力 | 双向 + Cross-Attention | 因果（单向） | 双向 |
| 预训练目标 | Denoising | Next-token prediction | Masked LM |
| 主要用途 | 序列到序列 | 文本生成 | 文本理解 |
| 推理开销 | 高（需要 encode + decode） | 中（纯 decode） | N/A |

**Decoder-only 成为主流的核心原因：**

1. **统一架构，训练简单**。只需要一种模型架构、一种训练流程（next-token prediction），不需要像 Encoder-Decoder 那样管理两套参数。Scaling 时只需要堆叠相同模块。

2. **推理天然适配自回归生成**。Decoder-only 的因果掩码（causal masking）使得每个 token 只依赖前面的 token，推理时 KV cache 可以复用，推理延迟和吞吐量可控。Encoder-Decoder 在推理时需要先跑完 encoder 再逐步 decode，KV cache 管理更复杂。

3. **Scaling Law 验证**。Kaplan et al. (2020) 和 Hoffmann et al. (2022) 的 Chinchilla Scaling Law 都是基于 Decoder-only 架构得出的，证明了在算力给定条件下，Decoder-only 的 loss 随规模单调下降。

4. **通用性出乎意料**。虽然 Encoder-Decoder 在翻译等 seq2seq 任务上理论更强，但 Decoder-only 通过适当的 prompt（如 "Translate English to French: ..."）也能达到接近的效果，加上 Instruct 微调后进一步缩小了差距。

5. **生态优势**。GPT 系列的成功带动了整个工具链（训练框架、推理框架、评测基准）围绕 Decoder-only 构建。

**Encoder-Decoder 仍有优势的场景：**
- 需要强双向理解的任务（如长文档摘要时 encoder 的 bidirectional attention 能更好地全局理解）
- 某些多模态场景（encoder 处理视觉信号，decoder 生成文本）

**生产建议：** 新项目默认选 Decoder-only。除非有明确的 seq2seq 需求且经过 benchmark 证明 Encoder-Decoder 效果更好。

**加分项：** 提到 PrefixLM（单向+双向混合，如 GLM/CodeBERT 的做法）；提到 U-Transformer（encoder-decoder 共享权重，节省参数）；指出 GPT-4 的确切架构未公开，但推测为 Decoder-only 变体；提到 Mamba/State-Space Models 作为自回归的替代架构正在挑战 Decoder-only 的地位。

---

## Q6：Claude 和 GPT 各自的优势是什么？

### 考察点
对主流模型的差异化能力有实际使用经验，能基于场景做技术选型。

### 解答思路
1. 避免主观偏好，从客观指标和功能特性对比。
2. 按典型使用场景分类讨论。
3. 给出选型的决策树。

### 参考答案

**Claude（Anthropic）的优势：**

1. **长上下文处理能力**。Claude 200K context window 的实际 recall 能力在 Needle-in-Haystack 测试中表现优于同级别 GPT 模型，尤其在 100K+ 长度时。
2. **安全性与对齐**。Constitutional AI 方法使得 Claude 在拒绝有害请求的同时不过度拒绝（refusal rate 更低），输出风格更自然。
3. **复杂指令遵循**。在多步骤任务、格式严格遵循（如 JSON output）方面表现更稳定。
4. **长文本写作和代码分析**。对长文档的理解和代码仓库的分析能力突出。
5. **价格竞争力**。Claude Haiku/Sonnet 的性价比在某些场景下优于 GPT-4o。

**GPT（OpenAI）的优势：**

1. **多模态原生支持**。GPT-4o 的 vision + audio 是端到端训练的，延迟更低，交互更自然。
2. **Function Calling / Tool Use**。工具调用的稳定性和格式一致性目前是行业标杆，支持并行调用。
3. **生态和集成**。OpenAI 的 API 生态最成熟，第三方工具（LangChain、LlamaIndex）最先适配，社区资源最丰富。
4. **结构化输出**。JSON Mode、structured outputs 功能完善，类型安全有保障。
5. **Agents SDK**。OpenAI Agents 框架为构建 Agent 提供了标准化方案。

**选型决策表：**

| 场景 | 推荐 | 理由 |
|------|------|------|
| 长文档分析/摘要 | Claude | 长上下文 recall 更好 |
| 代码生成 | 两者皆可 | GPT-4o 和 Claude Sonnet 编码能力接近 |
| 多模态（图片理解） | GPT-4o | 端到端训练，延迟更低 |
| 工具调用/Agent | GPT-4o | Function Calling 更稳定 |
| 严格格式输出 | Claude | 指令遵循更稳定 |
| 成本敏感 | 对比 Haiku vs GPT-4o-mini | 按具体 prompt 测试 |

**生产建议：** 不要锁定单一模型。用 LiteLLM / OpenRouter 等代理层做路由，根据任务类型自动选择最优模型。

**加分项：** 提到 Claude 的 Prompt Caching 对长 prompt 场景的成本优势（缓存命中后价格降 90%）；提到 GPT 的 `reasoning_effort` 参数和 o1/o3 的 Chain-of-Thought 推理能力；提到 Claude 的 tool use 已支持并行和动态 schema；指出模型能力差距在快速缩小，架构选择比模型选择更重要。

---

## Q7：LoRA 的核心思路是什么？数学公式 W' = W + BA 的含义？

### 考察点
对参数高效微调（PEFT）的数学理解和工程落地能力。

### 解答思路
1. 从低秩假设切入：模型微调时的权重变化是低秩的。
2. 解释 BA 分解的参数节省效果。
3. 给出实际代码，说明训练时和推理时的行为。

### 参考答案

**核心思路：**

大模型微调时，权重矩阵的变化量 `ΔW` 具有**低秩特性**——即有效的参数更新可以用一个低秩矩阵来近似。LoRA（Low-Rank Adaptation）冻结预训练权重 W，在旁边注入两个低秩矩阵 B 和 A 来学习 `ΔW`。

**数学公式：**

```
W' = W + ΔW = W + B @ A

W  ∈ R^(d×k)    # 原始权重（冻结）
B  ∈ R^(d×r)    # 低秩矩阵 B，r << d
A  ∈ R^(r×k)    # 低秩矩阵 A，r << k
```

前向传播时：
```
h = W'x = Wx + B(Ax)
```

**参数节省计算：**

假设 W 是 `[4096, 4096]` 的矩阵，r = 8：
- 原始参数量：`4096 × 4096 = 16,777,216`
- LoRA 参数量：`4096×8 + 8×4096 = 65,536`
- 节省比：`65,536 / 16,777,216 ≈ 0.39%`

**关键设计：**
- **A 初始化为 0，B 用随机高斯初始化**（或反过来），这样训练开始时 `BA = 0`，模型行为与预训练完全一致。
- **训练时只更新 B 和 A**，W 的梯度不计算（`requires_grad=False`）。
- **推理时可以合并**：`W_merged = W + BA`，不增加推理延迟。

**PyTorch 实现：**

```python
class LoRALayer(nn.Module):
    def __init__(self, in_dim, out_dim, rank, alpha):
        super().__init__()
        self.lora_A = nn.Parameter(torch.zeros(rank, in_dim))
        self.lora_B = nn.Parameter(torch.zeros(out_dim, rank))
        nn.init.kaiming_uniform_(self.lora_A)
        nn.init.zeros_(self.lora_B)
        self.scaling = alpha / rank

    def forward(self, x):
        return (self.lora_B @ self.lora_A) @ x * self.scaling
```

**加分项：** 提到 LoRA 的 `alpha` 参数控制学习率缩放（实际学习率 = `lr * alpha / rank`）；指出训练后可以 merge 权重而不增加推理开销，这是 LoRA 相比 Adapter/Prompt-Tuning 的最大优势；提到 LoRA 可以动态切换不同任务（换一组 BA 矩阵即可多路复用基座模型）。

---

## Q8：LoRA 的秩（rank）如何选择？对效果有什么影响？

### 考察点
对 LoRA 超参数的调优经验，以及在不同任务和数据规模下的选择策略。

### 解答思路
1. 给出 rank 对参数量、表达能力、过拟合风险的影响分析。
2. 按任务类型给出经验值。
3. 说明如何通过实验确定最优 rank。

### 参考答案

**Rank 的影响：**

| Rank 范围 | 可训练参数占比 | 表达能力 | 过拟合风险 | 适用场景 |
|-----------|--------------|----------|-----------|----------|
| r = 4-8 | < 0.5% | 低 | 低 | 简单指令跟随、风格迁移 |
| r = 16-32 | 0.5%-2% | 中 | 中 | 通用对话、代码生成 |
| r = 64-128 | 2%-5% | 高 | 较高 | 专业领域知识注入 |
| r = 256+ | 5%+ | 很高 | 高 | 接近全参微调的复杂任务 |

**选择策略：**

1. **从小 rank 开始**（r=8 或 r=16），如果验证集表现不足，逐步增大。大多数场景 r=16 已经足够。
2. **数据量越大，rank 可以越大**。1K 样本用 r=8 就够了；100K+ 样本可以尝试 r=64。
3. **任务复杂度**：风格迁移（r=4-8）< 指令跟随（r=8-16）< 领域知识注入（r=32-64）< 语言适配（r=64-128）。
4. **Alpha 的配合**：通常设 `alpha = 2 * rank` 或 `alpha = rank`。Alpha 越大，LoRA 的更新幅度越大。`alpha >> rank` 时 LoRA 近似于直接微调。

**实验验证方法：**

```python
# 扫 rank 的标准做法：固定其他超参数，只变 rank
ranks = [8, 16, 32, 64]
results = {}
for r in ranks:
    model = apply_lora(base_model, rank=r, alpha=r*2)
    results[r] = evaluate(model, val_dataset)

# 画出 rank vs performance 曲线，选择拐点
```

**生产经验陷阱：**
- Rank 不是越大越好。r 过大时 LoRA 退化为全参微调，失去 PEFT 的意义。
- 多任务 LoRA 需要更大的 rank 来容纳不同任务的知识。
- 如果全量微调效果 >> LoRA，说明任务的权重更新不是低秩的，需要考虑全参微调。

**加分项：** 提到 LoRA 的 rank 可以和不同的 target module 配合使用（如只加在 attention 层 vs 同时加在 FFN 层）；提到 AdaLoRA 可以根据重要性动态分配 rank；提到一些研究表明某些层的权重更新实际上是高秩的（如 embedding 层），单一 rank 可能不是最优的。

---

## Q9：QLoRA 和 LoRA 的区别？NF4 量化是什么？

### 考察点
对量化微调技术的理解，以及低成本微调方案的工程选型能力。

### 解答思路
1. 对比 LoRA 和 QLoRA 的完整训练流程差异。
2. 重点解释 NF4 量化相比传统量化的创新。
3. 给出具体的显存节省数据。

### 参考答案

**LoRA vs QLoRA：**

| 维度 | LoRA | QLoRA |
|------|------|-------|
| 基座权重精度 | FP16/BF16 | 4-bit (NF4) |
| 计算精度 | FP16/BF16 | BF16（计算时 dequantize） |
| LoRA 适配器精度 | FP16/BF16 | FP16/BF16（LoRA 分支不量化） |
| 显存占用（7B 模型） | ~28GB | ~8GB |
| 适用 GPU | A100 (40GB+) | RTX 4090 (24GB) 甚至单卡 16GB |
| 速度 | 快 | 稍慢（dequantize 开销） |
| 效果 | 略好 | 接近 LoRA（差距 < 1%） |

**QLoRA 的核心创新：**

QLoRA 在 LoRA 的基础上，将预训练基座权重量化到 4-bit，但 LoRA 适配器（B、A 矩阵）保持 FP16/BF16 精度。前向传播时，先将 4-bit 权重反量化到 BF16，再与 LoRA 的更新相加。

**NF4（NormalFloat 4-bit）量化：**

传统量化方法的问题：
- **均匀量化（Int4）**：假设权重均匀分布在 [-max, max]，但预训练权重实际是正态分布的，导致两端信息丢失。
- **FP4**：浮点量化比均匀量化好，但 FP4 的指数/尾数分配不一定最优。

NF4 的关键设计：
1. **信息论最优**：假设权重服从均值为 0 的正态分布，通过量化理论计算出 16 个量化级别的最优分割点（每个区间的概率质量相等），最大化每个 bit 的信息量。
2. **Double Quantization**：对量化常数本身再做一次量化，进一步节省内存。每个参数只需要 4.002 bits（而非标准 4 bits）。
3. **Paged Optimizers**：使用 NVIDIA 统一内存，将 optimizer states 分页到 CPU，避免 OOM。

```python
# bitsandbytes 中的 NF4 量化加载
from transformers import BitsAndBytesConfig

bnb_config = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_use_double_quant=True,    # 双重量化
    bnb_4bit_quant_type="nf4",         # NormalFloat 4-bit
    bnb_4bit_compute_dtype=torch.bfloat16  # 计算时反量化到这个精度
)

model = AutoModelForCausalLM.from_pretrained(
    "meta-llama/Llama-3-8B",
    quantization_config=bnb_config
)
```

**生产经验：** QLoRA 的精度损失通常可以忽略（在 MMLU 上差距 < 0.5%），但对于对数值精度敏感的任务（如数学计算、代码执行），建议用 LoRA 而非 QLoRA。

**加分项：** 提到 NF4 的 16 个 quantization levels 是通过求解正态分布下的等概率区间得到的；提到 QLoRA 论文证明了 4-bit 量化 + LoRA 可以复现全量微调的效果；指出 bitsandbytes 库的 `bnb_4bit_compute_dtype` 可以选择 BF16（推荐，精度更高）或 FP16。

---

## Q10：全参数微调 vs LoRA vs QLoRA 的对比，各自适用什么场景？

### 考察点
能否根据业务场景、资源约束和质量要求做技术方案选型。

### 解答思路
1. 用对比表格给出全面的差异。
2. 按场景给出明确的推荐方案。
3. 补充混合方案和实际决策流程。

### 参考答案

**全面对比表：**

| 维度 | 全参数微调 (Full FT) | LoRA | QLoRA |
|------|---------------------|------|-------|
| **可训练参数** | 100% | 0.1%-5% | 0.1%-5%（基座 4-bit） |
| **单卡 7B 显存** | ~80GB+ (需多卡) | ~28GB | ~8GB |
| **训练速度** | 基准 | ~1.0-1.2x | ~0.8-1.0x |
| **效果上限** | 最高 | 90%-98% Full FT | 85%-95% Full FT |
| **推理开销** | 增加（新权重文件） | 0（可 merge） | 0（可 merge） |
| **存储开销** | 完整模型副本 (~14GB for 7B) | 适配器 (~10-50MB) | 适配器 (~10-50MB) |
| **灾难性遗忘** | 高风险 | 低 | 低 |
| **多任务支持** | 每个任务一个模型 | 单基座 + 多适配器 | 单基座 + 多适配器 |
| **训练数据需求** | 10K-100K+ | 1K-50K | 1K-50K |

**场景推荐：**

| 场景 | 推荐方案 | 理由 |
|------|---------|------|
| 有充足算力 + 追求极致效果 | 全参数微调 | 效果上限最高 |
| 通用指令微调 | LoRA (r=16-32) | 性价比最优 |
| 单卡/消费级 GPU | QLoRA | 显存门槛最低 |
| 多租户 SaaS 服务 | LoRA | 一个基座 + N 个适配器 |
| 领域知识注入（垂直行业） | 全参数微调 或 LoRA (r=64+) | 领域适配需要更多参数 |
| 快速实验/POC | QLoRA | 迭代速度最快 |
| 语言适配（中文化） | LoRA (r=64-128) | 需要较大 rank 学习新语言模式 |

**决策流程：**
```
资源受限（单卡 < 24GB）？
  是 -> QLoRA
  否 -> 需要多任务切换？
    是 -> LoRA（一个基座服务多任务）
    否 -> 数据量 > 50K 且追求极致效果？
      是 -> 全参数微调
      否 -> LoRA（r=16-32）
```

**加分项：** 提到 DoRA 可以作为 LoRA 的升级版在同等资源下获得更好效果；提到全参微调时可以用 LoRA 做 warmup 再放开全量参数；指出在实际生产中，先用 QLoRA 快速验证数据 pipeline，确认有效后再升级到 LoRA/全参是常见策略。

---

## Q11：LoRA 应该应用到模型的哪些层？为什么？

### 考察点
对 Transformer 内部结构和工作机制的理解，以及对 PEFT 实际效果的经验。

### 解答思路
1. 列出 Transformer 的主要可注入层类型。
2. 从理论和实验两个角度分析各层的效果差异。
3. 给出生产实践中的默认配置。

### 参考答案

**可注入层类型：**

在标准的 Decoder-only Transformer 中，LoRA 可以注入以下模块：

| 模块 | 位置 | 矩阵形状 | 参数占比 |
|------|------|---------|---------|
| `q_proj` | Attention 的 Query 投影 | d_model × d_q | ~25% |
| `k_proj` | Attention 的 Key 投影 | d_model × d_k | ~25% |
| `v_proj` | Attention 的 Value 投影 | d_model × d_v | ~25% |
| `o_proj` | Attention 的 Output 投影 | d_v × d_model | ~25% |
| `gate_proj` | FFN 门控投影 | d_model × d_ff | ~33% |
| `up_proj` | FFN 上投影 | d_model × d_ff | ~33% |
| `down_proj` | FFN 下投影 | d_ff × d_model | ~33% |

（参数占比是相对于该层总参数量的相对值）

**效果分析（按优先级）：**

1. **Attention 层（q_proj + v_proj）**：这是 LoRA 最经典的注入位置。Attention 负责 token 间的信息路由和模式匹配，q 和 v 的变化对输出影响最大。大多数论文和库（peft、unsloth）的默认选择。

2. **全部 Attention 层（q, k, v, o）**：进一步覆盖 k 和 o 可以捕获更完整的注意力模式更新。实验显示比只用 q+v 有 1-3% 的提升，但参数增加约一倍。

3. **Attention + FFN 层**：加入 `gate_proj/up_proj/down_proj` 可以让 LoRA 修改模型的"知识表示"部分（FFN 被认为存储了事实性知识）。对领域知识注入和语言适配任务收益明显，但对简单指令跟随任务提升有限。

**PEFT 库的默认配置：**

```python
from peft import LoraConfig

# 最常用的配置（性价比最高）
config = LoraConfig(
    r=16,
    lora_alpha=32,
    target_modules=["q_proj", "v_proj"],  # 默认
    # target_modules=["q_proj", "k_proj", "v_proj", "o_proj",
    #                 "gate_proj", "up_proj", "down_proj"],  # 全量
    lora_dropout=0.05,
    bias="none",
    task_type="CAUSAL_LM"
)
```

**LLaMA 的特殊情况：** LLaMA 使用 RoPE（旋转位置编码），位置信息不在 attention score 中编码，因此 LoRA 对 attention 层的修改可以更专注于语义模式。

**生产建议：**
- **起步配置**：`target_modules=["q_proj", "v_proj"]`，r=16，覆盖 80% 的场景。
- **知识注入/语言适配**：加入 FFN 层（`["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"]`）。
- **显存紧张**：只用 `["q_proj", "v_proj"]`，减小 rank。

**加分项：** 提到 LORA-FA（Freeze A）只训练 B 矩阵进一步减少参数；提到 LoRA 在 embedding 层的应用效果不佳（高秩特性）；提到有研究表明对不同的层使用不同的 rank（AdaLoRA 的思路）可能比统一 rank 更优；指出 unsloth 通过只训练 q_proj 和 k_proj 实现了极致优化。

---

## Q12：DoRA 和 AdaLoRA 相比 LoRA 有什么改进？

### 考察点
对 LoRA 系列变体的演进脉络的理解，以及对前沿 PEFT 方法的跟踪。

### 解答思路
1. 先简述 LoRA 的两个核心局限。
2. 分别讲解 DoRA 和 AdaLoRA 如何针对这些局限改进。
3. 给出三者对比表和适用建议。

### 参考答案

**LoRA 的两个核心局限：**
1. 只学习权重变化的增量 `ΔW = BA`，但预训练权重的**幅值信息**（magnitude）和**方向信息**（direction）是耦合的，低秩约束同时影响了两者。
2. 对所有矩阵使用统一的 rank，但不同层/不同方向的重要性不同，统一 rank 可能浪费参数或不足。

**DoRA（Weight-Decomposed Low-Rank Adaptation）：**

核心思想：将预训练权重 W 分解为**幅值（magnitude）**和**方向（direction）**两部分，分别优化。

```
W' = m * (W / ||W||) + BA      # DoRA
     ^       ^          ^
     |       |          |
   幅值   预训练方向   低秩方向更新
```

具体公式：
```
W' = m * V / ||V||_c + BA
```
其中 `V = W`（初始），`m` 是可学习的标量向量，`||·||_c` 是按列的 L2 范数。

**改进效果：**
- 解耦幅值和方向，让 LoRA 专注于学习方向变化，幅值通过 `m` 独立调整
- 在相同 rank 下，效果比 LoRA 提升 1-3%
- 更接近全参数微调的效果
- 推理时可以完全 merge，零额外开销

**AdaLoRA（Adaptive Budget Allocation for LoRA）：**

核心思想：**不是所有权重矩阵都需要同样的 rank**。根据每个权重矩阵对任务的重要性，动态分配 rank 预算。

```
总参数量 = sum(r_i * (d_i + k_i))  对所有 layer i
```
重要性高的层分配更大的 r_i，重要性低的层分配更小的 r_i。

实现方式：用 SVD 形式的参数化 `ΔW = P Λ Q^T`，通过正则化自动缩减不重要方向的奇异值。

**改进效果：**
- 在相同总参数量下，效果比 LoRA 提升 1-2%
- 自动发现哪些层更需要微调（如 attention 层通常比 FFN 层需要更多 rank）
- 不需要手动调 rank

**三方案对比：**

| 维度 | LoRA | DoRA | AdaLoRA |
|------|------|------|---------|
| **核心改进** | 基准 | 幅值/方向解耦 | 动态 rank 分配 |
| **参数量** | 固定 | 多一个 m 向量（极小） | 动态但总量可控 |
| **效果** | 基准 | +1~3% vs LoRA | +1~2% vs LoRA |
| **超参数** | rank 需要手动调 | 同 LoRA | 总量预算（更直观） |
| **训练速度** | 基准 | ~0.95x（SVD 开销） | ~0.9x（SVD + 正则） |
| **推理 merge** | 支持 | 支持 | 支持 |
| **成熟度** | 非常成熟 | 较新（2024） | 较新（2023） |
| **库支持** | peft / unsloth | peft >= 0.10 | 实验性支持 |

**生产建议：**
- **默认选 LoRA**：成熟稳定，效果可预期。
- **追求效果但资源不变**：升级到 DoRA（只需改一行配置，`use_dora=True`）。
- **不想手动调 rank**：尝试 AdaLoRA，但要确认所用框架支持。

**加分项：** 提到 DoRA 的幅值向量 `m` 的维度等于输出维度（`d_model` 或 `d_ff`），额外参数量极小；提到 AdaLoRA 的奇异值裁剪本质上是一种 structured pruning；提到 PiSSA（Principal Singular values and Singular vectors Adaptation）通过初始化 BA 为 W 的主奇异向量/值来加速收敛；提到 VeRA（Vector-based Random Matrix Adaptation）用固定的随机矩阵 + 可学习向量，参数减少到 LoRA 的 0.01%。

---
