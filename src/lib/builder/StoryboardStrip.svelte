<script lang="ts">
	// The storyboard filmstrip along the bottom of the canvas: the active
	// storyboard's stages in replay order. Click one to go there, drag to
	// reorder, play to replay. Always on screen because building a flow is the
	// main activity here, not a side panel.
	import { onMount, tick } from 'svelte';
	import { builder } from './store.svelte.js';
	import { storyboard, DEFAULT_HOLD_MS, type Box, type Stage } from './storyboard.svelte.js';

	interface Props {
		/** Put the camera on a world-space box. The caller knows which chrome
		 *  covers the canvas; the strip does not. */
		fit: (box: Box) => void;
	}

	let { fit }: Props = $props();

	const THUMB_W = 112;
	const THUMB_H = 64;

	let collapsed = $state(false);
	let playing = $state(false);
	/** Bumped to cancel a replay in flight: each run checks it still owns the strip. */
	let run = 0;
	let dragFrom = $state<string | null>(null);

	const board = $derived(storyboard.active);
	const stages = $derived(board?.stages ?? []);
	const canNext = $derived(builder.selectedFrame !== null);
	const canAdd = $derived(builder.selectedFrame !== null || builder.selectedId !== null);

	onMount(() => {
		storyboard.hydrate();
		return () => run++;
	});

	async function go(stage: Stage): Promise<boolean> {
		storyboard.setCurrent(stage.id);
		if (stage.pageId !== builder.activePageId) {
			builder.switchPage(stage.pageId);
			await tick();
		}
		const r = storyboard.resolve(stage);
		if (r) fit(r.box);
		return r !== null;
	}

	async function play() {
		const token = ++run;
		playing = true;
		const list = stages;
		const at = list.findIndex((s) => s.id === storyboard.currentStageId);
		// Resume from where you are, unless that is the end.
		const start = at === -1 || at === list.length - 1 ? 0 : at;
		for (const stage of list.slice(start)) {
			if (token !== run) return;
			if (!(await go(stage))) continue;
			await new Promise((r) => setTimeout(r, stage.holdMs ?? DEFAULT_HOLD_MS));
		}
		if (token === run) playing = false;
	}

	function stop() {
		run++;
		playing = false;
	}

	function step(dir: -1 | 1) {
		stop();
		const at = stages.findIndex((s) => s.id === storyboard.currentStageId);
		const next = stages[Math.max(0, Math.min(stages.length - 1, at + dir))];
		if (next) go(next);
	}

	function onBoardChange(e: Event) {
		const value = (e.currentTarget as HTMLSelectElement).value;
		stop();
		if (value === '__new') storyboard.create();
		else storyboard.select(value);
	}

	function removeBoard() {
		if (board && confirm(`Delete storyboard “${board.name}”? The screens stay on the canvas.`)) {
			stop();
			storyboard.remove(board.id);
		}
	}

	function drop(index: number) {
		if (dragFrom) storyboard.moveStage(dragFrom, index);
		dragFrom = null;
	}
</script>

