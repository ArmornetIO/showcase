<script lang="ts">
	// ── SceneCuePicker — "make this thing do that, here" ──────────────────────
	// A scoped command palette, not a sidebar of accordions. Scoped by the
	// current selection, so a flat searchable list stays viable: you never see an
	// effect that can't apply to what you have selected.
	//
	// PREVIEW ON HOVER is the point of the component, and it is nearly free —
	// the runtime is already `progress → value`, so previewing is calling the
	// same evaluator with a hovered number instead of a clock value. There is no
	// preview-specific rendering path.
	import { vocabularyFor, EASES, type Channel, type Burst } from './vocabulary.js';
	import type { ObjectKind } from './types.js';

	let {
		kind,
		targetName,
		at,
		/** For a component target: which registry component, and its current props.
		 *  Both are needed to generate the prop channels and to honour `showWhen`. */
		componentId = undefined,
		componentProps = undefined,
		open = false,
		onPick,
		onClose,
		onPreview,
	}: {
		kind: ObjectKind;
		targetName: string;
		at: number;
		componentId?: string;
		componentProps?: Record<string, unknown>;
		open?: boolean;
		onPick?: (sel: {
			channel?: string;
			burst?: string;
			to?: unknown;
			dur: number;
			ease: string;
			anchored: boolean;
		}) => void;
		onClose?: () => void;
		/** Null clears the preview. */
		onPreview?: (sel: { channel?: string; burst?: string; to?: unknown } | null) => void;
	} = $props();

	let query = $state('');
	let dur = $state(700);
	let easeId = $state('out');
	let anchored = $state(true);
	let cursor = $state(0);
	let toValue = $state<string>('');

	// A picker that greets you with yesterday's search is a picker you have to
	// clear before you can use it.
	$effect(() => {
		if (open) {
			query = '';
			cursor = 0;
		}
	});

	const vocab = $derived(vocabularyFor(kind, componentId, componentProps));

	type Row =
		| { kind: 'channel'; item: Channel; label: string; group: string }
		| { kind: 'burst'; item: Burst; label: string; group: string };

	const rows = $derived.by((): Row[] => {
		const q = query.trim().toLowerCase();
		const all: Row[] = [
			...vocab.channels.map((c) => ({ kind: 'channel' as const, item: c, label: c.label, group: c.group })),
			...vocab.bursts.map((b) => ({ kind: 'burst' as const, item: b, label: b.label, group: b.group })),
		];
		if (!q) return all;
		return all.filter(
			(r) => r.label.toLowerCase().includes(q) || r.group.toLowerCase().includes(q) || r.item.id.includes(q),
		);
	});

	const active = $derived(rows[Math.min(cursor, rows.length - 1)]);

	$effect(() => {
		// Reset the proposed value whenever the highlighted row changes, so the
		// preview and the commit always agree about what is being proposed.
		const r = active;
		if (!r) return;
		toValue = r.kind === 'channel' ? String(r.item.preset ?? '') : '';
	});

	function preview(r: Row | undefined) {
		if (!r) return onPreview?.(null);
		if (r.kind === 'burst') onPreview?.({ burst: r.item.id });
		else onPreview?.({ channel: r.item.id, to: coerce(r.item, toValue) });
	}

	function coerce(ch: Channel, raw: string): unknown {
		if (ch.type === 'lerp') return Number(raw);
		return raw;
	}

	function commit() {
		const r = active;
		if (!r) return;
		onPreview?.(null);
		if (r.kind === 'burst') {
			onPick?.({ burst: r.item.id, dur: Math.min(dur, r.item.maxMs), ease: easeId, anchored });
		} else {
			onPick?.({ channel: r.item.id, to: coerce(r.item, toValue), dur, ease: easeId, anchored });
		}
	}

	function key(e: KeyboardEvent) {
		if (!open) return;
		if (e.key === 'Escape') {
			e.preventDefault();
			onPreview?.(null);
			onClose?.();
		} else if (e.key === 'ArrowDown') {
			e.preventDefault();
			cursor = Math.min(rows.length - 1, cursor + 1);
			preview(rows[cursor]);
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			cursor = Math.max(0, cursor - 1);
			preview(rows[cursor]);
		} else if (e.key === 'Enter') {
			e.preventDefault();
			commit();
		}
	}
