<script lang="ts">
	// ── Who somebody is, at three sizes ──────────────────────────────────────────
	// Glyph, name, and whatever line the caller wants under it. The `badge` and
	// `meta` snippets exist because the four places this appears each want a
	// different second line — ally/enemy, seat code, resource — and none of them
	// want a component that knows about all four.
	import type { Snippet } from 'svelte';
	import { Icon, type IconName } from 'showcase';
	import type { Klass } from '../internal/rules.js';

	interface Props {
		klass: Klass;
		size?: 'sm' | 'md' | 'lg';
		/** Second line under the name. Defaults to the tagline. */
		meta?: Snippet;
		/** Right-aligned content on the name row. */
		badge?: Snippet;
	}

	let { klass, size = 'md', meta, badge }: Props = $props();

	const GLYPH = { sm: 24, md: 32, lg: 36 } as const;
	const ICON = { sm: 12, md: 16, lg: 17 } as const;
	const NAME = { sm: 'text-[0.6rem]', md: 'text-[0.74rem]', lg: 'text-[0.8rem]' } as const;
</script>

<div class="flex items-start gap-2 min-w-0">
	<span
		class="grid place-items-center rounded border shrink-0"
		style:width="{GLYPH[size]}px"
		style:height="{GLYPH[size]}px"
		style:color={klass.color}
		style:border-color="color-mix(in srgb, {klass.color} 45%, transparent)"
		style:background="color-mix(in srgb, {klass.color} 12%, transparent)"
	>
		<Icon name={klass.icon as IconName} size={ICON[size]} />
	</span>

	<div class="flex flex-col gap-0.5 min-w-0 flex-1">
		<div class="flex items-center gap-1.5 min-w-0">
			<span class="font-mono {NAME[size]} font-bold truncate" style:color={klass.color}>
				{klass.name}
			</span>
			{#if badge}
				<span class="ml-auto shrink-0">{@render badge()}</span>
			{/if}
		</div>
		<span class="font-mono text-[0.54rem] leading-snug text-[var(--fg-dim)]">
			{#if meta}{@render meta()}{:else}{klass.tagline}{/if}
		</span>
	</div>
</div>
