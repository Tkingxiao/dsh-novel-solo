window.__ModuleLoader__.load({
	id: "dsh-novel-solo",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let React = require("react");
		const { useState, useEffect } = React;

		const NS = 'dshNovelSolo'
		const CHANNEL = '/dsh-novel-solo'
		const MIN_COUNT = 1
		const MAX_COUNT = 12
		const DEFAULT_COUNT = 1

		const zh = {
			title: '子 agent 数量',
			desc: 'novel-solo 同时放出的子 agent 并发上限（1-12）。启动子 agent 后主 agent 会停止等待汇报。'
		}
		const en = {
			title: 'Subagent count',
			desc: 'Max subagents the novel-solo preset may fan out in parallel (1-12). The main agent stops and waits for their report.'
		}

		let rpcCallFn = null
		function initRpc(call) {
			rpcCallFn = call
		}
		const rpcEndpoint = (method) => `${NS}/${method}`
		async function rpc(method, payload) {
			if (!rpcCallFn) return undefined
			try {
				const res = await rpcCallFn(rpcEndpoint(method), payload)
				if (res && res.ok === true) return res.value
				console.warn(`dsh-novel-solo: rpc "${method}" failed`, res?.error)
				return undefined
			} catch (e) {
				console.warn(`dsh-novel-solo: rpc "${method}" threw`, e)
				return undefined
			}
		}
		async function loadCount() {
			const v = await rpc('read', {})
			return v && typeof v === 'object' && typeof v.agentCount === 'number' ? v.agentCount : DEFAULT_COUNT
		}
		async function saveCount(n) {
			await rpc('writeAgentCount', { count: n })
		}

		function clamp(raw) {
			const n = Number(raw)
			if (!Number.isInteger(n)) return DEFAULT_COUNT
			return Math.min(MAX_COUNT, Math.max(MIN_COUNT, n))
		}

		function AgentCountRow(props) {
			const { t, load, save } = props
			const [count, setCount] = useState(DEFAULT_COUNT)
			useEffect(() => {
				let alive = true
				void load().then((n) => {
					if (alive) setCount(clamp(n))
				})
				return () => { alive = false }
			}, [])
			const commit = (raw) => {
				const n = clamp(raw)
				setCount(n)
				void save(n)
			}
			return React.createElement(
				'div',
				{ style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '12px 0' } },
				React.createElement(
					'div',
					{ style: { minWidth: 0 } },
					React.createElement('div', { style: { fontWeight: 600 } }, t('title')),
					React.createElement('div', { style: { fontSize: 12, opacity: 0.7, marginTop: 2 } }, t('desc'))
				),
				React.createElement('input', {
					type: 'number',
					min: MIN_COUNT,
					max: MAX_COUNT,
					step: 1,
					value: count,
					onChange: (e) => commit(e.target.value),
					style: {
						width: 72,
						padding: '6px 10px',
						borderRadius: 8,
						border: '1px solid var(--dsh-alias-border, currentColor)',
						background: 'transparent',
						color: 'inherit'
					}
				})
			)
		}

		exports.name = 'dsh-novel-solo'
		exports.inject = ['slots', 'locale', 'connection']

		exports.apply = function (ctx) {
			initRpc((endpoint, payload) =>
				ctx.connection.rpc.call(CHANNEL, endpoint, payload).then((res) => res || undefined)
			)
			ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-novel-solo: i18n')
			ctx.slots.inject('settings.general.item', () => ctx.slots.register({
				name: 'settings.general.item',
				id: 'agent-count',
				order: 100,
				locale: NS,
				inject: () => ({ t: ctx.locale.bind(NS), load: loadCount, save: saveCount })
			}, AgentCountRow))
		}

		return module.exports;
	}
});