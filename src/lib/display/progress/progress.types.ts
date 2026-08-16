/**
 * Shared vocabulary for the progress family.
 *
 * These live here rather than in `ProgressBar.svelte` because `ProgressBar` is
 * the facade that renders `RadialProgress`, `SteppedProgress` and `StackedBar`,
 * while all three need the same `ProgressVariant`. Declaring it in the facade
 * made every leaf type-import back out of its own parent — a cycle that only
 * survived because the edges were type-only and erased at compile time.
 *
 * Mirrors the `card.types.ts` / `toggle.types.ts` convention in `primitives/`.
 */

/** Which of the progress renderings to use. */
export type ProgressType = 'linear' | 'radial' | 'stepped' | 'stacked' | 'pips';

/** Semantic color, honoured by every progress type. */
export type ProgressVariant = 'default' | 'accent' | 'success' | 'warn' | 'error';

/** Track thickness for the linear and stacked bars. */
export type ProgressSize = 'sm' | 'md' | 'lg';
