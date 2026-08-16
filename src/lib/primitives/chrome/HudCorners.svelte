<script lang="ts">
	interface HudCornersProps {
		color?: string;
		size?: number;
		offset?: number;
		class?: string;
	}

	let {
		color = 'var(--accent)',
		size = 9,
		offset = 6,
		class: className = ''
	}: HudCornersProps = $props();

	// Shared base classes for all 4 corner spans
	const BASE = 'absolute border-solid border-0 pointer-events-none';
	const sz = $derived(`${size}px`);
	const off = $derived(`${offset}px`);
</script>

<!-- TL -->
<span
	class="hcr-corner hcr-tl {BASE} border-t border-l {className}"
	style:--hcr-color={color}
	style:--hcr-size={sz}
	style:--hcr-offset={off}
	style:width={sz}
	style:height={sz}
	style:border-color={color}
	style:top={off}
	style:left={off}
	aria-hidden="true"
></span>
<!-- TR -->
<span
	class="hcr-corner hcr-tr {BASE} border-t border-r"
	style:width={sz}
	style:height={sz}
	style:border-color={color}
	style:top={off}
	style:right={off}
	aria-hidden="true"
></span>
<!-- BL -->
<span
	class="hcr-corner hcr-bl {BASE} border-b border-l"
	style:width={sz}
	style:height={sz}
	style:border-color={color}
	style:bottom={off}
	style:left={off}
	aria-hidden="true"
></span>
<!-- BR -->
<span
	class="hcr-corner hcr-br {BASE} border-b border-r"
	style:width={sz}
	style:height={sz}
	style:border-color={color}
	style:bottom={off}
	style:right={off}
	aria-hidden="true"
></span>
