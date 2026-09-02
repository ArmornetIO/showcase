<script lang="ts">
	import ShowcaseBlock from '$lib/dev/ShowcaseBlock.svelte';
	import NodeDrawer from '$lib/display/drawer/NodeDrawer.svelte';
	import type { DrawerPosition } from '$lib/display/drawer/NodeDrawer.svelte';
	import type { MeshNodeType, NodeState } from '$lib/primitives/canvas/canvas.types.js';
	import Icon from '$lib/icons/Icon.svelte';

	const DRAWER_META: Record<MeshNodeType, { icon: string; title: string; nodeId: string }> = {
		'control-plane': { icon: 'CP',   title: 'Policy Engine',    nodeId: 'ctrl.plane.01'    },
		'agentic':       { icon: 'AG',   title: 'Dep Analysis',     nodeId: 'dep.analysis.02'  },
		'proxy':         { icon: 'PX',   title: 'Supply Chain',     nodeId: 'supply.chain.03'  },
		'daemon':        { icon: 'DM',   title: 'GitHub Runner',    nodeId: 'gh.runner.04'     },
	};

	let drawerOpen      = $state(true);
	let drawerType      = $state<MeshNodeType>('control-plane');
	let drawerNodeState = $state<NodeState>('healthy');
	let drawerPosition  = $state<DrawerPosition>('bottom');
</script>

<svelte:head>
	<title>NodeDrawer — UI Lib</title>
</svelte:head>

