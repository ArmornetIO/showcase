<script lang="ts">
	import type { Snippet } from 'svelte';

	interface FormFieldProps {
		label: string;
		hint?: string;
		/** Inline error message — shows below the field with red styling. */
		error?: string;
		required?: boolean;
		/** Render a muted "(optional)" tag after the label when not required. */
		showOptional?: boolean;
		/** Should match the id on the child input for label association. */
		id?: string;
		children: Snippet;
	}

	let {
		label,
		hint,
		error,
		required = false,
		showOptional = false,
		id,
		children
	}: FormFieldProps = $props();
</script>

<div class="form-field {error ? 'has-error' : ''}">
	<label for={id} class="form-label">
		{label}{#if required}<span class="form-required">*</span>{:else if showOptional}<span class="form-optional">(optional)</span>{/if}
	</label>
	{@render children()}
	{#if error}
		<p class="form-error" role="alert">{error}</p>
	{:else if hint}
		<p class="form-hint">{hint}</p>
	{/if}
</div>

<style>
	.form-field {
		display: flex;
		flex-direction: column;
		gap: 8px;
		max-width: 420px;
	}
	.form-label {
		display: block;
		font-family: var(--mono);
		font-size: 11px;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--fg-muted);
	}
	.form-required {
		margin-left: 3px;
		color: var(--accent);
	}
	.form-optional {
		margin-left: 6px;
		font-weight: 400;
		text-transform: none;
		letter-spacing: 0;
		color: var(--fg-dim);
		font-size: 10px;
	}
	.form-hint {
		margin: 0;
		font-size: 13px;
		color: var(--fg-dim);
	}
	.form-error {
		margin: 0;
		display: flex;
		align-items: center;
		gap: 6px;
		font-family: var(--mono);
		font-size: 12px;
		letter-spacing: 0.04em;
		color: var(--palette-red);
	}
	.form-error::before {
		content: '!';
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 14px;
		height: 14px;
		border-radius: 50%;
		background: var(--palette-red);
		color: var(--bg);
		font-weight: 700;
		font-size: 10px;
	}
</style>