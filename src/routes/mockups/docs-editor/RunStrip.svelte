<script lang="ts">
	// The last N outcomes as tone-filled cells, newest on the right.
	//
	// Nothing in showcase draws a CATEGORICAL outcome history: Sparkline is
	// continuous, ProgressBar and StackedBar are proportions, SteppedProgress is
	// a linear wizard, and Timeline is vertical and verbose. A pass/fail strip is
	// the standard CI idiom and is genuinely absent — so it is built local to the
	// mockup and promoted into the library once something else wants it.
	//
	// It answers one question a number cannot: is this check flapping, or has it
	// been steady? "Failing" reads very differently when the four runs before it
	// passed than when it has never passed once.

	import type { CommandRun } from './data.js';

	interface Props {
		runs: CommandRun[];
		/** How many cells to draw. Missing runs render as empty slots. */
		slots?: number;
		onopen?: () => void;
	}

	let { runs, slots = 8, onopen }: Props = $props();

	const TONE: Record<CommandRun['outcome'], string> = {
		pass: 'var(--palette-emerald-l)',
		fail: 'var(--palette-red)',
		error: 'var(--palette-orange)'
	};

	// Oldest → newest, left → right, padded at the front so the newest run always
	// sits against the right edge no matter how thin the history is.
	const cells = $derived.by(() => {
		const recent = runs.slice(0, slots).reverse();
		const pad = Math.max(0, slots - recent.length);
		return [...Array.from({ length: pad }, () => null), ...recent];
	});
</script>

<button
	class="flex items-center gap-[3px] p-0 bg-transparent border-0 cursor-pointer group/strip"
	onclick={onopen}
	aria-label="Open the full run history — {runs.length} runs"
	title="{runs.length} runs · open the full history"
>
	{#each cells as c, i (i)}
		<span
			class="w-[6px] h-[14px] rounded-[1px] transition-transform group-hover/strip:scale-y-110"
			style:background={c ? TONE[c.outcome] : 'var(--border)'}
			style:opacity={c ? 1 : 0.5}
		></span>
	{/each}
</button>
