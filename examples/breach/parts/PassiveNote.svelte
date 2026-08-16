<script lang="ts">
	// ── The standing rule a seat brings to the table ─────────────────────────────
	// Always on, never spent, and the thing that makes a chair feel like somebody
	// rather than a colour. Tinted in the seat's hue so it reads as theirs.
	import type { Klass } from '../internal/rules.js';

	interface Props {
		klass: Klass;
	}

	let { klass }: Props = $props();
</script>

<div
	class="flex flex-col gap-0.5 rounded border border-[var(--border)] px-2 py-1.5
	       bg-[color-mix(in_srgb,var(--fg)_4%,transparent)]"
>
	<span class="font-mono text-[0.52rem] tracking-[0.16em] uppercase" style:color={klass.color}>
		passive · {klass.passive.name}
	</span>
	<span class="font-mono text-[0.56rem] leading-snug text-[var(--fg-dim)]">
		{klass.passive.text}
	</span>
</div>
