# 云端部署类 - 面试题解答

> 生成日期：2026-05-14

---

## Q1：vllm 的推理加速是怎么实现的？

### 考察点
考察候选人对 vLLM 核心优化机制的深入理解，重点判断候选人是否真正读过源码、在生产环境做过推理部署，还是仅停留在"性能好"的表面认知。

### 解答思路
1. 先讲清楚传统 LLM 推理的瓶颈在哪里（显存碎片化、低 GPU 利用率、KV Cache 静态分配浪费）。
2. 逐一展开 vLLM 的核心优化技术：PagedAttention 的起源与设计、Continuous Batching 的工作原理、CUDA Kernel 层面的融合算子，以及 Prefix Caching 和量化配合。
3. 结合生产经验说明综合效果（吞吐提升的量级、需要关注的配置项、踩过的坑）。

### 参考答案

vLLM 的推理加速是一个多层次的系统工程，最核心的五个技术点依次展开：

**1. PagedAttention（KV Cache 分块管理）**：传统方案为每个请求预分配一块连续的 KV Cache 显存，导致严重的显存碎片和浪费——一个请求实际用完释放后，剩下的碎片无法给其他请求使用。PagedAttention 借鉴操作系统虚拟内存的分页思想，将 KV Cache 切分为固定大小的 block（如 16 或 32 个 token 一块），按需动态分配。请求结束后 block 直接回收进空闲池，显存利用率从传统方案的 10-30% 提升到接近 100%，同等显存下可以将 batch size 翻数倍。

**2. Continuous Batching（连续批处理）**：传统做法是等 batch 中所有请求都生成完成后才释放整批，短的请求必须等长的跑完，GPU 空转严重。vLLM 在每次 forward 迭代时动态决定当前 batch 包含哪些请求——新到的请求可以**不等当前 batch 结束就直接插入**（iteration-level scheduling），完成的请求也可立即退出并释放 KV Cache block。这使得 GPU 计算单元始终保持高占用率，中短请求的延迟不会因长请求而拖慢。

**3. CUDA Kernel 优化**：vLLM 深度集成了 FlashAttention v2 和 FlashInfer，将 attention 计算中的 softmax、masking、dropout 等操作融合为单个 CUDA kernel，避免 HBM 和 SRAM 之间的多次读写。PagedAttention 的 block 级访存也通过自定义 CUDA kernel 实现了高效的 gather/scatter 操作。这些融合算子将 attention 部分的耗时降低 2-4 倍。

**4. Prefix Caching & Speculative Decoding**：很多推理请求共享相同的 system prompt 或多轮对话的历史前缀。vLLM 自动对前缀 token 的 KV Cache block 做 hash 识别和复用——遇到相同前缀时直接拷贝对应 block 的指针，新请求不再重算。这在大批相同 instruction 的场景（如批量评测）下可节省 30-50% 的首 token 延迟。搭配推测解码（draft model 生成候选 token，target model 并行验证），端到端延迟可进一步压缩。

**5. 量化与并行策略协同**：vLLM 原生支持 AWQ、GPTQ、FP8 等多种量化方案，与 PagedAttention 的 block 管理无缝对接——量化后的 KV Cache 仍走 block 分配，只是每个 block 占更少显存。配合 Tensor Parallelism（张量并行）分散到多卡，单节点多卡可部署 72B/110B 大模型而不爆显存。生产上常见组合是 INT4 量化 + TP=2/4，单卡 A100 每秒可服务 2000+ token 的吞吐。

**综合效果**：对比 HuggingFace Transformers 的默认实现，vLLM 的吞吐通常有 10-30 倍的提升。生产部署时需要关注 `max_num_batched_tokens`（控制单次 forward 的总 token 数）、`gpu_memory_utilization`（预留比例，建议 0.90）、`block_size`（KV Cache block 大小，16 适合短对话，32 适合长文本）等关键参数。

**加分项：** 
- 了解 vLLM 的调度器（Scheduler）源码结构，能讲清楚 Prefill 和 Decode 阶段的切换逻辑与抢占机制。
- 有实际做过 vLLM + Lora Adapter 的多租户部署，理解 Adapter 的加载/卸载与 KV Cache 隔离。
- 了解 vLLM v1 架构（vLLM 的下一代引擎）的设计动机与改进点，关注分布式推理中的 disaggregated prefilling（将 Prefill 和 Decode 拆分到不同节点）。