<div class="px-3 sm:px-6 py-4 sm:py-5">
	<ShowcaseBlock component="NodeDrawer">
		<h3 class="component-name">NodeDrawer</h3>
		<p class="component-desc">
			Slide-in panel for mesh node detail. Tabs are <strong>type-aware</strong> — each
			<code class="demo-code">MeshNodeType</code> shows a distinct set:
			<code class="demo-code">control-plane</code> → Agents + Push Queue + Auth Log,
			<code class="demo-code">agentic</code> → Queries + Tools + Feed,
			<code class="demo-code">proxy</code> → Intercepts + Block Log + Config,
			<code class="demo-code">daemon</code> → Task Log + Config.
			The header accent color, glow, and tab underline are all driven by type.
			<code class="demo-code">nodeState</code> drives the status badge.
		</p>

		<div class="blade-ctrl">
			<!-- Type -->
			<div class="bc-group">
				<span class="bc-label">TYPE</span>
				<div class="bc-btns">
					{#each (['control-plane', 'agentic', 'proxy', 'daemon'] as const) as t}
						<button
							class="bc-btn"
							class:bc-active={drawerType === t}
							style="width:auto;padding:0 8px;font-family:var(--mono);font-size:0.5rem;letter-spacing:0.08em;"
							onclick={() => (drawerType = t)}
							title={t}
						>{t}</button>
					{/each}
				</div>
			</div>

			<span class="bc-sep" aria-hidden="true"></span>

			<!-- State -->
			<div class="bc-group">
				<span class="bc-label">STATE</span>
				<div class="bc-btns">
					<button
						class="bc-btn bc-success"
						class:bc-active={drawerNodeState === 'healthy'}
						title="Healthy"
						onclick={() => (drawerNodeState = 'healthy')}
					><Icon name="check-circle-2" size={13} /></button>
					<button
						class="bc-btn bc-warn"
						class:bc-active={drawerNodeState === 'degraded'}
						title="Degraded"
						onclick={() => (drawerNodeState = 'degraded')}
					><Icon name="alert-triangle" size={13} /></button>
					<button
						class="bc-btn bc-muted"
						class:bc-active={drawerNodeState === 'offline'}
						title="Offline"
						onclick={() => (drawerNodeState = 'offline')}
					><Icon name="x-circle" size={13} /></button>
				</div>
			</div>

			<span class="bc-sep" aria-hidden="true"></span>

			<!-- Position -->
			<div class="bc-group">
				<span class="bc-label">POSITION</span>
				<div class="bc-btns">
					{#each (['bottom', 'right', 'left', 'top'] as const) as p}
						<button
							class="bc-btn"
							class:bc-active={drawerPosition === p}
							style="width:auto;padding:0 6px;font-family:var(--mono);font-size:0.5rem;"
							onclick={() => (drawerPosition = p)}
						>{p}</button>
					{/each}
				</div>
			</div>

			<span class="bc-sep" aria-hidden="true"></span>

			<!-- Toggle -->
			<div class="bc-group">
				<span class="bc-label">OPEN</span>
				<div class="bc-btns">
					<button
						class="bc-btn"
						class:bc-active={drawerOpen}
						title="Toggle drawer"
						onclick={() => (drawerOpen = !drawerOpen)}
					><Icon name={drawerOpen ? 'eye' : 'eye-off'} size={13} /></button>
				</div>
			</div>
		</div>

		<!-- Demo frame -->
		<div class="drawer-demo-frame">
			<div class="drawer-demo-bg">
				<div class="drawer-demo-hint font-[var(--mono)] text-[0.625rem] text-[var(--fg-dim)]">
					↑ Canvas / topology view area ↑
				</div>
			</div>

			<NodeDrawer
				open={drawerOpen}
				position={drawerPosition}
				type={drawerType}
				icon={DRAWER_META[drawerType].icon}
				title={DRAWER_META[drawerType].title}
				nodeId={DRAWER_META[drawerType].nodeId}
				nodeState={drawerNodeState}
				onclose={() => (drawerOpen = false)}
			>
				{#snippet overview()}
					<div class="demo-overview">
						<div class="demo-kv-row"><span class="demo-kv-key">Uptime</span><span class="demo-kv-val">99.9%</span></div>
						<div class="demo-kv-row"><span class="demo-kv-key">Version</span><span class="demo-kv-val">0.8.4</span></div>
						<div class="demo-kv-row"><span class="demo-kv-key">State</span><span class="demo-kv-val">{drawerNodeState}</span></div>
						<p class="demo-placeholder">Type-specific overview metrics for <strong>{drawerType}</strong> nodes go here.</p>
					</div>
				{/snippet}
			</NodeDrawer>
		</div>
	</ShowcaseBlock>
</div>

<style>
	.drawer-demo-frame {
		position: relative;
		width: 100%;
		height: 420px;
		margin-top: 14px;
		border: 1px solid var(--border);
		border-radius: 8px;
		overflow: hidden;
	}

	.drawer-demo-bg {
		position: absolute;
		inset: 0;
		background: var(--bg);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.drawer-demo-hint {
		opacity: 0.4;
		letter-spacing: 0.12em;
	}

	.demo-overview {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.demo-kv-row {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 11px;
	}

	.demo-kv-key {
		font-family: var(--mono);
		color: var(--fg-dim);
		min-width: 72px;
		font-size: 10px;
		letter-spacing: 0.06em;
	}

	.demo-kv-val {
		color: var(--fg-muted);
		font-family: var(--mono);
		font-size: 11px;
	}

	.demo-placeholder {
		font-size: 11px;
		color: var(--fg-dim);
		font-style: italic;
		line-height: 1.5;
		margin: 0;
	}

	/* Blade controls */
	.blade-ctrl {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 10px;
		margin: 16px 0 4px;
		padding: 10px 12px;
		background: var(--bg-elev);
		border: 1px solid var(--border);
		border-radius: 6px;
	}

	.bc-group  { display: flex; align-items: center; gap: 6px; }
	.bc-btns   { display: flex; gap: 3px; }
	.bc-label  { font-family: var(--mono); font-size: 0.5rem; letter-spacing: 0.15em; color: var(--fg-dim); }
	.bc-sep    { width: 1px; height: 20px; background: var(--border); flex-shrink: 0; }

	.bc-btn {
		width: 26px;
		height: 26px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: 4px;
		color: var(--fg-dim);
		cursor: pointer;
		transition: border-color 0.15s, color 0.15s, background 0.15s;
	}
	.bc-btn:hover           { border-color: var(--accent); color: var(--accent); }
	.bc-btn.bc-active       { border-color: var(--accent); color: var(--accent); background: var(--accent-faint); }
	.bc-success:hover,
	.bc-success.bc-active   { border-color: #34D399; color: #34D399; background: rgba(52,211,153,0.1); }
	.bc-warn:hover,
	.bc-warn.bc-active      { border-color: #FCD34D; color: #FCD34D; background: rgba(252,211,77,0.1); }
	.bc-muted:hover,
	.bc-muted.bc-active     { border-color: #94A3B8; color: #94A3B8; background: rgba(148,163,184,0.1); }
</style>
