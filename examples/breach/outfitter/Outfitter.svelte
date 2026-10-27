<script lang="ts">
	// ── THE OUTFITTER ────────────────────────────────────────────────────────
	// Laid out like the character-select screens players already know: the
	// figure big on its platform, one card beside it, tap a tile to wear it,
	// Done. The rarer controls stay but sit quieter: camera and export in one
	// bar under the figure, per-part paint behind a disclosure on Color.
	import {
		CLIPS,
		Figure,
		Icon,
		art,
		downloadMesh,
		figureParts,
		poseAt,
		type Anchor,
		type IconName
	} from 'showcase';
	import {
		DEFAULT_LOADOUT,
		RARITY,
		inCategory,
		type Category,
		type Item
	} from '../internal/wardrobe.js';
	import { resolve, type Appearance } from '../internal/appearance.js';
	import { ROLE_GLYPH, SIDE_TONE } from '../internal/badge.js';
	import type { Faction } from '../internal/rules.js';
	import Swatch from './Swatch.svelte';
	import type { OutfitterState } from './outfitter.svelte.js';
	import { saved } from './saved.svelte.js';

	interface Props {
		fit: OutfitterState;
		/** The role this player holds, so the badge can be SHOWN. The chest is
		 *  the role's, never a control here. */
		klassKey?: string | null;
		klassName?: string | null;
		side?: Faction | null;
		ondone?: () => void;
		/** Opens the marks shop, which the caller owns: a dialog nested in this
		 *  one would inherit the full-size frame's sizing. */
		onshop?: () => void;
	}

	let { fit, klassKey = null, klassName = null, side = null, ondone, onshop }: Props = $props();
	const role = $derived(klassKey && side ? { key: klassKey, name: klassName ?? klassKey, side } : null);

	// ── Tabs ─────────────────────────────────────────────────────────────────
	// Head and Eyes share one tab: both are worn on the head, and Eyes holds a
	// single item. Each keeps its own section, so the game's one-slot-per-
	// category model is untouched.
	type Group = { id: string; label: string; icon: IconName; cats: Category[] };
	const groups = $derived<Group[]>([
		{ id: 'build', label: 'Build', icon: 'user', cats: ['build'] },
		{
			id: 'head',
			label: 'Head',
			icon: 'shapes',
			cats: fit.categories.filter((c) => c.key !== 'build' && c.key !== 'trim').map((c) => c.key)
		},
		{ id: 'trim', label: 'Color', icon: 'palette', cats: ['trim'] }
	]);
	const group = $derived(groups.find((g) => g.cats.includes(fit.category)) ?? groups[0]);

	// ── Saved characters ─────────────────────────────────────────────────────
	// Its own tab rather than a category: it holds whole looks, not items.
	saved.hydrate();
	let showSaved = $state(false);
	let full = $state(false);
	const current = $derived(saved.indexOf(fit.appearance));
	/** The saved character you put on, so changing it and pressing Save updates
	 *  it instead of making a second one with the same name. An empty slot is
	 *  still there for "save as new". */
	let editing = $state<number | null>(null);
	const editingName = $derived.by(() => {
		const look = editing === null ? null : saved.slots[editing];
		return look ? look.callsign || `Look ${(editing ?? 0) + 1}` : null;
	});

	function openTab(cat: Category) {
		showSaved = false;
		fit.selectCategory(cat);
	}

	/** Put a saved look back on. An item saved under another account may not be
	 *  yours here; it falls back to that slot's default, as the server resolves
	 *  a claimed loadout. */
	function wear(look: Appearance, i: number) {
		const loadout = Object.fromEntries(
			Object.entries(look.loadout).map(([slot, key]) => [
				slot,
				fit.owns(key) || key === DEFAULT_LOADOUT[slot] ? key : DEFAULT_LOADOUT[slot]
			])
		);
		fit.load({ ...look, loadout });
		editing = i;
		full = false;
	}

	function saveLook() {
		if (editingName !== null && editing !== null) return saved.saveAt(editing, fit.appearance);
		const i = saved.save(fit.appearance);
		if (i >= 0) return (editing = i);
		full = true;
		showSaved = true;
	}

	function saveAt(i: number) {
		saved.saveAt(i, fit.appearance);
		editing = i;
		full = false;
	}

	function remove(i: number) {
		saved.remove(i);
		if (editing === i) editing = null;
	}

	function reset() {
		fit.reset();
		editing = null;
	}

	const SECTION: Partial<Record<Category, string>> = { crown: 'Hats', brow: 'Eyes' };
	// The game's own hints, respelled: its data says "colour".
	const HINT: Partial<Record<Category, string>> = {
		trim: 'The hue everything you wear is painted in.'
	};
	const sections = $derived(
		group.cats.map((key) => {
			const c = fit.categories.find((x) => x.key === key);
			return {
				key,
				title: SECTION[key] ?? c?.label ?? key,
				hint: HINT[key] ?? c?.hint ?? '',
				items: inCategory(key)
			};
		})
	);

	// ── The clip ─────────────────────────────────────────────────────────────
	let t = $state(0);
	$effect(() => {
		if (fit.clip === 'still') return;
		let raf = 0;
		let last = performance.now();
		const tick = (now: number) => {
			t += ((now - last) / 1000) * fit.speed;
			last = now;
			raf = requestAnimationFrame(tick);
		};
		raf = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(raf);
	});
	const pose = $derived(poseAt(fit.clip, t, fit.clipOpts));
	const stage = $derived(fit.stage);
	const opts = $derived({ yaw: fit.yaw, pitch: fit.pitch, pose, ...stage.art });

	// ── Click a part ─────────────────────────────────────────────────────────
	// Hit boxes are percentages of the frame, and the frame is given the exact
	// aspect of the figure's viewBox so they land. With a platform that viewBox
	// is wider than the figure: these lines mirror Figure's own `ground` framing
	// (DAIS is its platform radius) so the boxes still sit on the head.
	type Rect = { x: number; y: number; w: number; h: number };
	const DAIS = 0.46;
	const a = $derived(art(stage.skin, opts));
	const view = $derived.by((): Rect => {
		const b = a.box;
		const bottom = a.floor + DAIS * b.w * 0.27;
		const x = Math.min(b.x, -DAIS * b.w);
		const w = Math.max(b.x + b.w, DAIS * b.w) - x;
		return { x, y: b.y, w, h: Math.max(bottom - b.y, b.h) };
	});
	const regions = $derived(
		(Object.entries(a.hit) as [Anchor, Rect][])
			// Only parts with a tab: the chest is the role's, and a box that opens
			// an empty category is a promise the shop cannot keep.
			.filter(([anchor]) => fit.categories.some((c) => c.key === anchor))
			.map(([anchor, r]) => ({
				anchor,
				left: `${((r.x - view.x) / view.w) * 100}%`,
				top: `${((r.y - view.y) / view.h) * 100}%`,
				width: `${(r.w / view.w) * 100}%`,
				height: `${(r.h / view.h) * 100}%`
			}))
	);

	// ── Drag to turn ─────────────────────────────────────────────────────────
	// The pointer is only captured once it has moved, so a plain click still
	// reaches the part under it.
	let press: { id: number; x: number; y: number; yaw: number; pitch: number } | null = null;
	let turning = $state(false);
	function down(e: PointerEvent) {
		press = { id: e.pointerId, x: e.clientX, y: e.clientY, yaw: fit.yaw, pitch: fit.pitch };
	}
	function move(e: PointerEvent) {
		if (!press) return;
		const dx = e.clientX - press.x;
		const dy = e.clientY - press.y;
		if (!turning) {
			if (Math.hypot(dx, dy) < 4) return;
			turning = true;
			(e.currentTarget as HTMLElement).setPointerCapture(press.id);
		}
		fit.yaw = press.yaw + dx * 0.005;
		fit.pitch = Math.max(-0.55, Math.min(0.85, press.pitch + dy * 0.003));
	}
	function up() {
		press = null;
		turning = false;
	}

	const exportMesh = (kind: 'stl' | 'obj') =>
		downloadMesh(figureParts(stage.skin, { ...stage.art, pose }), kind, stage.skin.key);

	// ── Tiles ────────────────────────────────────────────────────────────────
	function tileFigure(i: Item) {
		const look = fit.appearance;
		return resolve({ ...look, loadout: { ...look.loadout, [i.slot]: i.key } }, fit.who);
	}

	/** Owned things go straight on, like any character select. Unowned things
	 *  are tried on the big figure and the main button becomes Buy. */
	function pick(i: Item) {
		if (fit.category !== i.category) fit.selectCategory(i.category);
		fit.browse(i.key);
		if (fit.owns(i.key)) fit.equip(i.key);
	}

	const marks = (n: number) => n.toLocaleString();
	const shop = $derived(fit.packs.length > 0);
	const sel = $derived(fit.selected);
	// The default loadout wears the Optic Visor, which is priced: worn-but-unowned
	// is a real state, and it is not "trying on".
	const trying = $derived(!!sel && !fit.owns(sel.key) && !fit.isEquipped(sel.key));

	// ── One color row, for the thing in front of you ─────────────────────────
	// The suit on Build, the selected hat or eyewear on Head. Every other part
	// is on the Color tab. The hues are the library palette, the same tokens the
	// game's own picker uses.
	const HUES = ['slate', 'zinc', 'blue', 'sky', 'emerald', 'amber', 'rose', 'violet'];
	let hex = $state<Record<string, string>>({});
	$effect(() => {
		const css = getComputedStyle(document.documentElement);
		hex = Object.fromEntries(HUES.map((h) => [h, css.getPropertyValue(`--palette-${h}`).trim()]));
	});

	type Row = { label: string; value: string; fallback: string; set: (c: string | null) => void };
	const row = $derived.by((): Row | null => {
		if (showSaved || trying || fit.category === 'trim') return null;
		if (fit.category === 'build') {
			return {
				label: 'Suit color',
				value: fit.suit,
				fallback: '#46536B',
				set: (c) => fit.setMaterial('suit', c)
			};
		}
		const part = fit.paintablesFor(fit.equipped(fit.category))[0];
		if (!part) return null;
		return {
			label: `${part.label} color`,
			value: part.value,
			fallback: fit.trim,
			set: (c) => (c ? fit.paintOne(part.slot, c) : fit.clearOne(part.slot))
		};
	});
	const same = (x?: string, y?: string) => !!x && !!y && x.toLowerCase() === y.toLowerCase();

	// ── Paint (the game's Paint panel) ───────────────────────────────────────
	const MATERIALS = [
		{ key: 'suit', label: 'Suit', hint: 'Every mass the body is built from.' },
		{ key: 'plate', label: 'Plate', hint: 'The chest and the hard surfaces.' },
		{ key: 'lamp', label: 'Visor', hint: 'Follows the plate until you say otherwise.' }
	] as const;
	// Open by default so nobody misses it; it still folds away.
	let paintOpen = $state(true);
