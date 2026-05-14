# AI Agent 社招面试题集（采集日期：2026-05-14）

> 来源：小红书 / B站 / 牛客 / CSDN / 脉脉 / BOSS直聘 / 猎聘 / 知乎 / 黑马程序员 / 尚硅谷等
> 本次新增：200 题 | 累计去重后：200 题

---

## 🎯 Module 1：Prompt / LLM 原理类

- [Module 1] [来源:多平台][社招][2026-05] LoRA 以及 QLoRA 的原理是什么？LoRA 为什么有效？LoRA 与 QLoRA 的核心差异及工程中怎么选？ → 详见 [解答](answers/module_01_prompt_llm.md#Q1)
- [Module 1] [来源:多平台][社招][2026-05] 为什么 Agent 的 Prompt 容易「失效」？怎么提高 Prompt 的鲁棒性？System Prompt 和 User Prompt 在上下文中的优先级关系是怎样的？ → 详见 [解答](answers/module_01_prompt_llm.md#Q2)
- [Module 1] [来源:多平台][社招][2026-05] 如何让大模型感知状态机的当前状态？思考模型与非思考模型的输出除标签外还有哪些核心区别？ → 详见 [解答](answers/module_01_prompt_llm.md#Q3)
- [Module 1] [来源:多平台][社招][2026-05] 在 Agent 开发中，如何通过 Prompt 实现高效的指代消除和意图识别？ → 详见 [解答](answers/module_01_prompt_llm.md#Q4)
- [Module 1] [来源:多平台][社招][2026-05] 在样本量极少的情况下，如何解决 LoRA 微调容易出现的过拟合或欠拟合问题？ → 详见 [解答](answers/module_01_prompt_llm.md#Q5)
- [Module 1] [来源:多平台][社招][2026-05] 意图识别模型具体能解决什么问题？ → 详见 [解答](answers/module_01_prompt_llm.md#Q6)
- [Module 1] [来源:多平台][社招][2026-05] 讲一下你项目里的 Prompt 一般怎么写？ → 详见 [解答](answers/module_01_prompt_llm.md#Q7)
- [Module 1] [来源:多平台][社招][2026-05] 在 Agent 系统中，为什么需要 Prompt 动态配置？请设计一个支持动态配置和版本管理的 Prompt 管理系统。 → 详见 [解答](answers/module_01_prompt_llm.md#Q8)
- [Module 1] [来源:多平台][社招][2026-05] 请解释一下什么是"大语言模型"？它和传统的自然语言处理模型有什么本质区别？ → 详见 [解答](answers/module_01_prompt_llm.md#Q9)
- [Module 1] [来源:多平台][社招][2026-05] 在 AI 领域，我们经常听到 AGI、NLP、Prompt、Token、Inference 这些词，请一一解释它们的含义。 → 详见 [解答](answers/module_01_prompt_llm.md#Q10)
- [Module 1] [来源:多平台][社招][2026-05] 当大模型一本正经地"胡说八道"时，我们通常称之为什么现象？其产生的根本原因可能有哪些？ → 详见 [解答](answers/module_01_prompt_llm.md#Q11)
- [Module 1] [来源:多平台][社招][2026-05] 什么是模型的"微调"？在实际应用中我们为什么要对预训练模型进行微调？ → 详见 [解答](answers/module_01_prompt_llm.md#Q12)
- [Module 1] [来源:多平台][社招][2026-05] 如果你想针对一个特定领域（如法律咨询）微调一个大模型，你需要准备什么样的数据？数据质量对微调结果的影响有多大？ → 详见 [解答](answers/module_01_prompt_llm.md#Q13)
- [Module 1] [来源:多平台][社招][2026-05] 什么是"提示词工程"？请举例说明一个复杂的提示词通常包含哪些要素？ → 详见 [解答](answers/module_01_prompt_llm.md#Q14)
- [Module 1] [来源:多平台][社招][2026-05] 在选择一个 LLM 模型时（比如 OpenAI 的 GPT-4o 和 Meta 的 LLaMA 3），你会从哪些维度进行评估和决策？ → 详见 [解答](answers/module_01_prompt_llm.md#Q15)
- [Module 1] [来源:多平台][社招][2026-05] 多模态大模型的具体结构是什么？（视觉编码器 + 适配器/连接器 + LLM 生成三部分） → 详见 [解答](answers/module_01_prompt_llm.md#Q16)
- [Module 1] [来源:多平台][社招][2026-05] BERT 的 [CLS] token 能否直接作为句向量？各向异性问题是什么？ → 详见 [解答](answers/module_01_prompt_llm.md#Q17)
- [Module 1] [来源:多平台][社招][2026-05] LoRA 为什么有效？低秩假设是什么意思？ → 详见 [解答](answers/module_01_prompt_llm.md#Q18)
- [Module 1] [来源:多平台][社招][2026-05] QLoRA 的三大核心技术是什么？（NF4 量化/双重量化/分页优化器） → 详见 [解答](answers/module_01_prompt_llm.md#Q19)
- [Module 1] [来源:多平台][社招][2026-05] LoRA 微调过拟合怎么解决？ → 详见 [解答](answers/module_01_prompt_llm.md#Q20)
- [Module 1] [来源:多平台][社招][2026-05] 单卡 24G 显存不足（微调 13B），如何优化？ → 详见 [解答](answers/module_01_prompt_llm.md#Q21)
- [Module 1] [来源:多平台][社招][2026-05] 灾难性遗忘如何缓解？ → 详见 [解答](answers/module_01_prompt_llm.md#Q22)
- [Module 1] [来源:多平台][社招][2026-05] PPO vs DPO 流程差异？ → 详见 [解答](answers/module_01_prompt_llm.md#Q23)
- [Module 1] [来源:多平台][社招][2026-05] LoRA 能否插入 LayerNorm 层？（不能，会破坏归一化） → 详见 [解答](answers/module_01_prompt_llm.md#Q24)
- [Module 1] [来源:多平台][社招][2026-05] NF4 为什么比 INT4 好？（针对正态分布设计） → 详见 [解答](answers/module_01_prompt_llm.md#Q25)
- [Module 1] [来源:多平台][社招][2026-05] MHA / MQA / GQA 三种注意力机制的区别？ → 详见 [解答](answers/module_01_prompt_llm.md#Q26)
- [Module 1] [来源:多平台][社招][2026-05] 大模型微调流程是怎样的？ → 详见 [解答](answers/module_01_prompt_llm.md#Q27)
- [Module 1] [来源:多平台][社招][2026-05] 大模型意图识别是怎么做的？ → 详见 [解答](answers/module_01_prompt_llm.md#Q28)
- [Module 1] [来源:多平台][社招][2026-05] 解释下模型蒸馏和模型量化。 → 详见 [解答](answers/module_01_prompt_llm.md#Q29)
- [Module 1] [来源:多平台][社招][2026-05] 解释下全参数微调、LoRA、QLoRA 区别。 → 详见 [解答](answers/module_01_prompt_llm.md#Q30)
- [Module 1] [来源:多平台][社招][2026-05] 模型微调怎么评估效果？ → 详见 [解答](answers/module_01_prompt_llm.md#Q31)
- [Module 1] [来源:多平台][社招][2026-05] 详述 Transformer 多头自注意力机制。 → 详见 [解答](answers/module_01_prompt_llm.md#Q32)
- [Module 1] [来源:多平台][社招][2026-05] prefix LM 和 causal LM 区别是什么？ → 详见 [解答](answers/module_01_prompt_llm.md#Q33)
- [Module 1] [来源:多平台][社招][2026-05] 如何让大模型处理更长的文本？ → 详见 [解答](answers/module_01_prompt_llm.md#Q34)
- [Module 1] [来源:多平台][社招][2026-05] 领域数据训练后如何缓解模型遗忘通用能力？ → 详见 [解答](answers/module_01_prompt_llm.md#Q35)
- [Module 1] [来源:多平台][社招][2026-05] RAG 和 SFT 微调的区别是什么？什么时候该用哪个？对于 200 组左右的固定 QA 知识库你会选择 RAG、LoRA 微调还是长上下文直接输入？ → 详见 [解答](answers/module_01_prompt_llm.md#Q36)

## 🎯 Module 2：RAG 设计与优化类

- [Module 2] [来源:多平台][社招][2026-05] 什么是 RAG（检索增强生成）？一个完整的 RAG 流程包含哪些关键步骤？请从数据准备到最终生成详细描述整个过程。 → 详见 [解答](answers/module_02_rag.md#Q1)
- [Module 2] [来源:多平台][社招][2026-05] RAG 和长上下文模型（如 1M token 窗口）的关系是什么？超长上下文模型出现后 RAG 架构的必要性是否会下降？ → 详见 [解答](answers/module_02_rag.md#Q2)
- [Module 2] [来源:多平台][社招][2026-05] Chunking 策略有哪些？不同场景下怎么选？长文档切片的粒度一般怎么选择？为什么要有重叠区域？ → 详见 [解答](answers/module_02_rag.md#Q3)
- [Module 2] [来源:多平台][社招][2026-05] 为什么需要 Rerank 模型？向量检索已经计算了相似度，为什么还要引入交叉编码器进行重排？Rerank 后的截断策略是怎么设计的？ → 详见 [解答](answers/module_02_rag.md#Q4)
- [Module 2] [来源:多平台][社招][2026-05] 怎么评估 RAG 系统的效果？RAG 系统的评测维度有哪些？如何构建评测数据集？ → 详见 [解答](answers/module_02_rag.md#Q5)
- [Module 2] [来源:多平台][社招][2026-05] 稠密向量和稀疏向量的区别是什么？各自适合什么场景？向量检索和关键词检索是怎么组合的（混合检索）？ → 详见 [解答](answers/module_02_rag.md#Q6)
- [Module 2] [来源:多平台][社招][2026-05] RAG 中如果没有召回到相关知识，如何约束模型避免胡编？RAG 幻觉检测与控制怎么做？ → 详见 [解答](answers/module_02_rag.md#Q7)
- [Module 2] [来源:多平台][社招][2026-05] Query 改写你是怎么做的？解决什么问题？如何实现？ → 详见 [解答](answers/module_02_rag.md#Q8)
- [Module 2] [来源:多平台][社招][2026-05] HyDE（Hypothetical Document Embeddings）的原理和应用场景？在 query 模糊时是如何提升召回效果的？ → 详见 [解答](answers/module_02_rag.md#Q9)
- [Module 2] [来源:多平台][社招][2026-05] RAG 与小模型微调的适用场景分别是什么？全参数微调 vs PEFT（LoRA/Adapter 等）如何选择？ → 详见 [解答](answers/module_02_rag.md#Q10)
- [Module 2] [来源:多平台][社招][2026-05] RAG 的常见失败场景有哪些？如何解决？RAG 系统在实际部署中可能面临哪些挑战？ → 详见 [解答](answers/module_02_rag.md#Q11)
- [Module 2] [来源:多平台][社招][2026-05] Self-RAG 和 CRAG 等自适应检索机制的区别？什么是迭代检索（Iterative Retrieval）？与普通 RAG 有何区别？ → 详见 [解答](answers/module_02_rag.md#Q12)
- [Module 2] [来源:多平台][社招][2026-05] 什么是 RAG？（RAG/微调/Long Context 对比综述题） → 详见 [解答](answers/module_02_rag.md#Q13)
- [Module 2] [来源:多平台][社招][2026-05] 了解搜索系统吗？和 RAG 有什么区别？稀疏检索 vs 稠密检索的核心区别是什么？ → 详见 [解答](answers/module_02_rag.md#Q14)
- [Module 2] [来源:多平台][社招][2026-05] OCR 结果有噪声或错误时，你是怎么做纠错或提升解析质量的？ → 详见 [解答](answers/module_02_rag.md#Q15)
- [Module 2] [来源:多平台][社招][2026-05] 多模态检索中，图像和文本向量不在同一空间时，如何实现对齐？ → 详见 [解答](answers/module_02_rag.md#Q16)
- [Module 2] [来源:多平台][社招][2026-05] 长文档为什么一定要切 chunk 再做向量化？不切会有什么问题？ → 详见 [解答](answers/module_02_rag.md#Q17)
- [Module 2] [来源:多平台][社招][2026-05] 余弦相似度和欧氏距离在高维空间中的差异是什么？实际怎么选？ → 详见 [解答](answers/module_02_rag.md#Q18)
- [Module 2] [来源:多平台][社招][2026-05] 文档发生局部更新时，如何做增量索引而不是全量重建？ → 详见 [解答](answers/module_02_rag.md#Q19)
- [Module 2] [来源:多平台][社招][2026-05] 向量检索中 Top-K 设置过大或过小分别会带来什么问题？ → 详见 [解答](answers/module_02_rag.md#Q20)
- [Module 2] [来源:多平台][社招][2026-05] Agent 一般在什么阶段去查询向量知识库？通过什么方式去查询？查询知识库的工具函数其标准输入和输出是什么？ → 详见 [解答](answers/module_02_rag.md#Q21)
- [Module 2] [来源:多平台][社招][2026-05] 系统如何实现图像识别等多模态功能？为什么不直接使用多模态大模型？ → 详见 [解答](answers/module_02_rag.md#Q22)
- [Module 2] [来源:多平台][社招][2026-05] 多模态预处理中，图片在 RAG 系统里是如何向量化检索的？多模态预处理环节的技术难点是什么？ → 详见 [解答](answers/module_02_rag.md#Q23)
- [Module 2] [来源:多平台][社招][2026-05] 如何杜绝跨场景召回相似步骤的问题，具体实现方式是什么？ → 详见 [解答](answers/module_02_rag.md#Q24)
- [Module 2] [来源:多平台][社招][2026-05] 介绍评估精度和召回率所采用的框架，以及召回率的具体计算细节？ → 详见 [解答](answers/module_02_rag.md#Q25)
- [Module 2] [来源:多平台][社招][2026-05] 代码助手在代码检索时，如何高效找到与问题相关的依赖并提供给大模型？现阶段为何少有框架做代码依赖相关的优化工作？ → 详见 [解答](answers/module_02_rag.md#Q26)
- [Module 2] [来源:多平台][社招][2026-05] 不同数据表量级下，Text2SQL 的技术选型差异是什么？ → 详见 [解答](answers/module_02_rag.md#Q27)
- [Module 2] [来源:多平台][社招][2026-05] 为何要将数据表每一行数据向量化？行级向量化与表元数据（Metadata）检索的优劣对比是什么？ → 详见 [解答](answers/module_02_rag.md#Q28)
- [Module 2] [来源:多平台][社招][2026-05] Text2SQL 业界常用方案、技术框架与难点你了解哪些？ → 详见 [解答](answers/module_02_rag.md#Q29)
- [Module 2] [来源:多平台][社招][2026-05] 结构化数据用固定分块的原因？什么场景不适合固定分块？标点分块如何解决语义割裂问题？ → 详见 [解答](answers/module_02_rag.md#Q30)
- [Module 2] [来源:多平台][社招][2026-05] 加重排后效果变差的原因是什么？ → 详见 [解答](answers/module_02_rag.md#Q31)
- [Module 2] [来源:多平台][社招][2026-05] 向量数据库检索出来的历史信息，如果语义相关但时间太久，能直接用吗？ → 详见 [解答](answers/module_02_rag.md#Q32)
- [Module 2] [来源:多平台][社招][2026-05] 如何评估 Rerank 的有效性？有什么指标吗？ → 详见 [解答](answers/module_02_rag.md#Q33)
- [Module 2] [来源:多平台][社招][2026-05] 检索策略有哪些？向量匹配的计算指标有哪些？ → 详见 [解答](answers/module_02_rag.md#Q34)
- [Module 2] [来源:多平台][社招][2026-05] Embedding 模型怎么选？怎么微调？向量数据库怎么选？ → 详见 [解答](answers/module_02_rag.md#Q35)
- [Module 2] [来源:多平台][社招][2026-05] 多跳检索（Multi-hop RAG）的实现思路？ → 详见 [解答](answers/module_02_rag.md#Q36)
- [Module 2] [来源:多平台][社招][2026-05] 为什么需要父子索引？Re-rank 后一般返回几个块？为什么？ → 详见 [解答](answers/module_02_rag.md#Q37)
- [Module 2] [来源:多平台][社招][2026-05] 摘要生成用什么模型？摘要质量怎么保证？ → 详见 [解答](answers/module_02_rag.md#Q38)
- [Module 2] [来源:多平台][社招][2026-05] 如果做 Code-RAG，应该怎么做？ → 详见 [解答](answers/module_02_rag.md#Q39)
- [Module 2] [来源:多平台][社招][2026-05] 有关联关系的文档怎么做 RAG？行业黑话或内部术语文档怎么做 RAG？ → 详见 [解答](answers/module_02_rag.md#Q40)
- [Module 2] [来源:多平台][社招][2026-05] 什么是查询改写？什么是查询扩展？什么是自查询？ → 详见 [解答](answers/module_02_rag.md#Q41)
- [Module 2] [来源:多平台][社招][2026-05] 在构建知识库时，文本切块策略至关重要。你会如何选择合适的切块大小和重叠长度？这背后有什么权衡？ → 详见 [解答](answers/module_02_rag.md#Q42)
- [Module 2] [来源:多平台][社招][2026-05] 如何选择一个合适的嵌入模型？评估一个 Embedding 模型的好坏有哪些指标？ → 详见 [解答](answers/module_02_rag.md#Q43)
- [Module 2] [来源:多平台][社招][2026-05] 除了基础的向量检索，你还知道哪些可以提升 RAG 检索质量的技术？ → 详见 [解答](answers/module_02_rag.md#Q44)
- [Module 2] [来源:多平台][社招][2026-05] 请解释"Lost in the Middle"问题。它描述了 RAG 中的什么现象？有什么方法可以缓解这个问题？ → 详见 [解答](answers/module_02_rag.md#Q45)
- [Module 2] [来源:多平台][社招][2026-05] 在什么场景下，你会选择使用图数据库或知识图谱来增强或替代传统的向量数据库检索？ → 详见 [解答](answers/module_02_rag.md#Q46)
- [Module 2] [来源:多平台][社招][2026-05] 传统的 RAG 流程是"先检索后生成"，你是否了解一些更复杂的 RAG 范式，比如在生成过程中进行多次检索或自适应检索？ → 详见 [解答](answers/module_02_rag.md#Q47)
- [Module 2] [来源:多平台][社招][2026-05] 知道或者使用过哪些开源 RAG 框架比如 Ragflow？如何选择合适场景？ → 详见 [解答](answers/module_02_rag.md#Q48)
- [Module 2] [来源:多平台][社招][2026-05] RAG 召回优化：你们 RAG 召回存在什么问题？怎么优化的？用的什么向量数据库？怎么保证召回的准确性避免 Agent 答非所问？ → 详见 [解答](answers/module_02_rag.md#Q49)
- [Module 2] [来源:多平台][社招][2026-05] Dify 的 Knowledge Base（知识库）功能是如何工作的？它和 RAG 技术之间是什么关系？ → 详见 [解答](answers/module_02_rag.md#Q50)
- [Module 2] [来源:多平台][社招][2026-05] 当一个基于 RAG 的问答系统回答错误时，你会如何排查问题？可能的原因有哪些？ → 详见 [解答](answers/module_02_rag.md#Q51)
- [Module 2] [来源:多平台][社招][2026-05] RAG 落地时，数据清洗与切分的核心要点和避坑方法有哪些？ → 详见 [解答](answers/module_02_rag.md#Q52)
- [Module 2] [来源:多平台][社招][2026-05] 多模态用户信息的存储与使用方案？ → 详见 [解答](answers/module_02_rag.md#Q53)
- [Module 2] [来源:多平台][社招][2026-05] 多模态知识检索的实现方式？ → 详见 [解答](answers/module_02_rag.md#Q54)
- [Module 2] [来源:多平台][社招][2026-05] 什么是难负例（Hard Negatives）？如何挖掘？ → 详见 [解答](answers/module_02_rag.md#Q55)
- [Module 2] [来源:多平台][社招][2026-05] ColBERT 的 Late Interaction 机制是什么？ → 详见 [解答](answers/module_02_rag.md#Q56)
- [Module 2] [来源:多平台][社招][2026-05] RAG 如何处理多文档冲突信息？ → 详见 [解答](answers/module_02_rag.md#Q57)
- [Module 2] [来源:多平台][社招][2026-05] 如何优化长文档的 RAG 检索效果？ → 详见 [解答](answers/module_02_rag.md#Q58)
- [Module 2] [来源:多平台][社招][2026-05] RAG 如何适配实时更新的知识库？ → 详见 [解答](answers/module_02_rag.md#Q59)
- [Module 2] [来源:多平台][社招][2026-05] RAGAS 评估框架四大指标是什么？ → 详见 [解答](answers/module_02_rag.md#Q60)
- [Module 2] [来源:多平台][社招][2026-05] 设计一个多租户 RAG 系统，竞对之间数据必须完全隔离。 → 详见 [解答](answers/module_02_rag.md#Q61)
- [Module 2] [来源:多平台][社招][2026-05] 向量数据库的 ANN（近似最近邻）是什么？HNSW 和 IVF 索引原理是什么？HNSW 和 IVFFLAT 的区别是什么？ → 详见 [解答](answers/module_02_rag.md#Q62)

## 🎯 Module 3：工具调用类

- [Module 3] [来源:多平台][社招][2026-05] MCP（模型上下文协议）和 Function Calling 有什么区别？什么时候用哪个？在构建复杂 AI 应用时如何选择或结合使用它们？ → 详见 [解答](answers/module_03_tool_calling.md#Q1)
- [Module 3] [来源:多平台][社招][2026-05] Agent 工具调用失败了怎么办？你的错误处理和重试策略是什么？如果同时触发多个 Function Call 怎么处理？ → 详见 [解答](answers/module_03_tool_calling.md#Q2)
- [Module 3] [来源:多平台][社招][2026-05] MCP 的交互流程是怎样的？Agent 如何与 MCP Server 连接通信？MCP 提供了哪些能力（Tools/Resources/Prompts）？ → 详见 [解答](answers/module_03_tool_calling.md#Q3)
- [Module 3] [来源:多平台][社招][2026-05] Agent 工具太多时怎么管理？工具路由怎么做？设计有 100 个 Tool 的 Agent 你会怎么设计？ → 详见 [解答](answers/module_03_tool_calling.md#Q4)
- [Module 3] [来源:多平台][社招][2026-05] Function Call 的底层实现流程是什么？模型如何知道该调用哪个工具？LLM 自己执行 Function Call 吗？ → 详见 [解答](answers/module_03_tool_calling.md#Q5)
- [Module 3] [来源:多平台][社招][2026-05] MCP 和 A2A 都是协议，它们有什么区别？为什么 MCP 解决不了 A2A 要解决的问题？ → 详见 [解答](answers/module_03_tool_calling.md#Q6)
- [Module 3] [来源:多平台][社招][2026-05] MCP 的 Tool/Resource/Prompt 概念是什么？MCP 的工具发现机制是什么？ → 详见 [解答](answers/module_03_tool_calling.md#Q7)
- [Module 3] [来源:多平台][社招][2026-05] Parallel Tool Calling 是怎么实现的？有什么注意事项？多个工具怎么并行执行？顺序怎么确定？ → 详见 [解答](answers/module_03_tool_calling.md#Q8)
- [Module 3] [来源:多平台][社招][2026-05] 如果 Agent 调用工具失败或超时，一般怎么处理？如何设计 Prompt 让 Agent 给用户合理的反馈？ → 详见 [解答](answers/module_03_tool_calling.md#Q9)
- [Module 3] [来源:多平台][社招][2026-05] 在设计 Agent 的工具调用能力时，你的技术方案是什么？如何选择合适的工具 API？会使用哪些函数调用框架？ → 详见 [解答](answers/module_03_tool_calling.md#Q10)
- [Module 3] [来源:多平台][社招][2026-05] Skills 和 System Prompt / Function Call 有什么区别？Tool 和 Skill 哪个更适合 Agent 演进方向？你会怎么设计一个 Skill？ → 详见 [解答](answers/module_03_tool_calling.md#Q11)
- [Module 3] [来源:多平台][社招][2026-05] MCP 基于什么协议实现的？MCP 如何保证安全性？ → 详见 [解答](answers/module_03_tool_calling.md#Q12)
- [Module 3] [来源:多平台][社招][2026-05] 如果 API 返回结果有字段缺失，或者有冗余内容，你会怎么处理？ → 详见 [解答](answers/module_03_tool_calling.md#Q13)
- [Module 3] [来源:多平台][社招][2026-05] 你对 MCP 了解多吗？有没有写过相关的 MCP Server？ → 详见 [解答](answers/module_03_tool_calling.md#Q14)
- [Module 3] [来源:多平台][社招][2026-05] 如何让 Qwen 模型正常使用相关工具，具体实现方式是什么？ → 详见 [解答](answers/module_03_tool_calling.md#Q15)
- [Module 3] [来源:多平台][社招][2026-05] 用户如何自定义 Agent 与 MCP？流程是什么？ → 详见 [解答](answers/module_03_tool_calling.md#Q16)
- [Module 3] [来源:多平台][社招][2026-05] Agent skill 开发是怎么做的？什么是计划模式（Plan Mode）？ → 详见 [解答](answers/module_03_tool_calling.md#Q17)
- [Module 3] [来源:多平台][社招][2026-05] 请解释 MCP 的概念。在火山引擎这样的云平台上，提供一个 MCP Server 管理的解决方案，您会考虑哪些关键模块？ → 详见 [解答](answers/module_03_tool_calling.md#Q18)
- [Module 3] [来源:多平台][社招][2026-05] 请描述您之前设计和实现的一个 Agent 系统。在实现工具调用时，您是如何解决工具选择和参数校验这两个关键问题的？ → 详见 [解答](answers/module_03_tool_calling.md#Q19)
- [Module 3] [来源:多平台][社招][2026-05] Function Call 和普通的 Prompt + 正则解析有什么区别？ → 详见 [解答](answers/module_03_tool_calling.md#Q20)
- [Module 3] [来源:多平台][社招][2026-05] 如果你要给团队接入 10 个外部工具，你会用 MCP 还是直接写 Function Call？为什么？ → 详见 [解答](answers/module_03_tool_calling.md#Q21)
- [Module 3] [来源:多平台][社招][2026-05] 为什么说 Function Call 是 Agent 的基石？ → 详见 [解答](answers/module_03_tool_calling.md#Q22)
- [Module 3] [来源:多平台][社招][2026-05] Function Calling 为 LLM 应用带来了哪些好处？同时又引入了哪些新的挑战或限制？ → 详见 [解答](answers/module_03_tool_calling.md#Q23)
- [Module 3] [来源:多平台][社招][2026-05] 在 Dify 中，如果你想让它调用一个外部的天气 API，应该如何实现？ → 详见 [解答](answers/module_03_tool_calling.md#Q24)
- [Module 3] [来源:多平台][社招][2026-05] A2A 和 MCP 的区别是什么？ → 详见 [解答](answers/module_03_tool_calling.md#Q25)
- [Module 3] [来源:多平台][社招][2026-05] MCP 是什么？解决了什么问题？（N x M 爆炸问题） → 详见 [解答](answers/module_03_tool_calling.md#Q26)
- [Module 3] [来源:多平台][社招][2026-05] Function Call、MCP、Skills 三者的区别与协作？ → 详见 [解答](answers/module_03_tool_calling.md#Q27)
- [Module 3] [来源:多平台][社招][2026-05] Skills 是什么？和 Prompt/System Prompt/Few-shot 有什么区别？ → 详见 [解答](answers/module_03_tool_calling.md#Q28)

## 🎯 Module 4：Agent 架构设计类

- [Module 4] [来源:多平台][社招][2026-05] 请解释 AI Agent 的概念。一个典型的 AI Agent 通常包含哪些核心组成部分？它和传统的 LLM Chatbot 有什么本质区别？ → 详见 [解答](answers/module_04_agent_architecture.md#Q1)
- [Module 4] [来源:多平台][社招][2026-05] Agent Loop 是 Agent 运行的核心机制。请详细描述这个循环的各个步骤，并指出在实际应用中这个循环可能遇到哪些风险或问题？ → 详见 [解答](answers/module_04_agent_architecture.md#Q2)
- [Module 4] [来源:多平台][社招][2026-05] Agent 的 Memory 系统怎么设计？短期记忆和长期记忆在设计上有什么区别、如何协作？上下文窗口有限时怎么管理长对话中的记忆？ → 详见 [解答](answers/module_04_agent_architecture.md#Q3)
- [Module 4] [来源:多平台][社招][2026-05] LangChain Agent 和从零手写 Agent 各有什么优劣？你在生产环境怎么选？Agent 开发框架如何选型？ → 详见 [解答](answers/module_04_agent_architecture.md#Q4)
- [Module 4] [来源:多平台][社招][2026-05] Plan-and-Execute 和 ReAct 模式有什么区别？什么时候用哪个？什么是思维链（CoT）和思维树（ToT）？分别适用什么场景？ → 详见 [解答](answers/module_04_agent_architecture.md#Q5)
- [Module 4] [来源:多平台][社招][2026-05] 设计一个企业级/工业级 AI Agent 的完整架构，说明每个模块的设计目标和核心实现逻辑。 → 详见 [解答](answers/module_04_agent_architecture.md#Q6)
- [Module 4] [来源:多平台][社招][2026-05] 长期记忆的维护需要哪些策略或算法？长期记忆是否需要做处理（直接保留对话内容还是总结后保存）？短期记忆如何转化为长期记忆？ → 详见 [解答](answers/module_04_agent_architecture.md#Q7)
- [Module 4] [来源:多平台][社招][2026-05] 你的 Agent 系统记忆模块怎么实现？怎么管理它的 context？短期/长期/工作记忆分别怎么管理？ → 详见 [解答](answers/module_04_agent_architecture.md#Q8)
- [Module 4] [来源:多平台][社招][2026-05] 如何判断一个任务该用 Agent 还是 Workflow？Agent 和 Workflow 在设计理念、控制方式和适用场景上有什么核心区别？ → 详见 [解答](answers/module_04_agent_architecture.md#Q9)
- [Module 4] [来源:多平台][社招][2026-05] 长短记忆怎么管理？长记忆怎么存储？短记忆怎么清理避免 Token 浪费？ → 详见 [解答](answers/module_04_agent_architecture.md#Q10)
- [Module 4] [来源:多平台][社招][2026-05] 如果要做某个功能，你会怎么设计 Agent 流程？（开放题） → 详见 [解答](answers/module_04_agent_architecture.md#Q11)
- [Module 4] [来源:多平台][社招][2026-05] 多轮对话中，如果不同轮次的记忆发生冲突，你如何处理？ → 详见 [解答](answers/module_04_agent_architecture.md#Q12)
- [Module 4] [来源:多平台][社招][2026-05] 用户情绪异常（投诉、愤怒）时，Agent 如何在不中断主流程的情况下进行干预？ → 详见 [解答](answers/module_04_agent_architecture.md#Q13)
- [Module 4] [来源:多平台][社招][2026-05] Spring AI 框架的主要优势是什么？ → 详见 [解答](answers/module_04_agent_architecture.md#Q14)
- [Module 4] [来源:多平台][社招][2026-05] Agent 循环流程中执行太长或死循环怎么解决的？ → 详见 [解答](answers/module_04_agent_architecture.md#Q15)
- [Module 4] [来源:多平台][社招][2026-05] 项目里的 self-refine / 自我修正，你做过哪些修正策略？ → 详见 [解答](answers/module_04_agent_architecture.md#Q16)
- [Module 4] [来源:多平台][社招][2026-05] 模型多轮对话的历史记录中，长期记忆和短期记忆由谁定义、如何区分？ → 详见 [解答](answers/module_04_agent_architecture.md#Q17)
- [Module 4] [来源:多平台][社招][2026-05] 长期记忆的淘汰算法是否为先进先出，该算法是否存在问题？长期记忆是否一定要淘汰，能否通过检索方式调取而非丢弃？ → 详见 [解答](answers/module_04_agent_architecture.md#Q18)
- [Module 4] [来源:多平台][社招][2026-05] 长期记忆占用模型上下文窗口会导致输出窗口压缩，优化方向是什么？ → 详见 [解答](answers/module_04_agent_architecture.md#Q19)
- [Module 4] [来源:多平台][社招][2026-05] OpenCloud、Perplexity 等 Agent 系统的核心是什么？ → 详见 [解答](answers/module_04_agent_architecture.md#Q20)
- [Module 4] [来源:多平台][社招][2026-05] 了解 ToT 或者 GoT 吗？讲一下？ → 详见 [解答](answers/module_04_agent_architecture.md#Q21)
- [Module 4] [来源:多平台][社招][2026-05] ReAct、Plan-and-Execute、Tree-of-Thoughts 三种 Agent 规划范式分别适用于什么场景？各自的优缺点？如果做一个企业级数据分析 Agent 你会选择哪种？ → 详见 [解答](answers/module_04_agent_architecture.md#Q22)
- [Module 4] [来源:多平台][社招][2026-05] AI Agent 在长任务执行中经常会出现死循环、步骤漂移、忘记初始目标的问题，你认为核心原因是什么？你会用哪些工业级的方案来解决？ → 详见 [解答](answers/module_04_agent_architecture.md#Q23)
- [Module 4] [来源:多平台][社招][2026-05] 如果让你给拼多多的商家设计一款 AI Agent，核心目标是提升商家的运营效率和店铺 GMV，你会怎么设计？ → 详见 [解答](answers/module_04_agent_architecture.md#Q24)
- [Module 4] [来源:多平台][社招][2026-05] LangGraph 的中断恢复具体是怎么做的？checkpoint 怎么存、怎么恢复？长期运行 checkpoint 越来越多、上下文越来越长怎么办？ → 详见 [解答](answers/module_04_agent_architecture.md#Q25)
- [Module 4] [来源:多平台][社招][2026-05] 节点执行异常怎么处理？分层上下文管理每一层管的是什么？ → 详见 [解答](answers/module_04_agent_architecture.md#Q26)
- [Module 4] [来源:多平台][社招][2026-05] 怎么让 Agent 越用越聪明？ → 详见 [解答](answers/module_04_agent_architecture.md#Q27)
- [Module 4] [来源:多平台][社招][2026-05] 你们项目里用的是 LLM 直接调用还是 Agent？为什么这么选？Agent 比 LLM 多了什么？ → 详见 [解答](answers/module_04_agent_architecture.md#Q28)
- [Module 4] [来源:多平台][社招][2026-05] 你了解 ReAct 吗？除了 ReAct 还有哪些 Agent 工作模式？各自的优缺点是什么？ → 详见 [解答](answers/module_04_agent_architecture.md#Q29)
- [Module 4] [来源:多平台][社招][2026-05] Agent 怎么实现跨会话记忆？RAG 是 Agent 记忆的一部分吗？ → 详见 [解答](answers/module_04_agent_architecture.md#Q30)
- [Module 4] [来源:多平台][社招][2026-05] Agent 开发的最大难点是什么？如何让 Agent 稳定可控？ → 详见 [解答](answers/module_04_agent_architecture.md#Q31)
- [Module 4] [来源:多平台][社招][2026-05] 在 Dify 中，你可以通过 Workflow（工作流）来构建应用。请解释一下什么是 Workflow，并举例说明它相较于简单的对话型应用有什么优势。 → 详见 [解答](answers/module_04_agent_architecture.md#Q32)
- [Module 4] [来源:多平台][社招][2026-05] Agent 开发调优方案：你沉淀的这套解决方案具体包含哪些内容？怎么复用？适用于其他业务场景吗？ → 详见 [解答](answers/module_04_agent_architecture.md#Q33)
- [Module 4] [来源:多平台][社招][2026-05] 假设你需要开发美团智能客服 Agent，如何设计多轮对话流程？你会使用哪些对话状态跟踪方法？如何处理用户意图模糊的情况？ → 详见 [解答](answers/module_04_agent_architecture.md#Q34)
- [Module 4] [来源:多平台][社招][2026-05] 解释 AI Agent 的规划能力，如何实现多任务协同（如点餐+支付+售后）？ → 详见 [解答](answers/module_04_agent_architecture.md#Q35)
- [Module 4] [来源:多平台][社招][2026-05] 分享一次通过用户反馈优化 Agent 能力的经历，关键改进是什么？ → 详见 [解答](answers/module_04_agent_architecture.md#Q36)
- [Module 4] [来源:多平台][社招][2026-05] 较长较多上下文应该怎么解决？ → 详见 [解答](answers/module_04_agent_architecture.md#Q37)
- [Module 4] [来源:多平台][社招][2026-05] 详细说下 LangChain 框架应用场景。 → 详见 [解答](answers/module_04_agent_architecture.md#Q38)
- [Module 4] [来源:多平台][社招][2026-05] 生产级 AI Agent 五层架构：入口层/编排规划层/记忆层/工具调用层/算力层，请详细展开。 → 详见 [解答](answers/module_04_agent_architecture.md#Q39)

## 🎯 Module 5：多 Agent 设计类

- [Module 5] [来源:多平台][社招][2026-05] Multi-Agent 系统通常在什么场景下使用？和 Single Agent 比有什么不同？多个 Agent 之间怎么通信和协调？ → 详见 [解答](answers/module_05_multi_agent.md#Q1)
- [Module 5] [来源:多平台][社招][2026-05] 多 Agent 系统采用什么架构？任务如何编排？主 Agent 和子 Agent 怎么通信？ → 详见 [解答](answers/module_05_multi_agent.md#Q2)
- [Module 5] [来源:多平台][社招][2026-05] 详细描述你项目中的 Multi-Agent 三层架构（Router -> Manager -> Sub-Agent）的设计逻辑？ → 详见 [解答](answers/module_05_multi_agent.md#Q3)
- [Module 5] [来源:多平台][社招][2026-05] 在设计上，什么情况下你会用单 Agent，什么情况下会用多 Agent？ → 详见 [解答](answers/module_05_multi_agent.md#Q4)
- [Module 5] [来源:多平台][社招][2026-05] 多 Agent 之间的数据传输或者通信一般是怎么做的？如果有并发情况怎么处理？ → 详见 [解答](answers/module_05_multi_agent.md#Q5)
- [Module 5] [来源:多平台][社招][2026-05] 如果有多个 Agent 同时去操作数据库或者文件，这种并发你怎么处理？ → 详见 [解答](answers/module_05_multi_agent.md#Q6)
- [Module 5] [来源:多平台][社招][2026-05] 请设计一个多 Agent 协作系统来处理一个复杂的客户工单，阐述系统中不同 Agent 的角色、它们之间如何通信与协作。 → 详见 [解答](answers/module_05_multi_agent.md#Q7)

## 🎯 Module 6：工程落地类

- [Module 6] [来源:多平台][社招][2026-05] 如何进行 Token 用量控制？大模型高并发调用时如何做限流、降级和成本控制？ → 详见 [解答](answers/module_06_engineering.md#Q1)
- [Module 6] [来源:多平台][社招][2026-05] Agent 的「安全边界」怎么设计？什么是 Prompt Injection？怎么防御？ → 详见 [解答](answers/module_06_engineering.md#Q2)
- [Module 6] [来源:多平台][社招][2026-05] 项目里有没有遇到幻觉问题？针对模型幻觉问题做了哪些约束？如何减少和规避？ → 详见 [解答](answers/module_06_engineering.md#Q3)
- [Module 6] [来源:多平台][社招][2026-05] 前/后端开发上如何实现类似 ChatGPT 的"逐字输出"效果？SSE 在前后端是如何交互的？ → 详见 [解答](answers/module_06_engineering.md#Q4)
- [Module 6] [来源:多平台][社招][2026-05] 如何设计多模型支持架构？多租户环境下模型切换是否支持热更新？ → 详见 [解答](answers/module_06_engineering.md#Q5)
- [Module 6] [来源:多平台][社招][2026-05] 后端 Agent 是否支持多租户同时调用？Agent 工具调用的完整业务流程是怎样的？ → 详见 [解答](answers/module_06_engineering.md#Q6)
- [Module 6] [来源:多平台][社招][2026-05] Agent 发生工具调用时，SSE 推送的事件结构中通常包含哪些字段？ → 详见 [解答](answers/module_06_engineering.md#Q7)
- [Module 6] [来源:多平台][社招][2026-05] 如何系统性地降低 AI Agent 的幻觉？请你给出全链路的解决方案。 → 详见 [解答](answers/module_06_engineering.md#Q8)
- [Module 6] [来源:多平台][社招][2026-05] 为了提高 Agent 的可靠性并减少幻觉，除了工具调用还有哪些技术手段？在构建生产级的 RAG 系统时，最重要的三个优化点是什么？ → 详见 [解答](answers/module_06_engineering.md#Q9)
- [Module 6] [来源:多平台][社招][2026-05] 如果 Agent 要操作数据库，怎么保证它不会误删数据？ → 详见 [解答](answers/module_06_engineering.md#Q10)
- [Module 6] [来源:多平台][社招][2026-05] 什么是流式输出？什么是限流熔断？什么是缓存策略？ → 详见 [解答](answers/module_06_engineering.md#Q11)
- [Module 6] [来源:多平台][社招][2026-05] Agent 的 Token 消耗很大，怎么优化成本？ → 详见 [解答](answers/module_06_engineering.md#Q12)
- [Module 6] [来源:多平台][社招][2026-05] 对于 AI 应用而言，成本和效率是非常重要的考量。请谈谈在设计一个 AI 全栈应用时，可以从哪些方面进行成本和性能优化？ → 详见 [解答](answers/module_06_engineering.md#Q13)
- [Module 6] [来源:多平台][社招][2026-05] 描述一次使用 LLM 开发智能助手的经历，遇到过哪些幻觉问题？ → 详见 [解答](answers/module_06_engineering.md#Q14)
- [Module 6] [来源:多平台][社招][2026-05] 如何保证大模型生成内容的合规性？ → 详见 [解答](answers/module_06_engineering.md#Q15)
- [Module 6] [来源:多平台][社招][2026-05] 如何降低大模型 API 服务的推理延迟和成本？ → 详见 [解答](answers/module_06_engineering.md#Q16)
- [Module 6] [来源:多平台][社招][2026-05] 设计支撑百万级日活的高并发 AI 客服大模型调用系统。 → 详见 [解答](answers/module_06_engineering.md#Q17)
- [Module 6] [来源:多平台][社招][2026-05] 全链路耗时多少？瓶颈在哪？怎么优化？ → 详见 [解答](answers/module_06_engineering.md#Q18)
- [Module 6] [来源:多平台][社招][2026-05] 如果大模型效果突然下降，你怎么排查？ → 详见 [解答](answers/module_06_engineering.md#Q19)

## 🎯 Module 7：云端部署类

- [Module 7] [来源:多平台][社招][2026-05] vllm 的推理加速是怎么实现的？ → 详见 [解答](answers/module_07_deployment.md#Q1)

## 🎯 Module 8：技术演进与视野类

- [Module 8] [来源:多平台][社招][2026-05] 你认为当前 AI Agent 落地最大的瓶颈是什么？未来 1-2 年 AI Agent 的核心发展方向是什么？ → 详见 [解答](answers/module_08_evolution.md#Q1)
- [Module 8] [来源:多平台][社招][2026-05] 大模型落地的三大路线是什么？什么是全链路私有化？ → 详见 [解答](answers/module_08_evolution.md#Q2)
- [Module 8] [来源:多平台][社招][2026-05] 目前业界主流的闭源和开源大模型有哪些？请分别列举几个有代表性的。 → 详见 [解答](answers/module_08_evolution.md#Q3)
- [Module 8] [来源:多平台][社招][2026-05] Dify 是一个什么样的平台？它主要解决了 AI 应用开发中的哪些痛点？ → 详见 [解答](answers/module_08_evolution.md#Q4)
- [Module 8] [来源:多平台][社招][2026-05] AI 辅助开发的实践经验有哪些？ → 详见 [解答](answers/module_08_evolution.md#Q5)
- [Module 8] [来源:多平台][社招][2026-05] 当前 Agent 是否达到预期？你对 Agent 的预期是什么？ → 详见 [解答](answers/module_08_evolution.md#Q6)
- [Module 8] [来源:多平台][社招][2026-05] 目前主流的开源模型体系有哪些？ → 详见 [解答](answers/module_08_evolution.md#Q7)

## 📦 其他 / 综合类

- 设计一个从用户纠错行为中自动学习进化的自愈测试系统。

---

## ⭐ 近期高频题（近1个月出现 3 次以上）

> 本次为初次采集，题目级别来源（多平台 vs 单平台）的元数据未在增量流程中按题粒度量记录，暂无法通过来源 "/" 标记识别高频题。
> 后续增量更新流程中，将在 Step 4 输出中为每道题补充多平台出现标记，届时可据此自动生成高频题列表。

---

## 📊 模块题目数统计

| 模块 | 题目数 | Q 编号范围 |
|------|--------|-----------|
| Module 1 - Prompt / LLM 原理类 | 36 | Q1–Q36 |
| Module 2 - RAG 设计与优化类 | 62 | Q1–Q62 |
| Module 3 - 工具调用类 | 28 | Q1–Q28 |
| Module 4 - Agent 架构设计类 | 39 | Q1–Q39 |
| Module 5 - 多 Agent 设计类 | 7 | Q1–Q7 |
| Module 6 - 工程落地类 | 19 | Q1–Q19 |
| Module 7 - 云端部署类 | 1 | Q1 |
| Module 8 - 技术演进与视野类 | 7 | Q1–Q7 |
| 其他 / 综合类 | 1 | — |
| **合计** | **200** | — |
