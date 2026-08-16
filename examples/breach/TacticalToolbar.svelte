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
	import type { CanvasCamera } from 'showcase';
	import { CHAIN, CORE_ID, TERRITORIES, TERRITORY_ORDER } from './internal/rules.js';
	import type { BreachMatch } from './internal/match.svelte.js';

	interface Props {
		match: BreachMatch;
		camera: CanvasCamera | undefined;
		/** Bound to the canvas so the layout menu can drive it. */
		layout: string;
		onlayout: (id: string) => void;
		class?: string;
	}

	let { match, camera, layout, onlayout, class: cls = '' }: Props = $props();

	/** The building the player most likely wants to look at: what they are
	 *  aiming at, else the next step of the path, else the core. */
	const focus = $derived(
		match.selectedId ??
			(match.seat.faction === 'red' ? (match.chainNext?.id ?? CORE_ID) : CORE_ID)
	);

	const LAYOUTS: Array<{ id: string; label: string }> = [
		{ id: 'globe', label: 'Globe' },
		{ id: 'force', label: 'Force' },
		{ id: 'radial', label: 'Radial' },
		{ id: 'grid', label: 'Grid' }
	];

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
			icon: 'shapes',
			label: `Board layout — ${LAYOUTS.find((l) => l.id === layout)?.label ?? layout}`,
			menu: LAYOUTS.map((l) => ({
				label: l.label,
				onclick: () => onlayout(l.id)
			}))
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
