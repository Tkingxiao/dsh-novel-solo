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
