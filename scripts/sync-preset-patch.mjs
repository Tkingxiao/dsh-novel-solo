// 把 template/agent.cordis.yml 同步成 cordis.patch.yml 里 preset-novel-solo 行的
// config.plugins —— 0.1.6 的部署组合与 0.1.7 的声明式预设必须同源，只有插件包内
// 相对路径按各自的解析基准不同（部署目录 vs 包根）。
// 用法：node scripts/sync-preset-patch.mjs [--check]
import { readFileSync, writeFileSync } from 'node:fs'

const HEAD = '# ==== 生成区起点'
const TAIL = '# ==== 生成区终点'
const INDENT = ' '.repeat(10)

const source = readFileSync(new URL('../template/agent.cordis.yml', import.meta.url), 'utf8')
const targetUrl = new URL('../cordis.patch.yml', import.meta.url)

// 部署组合里 agent.cordis.yml 位于预设目录根部，包内资源与它同级，所以模板用
// './plugins/...' 相对自己解析。声明式预设行不能用相对路径：实测 0.1.7 的预设
// 子行按 profile 目录（profiles/web/）解析，不是包根，因此改成包名子路径导出，
// 由 node_modules 里的安装位置解析。
const generated = ['        plugins:', source
  .replace(/\s+$/, '')
  .replace("name: './plugins/llm-tool-choice-pin/index.mjs'", "name: 'dsh-novel-solo/plugins'")
  .split('\n')
  .map((line) => (line.trim() ? INDENT + line : line))
  .join('\n')].join('\n')

// persona.md 是宿主渲染时**严格插值**的模板：只有注册过的 {{变量}} 能用，写错一个
// 名字就是装载期异常，而不是在界面上温柔地少一段话——issue #2 的 {{cwd}} 就是这样
// 让整个预设装载失败、连对话都发不出去的。宿主 0.2.1 只注册 provider / model，
// 工作目录靠运行时上下文的 Current working directory 与 working_directory 工具，
// 不要写成变量。这条门禁挂进 npm run check，避免下次改 persona 时又踩一次。
const personaUrl = new URL('../template/persona.md', import.meta.url)
const persona = readFileSync(personaUrl, 'utf8')
const ALLOWED_VARIABLES = new Set(['provider', 'model'])
const badVariables = [...persona.matchAll(/\{\{([^{}]*)\}\}/g)]
  .map((match) => match[1])
  .filter((name) => !ALLOWED_VARIABLES.has(name))
if (badVariables.length > 0) {
  console.error(
    `template/persona.md 里有宿主不认识的提示词变量：${badVariables.map((name) => '{{' + name + '}}').join('、')}` +
      `（只认 ${[...ALLOWED_VARIABLES].join(' / ')}；工作目录请用运行时上下文或 working_directory 工具，别写成变量）`
  )
  process.exit(1)
}

const lines = readFileSync(targetUrl, 'utf8').split('\n')
const head = lines.findIndex((l) => l.includes(HEAD))
const tail = lines.findIndex((l) => l.includes(TAIL))
if (head < 0 || tail <= head) throw new Error('生成区标记缺失，请先在 cordis.patch.yml 里放好起止标记')

const next = [...lines.slice(0, head + 1), generated, ...lines.slice(tail)].join('\n')
if (process.argv.includes('--check')) {
  if (next !== lines.join('\n')) {
    console.error('cordis.patch.yml 与 template/agent.cordis.yml 不同步，请重跑 node scripts/sync-preset-patch.mjs')
    process.exit(1)
  }
  console.log('cordis.patch.yml 与模板一致')
} else {
  writeFileSync(targetUrl, next)
  console.log(`已同步 ${generated.split('\n').length} 行进 cordis.patch.yml`)
}
