<script lang="ts">
	import type {
		CardVariant,
		DataInputMode,
		DataInputInfoRow,
		DataInputField
	} from './card.types.js';

	interface Props {
		mode: DataInputMode;
		eyebrow?: string;
		title?: string;
		status?: string;
		rows?: DataInputInfoRow[];
		fields?: DataInputField[];
		submitLabel?: string;
		onsubmit?: (values: Record<string, string>) => void;
		variant?: CardVariant;
		class?: string;
	}

	let {
		mode,
		eyebrow,
		title,
		status,
		rows = [],
		fields = [],
		submitLabel = 'Submit',
		onsubmit,
		variant = 'accent',
		class: cls = ''
	}: Props = $props();

	type CardTokens = {
		border: string;
		bg: string;
		corner: string;
		eyebrow: string;
		title: string;
		live: string;
		focus: string;
	};

	const VARIANTS: Record<CardVariant, CardTokens> = {
		accent: {
			border: 'rgba(94,234,212,0.3)',
			bg: 'linear-gradient(135deg,rgba(8,12,18,0.95),rgba(8,18,14,0.85))',
			corner: 'rgba(94,234,212,0.5)',
			eyebrow: 'var(--palette-emerald-l)',
			title: '#a4f0de',
			live: 'var(--accent)',
			focus: 'rgba(94,234,212,0.2)'
		},
		cyan: {
			border: 'rgba(34,211,238,0.3)',
			bg: 'linear-gradient(135deg,rgba(8,12,18,0.95),rgba(8,16,20,0.85))',
			corner: 'rgba(34,211,238,0.5)',
			eyebrow: 'var(--palette-cyan-l)',
			title: 'var(--palette-cyan-l)',
			live: 'var(--palette-cyan)',
			focus: 'rgba(34,211,238,0.2)'
		},
		emerald: {
			border: 'rgba(52,211,153,0.3)',
			bg: 'linear-gradient(135deg,rgba(8,12,18,0.95),rgba(8,18,12,0.85))',
			corner: 'rgba(52,211,153,0.5)',
			eyebrow: 'var(--palette-emerald-l)',
			title: 'var(--palette-emerald-l)',
			live: 'var(--palette-emerald)',
			focus: 'rgba(52,211,153,0.2)'
		},
		blue: {
			border: 'rgba(56,189,248,0.3)',
			bg: 'linear-gradient(135deg,rgba(8,12,18,0.95),rgba(8,12,20,0.85))',
			corner: 'rgba(56,189,248,0.5)',
			eyebrow: 'var(--palette-blue-l)',
			title: 'var(--palette-blue-l)',
			live: 'var(--palette-blue)',
			focus: 'rgba(56,189,248,0.2)'
		},
		amber: {
			border: 'rgba(252,211,77,0.3)',
			bg: 'linear-gradient(135deg,rgba(8,12,18,0.95),rgba(20,16,8,0.85))',
			corner: 'rgba(252,211,77,0.5)',
			eyebrow: 'var(--palette-amber-l)',
			title: 'var(--palette-amber-l)',
			live: 'var(--palette-amber)',
			focus: 'rgba(252,211,77,0.2)'
		}
	};

	type RowTokens = { iconBorder: string; sublabel: string; icon: string };

	const ROW_VARIANTS: Record<CardVariant, RowTokens> = {
		accent: {
			iconBorder: 'rgba(94,234,212,0.4)',
			sublabel: 'var(--palette-emerald-l)',
			icon: 'var(--accent)'
		},
		cyan: {
			iconBorder: 'rgba(34,211,238,0.4)',
			sublabel: 'var(--palette-cyan-l)',
			icon: 'var(--palette-cyan)'
		},
		emerald: {
			iconBorder: 'rgba(52,211,153,0.4)',
			sublabel: 'var(--palette-emerald-l)',
			icon: 'var(--palette-emerald)'
		},
		blue: {
			iconBorder: 'rgba(56,189,248,0.4)',
			sublabel: 'var(--palette-blue-l)',
			icon: 'var(--palette-blue)'
		},
		amber: {
			iconBorder: 'rgba(252,211,77,0.4)',
			sublabel: 'var(--palette-amber-l)',
			icon: 'var(--palette-amber)'
		}
	};

	const v = $derived(VARIANTS[variant]);

	let formValues = $state<Record<string, string>>({});
	let submitted = $state(false);

	function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		submitted = true;
		onsubmit?.(formValues);
	}