</script>

<div class="outfitter" style:--trim={fit.trim}>
	<!-- ── You ──────────────────────────────────────────────────────────── -->
	<div class="stage">
		<!-- With no server there are no grants, and an owned-but-priced item
		     only exists on a granted account: this is the only way to see one. -->
		{#if fit.source === 'demo'}
			<div class="demo-chip" role="group" aria-label="Demo account">
				<span class="tag">Demo</span>
				{#each [['new', 'New'], ['alpha', 'Alpha']] as const as [p, label] (p)}
					<button class:on={fit.persona === p} onclick={() => fit.setPersona(p)}>{label}</button>
				{/each}
			</div>
		{/if}

		<!-- A way in only where this deployment sells marks; otherwise a readout. -->
		<button
			class="purse"
			disabled={!shop}
			title={shop ? 'Get more marks' : 'Your marks'}
			aria-label="{shop ? 'Get more marks. ' : ''}You have {marks(fit.balance)} marks."
			onclick={onshop}
		>
			<Icon name="credit-card" size={12} />
			<b>{marks(fit.balance)}</b> marks
			{#if shop}<span class="more"><Icon name="plus" size={10} /></span>{/if}
		</button>

		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="viewport"
			class:turning
			onpointerdown={down}
			onpointermove={move}
			onpointerup={up}
			onpointercancel={up}
		>
			<div class="frame" style:aspect-ratio={view.w / view.h} style:--zoom={fit.zoom}>
				<Figure klass={stage.skin} crop="hero" ground={fit.trim} shadow art={opts} />
				<div class="hits">
					{#each regions as r (r.anchor)}
						<button
							class="hit"
							class:active={fit.category === r.anchor}
							style:left={r.left}
							style:top={r.top}
							style:width={r.width}
							style:height={r.height}
							aria-label="Change {SECTION[r.anchor] ?? r.anchor}"
							onclick={() => openTab(r.anchor)}
						></button>
					{/each}
				</div>
			</div>
		</div>

		<div class="plate">
			<!-- A plain text field, labeled, with a pencil: the one thing on this
			     screen you type rather than pick has to look typeable. -->
			<label class="callsign">
				<span class="label">Callsign</span>
				<span class="box">
					<input
						value={fit.callsign}
						placeholder="Enter a callsign"
						maxlength="24"
						oninput={(e) => fit.rename(e.currentTarget.value)}
					/>
					<Icon name="pencil" size={13} />
				</span>
			</label>
			{#if role}
				<!-- The badge, shown and not sold: the chest is the role's. -->
				<div class="badge" style:--side-tone={SIDE_TONE[role.side]}>
					<Icon name="shield" size={12} />
					<span class="who">{role.name}</span>
					<span class="note">Your role · {ROLE_GLYPH[role.key] ?? 'ring'} · {role.side}</span>
				</div>
			{/if}
			<p class="hint"><Icon name="rotate-ccw" size={10} /> Drag to turn</p>
		</div>

		<div class="deck">
			<div class="seg">
				{#each CLIPS as c (c.id)}
					<button class:on={fit.clip === c.id} title={c.hint} onclick={() => (fit.clip = c.id)}>
						{c.label}
					</button>
				{/each}
			</div>
			<label class="zoom">
				<span>Zoom</span>
				<input type="range" min="0.25" max="1" step="0.01" bind:value={fit.zoom} />
			</label>
			<button class="plain" disabled={!fit.turned} onclick={() => fit.resetCamera()}>Recenter</button>
			<div class="seg">
				<button title="Mesh for CAD and slicers, millimeters, Z up" onclick={() => exportMesh('stl')}>
					STL
				</button>
				<button title="Named parts with vertex color, for Blender" onclick={() => exportMesh('obj')}>
					OBJ
				</button>
			</div>
		</div>
	</div>

	<!-- ── The card ─────────────────────────────────────────────────────── -->
	<div class="panel">
		<div class="tabs" role="tablist">
			{#each groups as g (g.id)}
				<button
					role="tab"
					aria-selected={!showSaved && group.id === g.id}
					class:active={!showSaved && group.id === g.id}
					onclick={() => openTab(g.cats[0])}
				>
					<Icon name={g.icon} size={14} />
					{g.label}
				</button>
			{/each}
			<button
				role="tab"
				aria-selected={showSaved}
				class:active={showSaved}
				onclick={() => (showSaved = true)}
			>
				<Icon name="users" size={14} />
				Saved
			</button>
		</div>

		<div class="list">
			{#if showSaved}
				<section>
					<header class="section-head">
						<p class:warn={full}>
							{full
								? `All ${saved.slots.length} slots are full. Delete one to save this look.`
								: 'Your saved characters. Tap one to wear it again.'}
						</p>
					</header>
					<div class="grid">
						{#each saved.slots as look, i (i)}
							{#if look}
								{@const f = resolve(look, fit.who)}
								{@const name = look.callsign || `Look ${i + 1}`}
								<div class="slot">
									<button
										class="tile"
										class:on={current === i}
										style:--trim={f.art.trim}
										onclick={() => wear(look, i)}
										aria-pressed={current === i}
									>
										<div class="art saved-art"><Figure klass={f.skin} crop="hero" art={f.art} /></div>
										<span class="name">{name}</span>
										{#if current === i}
											<span class="state on-tag left"><Icon name="check" size={11} /></span>
										{/if}
									</button>
									<button
										class="remove"
										title="Delete {name}"
										aria-label="Delete {name}"
										onclick={() => remove(i)}
									>
										<Icon name="trash-2" size={11} />
									</button>
								</div>
							{:else}
								<button class="tile empty" disabled={trying} onclick={() => saveAt(i)}>
									<div class="art saved-art"><Icon name="plus" size={18} /></div>
									<span class="name">Save current look</span>
								</button>
							{/if}
						{/each}
					</div>
				</section>
			{:else}
			{#each sections as s (s.key)}
				<section>
					<header class="section-head">
						{#if sections.length > 1}<h4>{s.title}</h4>{/if}
						<p>{s.hint}</p>
					</header>

					<div class="grid" class:wide={s.key === 'build'} class:colorway={s.key === 'trim'}>
						{#each s.items as i (i.key)}
							{@const owned = fit.owns(i.key)}
							{@const on = fit.isEquipped(i.key)}
							<button
								class="tile"
								class:on
								class:open={fit.previewKey === i.key && !on}
								class:locked={!owned && !on}
								style:--rare={RARITY[i.rarity].tone}
								title={i.blurb}
								onclick={() => pick(i)}
								aria-pressed={on}
							>
								<div class="art">
									{#if i.category === 'trim'}
										<span class="chip" style:background={i.color}></span>
									{:else}
										{@const f = tileFigure(i)}
										<Figure klass={f.skin} crop={i.category === 'build' ? 'hero' : 'bust'} art={f.art} />
									{/if}
								</div>
								<span class="name">{i.name}</span>
								{#if !owned && !on && i.lock}
									<span class="price"
										>{i.lock.kind === 'price' ? `${marks(i.lock.marks)} marks` : 'Alpha only'}</span
									>
								{/if}

								{#if on}
									<span class="state on-tag"><Icon name="check" size={11} /></span>
								{:else if !owned}
									<span class="state"><Icon name="lock" size={11} /></span>
								{/if}
								{#if i.rarity !== 'standard'}
									<span class="ribbon">{RARITY[i.rarity].label}</span>
								{/if}
							</button>
						{/each}
					</div>
				</section>
			{/each}

			{#if group.id === 'trim'}
				<!-- The game's Paint panel, whole, as one disclosure. -->
				<details class="paint" bind:open={paintOpen}>
					<summary>
						<Icon name="chevron-right" size={12} />
						Paint
						{#if fit.painted}<span class="dirty">Custom</span>{/if}
					</summary>

					<div class="mats">
						{#each MATERIALS as m (m.key)}
							{@const value = fit.swatches.find((x) => x.key === m.key)?.value ?? '#94A3B8'}
							<span class="mat" title={m.hint}>
								<Swatch {value} label={m.label} onpick={(c) => fit.setMaterial(m.key, c)} />
								<span>{m.label}</span>
							</span>
						{/each}
					</div>

					<div class="rows">
						{#each fit.paintables as p (p.slot)}
							<span class="prow" class:custom={p.slot in fit.appearance.tints}>
								<Swatch value={p.value} label={p.label} onpick={(c) => fit.paintOne(p.slot, c)} />
								<span class="plabel">{p.label}</span>
								<span class="group">{p.group}</span>
								{#if p.slot in fit.appearance.tints}
									<button
										class="clear"
										title="Back to the material's color"
										aria-label="Clear {p.label} color"
										onclick={() => fit.clearOne(p.slot)}>×</button
									>
								{/if}
							</span>
						{/each}
					</div>

					{#if fit.painted}
						<button class="plain strip" onclick={() => fit.resetPaint()}>Strip it back</button>
					{/if}
				</details>
			{/if}
			{/if}
		</div>

		{#if row}
			<div class="colors">
				<span class="label">{row.label}</span>
				<div class="dots">
					<button
						class="dot default"
						class:on={same(row.value, row.fallback)}
						style:background={row.fallback}
						title="Default"
						aria-label="Default color"
						onclick={() => row.set(null)}
					></button>
					{#each HUES as h (h)}
						<button
							class="dot"
							class:on={same(row.value, hex[h])}
							style:background="var(--palette-{h})"
							title={h}
							aria-label="{h} color"
							onclick={() => hex[h] && row.set(hex[h])}
						></button>
					{/each}
				</div>
			</div>
		{/if}

		<!-- What the game's open tile said: the item's line, its price or how it
		     is earned. -->
		{#if !showSaved && sel && (trying || sel.blurb)}
			<div class="info">
				{#if trying && sel.lock?.kind === 'price'}
					<p>
						<b>{sel.name}</b> · {marks(sel.lock.marks)} marks
						{#if !fit.canAfford}
							<span class="short">· you have {marks(fit.balance)}</span>
							{#if shop}<button class="get" onclick={onshop}>Get marks</button>{/if}
						{/if}
					</p>
				{:else if trying && sel.lock?.kind === 'reward'}
					<p class="reward">{sel.lock.note}</p>
				{/if}
				{#if sel.blurb}
					<p class="blurb">{#if !trying}<b>{sel.name}</b>{' · '}{/if}{sel.blurb}</p>
				{/if}
			</div>
		{/if}

		{#if fit.notice}
			<p class="notice" role="status">{fit.notice}</p>
		{/if}

		<div class="actions">
			<button class="secondary" disabled={!fit.dirty && !fit.painted} onclick={reset}>
				Reset
			</button>
			<!-- A look with something tried on but not bought is not yours to keep. -->
			<button
				class="secondary"
				disabled={trying || current >= 0}
				title={editingName && current < 0 ? `Save your changes to ${editingName}` : undefined}
				onclick={saveLook}
			>
				{#if current >= 0}<Icon name="check" size={11} /> Saved{:else if editingName}Update{:else}Save{/if}
			</button>
			{#if trying && sel?.lock?.kind === 'price'}
				<button class="primary" disabled={fit.pending || !fit.canAfford} onclick={() => fit.buy(sel.key)}>
					Buy · {marks(sel.lock.marks)}
				</button>
			{:else if trying}
				<button class="primary" disabled>Not for sale</button>
			{:else}
				<button class="primary" onclick={ondone}>Done</button>
			{/if}
		</div>
	</div>
</div>

<style>
	.outfitter {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(340px, 420px);
		gap: 22px;
		height: 100%;
		min-height: 0;
	}

	/* ── Stage ─────────────────────────────────────────────────────────── */
	/* No box: the figure stands in the room, lit from its own platform. */
	.stage {
		position: relative;
		display: grid;
		grid-template-rows: minmax(0, 1fr) auto auto;
		justify-items: center;
		min-height: 0;
		background: radial-gradient(
			ellipse 55% 60% at 50% 58%,
			color-mix(in srgb, var(--trim) 9%, transparent),
			transparent 70%
		);
	}

	.viewport {
		position: relative;
		width: 100%;
		height: 100%;
		min-height: 0;
		overflow: hidden;
		cursor: grab;
		touch-action: none;
		user-select: none;
	}
	.viewport.turning {
		cursor: grabbing;
	}
	/* Height is the zoom. As in the game, full zoom fills the room and never
	   crops the figure; the resting zoom (0.68) sits a little bigger than the
	   game's, because the room is the whole left half now. */
	.frame {
		position: absolute;
		left: 50%;
		top: 50%;
		height: calc(30% + var(--zoom) * 70%);
		transform: translate(-50%, -50%);
	}

	.hits {
		position: absolute;
		inset: 0;
		pointer-events: none;
	}
	.hit {
		position: absolute;
		padding: 0;
		border: 1px solid transparent;
		border-radius: 3px;
		background: transparent;
		pointer-events: auto;
		cursor: pointer;
		transition:
			border-color 120ms,
			background 120ms;
	}
	.hit.active {
		border-color: color-mix(in srgb, var(--trim) 42%, transparent);
	}
	.hit:hover {
		border-color: color-mix(in srgb, var(--trim) 72%, transparent);
		background: color-mix(in srgb, var(--trim) 8%, transparent);
	}
	.hit:focus-visible {
		outline: 2px solid var(--trim);
		outline-offset: 1px;
	}

	.purse {
		position: absolute;
		z-index: 2;
		top: 0;
		right: 0;
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 5px 10px;
		border: 1px solid var(--border);
		border-radius: 999px;
		background: color-mix(in srgb, var(--bg) 70%, transparent);
		color: var(--fg-dim);
		font-family: var(--mono);
		font-size: 0.6rem;
		letter-spacing: 0.06em;
	}
	.purse {
		cursor: pointer;
		transition:
			border-color 120ms,
			color 120ms;
	}
	.purse:disabled {
		cursor: default;
	}
	.purse:hover:not(:disabled) {
		border-color: color-mix(in srgb, var(--trim) 60%, transparent);
		color: var(--fg);
	}
	.purse b {
		color: var(--trim);
		font-weight: 600;
	}
	/* The plus says the pill is a way in, not just a readout. */
	.purse .more {
		display: grid;
		place-items: center;
		width: 16px;
		height: 16px;
		margin-left: 2px;
		border-radius: 50%;
		background: color-mix(in srgb, var(--trim) 22%, transparent);
		color: var(--trim);
	}

	.plate {
		display: grid;
		justify-items: center;
		gap: 7px;
		width: 100%;
	}
	/* A nameplate, not a form field: the name is part of the character. */
	.callsign {
		display: grid;
		gap: 5px;
		width: min(300px, 85%);
		cursor: text;
	}
	.callsign .label {
		font-family: var(--mono);
		font-size: 0.5rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--fg-dim);
	}
	.callsign .box {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 11px;
		border: 1px solid color-mix(in srgb, var(--fg) 22%, transparent);
		border-radius: 4px;
		background: color-mix(in srgb, var(--fg) 4%, transparent);
		color: var(--fg-dim);
		transition:
			border-color 120ms,
			box-shadow 120ms;
	}
	.callsign:hover .box {
		border-color: color-mix(in srgb, var(--fg) 38%, transparent);
	}
	.callsign:focus-within .box {
		border-color: var(--trim);
		box-shadow: 0 0 0 3px color-mix(in srgb, var(--trim) 18%, transparent);
		color: var(--trim);
	}
	.callsign input {
		flex: 1;
		min-width: 0;
		padding: 0;
		border: 0;
		background: none;
		color: var(--fg);
		font-family: var(--mono-display, var(--mono));
		font-size: 0.9rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	.callsign input::placeholder {
		color: color-mix(in srgb, var(--fg-dim) 85%, transparent);
		text-transform: none;
		letter-spacing: 0.02em;
		font-family: var(--mono);
		font-size: 0.72rem;
	}
	.callsign input:focus {
		outline: none;
	}

	.badge {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 4px 9px;
		border: 1px dashed color-mix(in srgb, var(--side-tone) 45%, transparent);
		border-radius: 4px;
		color: var(--side-tone);
	}
	.badge .who {
		font-family: var(--mono);
		font-size: 0.55rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--fg);
	}
	.badge .note {
		font-family: var(--mono);
		font-size: 0.5rem;
		letter-spacing: 0.06em;
		color: var(--fg-dim);
	}

	.hint {
		display: flex;
		align-items: center;
		gap: 5px;
		margin: 0;
		color: var(--fg-dim);
		font-family: var(--mono);
		font-size: 0.5rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		opacity: 0.7;
	}

	/* The camera and export, in one quiet bar: there when you want them, not
	   the first thing you read. */
	.deck {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: center;
		gap: 10px;
		margin-top: 12px;
		padding: 5px 8px;
		border: 1px solid var(--border);
		border-radius: 6px;
		background: color-mix(in srgb, var(--bg) 70%, transparent);
	}
	.seg {
		display: flex;
		border: 1px solid var(--border);
		border-radius: 3px;
		overflow: hidden;
	}
	.seg button,
	.plain {
		padding: 4px 9px;
		border: 0;
		background: none;
		color: var(--fg-dim);
		font-family: var(--mono);
		font-size: 0.55rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		cursor: pointer;
	}
	.seg button:hover,
	.plain:hover:not(:disabled) {
		color: var(--fg);
	}
	.seg button.on {
		background: color-mix(in srgb, var(--trim) 20%, transparent);
		color: var(--fg);
	}
	.plain {
		border: 1px solid var(--border);
		border-radius: 3px;
	}
	.plain:disabled {
		opacity: 0.4;
		cursor: default;
	}
	.zoom {
		display: flex;
		align-items: center;
		gap: 7px;
	}
	.zoom span {
		font-family: var(--mono);
		font-size: 0.52rem;
		letter-spacing: 0.11em;
		text-transform: uppercase;
		color: var(--fg-dim);
	}
	.zoom input {
		width: 84px;
		accent-color: var(--trim);
	}

	.demo-chip {
		position: absolute;
		z-index: 2;
		top: 0;
		left: 0;
		display: flex;
		align-items: center;
		gap: 2px;
		padding: 3px;
		border: 1px dashed color-mix(in srgb, var(--fg-dim) 50%, transparent);
		border-radius: 4px;
		font-family: var(--mono);
		font-size: 0.48rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}
	.demo-chip .tag {
		padding: 0 6px;
		color: var(--fg-dim);
	}
	.demo-chip button {
		padding: 3px 7px;
		border: 0;
		border-radius: 2px;
		background: none;
		color: var(--fg-dim);
		font: inherit;
		letter-spacing: inherit;
		text-transform: inherit;
		cursor: pointer;
	}
	.demo-chip button.on {
		background: color-mix(in srgb, var(--trim) 20%, transparent);
		color: var(--fg);
	}

	/* ── Card ──────────────────────────────────────────────────────────── */
	.panel {
		display: grid;
		grid-template-rows: auto minmax(0, 1fr) auto auto auto;
		min-height: 0;
		border: 1px solid var(--border);
		border-radius: 5px;
		background: color-mix(in srgb, var(--bg) 55%, transparent);
		overflow: hidden;
	}

	.tabs {
		display: flex;
		gap: 3px;
		margin: 12px 12px 0;
		padding: 3px;
		border: 1px solid var(--border);
		border-radius: 5px;
		background: color-mix(in srgb, var(--bg) 70%, transparent);
	}
	.tabs button {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		padding: 8px 4px;
		border: 0;
		border-radius: 3px;
		background: none;
		color: var(--fg-dim);
		font-family: var(--mono);
		font-size: 0.72rem;
		cursor: pointer;
		transition:
			background 120ms,
			color 120ms;
	}
	.tabs button:hover {
		color: var(--fg);
	}
	.tabs button.active {
		background: color-mix(in srgb, var(--trim) 16%, transparent);
		color: var(--fg);
		box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--trim) 45%, transparent);
	}

	.list {
		display: grid;
		gap: 12px;
		padding: 12px;
		overflow-y: auto;
		align-content: start;
		scrollbar-width: thin;
	}
	.section-head {
		display: grid;
		gap: 2px;
		margin-bottom: 8px;
	}
	.section-head h4 {
		margin: 0;
		font-family: var(--mono);
		font-size: 0.55rem;
		font-weight: 500;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--fg);
	}
	.section-head p {
		margin: 0;
		font-size: 0.66rem;
		color: var(--fg-dim);
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 10px;
	}
	/* Four bodies, judged head to toe: bigger, two across. */
	.grid.wide {
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}
	/* A color needs no figure, so its card can be small: five across leaves
	   room for Paint underneath without scrolling. */
	.grid.colorway {
		grid-template-columns: repeat(5, minmax(0, 1fr));
		gap: 8px;
	}
	.grid.colorway .tile {
		padding: 22px 4px 8px;
	}
	.grid.colorway .art {
		height: 34px;
	}
	.grid.colorway .chip {
		width: 30px;
		height: 30px;
	}
	.grid.colorway .name {
		font-size: 0.52rem;
		line-height: 1.3;
	}

	/* The game's tile, unchanged apart from size and a price line. */
	.tile {
		position: relative;
		display: grid;
		grid-template-rows: 1fr auto auto;
		gap: 4px;
		width: 100%;
		padding: 8px 6px;
		border: 1px solid var(--border);
		border-radius: 4px;
		background: color-mix(in srgb, var(--bg) 60%, transparent);
		cursor: pointer;
		transition:
			border-color 120ms,
			background 120ms;
	}
	.tile:hover {
		border-color: color-mix(in srgb, var(--trim) 60%, transparent);
	}
	.tile.on {
		border-color: var(--trim);
		background: color-mix(in srgb, var(--trim) 10%, transparent);
	}
	.tile.open {
		border-color: color-mix(in srgb, var(--trim) 80%, transparent);
		border-style: dashed;
	}
	.tile.locked .art {
		opacity: 0.45;
	}
	.tile.locked.open .art {
		opacity: 0.85;
	}
	.art {
		display: grid;
		place-items: center;
		height: 84px;
	}
	.grid.wide .art {
		height: 104px;
	}
	.chip {
		width: 40px;
		height: 40px;
		border-radius: 50%;
		border: 1px solid var(--border);
	}
	.name {
		font-family: var(--mono);
		font-size: 0.58rem;
		letter-spacing: 0.06em;
		color: var(--fg-dim);
		text-align: center;
	}
	.tile.on .name {
		color: var(--fg);
	}
	.price {
		font-family: var(--mono);
		font-size: 0.5rem;
		letter-spacing: 0.06em;
		color: color-mix(in srgb, var(--fg-dim) 80%, transparent);
		text-align: center;
	}
	.state {
		position: absolute;
		top: 6px;
		right: 6px;
		color: var(--fg-dim);
	}
	.state.on-tag {
		color: var(--trim);
	}
	.ribbon {
		position: absolute;
		top: 6px;
		left: 6px;
		padding: 1px 4px;
		border-radius: 2px;
		background: color-mix(in srgb, var(--rare) 22%, transparent);
		color: var(--rare);
		font-family: var(--mono);
		font-size: 0.45rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}

	/* ── Saved ─────────────────────────────────────────────────────────── */
	.section-head p.warn {
		color: #f5b942;
	}
	.slot {
		position: relative;
	}
	.saved-art {
		height: 104px;
	}
	.state.left {
		right: auto;
		left: 6px;
	}
	.remove {
		position: absolute;
		top: 5px;
		right: 5px;
		display: grid;
		place-items: center;
		width: 22px;
		height: 22px;
		padding: 0;
		border: 1px solid transparent;
		border-radius: 3px;
		background: none;
		color: var(--fg-dim);
		opacity: 0.55;
		cursor: pointer;
		transition:
			opacity 120ms,
			color 120ms,
			border-color 120ms;
	}
	.slot:hover .remove,
	.remove:focus-visible {
		opacity: 1;
	}
	.remove:hover {
		color: #fb7185;
		border-color: color-mix(in srgb, #fb7185 40%, transparent);
	}
	.tile.empty {
		border-style: dashed;
		background: none;
		color: var(--fg-dim);
	}
	.tile.empty:hover:not(:disabled) {
		color: var(--fg);
	}
	.tile.empty:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	/* ── Paint ─────────────────────────────────────────────────────────── */
	.paint {
		border: 1px solid var(--border);
		border-radius: 4px;
	}
	.paint summary {
		display: flex;
		align-items: center;
		gap: 7px;
		padding: 8px 11px;
		list-style: none;
		font-family: var(--mono);
		font-size: 0.62rem;
		letter-spacing: 0.06em;
		color: var(--fg);
		cursor: pointer;
	}
	.paint summary::-webkit-details-marker {
		display: none;
	}
	.paint summary :global(svg) {
		transition: transform 120ms;
	}
	.paint[open] summary :global(svg) {
		transform: rotate(90deg);
	}
	.paint .dirty {
		margin-left: auto;
		color: var(--trim);
		font-size: 0.5rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}
	.mats {
		display: flex;
		gap: 14px;
		padding: 2px 11px 8px;
		border-bottom: 1px solid var(--border);
	}
	.mat,
	.prow {
		display: flex;
		align-items: center;
		gap: 6px;
		font-family: var(--mono);
		font-size: 0.52rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--fg-dim);
	}
	.rows {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 5px 12px;
		padding: 8px 11px;
	}
	.prow.custom .plabel {
		color: var(--fg);
	}
	.prow .group {
		font-size: 0.42rem;
		opacity: 0.6;
	}
	.clear {
		border: 0;
		background: none;
		color: var(--fg-dim);
		font-size: 0.8rem;
		line-height: 1;
		cursor: pointer;
	}
	.strip {
		margin: 0 11px 11px;
	}

	.colors {
		display: grid;
		gap: 8px;
		padding: 12px 14px;
		border-top: 1px solid var(--border);
	}
	.colors .label {
		font-family: var(--mono);
		font-size: 0.5rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--fg-dim);
	}
	.dots {
		display: flex;
		flex-wrap: wrap;
		gap: 9px;
	}
	.dot {
		width: 28px;
		height: 28px;
		padding: 0;
		border: 1px solid color-mix(in srgb, var(--fg) 15%, transparent);
		border-radius: 50%;
		cursor: pointer;
		transition: box-shadow 120ms;
	}
	.dot:hover {
		box-shadow: 0 0 0 2px color-mix(in srgb, var(--trim) 50%, transparent);
	}
	.dot.on {
		box-shadow:
			0 0 0 2px var(--bg),
			0 0 0 4px var(--trim);
	}
	/* The first dot is "back to how it came", marked so it does not read as
	   just another hue. */
	.dot.default {
		background-image: linear-gradient(
			135deg,
			transparent 46%,
			color-mix(in srgb, var(--bg) 70%, transparent) 46%,
			color-mix(in srgb, var(--bg) 70%, transparent) 54%,
			transparent 54%
		) !important;
	}

	.info {
		display: grid;
		gap: 4px;
		padding: 10px 14px 0;
		border-top: 1px solid var(--border);
		font-family: var(--mono);
		font-size: 0.6rem;
		line-height: 1.45;
		color: var(--fg-dim);
	}
	.info p {
		margin: 0;
	}
	.info b {
		color: var(--fg);
		font-weight: 500;
	}
	.info .short {
		color: #fb7185;
	}
	.info .get {
		margin-left: 6px;
		padding: 0;
		border: 0;
		border-bottom: 1px solid currentColor;
		background: none;
		color: var(--trim);
		font: inherit;
		cursor: pointer;
	}
	.info .reward {
		color: #f5b942;
	}
	.info .blurb {
		font-family: var(--sans, inherit);
		font-size: 0.68rem;
	}

	.notice {
		margin: 0;
		padding: 10px 14px 0;
		font-size: 0.66rem;
		color: #f5b942;
	}

	.actions {
		display: grid;
		grid-template-columns: 1fr 1fr 1.4fr;
		gap: 10px;
		padding: 12px 14px 14px;
	}
	.actions button {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		padding: 11px 10px;
		border-radius: 4px;
		font-family: var(--mono);
		font-size: 0.66rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		cursor: pointer;
		transition:
			background 120ms,
			border-color 120ms,
			color 120ms;
	}
	.secondary {
		border: 1px solid var(--border);
		background: none;
		color: var(--fg-dim);
	}
	.secondary:hover:not(:disabled) {
		border-color: color-mix(in srgb, var(--fg) 30%, transparent);
		color: var(--fg);
	}
	.primary {
		border: 1px solid var(--trim);
		background: color-mix(in srgb, var(--trim) 22%, transparent);
		color: var(--fg);
		font-weight: 600;
	}
	.primary:hover:not(:disabled) {
		background: color-mix(in srgb, var(--trim) 32%, transparent);
	}
	.actions button:disabled {
		border-color: var(--border);
		background: none;
		color: color-mix(in srgb, var(--fg-dim) 60%, transparent);
		cursor: not-allowed;
	}

	/* Phone: one column that scrolls, rather than a card squeezed to nothing. */
	@media (max-width: 760px) {
		.outfitter {
			display: flex;
			flex-direction: column;
			gap: 14px;
			overflow-y: auto;
		}
		.stage {
			flex: none;
			height: 520px;
			padding-top: 34px;
		}
		.panel {
			flex: none;
			grid-template-rows: none;
			overflow: visible;
		}
		.list {
			overflow: visible;
		}
	}
</style>
