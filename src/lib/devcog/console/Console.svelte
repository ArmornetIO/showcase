<script lang="ts">
	// The console: one panel, one group at a time, nothing standing on screen a
	// control's own label does not need.
	//
	// 420px because a fader bank cannot put three legible strips in the 300px
	// the old drawer used. The extra width costs page coverage, which is paid
	// for by the inspector living on the cluster — the panel no longer has to be
	// open while you pick an element.
	import GroupRail from './GroupRail.svelte';
	import type { ToolGroup } from './types.js';
	import type { ConsoleState } from './console-state.svelte.js';
	import type { NitsController } from '../qa/nits.svelte.js';

	interface ConsoleProps {
		groups: ToolGroup[];
		state: ConsoleState;
		nits: NitsController;
		/** Where flags and serve mode live now. One link, not a sentence. */
		flagsHref?: string;
		onClose: () => void;
	}

	let { groups, state, nits, flagsHref = '/admin/flags', onClose }: ConsoleProps = $props();

	const ordered = $derived([...groups].sort((a, b) => (a.order ?? 99) - (b.order ?? 99)));
	const current = $derived(state.resolve(ordered));
</script>

<aside class="devcog-console" data-devcog aria-label="Dev console">
	<GroupRail groups={ordered} active={current?.id ?? ''} onselect={(id) => state.select(id)} />

	<div class="dc-main">
		<header class="dc-head">
			<span class="dc-title">{current?.label ?? ''}</span>
			<button class="dc-x" aria-label="Close console" onclick={onClose}>✕</button>
		</header>

		<div
			class="console-body"
			class:dc-scrolls={current?.scrolls}
			data-group={current?.id ?? ''}
		>
			{#if !current}
				<p class="dc-gate">No tools on this page.</p>
			{:else if current.available === false}
				<p class="dc-gate">{current.gate}</p>
			{:else}
				{@render current.content(nits)}
			{/if}
		</div>

		<footer class="dc-foot">
			<a class="dc-link" href={flagsHref}>flags →</a>
		</footer>
	</div>
</aside>

<style>
	.devcog-console {
		position: fixed;
		top: 0;
		right: 0;
		bottom: 0;
		z-index: 9996;
		width: 420px;
		display: flex;
		background: color-mix(in srgb, var(--bg-elev) 94%, transparent);
		backdrop-filter: blur(20px);
		-webkit-backdrop-filter: blur(20px);
		border-left: 1px solid color-mix(in srgb, var(--accent) 20%, transparent);
		box-shadow: -8px 0 40px rgba(0, 0, 0, 0.4);
		animation: console-in 0.18s ease;
	}
	@keyframes console-in {
		from {
			transform: translateX(100%);
			opacity: 0;
		}
	}

	.dc-main {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
	}
	.dc-head {
		display: flex;
		align-items: center;
		height: 38px;
		padding: 0 10px 0 14px;
		border-bottom: 1px solid var(--border);
		flex: none;
	}
	.dc-title {
		flex: 1;
		font-family: var(--mono, monospace);
		font-size: 0.56rem;
		letter-spacing: 0.26em;
		color: var(--accent);
	}
	.dc-x {
		border: 1px solid var(--border);
		background: transparent;
		color: var(--fg-dim);
		border-radius: 4px;
		width: 22px;
		height: 22px;
		font-size: 0.6rem;
		cursor: pointer;
	}
	.dc-x:hover {
		color: var(--fg);
		border-color: var(--border-strong);
	}

	.console-body {
		flex: 1;
		min-height: 0;
		padding: 12px 14px;
		overflow: hidden;
	}
	/* Only the capture batch may scroll; every other group is sized to fit, and
	   a group you have to scroll is a group this design failed to fit. */
	.dc-scrolls {
		overflow-y: auto;
		scrollbar-width: thin;
		scrollbar-color: var(--border) transparent;
	}

	.dc-gate {
		margin: 0;
		font-family: var(--mono, monospace);
		font-size: 0.6rem;
		line-height: 1.5;
		color: var(--fg-dim);
	}

	.dc-foot {
		flex: none;
		padding: 7px 14px;
		border-top: 1px solid var(--border);
	}
	.dc-link {
		font-family: var(--mono, monospace);
		font-size: 0.55rem;
		color: var(--fg-dim);
		text-decoration: none;
	}
	.dc-link:hover {
		color: var(--accent);
	}
</style>
