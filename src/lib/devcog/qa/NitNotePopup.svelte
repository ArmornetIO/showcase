<script lang="ts">
	// The note prompt that follows a pick. Anchored under the captured element,
	// clamped so it never lands off-screen when you annotate something near the
	// right or bottom edge.
	import type { NitsController } from './nits.svelte.js';

	interface NitNotePopupProps {
		nits: NitsController;
	}

	let { nits }: NitNotePopupProps = $props();

	const WIDTH = 292;
	/** Room the popup needs below the target before it has to ride up. */
	const HEIGHT = 140;

	let inputEl = $state<HTMLInputElement | null>(null);

	const capture = $derived(nits.capture!);
	const top = $derived(Math.min(capture.rect.bottom + 8, window.innerHeight - HEIGHT));
	const left = $derived(Math.min(capture.rect.left, window.innerWidth - WIDTH - 16));

	// The pick came from a click on the page, so focus is wherever the user
	// happened to be — move it here or the note has to be clicked into.
	$effect(() => {
		inputEl?.focus();
	});

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') nits.save();
		if (e.key === 'Escape') nits.cancel();
	}
</script>

<div data-devcog class="nit-popup" style="top:{top}px;left:{left}px;">
	<code class="nit-popup-selector" title={capture.selector}>{capture.selector}</code>
	<input
		bind:this={inputEl}
		bind:value={nits.note}
		class="nit-popup-input"
		placeholder="Describe the nit…"
		aria-label="Nit description"
		onkeydown={onKeydown}
	/>
	<div class="nit-popup-footer">
		<span class="nit-popup-hint">↵ save · Esc cancel</span>
		<button class="nit-popup-save" onclick={() => nits.save()}>Save</button>
	</div>
</div>

<style>
	.nit-popup {
		position: fixed;
		z-index: 10000;
		width: 292px;
		background: var(--bg-elev);
		border: 1px solid color-mix(in srgb, var(--accent) 40%, transparent);
		border-radius: 8px;
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.7);
		padding: 12px;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.nit-popup::before {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		height: 1px;
		background: linear-gradient(90deg, transparent, var(--accent), transparent);
		opacity: 0.7;
		border-radius: 8px 8px 0 0;
	}

	.nit-popup-selector {
		font-family: var(--mono, monospace);
		font-size: 0.58rem;
		color: var(--fg-dim);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		display: block;
	}

	.nit-popup-input {
		width: 100%;
		background: var(--surface-raised);
		border: 1px solid var(--border);
		border-radius: 5px;
		padding: 7px 9px;
		font-family: var(--sans, sans-serif);
		font-size: 0.82rem;
		color: var(--fg);
		outline: none;
		box-sizing: border-box;
		transition: border-color 0.15s;
	}
	.nit-popup-input:focus {
		border-color: var(--border-accent);
	}

	.nit-popup-footer {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}
	.nit-popup-hint {
		font-family: var(--mono, monospace);
		font-size: 0.58rem;
		color: var(--fg-dim);
	}
	.nit-popup-save {
		font-family: var(--mono, monospace);
		font-size: 0.65rem;
		padding: 4px 12px;
		border-radius: 4px;
		border: 1px solid color-mix(in srgb, var(--accent) 50%, transparent);
		background: var(--accent-faint);
		color: var(--accent);
		cursor: pointer;
		transition: background 0.15s;
	}
	.nit-popup-save:hover {
		background: var(--accent-faint-strong);
	}
</style>
