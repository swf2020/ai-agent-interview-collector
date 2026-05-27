# Step 7.1：公司文件与索引生成 Agent Prompt 模板

> 主会话注入：`{{DISPLAY_NAME}}` = 角色中文名，`{{ROLE_ID}}` = 角色标识，`{{OUTPUT_DIR}}` = 输出根目录，`{{STEP5_OUTPUT_FILE_PATH}}` = Step 5 生成的主题目文件路径，`{{FILE_PREFIX}}` = 题集文件前缀（角色配置 Section 4），`{{MODULE_FILE_MAP}}` = 模块编号→文件名映射（角色配置 Section 3），`{{COMPANY_CLASSIFICATION}}` = 公司分类（从 defaults 加载或角色配置覆盖），`{{ROUND_DEFINITIONS}}` = 轮次定义（从 defaults 加载或角色配置覆盖）

---

你是一个文件生成专家。请根据主题目文件中的公司分类信息，生成按公司+面试轮次分类的索引文件。

**主题目文件路径：** {{STEP5_OUTPUT_FILE_PATH}}
**解答文件目录：** {{OUTPUT_DIR}}/samples/{{ROLE_ID}}/answers/

**任务 1：按公司生成独立文件**

在 {{OUTPUT_DIR}}/samples/{{ROLE_ID}}/company/{公司大类}/ 目录下，为每个已采集到的公司创建 `{公司名}.md` 文件。

目录结构：
{OUTPUT_DIR}/samples/{{ROLE_ID}}/
├── {{FILE_PREFIX}}_YYYYMMDD.md                  # 主文件（Step 5 生成）
├── company_index.md                             # 公司索引
└── company/
    ├── 互联网公司/
    │   ├── 京东.md
    │   └── ...
    ├── 外企/
    │   ├── 微软.md
    │   └── ...
    ├── AI公司/
    │   └── ...
    ├── 硬件芯片/
    │   └── ...
    ├── 创业公司/
    │   └── ...
    └── 其他/
        └── ...

**每个公司文件格式（按面试轮次分组）：**

# {公司名} - {{DISPLAY_NAME}} 面试题集

> 公司大类：{互联网公司/外企/AI公司/硬件芯片/创业公司/其他}
> 累计题目：N 题 | 采集日期：YYYY-MM-DD

---

（按以下轮次定义生成各轮次 section，格式：`## {轮次}（{关注点}）`，只列出该公司出现过的轮次，空轮次不显示）

{{ROUND_DEFINITIONS}}

示例：
## 一面（基础知识）

- [来源:牛客][2026-03] [Module 1] 示例题目？ → 详见 [解答](../../answers/module_01_xxx.md#Q1)
- [来源:小红书][2026-02] [Module 2] 示例题目？ → 详见 [解答](../../answers/module_02_xxx.md#Q3)

## 二面（项目细节与系统设计）
...

（只列出该公司出现过的轮次 section，空轮次不显示）

**规则：**
- {{DISPLAY_NAME}}专项题标注 [Module N] 并包含 ../../answers/ 相对路径解答链接
- 非角色相关题不标 [Module N]、不生成解答链接
- **相对路径规则：** 公司文件位于 company/{大类}/{公司名}.md，比 answers/ 多两层目录，必须使用 `../../answers/{文件名}.md`（文件名从角色配置 Section 3 表格读取）
- 链接格式校验：`详见 [解答](../../answers/` 前缀（不能包含完整路径或其他角色目录）

**任务 2：生成 company_index.md 索引文件**

# 公司分类索引

> 生成日期：YYYY-MM-DD

{{COMPANY_CLASSIFICATION}}

### 已采集公司：
- [字节跳动](company/互联网公司/字节跳动.md) — N 题（轮次列表）
### 待采集公司：
（该类下尚未采集到的其余代表公司）

（其他大类同上格式）

## 统计
| 公司大类 | 已采集公司数 | 已采集题目数 |
|----------|-------------|-------------|
...

**重要：** 已采集公司链接格式必须为 [公司名](company/{大类}/{公司名}.md)，使用相对于 company_index.md 的路径。
