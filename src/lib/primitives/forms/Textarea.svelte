<script lang="ts">
	import type { InputStatus, InputSize } from './Input.svelte';

	interface TextareaProps {
		value?: string;
		placeholder?: string;
		rows?: number;
		disabled?: boolean;
		required?: boolean;
		readonly?: boolean;
		id?: string;
		name?: string;
		status?: InputStatus;
		size?: InputSize;
		class?: string;
		oninput?: (e: Event & { currentTarget: HTMLTextAreaElement }) => void;
		onchange?: (e: Event & { currentTarget: HTMLTextAreaElement }) => void;
	}

	let {
		value = $bindable(''),
		placeholder,
		rows = 3,
		disabled = false,
		required = false,
		readonly = false,
		id,
		name,
		status = 'default',
		size = 'md',
		class: cls = '',
		oninput,
		onchange
	}: TextareaProps = $props();
</script>

<textarea
	bind:value
	{placeholder}
	{rows}
	{disabled}
	{required}
	{readonly}
	{id}
	{name}
	{oninput}
	{onchange}
	class="textarea textarea-{status} textarea-{size} {cls}"
></textarea>

<style>
	.textarea {
		width: 100%;
		font-family: var(--mono);
		color: var(--fg);
		background: var(--surface-raised);
		border: 1px solid var(--border);
		border-radius: var(--radius-control);
		outline: none;
		resize: vertical;
		min-height: 84px;
		line-height: 1.55;
		transition: border-color 0.2s ease, box-shadow 0.2s ease;
	}
	.textarea::placeholder { color: var(--fg-dim); }
	.textarea:disabled { opacity: 0.5; cursor: not-allowed; resize: none; }

	/* ── Sizes (textarea is mono so font scale differs from Input) ────────── */
	/* Corner stays put across sizes — see the note in Input. */
	.textarea-sm { font-size: 12px; padding: 9px 11px; }
	.textarea-md { font-size: 13px; padding: 11px 13px; }
	.textarea-lg { font-size: 15px; padding: 13px 15px; }

	/* ── Status — focus halo matches Input ───────────────────────────────── */
	.textarea-default:focus {
		border-color: var(--accent);
		box-shadow:
			0 0 0 1px var(--accent-faint-strong),
			0 0 16px var(--accent-faint);
	}

	.textarea-error { border-color: rgba(252, 165, 165, 0.5); }
	.textarea-error:focus {
		border-color: var(--palette-red);
		box-shadow:
			0 0 0 1px rgba(252, 165, 165, 0.45),
			0 0 16px rgba(252, 165, 165, 0.18);
	}

	.textarea-success { border-color: rgba(52, 211, 153, 0.45); }
	.textarea-success:focus {
		border-color: var(--palette-emerald);
		box-shadow:
			0 0 0 1px rgba(52, 211, 153, 0.45),
			0 0 16px rgba(52, 211, 153, 0.18);
	}

	.textarea-warn { border-color: rgba(252, 211, 77, 0.5); }
	.textarea-warn:focus {
		border-color: var(--palette-amber);
		box-shadow:
			0 0 0 1px rgba(252, 211, 77, 0.5),
			0 0 16px rgba(252, 211, 77, 0.18);
	}
</style>