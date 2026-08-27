// Preset-scoped edge of @deepseek-ai/dsh-llm-tool-choice-pin, vendored into
// the novel-solo preset so the plugin is NOT installed/profile-wide and applies
// only to sessions that mount this preset.
//
// Pins `toolChoice` on every LLM request whose `provider` matches the
// configured list (`llama`). On a quantized model the tool-decision logits
// inflate per-token decode cost; `toolChoice: none` restores full prose
// throughput while `auto`/`any` pays for the tool-call decision every token.
//
// Seam: hooks the `agent/request` waterfall. The agent loop spreads the
// returned config verbatim into the final deep-frozen GenerateOptions, so the
// `toolChoice` override reaches the wire without violating reconstructability.
//
// Plain ESM, no runtime deps (schemastery `Config` validation is dropped;
// apply reads `config` directly). This file is deliberately side-effect free:
// it never writes logs or touches disk. A preset that genuinely calls tools can
// override downstream with its own `agent/request` listener.

export const name = 'llm-tool-choice-pin'
export const inject = []

const DEFAULTS = Object.freeze({
  providers: ['llama'],
  toolChoice: 'none',
})

export function apply(ctx, config = {}) {
  const providers = config.providers ?? DEFAULTS.providers
  const toolChoice = config.toolChoice ?? DEFAULTS.toolChoice

  if (!Array.isArray(providers) || providers.length === 0) return
  const providerSet = new Set(providers)

  ctx.on('agent/request', async (_payload, next) => {
    const upstream = await next()
    if (upstream === null || typeof upstream !== 'object') return upstream
    if (!providerSet.has(upstream.provider)) return upstream
    return { ...upstream, toolChoice }
  })
}