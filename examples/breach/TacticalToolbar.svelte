<script lang="ts">
	// ── The tactical toolbar ─────────────────────────────────────────────────────
	// The camera controls, re-pointed at the GAME. A raw zoom-in/zoom-out pair is
	// a viewer's control; a commander wants "show me the objective", "show me
	// what I hold", "show me the whole theatre" — the camera move is the same, but
	// the button names a decision rather than a transform.
	//
	// It is `IconToolbar` because that is what a vertical icon rail with tooltips,
	// dividers and dropdowns already is. Nothing here re-implements a toolbar.
	import { IconToolbar, type IconToolbarItem } from 'showcase';
	import type { CanvasCamera, MeshLayoutId } from 'showcase';
	import { CHAIN, CORE_ID, TERRITORIES, TERRITORY_ORDER } from './internal/rules.js';
	import type { BreachMatch } from './internal/match.svelte.js';
	import { PRESENCE_MODES, type PresenceRenderMode } from './presence/index.js';

	interface Props {
		match: BreachMatch;
		camera: CanvasCamera | undefined;
		/** Bound to the canvas so the view menu can drive it. Typed against the
		 *  canvas's own ids rather than `string`: the rail used to offer "Force" and
		 *  "Grid", neither of which is a layout the canvas has, and both silently
		 *  fell through to the grouped 2D solve. A widened type is how two of four
		 *  buttons ended up drawing the same thing. */
		layout: MeshLayoutId;
		onlayout: (id: MeshLayoutId) => void;
		/** Player-presence modes currently drawing. */
		presenceModes?: PresenceRenderMode[];
		onpresence?: (id: PresenceRenderMode) => void;
		class?: string;
	}

	let {
		match,
		camera,
		layout,
		onlayout,
		presenceModes = [],
		onpresence,
		class: cls = ''
	}: Props = $props();

	/** The building the player most likely wants to look at: what they are
	 *  aiming at, else the next step of the path, else the core. */
	const focus = $derived(
		match.selectedId ??
			(match.seat.faction === 'red' ? (match.chainNext?.id ?? CORE_ID) : CORE_ID)
	);

	/** Two views of ONE board, and deliberately not a menu of arrangements.
	 *
	 *  The canvas can also lay a mesh out as a ring, a fan or a cluster, and none
	 *  of those is a board: they scatter the buildings by graph shape, so the
	 *  territory a structure stands in — which is the whole of the game's geography
	 *  — stops being where it is. Globe and Map are the same pack, the same ground
	 *  and the same regions seen two ways, so switching is a camera decision rather
	 *  than a different world.
	 *
	 *  Two states is a TOGGLE, not a list. A dropdown of two makes the player open
	 *  a menu to read which one they are already in and then pick the only other
	 *  answer — two clicks and a read to do what one press does. The button shows
	 *  the view it will take you TO, so the press and its glyph say the same thing. */
	// "Map" is the player-facing word for the flat view; `grouped` is what that
	// view is called in the canvas. The label is the promise, the id is the
	// layout — they are allowed to differ, and a made-up id is not.
	const OTHER = $derived<{ id: MeshLayoutId; label: string; icon: 'globe' | 'layers' }>(
		layout === 'globe'
			? { id: 'grouped', label: 'Map', icon: 'layers' }
			: { id: 'globe', label: 'Globe', icon: 'globe' }
	);

	const items = $derived<IconToolbarItem[]>([
		{
			icon: 'crestlink',
			label: 'Objective — fly to the next step',
			onclick: () => {
				match.selectedId = match.chainNext?.id ?? CORE_ID;
				void camera?.flyTo(match.chainNext?.id ?? CORE_ID, { duration: 700 });
			}
		},
		{
			icon: 'flame',
			label: 'Hottest region',
			disabled: TERRITORY_ORDER.every((t) => match.heat[t] === 0),
			onclick: () => {
				const hottest = TERRITORY_ORDER.reduce((a, b) =>
					match.heat[a] >= match.heat[b] ? a : b
				);
				const anchor = CHAIN.find((s) => s.territory === hottest);
				void camera?.flyTo(anchor?.id ?? CORE_ID, { duration: 700 });
			}
		},
		{
			icon: 'home',
			label: 'Recentre on the core',
			onclick: () => void camera?.flyTo(CORE_ID, { duration: 600 })
		},
		{ divider: true },
		{ icon: 'maximize', label: 'Fit the whole theatre', onclick: () => camera?.fitAll() },
		{ icon: 'zoom-in', label: 'Closer', onclick: () => camera?.zoomIn() },
		{ icon: 'zoom-out', label: 'Wider', onclick: () => camera?.zoomOut() },
		{ divider: true },
		{
			icon: OTHER.icon,
			label: `Board view — switch to ${OTHER.label}`,
			onclick: () => onlayout(OTHER.id)
		},
		// The table, as a set of layers rather than a panel. It sits with the
		// camera controls because it is the same kind of decision: not a move, but
		// how the commander wants to be shown the board.
		{
			icon: 'users',
			label: `Player presence — ${presenceModes.length} of ${PRESENCE_MODES.length} on`,
			active: presenceModes.length > 0,
			disabled: !onpresence,
			menu: [
				{ kind: 'header' as const, label: 'Presence modes' },
				...PRESENCE_MODES.map((m) => ({
					label: m.name,
					icon: m.icon,
					selected: presenceModes.includes(m.id),
					color: presenceModes.includes(m.id) ? undefined : 'var(--fg-dim)',
					onclick: () => onpresence?.(m.id)
				}))
			]
		},
		{
			icon: 'eye',
			label: match.selectedId
				? `Clear target — ${TERRITORIES[
						CHAIN.find((s) => s.id === focus)?.territory ?? 'marches'
					].name}`
				: 'Nothing targeted',
			active: !!match.selectedId,
			disabled: !match.selectedId,
			onclick: () => (match.selectedId = null)
		}
	]);
</script>

<IconToolbar {items} orientation="vertical" class={cls} />
