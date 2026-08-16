<script lang="ts">
	import ShowcaseBlock from '$lib/dev/ShowcaseBlock.svelte';
	import AlertBladeHost from '$lib/display/drawer/AlertBladeHost.svelte';
	import type { BladePosition } from '$lib/display/drawer/AlertBladeHost.svelte';
	import { alertBlade } from '$lib/display/drawer/alertBlade.svelte.js';
	import Icon from '$lib/icons/Icon.svelte';

	let bladePosition = $state<BladePosition>('bottom-right');
	let bladeDraggable = $state(false);
</script>

<svelte:head>
	<title>AlertBlade — UI Lib</title>
</svelte:head>

<div class="px-3 sm:px-6 py-4 sm:py-5">
	<ShowcaseBlock component="AlertBladeHost">
		<h3 class="component-name">AlertBlade</h3>
		<p class="component-desc">Non-blocking toast notification system. Calls <code class="demo-code">alertBlade.show()</code> from anywhere in the app — the singleton store manages the queue. Set <code class="demo-code">duration: 0</code> for persistent alerts requiring manual dismissal. Add an <code class="demo-code">action</code> to give the user a direct path to the relevant view. Place <code class="demo-code">AlertBladeHost</code> once in your app shell.</p>
		<div class="blade-ctrl">
			<!-- Variant triggers -->
			<div class="bc-group">
				<span class="bc-label">TRIGGER</span>
				<div class="bc-btns">
					<button
						class="bc-btn bc-info"
						title="Info"
						onclick={() => alertBlade.show({ message: 'Agent mesh topology updated.' })}
						><Icon name="info" size={13} /></button
					>
					<button
						class="bc-btn bc-success"
						title="Success"
						onclick={() =>
							alertBlade.show({
								variant: 'success',
								title: 'Assessment complete',
								message: 'SOC 2 evidence collected.'
							})}><Icon name="check-circle-2" size={13} /></button
					>
					<button
						class="bc-btn bc-warn"
						title="Warn"
						onclick={() =>
							alertBlade.show({
								variant: 'warn',
								title: 'Degraded node',
								message: 'intel.feed.02 reporting elevated latency.'
							})}><Icon name="alert-triangle" size={13} /></button
					>
					<button
						class="bc-btn bc-danger"
						title="Danger"
						onclick={() =>
							alertBlade.show({
								variant: 'danger',
								title: 'Connection lost',
								message: 'edge.relay.03 went offline.'
							})}><Icon name="x-circle" size={13} /></button
					>
				</div>
			</div>

			<span class="bc-sep" aria-hidden="true"></span>

			<!-- Extras -->
			<div class="bc-group">
				<span class="bc-label">EXTRAS</span>
				<div class="bc-btns">
					<button
						class="bc-btn"
						title="Persistent (no auto-dismiss)"
						onclick={() =>
							alertBlade.show({
								variant: 'info',
								message: 'Persistent — dismiss manually.',
								duration: 0
							})}><Icon name="clock" size={13} /></button
					>
					<button
						class="bc-btn"
						title="With action button"
						onclick={() =>
							alertBlade.show({
								variant: 'warn',
								title: 'Config drift',
								message: 'policy.engine.01 differs from source.',
								action: { label: 'Review', onclick: () => alertBlade.clear() }
							})}><Icon name="zap" size={13} /></button
					>
					<button class="bc-btn bc-clear" title="Clear all" onclick={() => alertBlade.clear()}
						><Icon name="trash" size={13} /></button
					>
				</div>
			</div>

			<span class="bc-sep" aria-hidden="true"></span>

			<!-- Position 2×2 -->
			<div class="bc-group">
				<span class="bc-label">POSITION</span>
				<div class="bc-pos">
					<button
						class="bc-pos-btn"
						class:bc-pos-active={bladePosition === 'top-left'}
						title="Top left"
						onclick={() => (bladePosition = 'top-left')}>TL</button
					>
					<button
						class="bc-pos-btn"
						class:bc-pos-active={bladePosition === 'top-right'}
						title="Top right"
						onclick={() => (bladePosition = 'top-right')}>TR</button
					>
					<button
						class="bc-pos-btn"
						class:bc-pos-active={bladePosition === 'bottom-left'}
						title="Bottom left"
						onclick={() => (bladePosition = 'bottom-left')}>BL</button
					>
					<button
						class="bc-pos-btn"
						class:bc-pos-active={bladePosition === 'bottom-right'}
						title="Bottom right"
						onclick={() => (bladePosition = 'bottom-right')}>BR</button
					>
				</div>
			</div>

			<span class="bc-sep" aria-hidden="true"></span>

			<!-- Draggable toggle -->
			<div class="bc-group">
				<span class="bc-label">DRAG</span>
				<button
					class="bc-btn"
					class:bc-active={bladeDraggable}
					title={bladeDraggable ? 'Draggable on' : 'Draggable off'}
					onclick={() => (bladeDraggable = !bladeDraggable)}
					><Icon name="maximize-2" size={13} /></button
				>
			</div>
		</div>
	</ShowcaseBlock>
