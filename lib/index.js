/**
 * dsh-novel-solo — node half.
 *
 * Owns the parallel-subagent cap and mirrors it into
 * `<dshHome>/.dsh-novel-solo-data/agent-count.json`, which the preset persona
 * reads while it loads to render `并发上限 N=<count>`. Where the value is edited
 * depends on the host: 0.1.7 projects this plugin's volatile `Config` into a
 * settings form and saves edits back into the profile patch, while 0.1.6 only
 * had the runtime namespace this plugin registers itself.
 *
 * Preset delivery is host-dependent too: earlier hosts scan
 * `<dshHome>/.agent-presets/`, so this half deploys the bundled template there.
 */
import { cp } from 'node:fs/promises'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
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

const PRESET_NAME = 'novel-solo'
// 插件包根目录：lib/index.js 的上两级即包根。内置预设模板随包携带，
// 只供 0.1.6 及更早宿主幂等铺设到 <dshHome>/.agent-presets/novel-solo/。
const PKG_ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const TEMPLATE_PRESET = join(PKG_ROOT, 'template')

const expandHome = (p) => (p === '~' ? os.homedir() : /^~[\\/]/.test(p) ? join(os.homedir(), p.slice(2)) : p)
// 与宿主的 resolveDshHome 同式：环境变量优先，否则 ~/.dsh，最后绝对化。
const envDshHome = () => resolve(expandHome(process.env.DSH_HOME?.trim() || join(os.homedir(), '.dsh')))

const presetDir = (home) => join(home, '.agent-presets', PRESET_NAME)

// 幂等铺设：目标目录已存在则跳过（绝不覆盖用户已编辑的预设）；可设
// DSH_NOVEL_SKIP_DEPLOY=1 关闭，或 DSH_NOVEL_REDEPLOY=1 强制覆盖。
async function ensurePreset(home) {
  if (process.env.DSH_NOVEL_SKIP_DEPLOY === '1') return
  try {
    if (existsSync(presetDir(home)) && process.env.DSH_NOVEL_REDEPLOY !== '1') return
    if (!existsSync(join(TEMPLATE_PRESET, 'agent.cordis.yml'))) return
    mkdirSync(join(home, '.agent-presets'), { recursive: true })
    await cp(TEMPLATE_PRESET, presetDir(home), { recursive: true, force: process.env.DSH_NOVEL_REDEPLOY === '1' })
  } catch (e) {
    console.warn(`dsh-novel-solo: preset deploy skipped for "${PRESET_NAME}"`, e)
  }
}

/** Read the host's own version off the profile install anchor. Unrecognisable
 *  input answers "legacy", the only branch an older host can act on. */
function isLegacyHost(ctx) {
  try {
    const version = String(JSON.parse(readFileSync(ctx.profileContext.installAnchor, 'utf8')).version)
    const [major, minor, patch] = version.split('-')[0].split('.').map(Number)
    return !(major > 0 || minor > 1 || (minor === 1 && patch >= 7))
  } catch {
    return true
  }
}

const storeDir = (home) => join(home, DATA_DIR)
const storeFile = (home) => join(home, DATA_DIR, CONFIG_FILE)

/** Coerce an unknown count into an integer in [1, 12]; unnamed/finished values
 *  fall back to the default so a stale file can never crash the injector. */
function clampCount(v) {
  const n = typeof v === 'string' ? Number(v) : v
  return Number.isInteger(n) && n >= MIN_COUNT && n <= MAX_COUNT ? n : DEFAULT_COUNT
}

/** A volatile field reaches `apply` as a cosmokit box on 0.1.7; plain values —
 *  0.1.6, and a row that never spells the field out — pass through untouched. */
const unwrap = (v) => (v !== null && typeof v === 'object' && typeof v.get === 'function' ? v.get() : v)

// 镜像读写必须同步：紧跟本行的预设 persona 用 !!js 在装载时读这个文件。
function readCount(home) {
  try {
    const parsed = JSON.parse(readFileSync(storeFile(home), 'utf8'))
    return clampCount(parsed && typeof parsed === 'object' ? parsed.count : parsed)
  } catch {
    return DEFAULT_COUNT
  }
}

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

/** 0.1.7 只把 volatile 字段投影成设置表单；老宿主解析到的 schemastery 还没有
 *  这个标记，那边的命名空间由下面的 legacy 分支自己注册。 */
const countField = () => {
  const field = z.number().min(MIN_COUNT).max(MAX_COUNT).default(DEFAULT_COUNT)
  return typeof field.volatile === 'function' ? field.volatile() : field
}

/** Durable schema for the subagent count — the composition row config, the
 *  0.1.7 settings form, and the wire envelope the browser scope validates against. */
export const Config = z.object({
  [COUNT_FIELD]: countField(),
})

export async function apply(ctx, config = {}) {
  const home = ctx.profileContext?.home || envDshHome()
  if (isLegacyHost(ctx)) await ensurePreset(home)
  // 组合行里的值是权威值；它还是默认值而镜像里另有数字时，说明这是从只认镜像的
  // 版本升上来的，先按镜像走，再把数字回写进宿主设置。
  const composed = clampCount(unwrap(config[COUNT_FIELD]))
  const mirrored = readCount(home)
  const target = composed === DEFAULT_COUNT && mirrored !== DEFAULT_COUNT ? mirrored : composed
  writeCount(home, target)
  const needsBackfill = composed === DEFAULT_COUNT && target !== DEFAULT_COUNT
  // 镜像只在装载这一刻刷新：0.1.7 的 volatile 盒子是「用的时候拉」，node 侧没有设置
  // 变更回调（`SettingsForms` 只有 describe/update/configure），跟着盒子挂 effect
  // 实测不会重跑。所以改完数量要重启宿主，写作规范里的 N 才会变。
  ctx.inject(['settings'], (settingsCtx) => {
    // 0.1.6 的 settings 服务不投影表单，命名空间要本插件自己注册。
    if (typeof settingsCtx.settings.register === 'function') return legacyNamespace(settingsCtx, home, needsBackfill)
    // 0.1.7：设置页由本包的 client 半区提供，关掉宿主的自动生成页。
    if (typeof settingsCtx.settings.configure === 'function') {
      settingsCtx.effect(() => settingsCtx.settings.configure({ auto: false }, ctx.fiber))
    }
    if (needsBackfill) {
      // 本行还在装载中时宿主不肯把表单写回自己，等 Loader 收尾再回填 profile patch。
      void ctx.loader
        .await()
        .then(() => settingsCtx.settings.update(NS, { [COUNT_FIELD]: target }))
        .catch((e) => ctx.logger.warn('dsh-novel-solo: count backfill skipped', e))
    }
  })
}

/** 0.1.6：注册命名空间供设置卡片读写，并把解析值同步进镜像文件。 */
function legacyNamespace(settingsCtx, home, needsBackfill) {
  const scope = settingsCtx.settings.register(NS, Config)
  if (needsBackfill) {
    const descriptor = settingsCtx.settings.describe({ redactSecrets: true }).find((v) => v.ns === NS)
    if (descriptor && descriptor.user === undefined) {
      void scope.update({ [COUNT_FIELD]: readCount(home) }).catch(() => {})
    }
  }
  const mirror = () => writeCount(home, scope.get()[COUNT_FIELD])
  mirror()
  scope.watch(mirror)
}
