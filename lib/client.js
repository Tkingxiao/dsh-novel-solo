window.__ModuleLoader__.load({
	id: "dsh-novel-solo",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let React = require("react");
		const { useState, useEffect } = React;

		const NS = 'dsh-novel-solo'
		const COUNT_FIELD = 'count'
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

		function clamp(raw) {
			const n = Number(raw)
			if (!Number.isInteger(n)) return DEFAULT_COUNT
			return Math.min(MAX_COUNT, Math.max(MIN_COUNT, n))
		}

		function AgentCountCard(props) {
			const { t, scope } = props
			const [count, setCount] = useState(DEFAULT_COUNT)
			useEffect(() => {
				const sync = () => {
					const snap = scope.getSnapshot()
					const v = snap && snap.value && typeof snap.value === 'object' ? snap.value[COUNT_FIELD] : DEFAULT_COUNT
					setCount(clamp(v))
				}
				sync()
				return scope.subscribe(sync)
			}, [scope])
			const commit = (raw) => {
				const n = clamp(raw)
				setCount(n)
				void scope.set(COUNT_FIELD, n)
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
		exports.inject = ['slots', 'locale', 'settingsScope']

		exports.apply = function (ctx) {
			ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-novel-solo: i18n')
			ctx.slots.inject('settings.plugin.item', () => ctx.slots.register({
				name: 'settings.plugin.item',
				key: NS,
				order: 100,
				locale: NS,
				inject: () => ({ t: ctx.locale.bind(NS), scope: ctx.settingsScope.bind({ namespace: NS }) })
			}, AgentCountCard))
		}

		return module.exports;
	}
});
