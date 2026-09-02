<script lang="ts">
	// ── Checkbox — the notched box, on its own ───────────────────────────────────
	// Lifted out of assessment/CheckboxList so anything can wear the same box. The
	// LIST owns which options exist and what's selected; this owns what a checkbox
	// looks like and how it behaves. They are different jobs, and only one of them
	// is reusable.
	//
	// The label is a snippet rather than a string, because callers need to put
	// things beside the text — a status dot, a count, a truncating name — and a
	// string parameter can't carry any of that.
	import type { Snippet } from 'svelte';

	let {
		checked = false,
		indeterminate = false,
		disabled = false,
		onchange,
		children,
	}: {
		checked?: boolean;
		/** Neither on nor off — for a box standing in for a partly-selected set. */
		indeterminate?: boolean;
		disabled?: boolean;
		onchange?: () => void;
		children?: Snippet;
	} = $props();

	// `indeterminate` has no HTML attribute — it exists only as a DOM property, so
	// it has to be written to the node rather than rendered.
	function setIndeterminate(node: HTMLInputElement, v: boolean) {
		node.indeterminate = v;
		return { update(next: boolean) { node.indeterminate = next; } };
	}
</script>

<label class="check {disabled ? 'is-disabled' : ''}">
	<input
		type="checkbox"
		{checked}
		{disabled}
		use:setIndeterminate={indeterminate}
		onchange={() => { if (!disabled) onchange?.(); }}
	/>
	<span class="ck"></span>
	{#if children}{@render children()}{/if}
</label>

<style>
	.check {
		display: inline-flex;
		align-items: center;
		gap: 11px;
		cursor: pointer;
		font-family: var(--mono);
		font-size: 13px;
		letter-spacing: 0.05em;
		color: var(--fg-muted);
		user-select: none;
	}
	.check input {
		position: absolute;
		opacity: 0;
		width: 0;
		height: 0;
	}
	.check .ck {
		position: relative;
		flex-shrink: 0;
		width: 18px;
		height: 18px;
		border: 1px solid var(--border-strong);
		border-radius: var(--radius-control);
		background: var(--surface-raised);
		transition: all 0.18s ease;
		clip-path: polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px);
	}
	.check .ck::after {
		content: '';
		position: absolute;
		left: 5px;
		top: 2px;
		width: 5px;
		height: 9px;
		border: solid var(--text-onaccent);
		border-width: 0 2px 2px 0;
		transform: rotate(45deg) scale(0);
		transform-origin: center;
		transition: transform 0.18s cubic-bezier(0.5, 1.6, 0.5, 1);
	}
	.check input:checked + .ck {
		background: var(--accent);
		border-color: var(--accent);
		box-shadow: 0 0 10px -1px var(--accent);
	}
	.check input:checked + .ck::after {
		transform: rotate(45deg) scale(1);
	}
	.check input:indeterminate + .ck {
		background: var(--accent);
		border-color: var(--accent);
	}
	.check input:indeterminate + .ck::after {
		transform: none;
		left: 4px;
		top: 8px;
		width: 8px;
		height: 0;
		border-width: 0 0 2px 0;
	}
	.check input:focus-visible + .ck {
		box-shadow: 0 0 0 2px var(--accent-faint-strong);
	}
	.check input:disabled + .ck {
		opacity: 0.4;
	}
	.check.is-disabled {
		cursor: not-allowed;
		color: var(--fg-dim);
	}
	.check:hover input:not(:disabled) + .ck {
		border-color: var(--accent);
	}
</style>