</script>

<div
	class="di-root {cls}"
	style:--border={v.border}
	style:--bg={v.bg}
	style:--corner={v.corner}
	style:--c-eyebrow={v.eyebrow}
	style:--c-title={v.title}
	style:--c-live={v.live}
	style:--c-focus={v.focus}
>
	<span class="di-corner di-tl" aria-hidden="true"></span>
	<span class="di-corner di-tr" aria-hidden="true"></span>
	<span class="di-corner di-bl" aria-hidden="true"></span>
	<span class="di-corner di-br" aria-hidden="true"></span>

	{#if eyebrow || title || status}
		<div class="di-header">
			<div>
				{#if eyebrow}<div class="di-eyebrow">/ {eyebrow}</div>{/if}
				{#if title}<h3 class="di-title">{title}</h3>{/if}
			</div>
			{#if status}
				<div class="di-status">
					<span class="di-status-dot pulse-dot" aria-hidden="true"></span>
					{status}
				</div>
			{/if}
		</div>
	{/if}

	{#if mode === 'info'}
		<div class="di-info-rows">
			{#each rows as row}
				{@const rv = ROW_VARIANTS[row.variant ?? variant]}
				<div
					class="di-info-row"
					style:--rv-icon-border={rv.iconBorder}
					style:--rv-sublabel={rv.sublabel}
					style:--rv-icon={rv.icon}
				>
					<div class="di-info-icon">{row.icon}</div>
					<div>
						<div class="di-info-sublabel">{row.sublabel}</div>
						<div class="di-info-value">{row.value}</div>
					</div>
				</div>
			{/each}
		</div>
	{:else}
		<form class="di-form" onsubmit={handleSubmit}>
			<div class="di-fields">
				{#each fields as field}
					<div class="di-field-wrap" class:di-span-2={field.span === 2}>
						<label class="di-label" for="di-{field.name}">{field.label}</label>
						{#if field.type === 'textarea'}
							<textarea
								id="di-{field.name}"
								name={field.name}
								class="di-input"
								placeholder={field.placeholder}
								rows={field.rows ?? 3}
								required={field.required}
								bind:value={formValues[field.name]}
							></textarea>
						{:else if field.type === 'select'}
							<select
								id="di-{field.name}"
								name={field.name}
								class="di-input"
								required={field.required}
								bind:value={formValues[field.name]}
							>
								{#each field.options ?? [] as opt}
									<option value={opt}>{opt}</option>
								{/each}
							</select>
						{:else}
							<input
								id="di-{field.name}"
								type={field.type}
								name={field.name}
								class="di-input"
								placeholder={field.placeholder}
								required={field.required}
								bind:value={formValues[field.name]}
							/>
						{/if}
					</div>
				{/each}
			</div>
			<button type="submit" class="di-submit" disabled={submitted}>
				{submitted ? 'SUBMITTED ✓' : submitLabel}
			</button>
		</form>
	{/if}
</div>

<style>
	.di-root {
		position: relative;
		padding: 2rem 2.5rem;
		border: 1px solid var(--border);
		border-radius: var(--radius-inset);
		background: var(--bg);
	}
	.di-corner {
		position: absolute;
		width: 9px;
		height: 9px;
		border-color: var(--corner);
		border-style: solid;
		border-width: 0;
		pointer-events: none;
	}
	.di-tl {
		top: 6px;
		left: 6px;
		border-top-width: 1px;
		border-left-width: 1px;
	}
	.di-tr {
		top: 6px;
		right: 6px;
		border-top-width: 1px;
		border-right-width: 1px;
	}
	.di-bl {
		bottom: 6px;
		left: 6px;
		border-bottom-width: 1px;
		border-left-width: 1px;
	}
	.di-br {
		bottom: 6px;
		right: 6px;
		border-bottom-width: 1px;
		border-right-width: 1px;
	}
	.di-header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		margin-bottom: 1.5rem;
	}
	.di-eyebrow {
		font-family: var(--mono);
		font-size: 0.625rem;
		letter-spacing: 0.3em;
		text-transform: uppercase;
		color: var(--c-eyebrow);
		margin-bottom: 0.25rem;
	}
	.di-title {
		font-family: var(--mono-display);
		font-size: 1.25rem;
		font-weight: 700;
		color: var(--c-title);
		margin: 0;
	}
	.di-status {
		font-family: var(--mono);
		font-size: 0.5625rem;
		letter-spacing: 0.25em;
		color: var(--c-live);
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.di-status-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--c-live);
		box-shadow: 0 0 6px var(--c-live);
		flex-shrink: 0;
	}

	/* ── Info mode ─────────────────────────────────────────────────────────── */
	.di-info-rows {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
	.di-info-row {
		display: flex;
		align-items: center;
		gap: 1rem;
	}
	.di-info-icon {
		width: 36px;
		height: 36px;
		border: 1px solid var(--rv-icon-border);
		background: rgba(15, 23, 42, 0.6);
		display: flex;
		align-items: center;
		justify-content: center;
		font-family: var(--mono);
		font-size: 0.75rem;
		color: var(--rv-icon);
		flex-shrink: 0;
	}
	.di-info-sublabel {
		font-family: var(--mono);
		font-size: 0.5625rem;
		letter-spacing: 0.25em;
		text-transform: uppercase;
		color: var(--rv-sublabel);
		margin-bottom: 0.125rem;
	}
	.di-info-value {
		font-size: 0.9375rem;
		color: var(--fg-muted);
	}

	/* ── Form mode ─────────────────────────────────────────────────────────── */
	.di-form {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}
	.di-fields {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1.25rem;
	}
	.di-field-wrap {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
	}
	.di-span-2 {
		grid-column: span 2;
	}
	.di-label {
		font-family: var(--mono);
		font-size: 0.5625rem;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		color: var(--fg-dim);
	}
	.di-input {
		background: var(--input-bg);
		border: 1px solid var(--border-strong);
		border-radius: var(--radius-inset);
		padding: 0.625rem 0.875rem;
		font-family: var(--sans);
		font-size: 0.9375rem;
		color: var(--fg);
		width: 100%;
		outline: none;
		transition:
			border-color 0.2s,
			box-shadow 0.2s;
		resize: vertical;
		-webkit-appearance: none;
		appearance: none;
	}
	.di-input:focus {
		border-color: var(--c-live);
		box-shadow: 0 0 0 2px var(--c-focus);
	}
	.di-input::placeholder {
		color: var(--fg-dim);
		opacity: 0.6;
	}
	.di-submit {
		width: 100%;
		padding: 0.875rem 1.5rem;
		background: var(--c-live);
		border: none;
		border-radius: var(--radius-inset);
		font-family: var(--mono-display);
		font-size: 0.875rem;
		font-weight: 700;
		letter-spacing: 0.1em;
		color: var(--bg);
		cursor: pointer;
		transition:
			opacity 0.2s,
			transform 0.2s;
	}
	.di-submit:hover:not(:disabled) {
		opacity: 0.88;
		transform: translateY(-1px);
	}
	.di-submit:disabled {
		opacity: 0.55;
		cursor: default;
	}
</style>
