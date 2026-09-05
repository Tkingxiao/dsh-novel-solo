# dsh-novel-solo

A **single-author novel-writing plugin** for DeepSeek Harness: a **subagent concurrency setting** plus a **complete novel-creation preset** (persona). It is tuned for quantized small models — the tool catalog is slimmed and output behavior hardened — so you can run a full-length novel pipeline locally.

## Features

- **GUI setting**: a "Subagent count (1-12)" card under Settings → Plugins, with built-in zh/en i18n.
- **Full creation preset**: ships the `novel-solo` preset with a self-driven persona that follows a fixed pipeline — 叙事方法 (narrative method) → 核心世界观 (core worldview) → 名词索引 (noun index) → 大纲 (outline) → 章节目录 (chapter list) → 人物档案 (character files) → chapter-by-chapter writing → per-chapter review → final whole-book review & assembly.
- **Quantized-safe protocol**: plain CJK + common punctuation only, no JSON, no escapes, avoids fragile tokens; minimal tool calls, one at a time.
- **Review loop**: every chapter is reviewed (green/yellow/red) across 7 dimensions (setting / character / catalog / narrative / text rules / AI-cliché / plot logic); each report is written to a markdown file; when all chapters pass, a whole-book review runs and the book is assembled.
- **No AI clichés**: judges AI-flavor across six dimensions (sentence templates / stock vocabulary / emotion telling / structural sameness / diluted information / character distortion), distinguishing narrator-level repetition from character-level consistency; shared by writing and review.
- **Slimmed catalog**: hard-disables whole tool rows (shell / jobs / skills / goals / web) inside the preset to shrink the tool schema.
- **Versioned writing**: each chapter is `第N章-章节名字-vX.md`; full-chapter rewrites first copy to v(X+1) and never overwrite older drafts.

## Install

```sh
dsh plugin --profile web add "dsh-novel-solo"
dsh web
```

Then open Settings → Plugins; the dsh-novel-solo "Subagent count" card appears.

On first launch the plugin **idempotently deploys** the preset from `template/` to `<dshHome>/.agent-presets/novel-solo/` (skips if the target already exists — it never overwrites your edited preset).

## How the subagent count takes effect

DSH's `agent/request` waterfall only lets a plugin rewrite LLM routing/config — it cannot inject or rewrite `system`/`messages` — so "GUI → model prompt" dynamic injection cannot go through the request waterfall. This plugin uses a two-stage wiring instead:

1. On save, `N` is written to `~/.dsh/.dsh-novel-solo-data/agent-count.json` (the single source of truth).
2. The persona's sync anchor `并发上限 N=<number>` is rewritten in place (by default in the deployed preset `~/.dsh/.agent-presets/novel-solo/agent.cordis.yml`). The persona then decides: `N=1` the main agent does everything itself; `N>1` writing/review tasks are delegated to subagents while the main agent only dispatches and silently waits.

> Note: the persona is loaded each time a preset session starts. A GUI change edits files, so **running sessions pick up the new N only after a restart / new session**.

## Preset at a glance

`template/agent.cordis.yml` (deployed to `~/.dsh/.agent-presets/novel-solo/agent.cordis.yml`) includes:

| Section | Content |
|---|---|
| Division of labor | concurrency anchor `N=1` (default), with N=1 / N>1 execution paths |
| Quantized-safe rules | top-priority constraints on output and tool calls |
| Six-doc standard structures | per-field templates for 叙事方法 / 核心世界观 / 名词索引 / 大纲 / 章节目录 / 人物档案 |
| Writing & review rules | chapter rules, AI-cliché lists, A–G review dimensions + green/yellow/red, md review reports, whole-book review & assembly |
| Tool usage standards | per-tool rules for read/write/edit/glob/grep/subagent, etc. |
| Project & discipline | project dir `{{cwd}}/项目名/`, one thing at a time, etc. |

## Tool slimming

The preset hard-disables these rows via `disabled: true`: `tool-bash`, `tool-jobs`, `skill-filesystem`, `tool-skill`, `tool-goal`, `plan-mode`, `subagent_codex`, `subagent_claude_code`, `workflow-worker-thread`, `tool-workflow`, `tool-ralph`, `tool-todo`, `tool-web`. It keeps `tool-fs` (read/write/edit), `tool-fs-search` (glob/grep), `str-replace-editor` (view/create/str_replace/insert), `tool-pwsh` (filesystem management only: rename/delete files & folders), `subagent`/`subagent_fork`, `list_agents`, etc.

It also ships a **preset-scoped** vendored plugin (active only for sessions mounting the `novel-solo` preset):

- `template/plugins/llm-tool-choice-pin/index.mjs` — pins `toolChoice` to `auto` for the `llama` provider so retained tools like `edit` stay callable (avoids per-request tool decisions under small models).

## File structure

```
lib/index.js        node half: registers the dsh-novel-solo settings namespace (settings service), file store + persona-anchor sync + preset deploy
lib/client.js       browser half: registers the settings.plugin.item card (key=dsh-novel-solo), renders the 1-12 selector
cordis.patch.yml    inserted into the web profile on install
template/           the novel-solo preset (agent.cordis.yml + preset.yml + vendored plugin), shipped with the package
package.json        dsh.client metadata so the plugin is recognizable by the plugin market/manifest
```

## Environment variables

| Variable | Purpose | Default |
|---|---|---|
| `DSH_HOME` | dsh home directory | `~/.dsh` |
| `DSH_NOVEL_PERSONA_YAML` | target YAML for the concurrency-anchor rewrite (can point to any preset) | `<dshHome>/.agent-presets/novel-solo/agent.cordis.yml` |
| `DSH_NOVEL_PERSONA_MD` | extra persona md file to also sync (optional) | none |
| `DSH_NOVEL_SKIP_DEPLOY` | `1` skips preset deployment | none |
| `DSH_NOVEL_REDEPLOY` | `1` forcibly overwrites an existing preset (use with care) | none |

## Test environment

This plugin was tested end-to-end with a local model:

- **Runtime**: llama.cpp (`llama-b10615-bin-win-cuda-13.3-x64`)
- **Model**: `Qwen3.6-35B-A3B-Uncensored-HauhauCS-Aggressive-IQ4_XS.gguf`
- **Context**: `ctx=65536`, `reasoning on`
- **Hardware**: laptop RTX 4060 8GB + 32GB RAM + AMD 7840H CPU
- **Measured on a ~10k-char novel**: 22 token/s, 98% cache hit; 78.8k input / 36.9k output / 2.3M cache; 22 turns / 63 steps, 1h03m42s total

**Key server flags (llama-server)**:

```sh
llama-server.exe -m <model.gguf> --no-mmproj --load-mode none --n-cpu-moe 30 -c 65536 -ngl 999 -t 12 -b 1024 -ub 512 -ctk q8_0 -ctv q8_0 -fa on --fit off --no-warmup --poll 0 --temp 0.85 --top-k 20 --top-p 0.95 --min-p 0.05 --repeat-penalty 1.35 --presence-penalty 0.2 --frequency-penalty 0.2 --dry-multiplier 0.8 --dry-base 1.75 --jinja --reasoning on --reasoning-effort medium --reasoning-budget 2048 --reasoning-format deepseek --reasoning-preserve --cont-batching -np 1 --alias "qwen3.6-novel-nsfw-reason" --port 8090 --host 127.0.0.1 --ui --keep -1 --cache-ram 4096 --ctx-checkpoints 64
```

## References

This plugin's design is inspired by [sailoumili/novel-writer](https://github.com/sailoumili/novel-writer).

## License

MIT License

Copyright (c) 2026 Tkingxiao

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
