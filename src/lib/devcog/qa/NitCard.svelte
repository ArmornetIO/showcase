<script lang="ts">
	// One captured nit in the drawer list: where it was taken, what was said
	// about it, and the selector it will be reported under. Each card carries
	// its own copy so a single nit can be handed to an assistant without
	// dragging the rest of the batch along.
	import type { Nit } from './nits.js';

	interface NitCardProps {
		nit: Nit;
		selected: boolean;
		/** True while this card's own copy button is showing its confirmation. */
		copied: boolean;
		onToggle: (id: string) => void;
		onCopy: (id: string) => void;
		onRemove: (id: string) => void;
	}

	let { nit, selected, copied, onToggle, onCopy, onRemove }: NitCardProps = $props();
</script>

<li class="nit-item" class:selected>
	<div class="nit-item-top">
		<label class="nit-pick">
			<input
				type="checkbox"
				checked={selected}
				onchange={() => onToggle(nit.id)}
				aria-label="Select nit for copying"
			/>
			<span class="nit-url">{nit.url}</span>
		</label>
		<button
			class="nit-copy"
			class:copied
			onclick={() => onCopy(nit.id)}
			title="Copy this nit's prompt"
			aria-label="Copy this nit's prompt"
		>
			{copied ? '✓' : 'copy'}
		</button>
		<button class="nit-delete" onclick={() => onRemove(nit.id)} aria-label="Remove nit">×</button>
	</div>
	<span class="nit-note">{nit.note}</span>
	<code class="nit-selector" title={nit.selector}>{nit.selector}</code>
</li>

<style>
	.nit-item {
		background: var(--surface-raised);
		border: 1px solid var(--border);
		border-radius: 6px;
		padding: 8px 10px;
		display: flex;
		flex-direction: column;
		gap: 3px;
	}
	.nit-item.selected {
		border-color: color-mix(in srgb, var(--accent) 55%, transparent);
		background: var(--accent-faint);
	}
	.nit-item-top {
		display: flex;
		align-items: center;
		gap: 6px;
	}
	.nit-pick {
		display: flex;
		align-items: center;
		gap: 6px;
		flex: 1;
		min-width: 0;
		cursor: pointer;
	}
	.nit-pick input {
		width: 11px;
		height: 11px;
		margin: 0;
		accent-color: var(--accent);
		cursor: pointer;
		flex-shrink: 0;
	}
	.nit-url {
		font-family: var(--mono, monospace);
		font-size: 0.55rem;
		color: var(--fg-dim);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.nit-copy {
		font-family: var(--mono, monospace);
		font-size: 0.55rem;
		letter-spacing: 0.06em;
		padding: 1px 5px;
		border-radius: 3px;
		border: 1px solid var(--border);
		background: transparent;
		color: var(--fg-dim);
		cursor: pointer;
		flex-shrink: 0;
		transition: color 0.12s, border-color 0.12s, background 0.12s;
	}
	.nit-copy:hover {
		color: var(--accent);
		border-color: color-mix(in srgb, var(--accent) 45%, transparent);
		background: var(--accent-faint);
	}
	.nit-copy.copied {
		color: var(--accent);
		border-color: color-mix(in srgb, var(--accent) 45%, transparent);
	}
	.nit-delete {
		background: none;
		border: none;
		color: var(--fg-dim);
		cursor: pointer;
		font-size: 1rem;
		line-height: 1;
		padding: 0;
		flex-shrink: 0;
		transition: color 0.1s;
	}
	.nit-delete:hover {
		color: var(--method-delete-fg, #f87171);
	}
	.nit-note {
		font-size: 0.8rem;
		color: var(--fg);
		line-height: 1.35;
	}
	.nit-selector {
		font-family: var(--mono, monospace);
		font-size: 0.55rem;
		color: var(--fg-dim);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		display: block;
	}
</style>