</div>

<AlertBladeHost position={bladePosition} draggable={bladeDraggable} />

<style>
	.component-block {
		display: flex;
		flex-direction: column;
		gap: 0.9rem;
		padding: 1.25rem;
		border: 1px solid var(--border);
		border-radius: 8px;
		background: var(--bg-elev);
		margin-bottom: 1.5rem;
	}

	.demo-code {
		font-family: var(--mono);
		font-size: 0.78em;
		background: var(--surface-strong);
		border: 1px solid var(--border);
		padding: 0.1rem 0.35rem;
		border-radius: 3px;
		color: var(--fg-muted);
	}

	.blade-ctrl {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 12px;
		padding: 12px 16px;
		background: rgba(0, 0, 0, 0.25);
		border: 1px solid rgba(255, 255, 255, 0.06);
		border-radius: 3px;
	}
	.bc-group {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.bc-label {
		font-family: var(--mono);
		font-size: 0.5rem;
		letter-spacing: 0.2em;
		color: var(--fg-muted, rgba(156, 163, 175, 0.45));
	}
	.bc-btns {
		display: flex;
		gap: 4px;
	}
	.bc-sep {
		width: 1px;
		height: 44px;
		background: rgba(255, 255, 255, 0.07);
		flex-shrink: 0;
		align-self: center;
	}
	.bc-btn {
		width: 30px;
		height: 30px;
		display: flex;
		align-items: center;
		justify-content: center;
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 2px;
		background: transparent;
		color: var(--fg-dim);
		cursor: pointer;
		padding: 0;
		transition:
			color 0.15s,
			border-color 0.15s,
			background 0.15s;
	}
	.bc-btn:hover {
		color: var(--accent);
		border-color: rgba(94, 234, 212, 0.4);
		background: rgba(94, 234, 212, 0.06);
	}
	.bc-btn.bc-active {
		color: var(--accent);
		border-color: rgba(94, 234, 212, 0.5);
		background: rgba(94, 234, 212, 0.1);
	}
	.bc-btn.bc-info {
		color: #5fead5;
		border-color: rgba(95, 234, 213, 0.3);
	}
	.bc-btn.bc-info:hover {
		background: rgba(95, 234, 213, 0.1);
		border-color: rgba(95, 234, 213, 0.6);
	}
	.bc-btn.bc-success {
		color: #34d399;
		border-color: rgba(52, 211, 153, 0.3);
	}
	.bc-btn.bc-success:hover {
		background: rgba(52, 211, 153, 0.1);
		border-color: rgba(52, 211, 153, 0.6);
	}
	.bc-btn.bc-warn {
		color: #fcd34d;
		border-color: rgba(252, 211, 77, 0.3);
	}
	.bc-btn.bc-warn:hover {
		background: rgba(252, 211, 77, 0.1);
		border-color: rgba(252, 211, 77, 0.6);
	}
	.bc-btn.bc-danger {
		color: #fca5a5;
		border-color: rgba(252, 165, 165, 0.3);
	}
	.bc-btn.bc-danger:hover {
		background: rgba(252, 165, 165, 0.1);
		border-color: rgba(252, 165, 165, 0.6);
	}
	.bc-btn.bc-clear {
		color: rgba(252, 165, 165, 0.6);
	}
	.bc-btn.bc-clear:hover {
		color: #fca5a5;
		border-color: rgba(252, 165, 165, 0.5);
		background: rgba(252, 165, 165, 0.08);
	}

	.bc-pos {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 3px;
	}
	.bc-pos-btn {
		width: 26px;
		height: 20px;
		display: flex;
		align-items: center;
		justify-content: center;
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 2px;
		background: transparent;
		color: var(--fg-muted, rgba(156, 163, 175, 0.4));
		font-family: var(--mono);
		font-size: 0.5rem;
		letter-spacing: 0.05em;
		cursor: pointer;
		padding: 0;
		transition:
			color 0.15s,
			border-color 0.15s,
			background 0.15s;
	}
	.bc-pos-btn:hover {
		color: var(--fg-dim);
		border-color: rgba(255, 255, 255, 0.2);
	}
	.bc-pos-btn.bc-pos-active {
		color: var(--accent);
		border-color: rgba(94, 234, 212, 0.5);
		background: rgba(94, 234, 212, 0.1);
	}
</style>
