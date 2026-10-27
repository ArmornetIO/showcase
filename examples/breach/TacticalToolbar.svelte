<script lang="ts">
	// ── The tactical toolbar ─────────────────────────────────────────────────────
	// Two controls, lying flat, at every width.
	//
	// It was nine, in a vertical column, on anything wider than a phone. The
	// narrow layout cut it to two on the argument that seven of them were a
	// mouse's conveniences — and having played both, the two-item bar is simply
	// the better control surface, mouse or not. `Closer`/`Wider` are a worse copy
	// of the scroll wheel; `Objective` and `Hottest region` fly the camera
	// somewhere the objective strip already names in words; `Clear target` is a
	// click on empty board. None of those stop being true when a cursor arrives —
	// a desktop just has enough room to hide that they were never earning it.
	//
	// What is left is the pair a player cannot do any other way: get the view back
	// when they have spun the globe into empty space, and see the other board.
	//
	// It is `IconToolbar` because that is what an icon bar with tooltips and
	// dropdowns already is. Nothing here re-implements a toolbar.
	import { IconToolbar, type IconToolbarItem } from 'showcase';
	import type { CanvasCamera, MeshLayoutId } from 'showcase';
	import { PRESENCE_MODES, type PresenceRenderMode } from './presence/index.js';

	interface Props {
		camera: CanvasCamera | undefined;
		/** Bound to the canvas so the view menu can drive it. Typed against the
		 *  canvas's own ids rather than `string`: the rail used to offer "Force" and
		 *  "Grid", neither of which is a layout the canvas has, and both silently
		 *  fell through to the grouped 2D solve. A widened type is how two of four
		 *  buttons ended up drawing the same thing. */
		layout: MeshLayoutId;
		onlayout: (id: MeshLayoutId) => void;
		/** Player-presence modes currently drawing. Host-supplied: this example
		 *  never wires `onpresence`, so the menu is absent here and present for an
		 *  embedder that wants it. */
		presenceModes?: PresenceRenderMode[];
		onpresence?: (id: PresenceRenderMode) => void;
		class?: string;
	}

	let {
		camera,
		layout,
		onlayout,
		presenceModes = [],
		onpresence,
		class: cls = ''
	}: Props = $props();

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
		{ icon: 'maximize', label: 'Fit the whole theatre', onclick: () => camera?.fitAll() },
		{
			icon: OTHER.icon,
			label: `Board view — switch to ${OTHER.label}`,
			onclick: () => onlayout(OTHER.id)
		},
		// Only for a host that wired it. This is the toolbar's one remaining menu
		// and it is not a camera decision, so it does not get to set the shape of
		// the bar for the app that never passes the handler — where it drew a
		// permanently disabled ninth glyph.
		...(onpresence
			? [
					{
						icon: 'users',
						label: `Player presence — ${presenceModes.length} of ${PRESENCE_MODES.length} on`,
						active: presenceModes.length > 0,
						menu: [
							{ kind: 'header' as const, label: 'Presence modes' },
							...PRESENCE_MODES.map((m) => ({
								label: m.name,
								icon: m.icon,
								selected: presenceModes.includes(m.id),
								color: presenceModes.includes(m.id) ? undefined : 'var(--fg-dim)',
								onclick: () => onpresence(m.id)
							}))
						]
					} satisfies IconToolbarItem
				]
			: [])
	]);
</script>

<IconToolbar items={items} orientation="horizontal" class="tac-rail {cls}" />

<style>
	/* The buttons are laid out for a cursor. A finger needs 44px, and the
	   toolbar's own sizing lives in the library — so the size is overridden here,
	   where the decision that this bar is played on a phone is actually made.

	   The container has to grow with them: `height` now rather than `width`, the
	   bar being horizontal at every size. A 44px button in a 44px track with auto
	   margins overflows by exactly the margin. */
	@media (pointer: coarse) {
		:global(.tac-rail) {
			height: 54px;
		}
		:global(.tac-rail .toolbar-btn) {
			width: 44px;
			height: 44px;
		}
	}
</style>