</script>

<svelte:window onkeydown={key} />

{#if open}
	<div class="scrim" role="presentation" onclick={() => { onPreview?.(null); onClose?.(); }}></div>
	<div class="pick" role="dialog" aria-label="Add cue">
		<div class="head">
			<span class="ttl">ADD CUE</span>
			<span class="dim">target: {targetName} ({kind.replace('mesh.', '')}) · at {(at / 1000).toFixed(2)}s</span>
		</div>

		<!-- svelte-ignore a11y_autofocus -->
		<input
			class="q"
			placeholder="search the vocabulary…"
			bind:value={query}
			autofocus
			oninput={() => (cursor = 0)}
		/>

		<div class="body">
			<div class="list">
				{#each rows as r, i (r.item.id)}
					{@const first = i === 0 || rows[i - 1].group !== r.group}
					{#if first}<div class="grp">{r.group}</div>{/if}
					<button
						class="row"
						class:row--on={i === cursor}
						onmouseenter={() => {
							cursor = i;
							preview(r);
						}}
						onmouseleave={() => onPreview?.(null)}
						onclick={commit}
					>
						<span class="row-l">{r.label}</span>
						{#if r.kind === 'burst'}<span class="tag tag--burst">burst</span>
						{:else}<span class="tag">{r.item.type}</span>{/if}
					</button>
				{/each}
				{#if !rows.length}<div class="none">nothing matches “{query}”</div>{/if}
			</div>

			<div class="side">
				{#if active}
					<div class="hint">
						{#if active.kind === 'burst'}
							{active.item.hint}
							<div class="cap">capped at {active.item.maxMs}ms — a burst may never carry the story</div>
						{:else}
							Sets <code>{active.item.path}</code>
							{#if active.item.type === 'lerp'}over the span{:else}at the start of the span{/if}.
						{/if}
					</div>

					{#if active.kind === 'channel'}
						<label class="f">
							<span>to</span>
							{#if active.item.options}
								<select bind:value={toValue} onchange={() => preview(active)}>
									{#each active.item.options as o (o)}<option value={o}>{o}</option>{/each}
								</select>
							{:else if active.item.type === 'lerp'}
								<input
									type="number"
									step="0.05"
									min={active.item.range?.[0]}
									max={active.item.range?.[1]}
									bind:value={toValue}
									oninput={() => preview(active)}
								/>
							{:else}
								<input type="text" bind:value={toValue} oninput={() => preview(active)} />
							{/if}
						</label>
					{/if}

					<div class="rowf">
						<label class="f f--n"><span>dur</span><input type="number" step="50" bind:value={dur} /></label>
						<label class="f f--n">
							<span>ease</span>
							<select bind:value={easeId}>
								{#each EASES as e (e.id)}<option value={e.id}>{e.label}</option>{/each}
							</select>
						</label>
					</div>

					<label class="chk">
						<input type="checkbox" bind:checked={anchored} />
						<span>anchor to this beat</span>
					</label>
					<div class="cap">
						An anchored cue travels when the beat is retimed. Absolute cues stay where they are.
					</div>
				{/if}
			</div>
		</div>

		<div class="foot">
			<span class="dim">↑↓ browse · hover to preview on the canvas · ⏎ add · esc cancel</span>
			<button class="btn" onclick={commit}>Add cue</button>
		</div>
	</div>
{/if}

<style>
	.scrim {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.4);
		z-index: 60;
	}
	/* Docked left, not centred. The footer says "hover to preview on the canvas"
	   while a centred modal sat directly on the thing being previewed. */
	.pick {
		position: fixed;
		top: 8vh;
		left: 1.2rem;
		width: min(40rem, 46vw);
		z-index: 61;
		border: 1px solid rgba(255, 255, 255, 0.16);
		border-radius: 0.5rem;
		background: rgba(8, 11, 17, 0.98);
		box-shadow: 0 24px 60px rgba(0, 0, 0, 0.6);
		color: var(--fg);
		font-size: 0.72rem;
		overflow: hidden;
	}
	.head {
		display: flex;
		align-items: baseline;
		gap: 0.6rem;
		padding: 0.55rem 0.7rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.1);
	}
	.ttl {
		font-size: 0.6rem;
		letter-spacing: 0.16em;
		color: var(--accent);
	}
	.dim {
		color: var(--fg-dim);
		font-size: 0.64rem;
	}
	.q {
		width: 100%;
		padding: 0.5rem 0.7rem;
		border: none;
		border-bottom: 1px solid rgba(255, 255, 255, 0.1);
		background: transparent;
		color: inherit;
		font: inherit;
		font-size: 0.85rem;
		outline: none;
	}
	.body {
		display: flex;
		min-height: 16rem;
	}
	.list {
		flex: 1;
		/* Sized so a row is never sliced in half — a clipped row with no scrollbar
		   reads as "that's everything". */
		max-height: 21rem;
		overflow-y: auto;
		scrollbar-width: thin;
		padding: 0.3rem 0;
		border-right: 1px solid rgba(255, 255, 255, 0.1);
	}
	.grp {
		padding: 0.35rem 0.7rem 0.15rem;
		font-size: 0.55rem;
		letter-spacing: 0.16em;
		color: var(--fg-dim);
	}
	.row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		width: 100%;
		padding: 0.3rem 0.7rem;
		border: none;
		background: none;
		color: inherit;
		font: inherit;
		cursor: pointer;
		text-align: left;
	}
	.row--on {
		background: rgba(95, 234, 212, 0.14);
	}
	.row-l {
		flex: 1;
	}
	.tag {
		font-size: 0.52rem;
		letter-spacing: 0.1em;
		padding: 0.08rem 0.28rem;
		border-radius: 0.2rem;
		border: 1px solid rgba(255, 255, 255, 0.18);
		color: var(--fg-dim);
	}
	.tag--burst {
		border-color: rgba(251, 191, 36, 0.5);
		color: #fbbf24;
	}
	.none {
		padding: 1rem 0.7rem;
		color: var(--fg-dim);
	}
	.side {
		width: 17rem;
		flex: none;
		padding: 0.6rem 0.7rem;
	}
	.hint {
		font-size: 0.66rem;
		line-height: 1.45;
		color: var(--fg-dim);
		margin-bottom: 0.5rem;
	}
	.hint code {
		font-family: var(--mono);
		color: var(--fg);
	}
	.cap {
		font-size: 0.58rem;
		line-height: 1.4;
		color: var(--fg-dim);
		margin-top: 0.3rem;
	}
	.f {
		display: block;
		margin-bottom: 0.4rem;
	}
	.f > span {
		display: block;
		font-size: 0.55rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--fg-dim);
		margin-bottom: 0.12rem;
	}
	.f--n {
		flex: 1;
	}
	.rowf {
		display: flex;
		gap: 0.4rem;
	}
	input[type='number'],
	input[type='text'],
	select {
		width: 100%;
		padding: 0.26rem 0.3rem;
		border: 1px solid rgba(255, 255, 255, 0.16);
		border-radius: 0.25rem;
		background: rgba(255, 255, 255, 0.04);
		color: inherit;
		font: inherit;
		font-size: 0.7rem;
	}
	.chk {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		margin-top: 0.3rem;
		cursor: pointer;
	}
	.foot {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.6rem;
		padding: 0.45rem 0.7rem;
		border-top: 1px solid rgba(255, 255, 255, 0.1);
	}
	.btn {
		padding: 0.3rem 0.7rem;
		border: 1px solid rgba(95, 234, 212, 0.45);
		border-radius: 0.3rem;
		background: rgba(95, 234, 212, 0.12);
		color: var(--accent);
		cursor: pointer;
		font: inherit;
		font-size: 0.66rem;
	}
</style>
