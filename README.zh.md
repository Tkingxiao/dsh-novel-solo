# dsh-novel-solo

DeepSeek Harness 的「单核写作」插件：一个 **子 agent 并发数量设置** + 一套**完整的小说创作预设**（persona）。面向量化小模型做了充分的工具瘦身与输出加固，适合在本机用本地模型跑长篇小说流水线。

## 特性

- **GUI 设置**：在「设置 → 通用」提供「子 agent 数量（1-12）」选择器，随插即用，支持中/英双语。
- **完整创作预设**：随插件附带 `novel-solo` 预设，内置自驱写作 persona——按固定流水线完成 叙事方法 → 核心世界观 → 名词索引 → 大纲 → 章节目录 → 人物档案 → 逐章写作 → 章节审核 → 全书终审与合订。
- **量化安全协议**：输出只用常用汉字/普通标点、禁 JSON、禁转义、少用易崩 token；非必要不调工具、一次只调一个。
- **审核闭环**：每章必审（绿黄红三色），A–G 七个维度（设定/人物性格/目录/叙事/正文规则/禁AI腔/剧情逻辑），审核报告落盘为 md；全书完成后统一终审并合订为单本书。
- **禁AI腔**：内置结构套话、神态套话、情绪套话、重复、连词等易崩/套路清单，写作与审核共用。
- **工具瘦身**：预设内行级禁用 shell/jobs/skills/goals/web 等整行工具，压缩工具目录 schema。
- **版本化写作**：每章 `第N章-章节名字-vX.md`，整章重写先复制 v(X+1)、旧版永不覆盖。

## 安装

```sh
dsh plugin --profile web add "dsh-novel-solo"
dsh web
```

打开「设置 → 通用」，底部可见「子 agent 数量」。

首次启动时，插件会把 `template/` 里的预设**幂等铺设**到 `<dshHome>/.agent-presets/novel-solo/`（目标已存在则跳过，绝不覆盖你已编辑的预设）。

## 子 agent 数量如何影响行为

DSH 的 `agent/request` 瀑布只允许插件改写 LLM 路由/config，不能注入或改写 `system`/`messages`，所以「GUI → 模型提示」的动态注入不能走请求瀑布。本插件改用两段式接线：

1. 保存时把 `N` 写入 `~/.dsh/.dsh-novel-solo-data/agent-count.json`（唯一事实源）。
2. 同步改写 persona 文本里的同步锚点 `并发上限 N=<数字>`（默认改写部署预设 `~/.dsh/.agent-presets/novel-solo/agent.cordis.yml`）。persona 据此决定：`N=1` 全部由主代理一人完成；`N>1` 写作/审核交给子代理、主代理只派活并静默等待。

> 注意：persona 在每次启动 preset 时装载。GUI 改动是「改文件」，**已在运行的会话需重启/新会话才吃到新 N**。

## 预设内容速览

`template/agent.cordis.yml`（部署到 `~/.dsh/.agent-presets/novel-solo/agent.cordis.yml`）内置：

| 区块 | 内容 |
|---|---|
| 分工模式 | 并发上限锚点 `N=1`（默认），N=1 / N>1 两种执行路径 |
| 量化安全铁律 | 输出与工具调用的最优先级约束 |
| 六类文档标准结构 | 叙事方法 / 核心世界观 / 名词索引 / 大纲 / 章节目录 / 人物档案 逐字段模板 |
| 写作与审核规范 | 正文规则、禁AI腔清单、章节审核 A–G + 绿黄红、审核报告 md、全书终审与合订 |
| 工具使用标准 | read/write/edit/glob/grep/subagent 等逐工具铁律 |
| 项目与纪律 | 项目目录 `{{cwd}}/项目名/`、一次只做一件事等 |

## 工具瘦身

预设通过行级 `disabled: true` 硬禁用：`tool-bash`、`tool-jobs`、`skill-filesystem`、`tool-skill`、`tool-goal`、`plan-mode`、`subagent_codex`、`subagent_claude_code`、`workflow-worker-thread`、`tool-workflow`、`tool-ralph`、`tool-todo`、`tool-web`。保留 `tool-fs`（read/write/edit）、`tool-fs-search`（glob/grep）、`str-replace-editor`（view/create/str_replace/insert）、`tool-pwsh`（已解禁，仅做文件系统管理：改文件夹/文件名、删除文件夹/文件）、`subagent`/`subagent_fork`、`list_agents` 等。

