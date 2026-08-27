/**
 * dsh-novel-solo — node half.
 *
 * Owns a tiny file-backed store at `~/.dsh/.dsh-novel-solo-data/agent-count.json`
 * and exposes it on the dedicated RPC channel `/dsh-novel-solo` (never the
 * shared `/api`). The value is the max parallel subagents (1-12) that the
 * novel-solo agent-plane injector reads at request time.
 */
import { mkdir, readFile, writeFile, cp } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import os from 'node:os'

export const name = 'dsh-novel-solo'
export const inject = ['connection']

const NS = 'dshNovelSolo'
const CHANNEL = '/dsh-novel-solo'
const DATA_DIR = '.dsh-novel-solo-data'
const CONFIG_FILE = 'agent-count.json'
const MIN_COUNT = 1
const MAX_COUNT = 12
const DEFAULT_COUNT = 1

const PRESET_NAME = 'novel-solo'
// 插件包根目录：lib/index.js 的上两级即包根。内置预设模板随包携带，
// 安装时幂等铺设到 <dshHome>/.agent-presets/novel-solo/（存在则不覆盖）。
const PKG_ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const TEMPLATE_PRESET = join(PKG_ROOT, 'template')

const expandHome = (p) => (p === '~' ? os.homedir() : /^~[\\/]/.test(p) ? join(os.homedir(), p.slice(2)) : p)
const dshHome = () => (process.env.DSH_HOME ? expandHome(process.env.DSH_HOME) : join(os.homedir(), '.dsh'))
const userPresetsDir = () => join(dshHome(), '.agent-presets')
const presetDir = () => join(userPresetsDir(), PRESET_NAME)

// 幂等铺设：目标目录已存在则跳过（绝不覆盖用户已编辑的预设）；可设
// DSH_NOVEL_SKIP_DEPLOY=1 关闭，或 DSH_NOVEL_REDEPLOY=1 强制覆盖。
async function ensurePreset() {
  if (process.env.DSH_NOVEL_SKIP_DEPLOY === '1') return
  try {
    if (existsSync(presetDir()) && process.env.DSH_NOVEL_REDEPLOY !== '1') return
    if (!existsSync(join(TEMPLATE_PRESET, 'agent.cordis.yml'))) return
    await mkdir(userPresetsDir(), { recursive: true })
    await cp(TEMPLATE_PRESET, presetDir(), { recursive: true, force: process.env.DSH_NOVEL_REDEPLOY === '1' })
  } catch (e) {
    console.warn(`dsh-novel-solo: preset deploy skipped for "${PRESET_NAME}"`, e)
  }
}

const storeDir = () => join(dshHome(), DATA_DIR)
const storeFile = () => join(dshHome(), DATA_DIR, CONFIG_FILE)

// Persona 同步锚点：GUI 保存并发数时，同步改写 persona 文本里的「并发上限
// N=<数字>」。默认改写部署目录里的 preset；额外同步文件用环境变量显式指定。
const PERSONA_FILES = [
  process.env.DSH_NOVEL_PERSONA_YAML ?? join(presetDir(), 'agent.cordis.yml'),
  ...(process.env.DSH_NOVEL_PERSONA_MD ? [process.env.DSH_NOVEL_PERSONA_MD] : []),
]
const CONCURRENCY_ANCHOR = /(并发上限\s*N=)\d+/g

/** Coerce an unknown count into an integer in [1, 12]; unnamed/finished values
 *  fall back to the default so a stale file can never crash the injector. */
function clampCount(v) {
  const n = typeof v === 'string' ? Number(v) : v
  return Number.isInteger(n) && n >= MIN_COUNT && n <= MAX_COUNT ? n : DEFAULT_COUNT
}

async function ensureDir() {
  await mkdir(storeDir(), { recursive: true })
}

async function readCount() {
  try {
    const raw = await readFile(storeFile(), 'utf8')
    const parsed = JSON.parse(raw)
    return clampCount(parsed && typeof parsed === 'object' ? parsed.count : parsed)
  } catch {
    return DEFAULT_COUNT
  }
}

async function syncPersona(count) {
  for (const file of PERSONA_FILES) {
    try {
      const text = await readFile(file, 'utf8')
      const next = text.replace(CONCURRENCY_ANCHOR, `$1${count}`)
      if (next !== text) await writeFile(file, next, 'utf8')
    } catch (e) {
      console.warn(`dsh-novel-solo: persona sync skipped for "${file}"`, e)
    }
  }
}

async function writeCount(count) {
  const n = clampCount(count)
  await ensureDir()
  try {
    await writeFile(storeFile(), JSON.stringify({ count: n }, null, 2), 'utf8')
  } catch (e) {
    console.warn(`dsh-novel-solo: failed to write "${CONFIG_FILE}"`, e)
  }
  await syncPersona(n)
  return n
}

export async function apply(ctx) {
  await ensurePreset()
  return ctx.connection.rpc.handle(
    CHANNEL,
    async (ep, payload) => {
      const method = ep.slice(`${NS}/`.length)
      try {
        switch (method) {
          case 'read':
            return { ok: true, value: { agentCount: await readCount() } }
          case 'writeAgentCount':
            return { ok: true, value: { agentCount: await writeCount(payload?.count) } }
          default:
            return { ok: false, error: { code: 'bad-request', message: `unknown endpoint ${ep}`, details: {} } }
        }
      } catch (e) {
        return { ok: false, error: { code: 'internal', message: e instanceof Error ? e.message : String(e), details: {} } }
      }
    },
    { authority: 'trusted-host' },
  )
}