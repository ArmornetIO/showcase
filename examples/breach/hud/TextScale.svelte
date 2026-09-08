<script lang="ts">
	// The control for `hud-scale`. Deliberately outside the scaled subtree: a
	// button that grows as you press it walks away from the cursor, and the one
	// thing a player adjusting text size must be able to do is press it again.
	import { Icon } from 'showcase';
	import { hudScale } from './hud-scale.svelte.js';

	interface Props {
		class?: string;
	}

	let { class: cls = '' }: Props = $props();
</script>

<div
	class="flex items-center gap-1 rounded-full border border-[var(--border)] bg-[color-mix(in_srgb,var(--bg-elev,#0b0f16)_88%,transparent)] px-1 py-1 {cls}"
	title="HUD text size"
>
	<button
		type="button"
		class="grid h-[22px] w-[22px] place-items-center rounded-full text-[var(--fg-muted)] transition-colors hover:text-[var(--fg)] disabled:opacity-35"
		disabled={hudScale.atMin}
		onclick={() => hudScale.nudge(-1)}
		aria-label="smaller HUD text"
	>
		<Icon name="minus" size={13} />
	</button>

	<!-- Doubles as the reset: the only two things anybody does with a text-size
	     control are nudge it and put it back. -->
	<button
		type="button"
		class="min-w-[42px] font-mono text-[0.62rem] leading-none font-black tabular-nums text-[var(--fg)] transition-colors hover:text-[var(--accent)]"
		onclick={() => hudScale.reset()}
		aria-label="reset HUD text size"
	>
		{hudScale.percent}%
	</button>

	<button
		type="button"
		class="grid h-[22px] w-[22px] place-items-center rounded-full text-[var(--fg-muted)] transition-colors hover:text-[var(--fg)] disabled:opacity-35"
		disabled={hudScale.atMax}
		onclick={() => hudScale.nudge(1)}
		aria-label="larger HUD text"
	>
		<Icon name="plus" size={13} />
	</button>
</div>