随包还携带一个 **preset 作用域**的 vendored 插件（仅对挂载 `novel-solo` 预设的会话生效）：

- `template/plugins/llm-tool-choice-pin/index.mjs` — 把 `llama` provider 的 `toolChoice` 钉为 `auto`，让 `edit` 等保留工具可被调用（小模型下避免每次请求都做工具决策）。

## 文件结构

```
lib/index.js        node 半区：RPC 通道 /dsh-novel-solo（read / writeAgentCount），文件落盘、预设铺设
lib/client.js       浏览器半区：注册 settings.general.item（id agent-count），渲染 1-12 选择器
cordis.patch.yml    安装进 web profile 时插入本插件
template/           novel-solo 预设（agent.cordis.yml + preset.yml + vendored 插件），随包分发
package.json        dsh.client 元数据，使插件可被插件市场/清单识别
```

## 环境变量

| 变量 | 作用 | 默认 |
|---|---|---|
| `DSH_HOME` | dsh 根目录 | `~/.dsh` |
| `DSH_NOVEL_PERSONA_YAML` | 并发锚点改写的目标 YAML（可指向任意预设） | `<dshHome>/.agent-presets/novel-solo/agent.cordis.yml` |
| `DSH_NOVEL_PERSONA_MD` | 额外同步的 persona md 文件（可选，设了才同步） | 无 |
| `DSH_NOVEL_SKIP_DEPLOY` | `1` 时跳过预设铺设 | 无 |
| `DSH_NOVEL_REDEPLOY` | `1` 时强制覆盖已存在的预设（慎用） | 无 |

## 特殊说明

本插件在以下环境使用本地模型完成完整测试：

- **运行框架**：llama.cpp（`llama-b10615-bin-win-cuda-13.3-x64`）
- **测试模型**：`Qwen3.6-35B-A3B-Uncensored-HauhauCS-Aggressive-IQ4_XS.gguf`
- **上下文**：`ctx=65536`，`reasoning on`
- **设备**：笔记本 RTX 4060 8G + 32G 内存 + AMD 7840H CPU
- **实测成绩（约 1 万字文本小说）**：22 token/s，缓存命中 98%；输入 78.8k / 输出 36.9k / 缓存 2.3M；22 轮 63 步，总耗时 1 小时 03 分 42 秒

**关键启动参数（llama-server）**：

```sh
llama-server.exe -m <model.gguf> --no-mmproj --load-mode none --n-cpu-moe 30 -c 65536 -ngl 999 -t 12 -b 1024 -ub 512 -ctk q8_0 -ctv q8_0 -fa on --fit off --no-warmup --poll 0 --temp 0.85 --top-k 20 --top-p 0.95 --min-p 0.05 --repeat-penalty 1.35 --presence-penalty 0.2 --frequency-penalty 0.2 --dry-multiplier 0.8 --dry-base 1.75 --jinja --reasoning on --reasoning-effort medium --reasoning-budget 2048 --reasoning-format deepseek --reasoning-preserve --cont-batching -np 1 --alias "qwen3.6-novel-nsfw-reason" --port 8090 --host 127.0.0.1 --ui --keep -1 --cache-ram 4096 --ctx-checkpoints 64
```

## 参考来源

本插件的设计参考自 [sailoumili/novel-writer](https://github.com/sailoumili/novel-writer)。

## 许可证

MIT License

Copyright (c) 2026 Tkingxiao

特此免费授予任何获得本软件及相关文档文件（以下简称「软件」）副本的人，无限制地处理本软件，包括但不限于使用、复制、修改、合并、发布、分发、再许可和/或销售本软件的副本，并允许向其提供本软件的人这样做，前提是满足以下条件：

上述版权声明和本许可声明应包含在本软件的所有副本或实质性部分中。

本软件按「原样」提供，不提供任何明示或暗示的担保，包括但不限于适销性、特定用途适用性和非侵权性的担保。在任何情况下，作者或版权持有人均不对因本软件或本软件的使用或其他交易而产生、或与之相关的任何索赔、损害或其他责任负责，无论是基于合同、侵权或其他方式。
