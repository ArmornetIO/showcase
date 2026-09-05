// ── gl/render-tunables — the two dials worth turning at runtime ──────────────
// Both of these were found by measurement and both are quality-for-speed
// trades, which is exactly the kind of value nobody should be guessing from a
// source file. On the marketing page at deviceScaleFactor 2 (M3 Pro, 40s holds,
// ±6% run-to-run noise), late frames per second against the density ceiling:
//
//   2.0 (unclamped) 38.5   ·   1.5  21.8   ·   1.25  14.8   ·   1.0  11.6
//
// 1.25 is the knee: −62% against unclamped while still supersampling. 1.0 buys
// another 22% and gives up supersampling entirely on a Retina panel.
//
// MSAA measured as a WASH on the same page — 22.15/s off against 21.84/s on,
// inside the noise band — so it is here to be re-checked on other hardware, not
// because it is known to cost anything.
//
// Persisted, because the point is comparing across reloads: MSAA is a context
// CREATION attribute, so changing it cannot take effect until the contexts are
// rebuilt, and a value that did not survive the reload would be untestable.

const KEY = 'gl-tunables';

/** Ceiling on drawing-buffer density. `Math.min` with `devicePixelRatio`, so a
 *  standard display is unaffected by any value ≥ 1. */
export const DPR_DEFAULT = 1.25;

interface Persisted {
	dprCeiling: number;
	antialias: boolean;
}

function load(): Persisted {
	const fallback = { dprCeiling: DPR_DEFAULT, antialias: true };
	if (typeof localStorage === 'undefined') return fallback;
	try {
		const raw = localStorage.getItem(KEY);
		if (!raw) return fallback;
		const p = JSON.parse(raw) as Partial<Persisted>;
		return {
			// Clamped on read: a hand-edited 0 would allocate a 1px buffer and the
			// page would render blank with no clue why.
			dprCeiling: Math.min(Math.max(Number(p.dprCeiling) || DPR_DEFAULT, 0.5), 3),
			antialias: p.antialias ?? true
		};
	} catch {
		return fallback;
	}
}

const initial = load();

class RenderTunables {
	/** Live. Takes effect on the next `resize()`, which every layer already calls
	 *  per draw — no remount needed. */
	dprCeiling = $state(initial.dprCeiling);
	/** NOT live. A context creation attribute; the page must reload for it to
	 *  apply. `MeshDevControls` says so next to the switch. */
	antialias = $state(initial.antialias);

	save(): void {
		try {
			localStorage.setItem(
				KEY,
				JSON.stringify({ dprCeiling: this.dprCeiling, antialias: this.antialias })
			);
		} catch {
			// Private mode. The dial still works for this session.
		}
	}

	reset(): void {
		this.dprCeiling = DPR_DEFAULT;
		this.antialias = true;
		this.save();
	}
}

export const renderTunables = new RenderTunables();

/** Read by `context.ts`. A plain function rather than the rune object so the
 *  non-reactive plumbing does not have to import a `.svelte.ts` boundary it has
 *  no other reason to know about. */
export function dprCeiling(): number {
	return renderTunables.dprCeiling;
}

export function wantAntialias(): boolean {
	return renderTunables.antialias;
}
