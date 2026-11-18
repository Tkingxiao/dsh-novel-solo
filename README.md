# dsh-novel-solo

A **single-author novel-writing plugin** for DeepSeek Harness: a **subagent concurrency setting** plus a **complete novel-creation preset** (persona). It is tuned for quantized small models — the tool catalog is slimmed and output behavior hardened — so you can run a full-length novel pipeline locally. Requires **dsh >= 0.2.1**.

## Features

- **GUI setting**: a "Subagent count (1-12)" card on the plugin page (left rail → Plugins), with built-in zh/en i18n.
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

Then open the plugin page (**Plugins** in the left rail) and the dsh-novel-solo "Subagent count" card appears.

## Host compatibility

Requires **dsh >= 0.2.1**. The preset arrives as a declarative `@deepseek-ai/dsh-agent-preset` row in the profile patch, and the count lives in this plugin's volatile `Config` projected into the patch; loadability is decided by `engines.dsh` alone. `template/agent.cordis.yml` is the single source for the preset's row list — the generated region in `cordis.patch.yml` is guarded by `npm run check`, never hand-edited.

## How the subagent count takes effect

DSH's `agent/request` waterfall only lets a plugin rewrite LLM routing/config — it cannot inject or rewrite `system`/`messages` — so "GUI → model prompt" dynamic injection cannot go through the request waterfall. This plugin wires the value through files instead:

1. The card saves `N` into the host's settings store — the source of truth.
2. On load, the node half mirrors it to `<dshHome>/.dsh-novel-solo-data/agent-count.json`.
3. The persona row resolves `!!js` while the preset loads: it reads `template/persona.md` and replaces that file's `并发上限 N=<number>` anchor with the mirrored number. `N=1` the main agent does everything itself; `N>1` writing/review tasks are delegated to subagents while the main agent only dispatches and silently waits.

> Note: the mirror and the persona are both resolved while the host loads its plugins, so **a GUI change reaches the prompt only after a host restart**. Volatile settings give the node side no change callback, so there is nothing to push the new value out live.

## Preset at a glance

The persona body lives in `template/persona.md`; `template/agent.cordis.yml` (mirrored into `cordis.patch.yml`) carries the tool rows around it. Content:

| Section | Content |
|---|---|
| Division of labor | concurrency anchor `N=1` (default), with N=1 / N>1 execution paths |
| Quantized-safe rules | top-priority constraints on output and tool calls |
| Six-doc standard structures | per-field templates for 叙事方法 / 核心世界观 / 名词索引 / 大纲 / 章节目录 / 人物档案 |
| Writing & review rules | chapter rules, AI-cliché lists, A–G review dimensions + green/yellow/red, md review reports, whole-book review & assembly |
| Tool usage standards | per-tool rules for read/write/edit/glob/grep/subagent, etc. |
| Project & discipline | the project dir is the `项目名` folder under the working directory; paths come from the runtime context's Current working directory or the `working_directory` tool — never from a template variable — one thing at a time |

## Tool slimming

The preset hard-disables these rows via `disabled: true`: `tool-bash`, `tool-jobs`, `skill-filesystem`, `tool-skill`, `tool-goal`, `plan-mode`, `subagent_codex`, `subagent_claude_code`, `workflow-ptc`, `tool-workflow`, `tool-ralph`, `tool-todo`, `tool-web`. It keeps `tool-fs` (read/write/edit, with `read_image` switched off), `tool-fs-search` (glob/grep), `str-replace-editor` (view/create/str_replace/insert), `tool-pwsh` (filesystem management only: rename/delete files & folders), `subagent`/`subagent_fork`, `list_agents`, etc.

The 0.2.1 stock `standard` grew four more model-facing toolchains, and this preset screens every one of them out: `tool-schedule`, `command-goal`, `tool-present`, and the `tools` entry of `plugin-manager` / `plugin-market`. They are spelled out as `disabled: true` rows so they cannot quietly reappear if the composition is reordered later. Two prompt-only rows are simply left out: `agent-instructions` (AGENTS.md injection) and `time-context` (clock context) would be dead weight under `complete: true`. The `working_directory` tool is a host-plane row every session receives, so the persona treats it as the source of truth for paths instead of fighting it.

It also ships a **preset-scoped** vendored plugin (active only for sessions mounting the `novel-solo` preset):

- `template/plugins/llm-tool-choice-pin/index.mjs`, exported as `dsh-novel-solo/plugins` — pins `toolChoice` to `auto` for the `llama` provider so retained tools like `edit` stay callable (avoids per-request tool decisions under small models).

## File structure

```
lib/index.js        node half: count mirror + settings seam (volatile `Config` form, suppresses the host's auto settings page)
lib/client.js       browser half: the "Subagent count" card, mounted on `plugins.item` via `configForms`
cordis.patch.yml    installed into the web profile: the plugin row plus the declarative novel-solo preset row
cordis.yml          development overlay: card only, no preset rows
template/           the novel-solo preset (agent.cordis.yml + persona.md + preset.yml + vendored plugin), shipped with the package
scripts/sync-preset-patch.mjs  copies template/agent.cordis.yml into the patch's generated block; `--check` verifies it and rejects a persona that references an unregistered `{{variable}}`
package.json        dsh.bundle / dsh.client metadata so the plugin is recognizable by the plugin market/manifest
```

`npm run check` syntax-checks both halves, re-runs the patch/template consistency check, and rejects any `{{variable}}` in `template/persona.md` that the host does not register (only `provider` / `model` exist; one wrong name is a load-time failure, not a cosmetic gap in the UI).

## Environment variables

| Variable | Purpose | Default |
|---|---|---|
| `DSH_HOME` | dsh home directory | `~/.dsh` |

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
