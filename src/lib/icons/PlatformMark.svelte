<script lang="ts" module>
	// OS marks, hand-rolled because the icon set carries no brand marks. Keyed by
	// GOOS, the vocabulary agents and install scripts already speak.
	const GLYPH: Record<string, string> = {
		darwin:
			'M9.2 5.6c.7 0 1.6-.5 2.1-1.1.5-.6.8-1.4.7-2.2-.7 0-1.6.5-2.1 1.1-.5.6-.8 1.4-.7 2.2zM12.6 8.5c-1 0-1.4.6-2.1.6-.8 0-1.4-.6-2.2-.6-1.2 0-2.5 1-2.5 3 0 1.2.4 2.5 1 3.4.5.7.9 1.3 1.6 1.3.6 0 .9-.4 1.7-.4.8 0 1 .4 1.7.4.7 0 1.1-.6 1.6-1.3.4-.6.6-1.2.7-1.3-1.3-.5-1.6-2.6-.1-3.4-.4-.5-1.1-.7-1.4-.7z',
		linux:
			'M8 1.8c1.6 0 2.6 1.3 2.6 3 0 1.1.5 1.6 1.2 2.6.8 1.1 1.4 2.2 1.4 3.6 0 1.9-1.2 3.2-3 3.6-.6.1-1.5.4-2.2.4s-1.6-.3-2.2-.4c-1.8-.4-3-1.7-3-3.6 0-1.4.6-2.5 1.4-3.6.7-1 1.2-1.5 1.2-2.6 0-1.7 1-3 2.6-3z M6.6 5.1a.7.9 0 1 0 0 .1z M9.4 5.1a.7.9 0 1 0 0 .1z',
		windows:
			'M2 3.3l5.3-.7v5.1H2zM8.6 2.4L14 1.6v6.1H8.6zM2 9h5.3v5.1L2 13.4zM8.6 9H14v6.1l-5.4-.8z',
		wasm: 'M8 1.5l5.5 3.2v6.6L8 14.5 2.5 11.3V4.7zM8 3.2L4 5.5v4.6l4 2.3 4-2.3V5.5z'
	};

	export const PLATFORM_LABEL: Record<string, string> = {
		darwin: 'macOS',
		linux: 'Linux',
		windows: 'Windows',
		wasm: 'WASM'
	};

	export const hasPlatformMark = (goos: string) => goos in GLYPH;
</script>

<script lang="ts">
	let { goos, size = 12 }: { goos: string; size?: number } = $props();
</script>

{#if GLYPH[goos]}
	<svg viewBox="0 0 16 16" width={size} height={size} aria-hidden="true">
		<path d={GLYPH[goos]} fill="currentColor" />
	</svg>
{/if}
