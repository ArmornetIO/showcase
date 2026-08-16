<script lang="ts">
	// ── Four numbers, one row ────────────────────────────────────────────────────
	// The same card in two different pairs of hands is not the same card, and this
	// is where a player sees why. Rendered in three places — your own seat, the
	// sheet for somebody else's, and the chair-selection screen — which is exactly
	// the threshold at which a repeated block becomes a component.
	import { SKILL_BLURB, SKILL_LABEL, type Klass, type Skill } from '../internal/rules.js';

	interface Props {
		klass: Klass;
		/** Scale. The select screen can afford a bigger number than a rail can. */
		size?: 'sm' | 'md';
	}

	let { klass, size = 'md' }: Props = $props();

	const NUM = { sm: 'text-[0.76rem]', md: 'text-[0.8rem]' } as const;
	const skills = $derived(Object.keys(klass.skills) as Skill[]);
</script>

<div class="grid grid-cols-4 gap-1">
	{#each skills as key (key)}
		{@const value = klass.skills[key]}
		<div
			class="flex flex-col items-center gap-0.5 py-1 rounded border border-[var(--border)]"
			title={SKILL_BLURB[key]}
		>
			<span
				class="font-mono {NUM[size]} font-bold leading-none tabular-nums"
				style:color={value > 0 ? klass.color : value < 0 ? '#FB7185' : 'var(--fg-dim)'}
			>
				{value >= 0 ? '+' : ''}{value}
			</span>
			<span class="font-mono text-[0.44rem] tracking-[0.1em] text-[var(--fg-dim)]">
				{SKILL_LABEL[key].slice(0, 3)}
			</span>
		</div>
	{/each}
</div>
