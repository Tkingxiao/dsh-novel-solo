# dsh-novel-solo

A **single-author novel-writing plugin** for DeepSeek Harness: a **subagent concurrency setting** plus a **complete novel-creation preset** (persona). It is tuned for quantized small models — the tool catalog is slimmed and output behavior hardened — so you can run a full-length novel pipeline locally.

## Features

- **GUI setting**: a "Subagent count (1-12)" card on the plugin page (0.1.7: left rail → Plugins; 0.1.6: Settings → Plugins), with built-in zh/en i18n.
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

Then open the plugin page — **Plugins** in the left rail on 0.1.7, **Settings → Plugins** on 0.1.6 — and the dsh-novel-solo "Subagent count" card appears.

On hosts older than 0.1.7 the plugin additionally **deploys the preset idempotently** from `template/` to `<dshHome>/.agent-presets/novel-solo/`, because that was the only preset contract there (an existing target is skipped — your edited preset is never overwritten). On 0.1.7 nothing is deployed: the preset arrives as a declarative row in the profile patch.

## Host compatibility

The plugin supports **DSH 0.1.6 through 0.2.0-rc.1** and picks its route per host. Both halves probe the host's own version through `ctx.profileContext.installAnchor` — the YAML `disabled:` gate in `cordis.patch.yml` and the same check in `lib/index.js` — and fall back to the 0.1.6 route whenever the version cannot be read. Everything from 0.1.7 on takes the same route, 0.2.0 included.

| | 0.1.6 | 0.1.7 and later |
|---|---|---|
| Preset delivery | deploy `template/` into `<dshHome>/.agent-presets/novel-solo/` | declarative `@deepseek-ai/dsh-agent-preset` row in the patch |
| Where `N` is saved | `dsh-novel-solo` settings namespace the plugin registers | the plugin's own `Config` (`count` is `volatile`), projected into the profile patch |
| Card slot | `settings.plugin.item` via `settingsScope` | `plugins.item` via `configForms` |

Both routes are exercised against a real host; the 0.1.7 one on `0.1.7-rc.1` (card renders on the Plugins page, saves land in `cordis.patch.yml`, preset shows up in the picker). The 0.1.6 route is covered by the same version gate offline, since no 0.1.6 host binary is installed next to the 0.1.7 one. `0.1.7-rc.2` and `0.2.0-rc.1` were checked against the host source at those releases rather than run: the preset row fields, the `settings.configure` / `configForms` seams, the `plugins.item` slot and `profileContext.installAnchor` all read the same as on `0.1.7-rc.1`.

Whether the plugin loads at all is decided before its code runs: since `0.1.7-rc.1` the host evaluates every `@deepseek-ai/dsh*` range in `peerDependencies` against the running release and disables the row if one of them doesn't match. `0.2.0-rc.1` is named there; later 0.2.0 builds are not, because a release nobody checked is a different host. `engines.dsh` repeats the same list for readers — the host never parses it. Reinstalling on a host that previously refused the plugin needs a `dsh web` restart, since the decision is made while the profile is composed.

Since `0.1.5`, the persona uses the `@deepseek-ai/dsh-persona` config key `prefix` (the `text` key of 0.1.2-rc.1 was removed), so hosts older than that need the persona row renamed by hand. Each home keeps its own deployed copy; homes provisioned by older hosts keep their `text:` copy and still work when you switch back.

## How the subagent count takes effect

DSH's `agent/request` waterfall only lets a plugin rewrite LLM routing/config — it cannot inject or rewrite `system`/`messages` — so "GUI → model prompt" dynamic injection cannot go through the request waterfall. This plugin wires the value through files instead:

1. The card saves `N` into the host's settings store (see the table above). That is the source of truth.
2. On load, the node half mirrors it to `<dshHome>/.dsh-novel-solo-data/agent-count.json`.
3. The persona row resolves `!!js` while the preset loads: it reads `template/persona.md` and replaces that file's `并发上限 N=<number>` anchor with the mirrored number. The persona then decides: `N=1` the main agent does everything itself; `N>1` writing/review tasks are delegated to subagents while the main agent only dispatches and silently waits.

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
| Project & discipline | project dir `{{cwd}}/项目名/`, one thing at a time, etc. |

## Tool slimming

The preset hard-disables these rows via `disabled: true`: `tool-bash`, `tool-jobs`, `skill-filesystem`, `tool-skill`, `tool-goal`, `plan-mode`, `subagent_codex`, `subagent_claude_code`, `workflow-worker-thread`, `tool-workflow`, `tool-ralph`, `tool-todo`, `tool-web`. It keeps `tool-fs` (read/write/edit), `tool-fs-search` (glob/grep), `str-replace-editor` (view/create/str_replace/insert), `tool-pwsh` (filesystem management only: rename/delete files & folders), `subagent`/`subagent_fork`, `list_agents`, etc.

It also ships a **preset-scoped** vendored plugin (active only for sessions mounting the `novel-solo` preset):

- `template/plugins/llm-tool-choice-pin/index.mjs`, exported as `dsh-novel-solo/plugins` — pins `toolChoice` to `auto` for the `llama` provider so retained tools like `edit` stay callable (avoids per-request tool decisions under small models).

## File structure

```
lib/index.js        node half: host version gate, count mirror, settings seam (0.1.7 volatile `Config` form / 0.1.6 namespace), preset deploy on legacy hosts
lib/client.js       browser half: the "Subagent count" card, mounted on `plugins.item` (0.1.7) and `settings.plugin.item` (0.1.6)
cordis.patch.yml    installed into the web profile: the plugin row plus the declarative novel-solo preset row (disabled below 0.1.7)
cordis.yml          development overlay: card only, no preset rows
template/           the novel-solo preset (agent.cordis.yml + persona.md + preset.yml + vendored plugin), shipped with the package
scripts/sync-preset-patch.mjs  copies template/agent.cordis.yml into the patch's generated block; `--check` verifies it
package.json        dsh.bundle / dsh.client metadata so the plugin is recognizable by the plugin market/manifest
```

`npm run check` syntax-checks both halves and re-runs the patch/template consistency check.

## Environment variables

| Variable | Purpose | Default |
|---|---|---|
| `DSH_HOME` | dsh home directory | `~/.dsh` |
| `DSH_NOVEL_SKIP_DEPLOY` | `1` skips preset deployment (legacy hosts only) | none |
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
