<script lang="ts">
	export type LogLevel = 'info' | 'warn' | 'err' | 'ok';

	interface LogRowProps {
		ts: string;
		level: LogLevel;
		message: string;
	}

	let { ts, level, message }: LogRowProps = $props();

	const LEVEL_LABELS: Record<LogLevel, string> = {
		info: 'INFO',
		warn: 'WARN',
		err:  'ERR',
		ok:   'OK',
	};
</script>

<div class="log-row">
	<span class="log-ts">{ts}</span>
	<span class="log-level level-{level}">{LEVEL_LABELS[level]}</span>
	<span class="log-msg">{message}</span>
</div>

<style>
	.log-row {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: 3px 0;
		transition: background 0.1s ease;
	}
	@media (min-width: 640px) {
		.log-row {
			display: grid;
			grid-template-columns: 70px 70px 1fr;
			align-items: center;
			gap: 0;
		}
	}

	.log-row:hover {
		background: rgba(95, 234, 213, 0.03);
	}

	.log-ts {
		font-family: var(--mono);
		font-size: 10px;
		color: var(--fg-dim);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.log-level {
		font-family: var(--mono);
		font-size: 9px;
		letter-spacing: 0.1em;
		padding: 2px 6px;
		border-radius: 2px;
		border: 1px solid;
		display: inline-block;
		width: fit-content;
	}

	.level-info {
		color: var(--palette-blue-l);
		border-color: rgba(56, 189, 248, 0.35);
	}

	.level-warn {
		color: var(--palette-amber);
		border-color: rgba(252, 211, 77, 0.4);
	}

	.level-err {
		color: var(--palette-red);
		border-color: rgba(252, 165, 165, 0.4);
	}

	.level-ok {
		color: var(--palette-emerald-l);
		border-color: rgba(52, 211, 153, 0.35);
	}

	.log-msg {
		font-family: var(--mono);
		font-size: 11px;
		color: var(--fg-muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
</style>
