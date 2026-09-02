<script lang="ts">
	// ── The table ────────────────────────────────────────────────────────────────
	// The HUD column's half of player presence. The presence module draws into two
	// places — over the board and in this column — and those are two different
	// points in the tree, so it mounts twice and each mount draws its own layer.
	// This is the panel one; `BoardStage` owns the other.
	//
	// It holds no state and makes no decisions: which modes are on is the app's
	// call, passed straight through, so the rail that toggles a mode toggles it
	// for both surfaces at once.
	import { PlayerPresence, DEFAULT_MODES, type PresenceRenderMode } from '../presence/index.js';
	import type { BreachMatch } from '../internal/match.svelte.js';

	interface Props {
		match: BreachMatch;
		/** Which presence modes are drawing. The board modes in the set are simply
		 *  ignored here — the module knows which of its modes belong to which
		 *  surface, and a caller should not have to split the list. */
		modes?: PresenceRenderMode[];
		/** Open a seat's sheet, for the roster mode. Omit and the rows are inert. */
		oninspect?: (key: string) => void;
		/** Fly the camera, for the seat-cameras mode. */
		onvisit?: (structureId: string) => void;
		class?: string;
	}

	let { match, modes = DEFAULT_MODES, oninspect, onvisit, class: cls = '' }: Props = $props();
</script>

<PlayerPresence {match} {modes} {oninspect} {onvisit} surface="panel" class={cls} />
