# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

This is a **Claude Code Skill** (not a traditional app). The skill orchestrates 8-step parallel Agent workflows to collect real-world interview questions from Chinese internet platforms (Xiaohongshu, Bilibili, Niuke, CSDN, Maimai, etc.), deduplicate, classify them by role-specific knowledge modules, and generate Markdown question banks with answers.

The core artifact is `SKILL.md` — a 26K+ line Agent orchestration document that the Claude Code harness loads and executes directly. There is no runtime, no build step, and no test suite. The `bin/cli.js` is only an installer that copies files into `~/.claude/skills/`.

## Key files and directories

- **`SKILL.md`** — The entire skill definition. Contains the full 8-step Agent orchestration workflow (Step 0: role detection → Step 1: parallel platform scraping → Step 2: dedup/clean → Step 3: classify by module → Step 4: incremental merge → Step 5: generate question file → Step 6: batch answer generation → Step 7: company index + validation). All Agent prompts are inline.
- **`references/roles/`** — Role-specific configs (ai-agent, backend, frontend, product-manager, qa-testing, ui-design, algorithm). Each defines search keywords, knowledge modules, output config, and optional custom company/round classifications. Loaded in Step 0.
- **`references/defaults/`** — Baseline configs shared across roles: `company-classification.md` (6 company categories) and `round-definitions.md` (7 interview round types). Roles can override these in their own Sections 5/6.
- **`references/site-patterns/`** — Platform-specific scraping know-how (API endpoints, CDP scripts, known pitfalls) for xiaohongshu, bilibili, and zhipin.com. Agents must read these before scraping.
- **`samples/{role_id}/`** — All output (question files, answers, company index, intermediate artifacts) lands here, isolated per role.
- **`evals/`** — Manual evaluation prompts and expected outputs (not automated tests). `evals.json` defines assertion checklists; `fixtures/` holds test input data; `test_plan.md` documents the 10-case test strategy.

## Working on this project

This project has no build, lint, or test commands. All development is done by editing `SKILL.md` and the reference files directly.

**When editing `SKILL.md`:**
- The file is consumed by the Claude Code harness as a skill definition. Changes to Agent prompts, step ordering, or output format affect the runtime behavior of the skill when users invoke it.
- Agent prompts use `{{PLACEHOLDER}}` syntax for variables injected by the orchestrating session (e.g., `{{ROLE_ID}}`, `{{SEARCH_KEYWORDS}}`, `{{ROUND_DEFINITIONS}}`). Keep these placeholders intact.
- The 8-step architecture table at the top of the file must stay in sync with the actual step sections below.

**When adding a new role:**
1. Create `references/roles/{role_id}.md` following the existing role file format (YAML frontmatter with role_id/display_name/domain, then Sections 1-6).
2. Update the role matching table in `SKILL.md` Step 0.1 with trigger keywords.
3. Add a row to the role support table in `SKILL.md` overview and `README.md`.

**When adding a new site pattern:**
1. Create `references/site-patterns/{domain}.md` following the format of existing files.
2. Update the site patterns table in `SKILL.md` Step 1 and `README.md`.

**Evaluation:** Evaluations are manual — paste the prompt from `evals/evals.json` into a Claude Code session and verify outputs against the `expected_output` and `assertions` fields. `evals/test_plan.md` describes the full test strategy (E2E + unit + edge cases).

## Installation

```bash
npx skills add swf2020/interview-collector --all -g
```

Requires the `web-access` skill installed for CDP browser-based scraping of anti-bot platforms (Xiaohongshu, Bilibili, Maimai). Without it, the workflow falls back to WebSearch/WebFetch with limited coverage.
