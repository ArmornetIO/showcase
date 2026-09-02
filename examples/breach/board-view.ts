// ── Game state → canvas geometry ─────────────────────────────────────────────
// The adapter, and the only place that knows both vocabularies. `internal/` has
// never heard of a StudioNode; MeshCanvas has never heard of a foothold. This
// file is the seam, and keeping it a plain function rather than burying it in a
// component is what makes it testable.

import type { StudioEdge, StudioNode, TerritoryStyle } from 'showcase';
import {
	CHAIN,
	CORE_ID,
	STRUCTURES,
	TERRITORIES,
	structureById,
	type TerritoryKey
} from './internal/rules.js';
import type { BreachMatch } from './internal/match.svelte.js';

/** Clearance so a settlement's label never collides with its neighbour's roof. */
export const NODE_CLEARANCE = 10;
export const nodeFootprint = (n: StudioNode) => (n.r ?? 22) + NODE_CLEARANCE;

/**
 * The board's bodies. The core carries the score; every structure carries its
 * live hardening and — crucially — a state that is fogged: a building blue has
 * not turned over still looks FINE, and the only tell is the heat on the region
 * it stands in. That asymmetry is the game.
 */
export function boardNodes(match: BreachMatch): StudioNode[] {
	const held =
		match.seat.faction === 'red' ? match.chainHeld.length : match.chainShown.length;

	return [
		{
			id: CORE_ID,
			type: 'control-plane',
			state: match.chainHeld.length >= 4 ? 'degraded' : 'healthy',
			label: 'PROTECTED CORE',
			value: `${held}/${CHAIN.length}`,
			valueLabel: 'chain',
			iconKey: 'crestlink',
			glyphAsBody: true,
			x: 0,
			y: 0,
			r: 42
		},
		...STRUCTURES.map((s): StudioNode => {
			const foothold = match.visibleOn(s.id);
			const hot = match.heat[s.territory] >= 55;
			return {
				id: s.id,
				type: 'agentic',
				state: foothold ? 'offline' : hot ? 'degraded' : 'healthy',
				label: s.name,
				value: String(match.hardeningOf(s.id)),
				valueLabel: 'hard',
				strokeColor: foothold
					? foothold.sleeper
						? '#FB923C'
						: '#F472B6'
					: match.quarantined.includes(s.id)
						? '#94A3B8'
						: TERRITORIES[s.territory].color,
				piece: s.piece,
				x: 0,
				y: 0,
				r: s.chain ? 28 : 23
			};
		})
	];
}

/**
 * The payload path drawn as the lane it is, plus a latent tie from everything
 * off-path back to the core. A lit segment is one red already owns AND this seat
 * can see — held-but-unseen draws latent, which is the fog doing its job.
 */
export function boardEdges(match: BreachMatch): StudioEdge[] {
	return [
		...CHAIN.map((s, i) => {
			const to = CHAIN[i + 1]?.id ?? CORE_ID;
			const held = match.footholds.some((f) => f.structure_id === s.id);
			const shown = !!match.visibleOn(s.id);
			const lit = held && shown;
			return {
				id: `chain-${s.id}`,
				from: s.id,
				to,
				dataType: 'lifecycle' as const,
				style: (lit ? 'energy' : 'latent') as StudioEdge['style'],
				active: lit,
				sig: lit ? 0.85 : 0.15
			};
		}),
		...STRUCTURES.filter((s) => !s.chain).map((s) => ({
			id: `link-${s.id}`,
			from: CORE_ID,
			to: s.id,
			dataType: 'lifecycle' as const,
			style: 'latent' as StudioEdge['style'],
			active: false,
			sig: 0.1
		}))
	];
}

/** Which territory a body belongs to, for the globe's grouping. */
export const groupKeyOf = (n: StudioNode) =>
	n.id === CORE_ID ? 'marches' : (structureById(n.id)?.territory ?? 'marches');

/** The territory's paint. Same colours the HUD uses, from the same table. */
export const styleOf = (k: string | number): TerritoryStyle | null =>
	(TERRITORIES[k as TerritoryKey] as TerritoryStyle) ?? null;
