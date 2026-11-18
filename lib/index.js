/**
 * dsh-novel-solo — node half.
 *
 * Owns the parallel-subagent cap and mirrors it into
 * `<dshHome>/.dsh-novel-solo-data/agent-count.json`, which the preset persona
 * reads while it loads to render `并发上限 N=<count>`. The value is edited on
 * the host settings form projected from this plugin's volatile `Config` and
 * saved back into the profile patch. Requires dsh >= 0.2.1 — the legacy routes
 * (`.agent-presets/` deployment, runtime-only settings namespace) are gone.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import os from 'node:os'
import z from '@deepseek-ai/schemastery'

export const name = 'dsh-novel-solo'

const NS = 'dsh-novel-solo'
const COUNT_FIELD = 'count'
const DATA_DIR = '.dsh-novel-solo-data'
const CONFIG_FILE = 'agent-count.json'
const MIN_COUNT = 1
const MAX_COUNT = 12
const DEFAULT_COUNT = 1

const expandHome = (p) => (p === '~' ? os.homedir() : /^~[\\/]/.test(p) ? join(os.homedir(), p.slice(2)) : p)
// 与宿主的 resolveDshHome 同式：环境变量优先，否则 ~/.dsh，最后绝对化。
const envDshHome = () => resolve(expandHome(process.env.DSH_HOME?.trim() || join(os.homedir(), '.dsh')))

const storeDir = (home) => join(home, DATA_DIR)
const storeFile = (home) => join(home, DATA_DIR, CONFIG_FILE)

/** Coerce an unknown count into an integer in [1, 12]; unnamed/finished values
 *  fall back to the default so a stale file can never crash the injector. */
function clampCount(v) {
  const n = typeof v === 'string' ? Number(v) : v
  return Number.isInteger(n) && n >= MIN_COUNT && n <= MAX_COUNT ? n : DEFAULT_COUNT
}

/** The volatile field reaches `apply` as a cosmokit box; plain values — a row
 *  that never spells the field out — pass through untouched. */
const unwrap = (v) => (v !== null && typeof v === 'object' && typeof v.get === 'function' ? v.get() : v)

// 镜像写入必须同步：紧跟本行的预设 persona 用 !!js 在装载时读这个文件。
function writeCount(home, count) {
  const n = clampCount(count)
  try {
    mkdirSync(storeDir(home), { recursive: true })
    writeFileSync(storeFile(home), JSON.stringify({ count: n }, null, 2), 'utf8')
  } catch (e) {
    console.warn(`dsh-novel-solo: failed to write "${CONFIG_FILE}"`, e)
  }
  return n
}

/** Durable schema for the subagent count — the composition row config, the
 *  settings form, and the wire envelope the browser scope validates against. */
export const Config = z.object({
  [COUNT_FIELD]: z.number().min(MIN_COUNT).max(MAX_COUNT).default(DEFAULT_COUNT).volatile(),
})

export async function apply(ctx, config = {}) {
  const home = ctx.profileContext?.home || envDshHome()
  // 组合行里的值是权威值；镜像文件只是 persona 装载时的读取源。
  writeCount(home, clampCount(unwrap(config[COUNT_FIELD])))
  // 镜像只在装载这一刻刷新：volatile 盒子是「用的时候拉」，node 侧没有设置
  // 变更回调（`SettingsForms` 只有 describe/update/configure），跟着盒子挂 effect
  // 实测不会重跑。所以改完数量要重启宿主，写作规范里的 N 才会变。
  ctx.inject(['settings'], (settingsCtx) => {
    // 设置页由本包的 client 半区提供，关掉宿主的自动生成页。
    settingsCtx.effect(() => settingsCtx.settings.configure({ auto: false }, ctx.fiber))
  })
}