<div class="sb" class:sb--collapsed={collapsed}>
	<div class="sb-bar">
		<button
			class="sb-btn sb-title"
			onclick={() => (collapsed = !collapsed)}
			aria-expanded={!collapsed}
			title={collapsed ? 'Show storyboard' : 'Hide storyboard'}
		>
			{collapsed ? '▸' : '▾'} STORYBOARD
		</button>

		{#if board}
			<select class="sb-select" value={board.id} onchange={onBoardChange} aria-label="Storyboard">
				{#each storyboard.boards as b (b.id)}
					<option value={b.id}>{b.name}</option>
				{/each}
				<option value="__new">+ New storyboard</option>
			</select>
			<input
				class="sb-name"
				value={board.name}
				aria-label="Storyboard name"
				onchange={(e) => storyboard.rename(board.id, e.currentTarget.value)}
			/>
			<button class="sb-btn sb-btn--danger" onclick={removeBoard} title="Delete storyboard">✕</button>

			<span class="sb-sep"></span>
			<button class="sb-btn" onclick={() => step(-1)} disabled={!stages.length} title="Previous stage">◀</button>
			{#if playing}
				<button class="sb-btn sb-btn--on" onclick={stop} title="Stop">■ STOP</button>
			{:else}
				<button class="sb-btn" onclick={play} disabled={!stages.length} title="Replay from here">▶ PLAY</button>
			{/if}
			<button class="sb-btn" onclick={() => step(1)} disabled={!stages.length} title="Next stage">▶</button>
		{:else}
			<button class="sb-btn" onclick={() => storyboard.create()}>+ NEW STORYBOARD</button>
		{/if}

		<span class="sb-spacer"></span>
		<button
			class="sb-btn"
			onclick={() => storyboard.addSelection()}
			disabled={!canAdd}
			title="Add the selected frame, or zoom to the selected item, as the next stage"
		>
			+ ADD SELECTION
		</button>
		<button
			class="sb-btn sb-btn--primary"
			onclick={() => storyboard.nextScreen()}
			disabled={!canNext}
			title="Copy the selected frame beside itself and add the copy as the next stage"
		>
			NEXT SCREEN →
		</button>
	</div>

	{#if !collapsed && board}
		<ol class="sb-film">
			{#each stages as stage, i (stage.id)}
				{@const r = storyboard.resolve(stage)}
				<li
					class="sb-stage"
					class:sb-stage--current={stage.id === storyboard.currentStageId}
					class:sb-stage--missing={!r}
					class:sb-stage--drag={dragFrom === stage.id}
					draggable="true"
					ondragstart={() => (dragFrom = stage.id)}
					ondragend={() => (dragFrom = null)}
					ondragover={(e) => e.preventDefault()}
					ondrop={() => drop(i)}
				>
					<button class="sb-thumb" onclick={() => (stop(), go(stage))} title={r ? `${r.pageName} · ${r.name}` : 'Missing'}>
						<span class="sb-num">{i + 1}</span>
						{#if r}
							{@const w = r.box.maxX - r.box.minX}
							{@const h = r.box.maxY - r.box.minY}
							<svg viewBox="0 0 {w} {h}" width={THUMB_W} height={THUMB_H} aria-hidden="true">
								<rect class="sb-frame" x="0" y="0" width={w} height={h} vector-effect="non-scaling-stroke" />
								{#each r.contents as c, j (j)}
									<rect class="sb-item" x={c.x} y={c.y} width={c.w} height={c.h} vector-effect="non-scaling-stroke" />
								{/each}
							</svg>
							<span class="sb-kind">{r.kind === 'item' ? 'ZOOM' : r.pageName}</span>
						{:else}
							<span class="sb-missing">MISSING</span>
						{/if}
					</button>
					<input
						class="sb-label"
						value={stage.label ?? ''}
						placeholder={r?.name ?? 'deleted'}
						aria-label="Stage {i + 1} label"
						onchange={(e) => storyboard.updateStage(stage.id, { label: e.currentTarget.value || undefined })}
					/>
					<div class="sb-meta">
						<input
							class="sb-hold"
							type="number"
							min="0.5"
							max="30"
							step="0.5"
							value={(stage.holdMs ?? DEFAULT_HOLD_MS) / 1000}
							aria-label="Stage {i + 1} hold, seconds"
							title="Seconds replay rests here"
							onchange={(e) =>
								storyboard.updateStage(stage.id, { holdMs: Math.round(Number(e.currentTarget.value) * 1000) })}
						/>
						<span class="sb-unit">s</span>
						<button class="sb-btn sb-btn--danger" onclick={() => storyboard.removeStage(stage.id)} title="Remove stage">✕</button>
					</div>
				</li>
				{#if i < stages.length - 1}
					<li class="sb-arrow" aria-hidden="true">→</li>
				{/if}
			{:else}
				<li class="sb-empty">
					Select a frame and press <b>NEXT SCREEN →</b> to start a flow, or <b>+ ADD SELECTION</b> to add a screen or one part of it.
				</li>
			{/each}
		</ol>
	{/if}
</div>

<style>
	.sb {
		position: absolute;
		left: 12px;
		right: 64px; /* clear of the camera controls */
		bottom: 52px; /* above the page tabs */
		z-index: 10;
		display: flex;
		flex-direction: column;
		border: 1px solid var(--border, rgba(94, 234, 212, 0.12));
		border-radius: 4px;
		background: var(--bg-elev, #0a1120);
		font-family: var(--mono);
	}

	.sb-bar {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 3px 6px;
		min-width: 0;
	}
	.sb:not(.sb--collapsed) .sb-bar {
		border-bottom: 1px solid var(--border, rgba(94, 234, 212, 0.12));
	}
	.sb-spacer {
		flex: 1;
	}
	.sb-sep {
		width: 1px;
		height: 14px;
		margin: 0 4px;
		background: var(--border, rgba(94, 234, 212, 0.12));
	}

	.sb-btn {
		padding: 3px 6px;
		background: none;
		border: 1px solid transparent;
		border-radius: 2px;
		font-family: var(--mono);
		font-size: 9px;
		letter-spacing: 0.12em;
		color: var(--fg-dim);
		cursor: pointer;
		white-space: nowrap;
	}
	.sb-btn:hover:not(:disabled) {
		color: var(--accent);
	}
	.sb-btn:disabled {
		opacity: 0.35;
		cursor: default;
	}
	.sb-btn--primary {
		border-color: var(--border, rgba(94, 234, 212, 0.25));
		color: var(--accent);
	}
	.sb-btn--on {
		color: var(--accent);
	}
	.sb-btn--danger:hover:not(:disabled) {
		color: #f87171;
	}
	.sb-title {
		color: var(--fg);
	}

	.sb-select,
	.sb-name,
	.sb-label,
	.sb-hold {
		background: none;
		border: 1px solid transparent;
		border-radius: 2px;
		font-family: var(--mono);
		font-size: 9px;
		color: var(--fg);
	}
	.sb-select {
		max-width: 140px;
		background: var(--bg-elev, #0a1120);
	}
	.sb-name {
		width: 120px;
		padding: 2px 4px;
	}
	.sb-name:hover,
	.sb-name:focus,
	.sb-label:hover,
	.sb-label:focus,
	.sb-hold:hover,
	.sb-hold:focus {
		border-color: var(--border, rgba(94, 234, 212, 0.25));
		outline: none;
	}

	.sb-film {
		display: flex;
		align-items: center;
		gap: 4px;
		margin: 0;
		padding: 8px;
		list-style: none;
		overflow-x: auto;
	}

	.sb-stage {
		display: flex;
		flex-direction: column;
		gap: 3px;
		flex-shrink: 0;
		width: 124px;
		padding: 4px;
		border: 1px solid transparent;
		border-radius: 3px;
	}
	.sb-stage--current {
		border-color: var(--accent);
		background: rgba(94, 234, 212, 0.06);
	}
	.sb-stage--drag {
		opacity: 0.4;
	}

	.sb-thumb {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		height: 76px;
		padding: 0;
		background: var(--bg, #060b14);
		border: 1px solid var(--border, rgba(94, 234, 212, 0.12));
		border-radius: 2px;
		cursor: pointer;
	}
	.sb-thumb:hover {
		border-color: var(--accent);
	}
	.sb-frame {
		fill: rgba(94, 234, 212, 0.04);
		stroke: var(--fg-dim);
		stroke-width: 1;
	}
	.sb-item {
		fill: rgba(94, 234, 212, 0.18);
		stroke: var(--accent);
		stroke-width: 0.5;
	}
	.sb-num {
		position: absolute;
		top: 2px;
		left: 3px;
		font-size: 9px;
		color: var(--accent);
	}
	.sb-kind {
		position: absolute;
		bottom: 2px;
		right: 3px;
		max-width: 90%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: 7px;
		letter-spacing: 0.12em;
		color: var(--fg-dim);
	}
	.sb-missing {
		font-size: 8px;
		letter-spacing: 0.12em;
		color: #f87171;
	}
	.sb-stage--missing .sb-thumb {
		border-style: dashed;
	}

	.sb-label {
		width: 100%;
		padding: 2px 3px;
	}
	.sb-meta {
		display: flex;
		align-items: center;
		gap: 2px;
	}
	.sb-hold {
		width: 40px;
		padding: 1px 3px;
		font-variant-numeric: tabular-nums;
	}
	.sb-unit {
		flex: 1;
		font-size: 8px;
		color: var(--fg-dim);
	}

	.sb-arrow {
		flex-shrink: 0;
		color: var(--fg-dim);
		font-size: 12px;
	}
	.sb-empty {
		padding: 10px 4px;
		font-size: 9px;
		letter-spacing: 0.06em;
		color: var(--fg-dim);
	}
	.sb-empty b {
		color: var(--accent);
		font-weight: normal;
	}
</style>
