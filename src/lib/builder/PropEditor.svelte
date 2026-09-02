<script lang="ts">
	import Icon from '../icons/Icon.svelte';
	import { ICONS } from '../icons/Icon.svelte';
	import type { IconName } from '../icons/Icon.svelte';
	import type { ComponentMeta } from './registry.js';

	interface Props {
		meta: ComponentMeta;
		values: Record<string, unknown>;
		onchange: (key: string, value: unknown) => void;
	}
	let { meta, values, onchange }: Props = $props();

	/**
	 * Has this prop been moved off its registry default?
	 *
	 * Sound because `store.addItem` seeds every prop FROM `def.default`, so an
	 * untouched prop is identical to it. `Object.is` rather than `===` so a prop
	 * whose default is `NaN` does not report itself as permanently modified.
	 */
	function modified(key: string, def: ComponentMeta['props'][string]): boolean {
		return key in values && !Object.is(values[key], def.default);
	}

	/** Only a name the icon set actually knows can be rendered — an unknown key
	 *  would otherwise draw an empty box with no hint why. */
	function isIcon(name: string): name is IconName {
		return name in ICONS;
	}

	// ── Multi-valued enums ────────────────────────────────────────────────────
	// A `multi` enum stores its selection as a comma-joined list rather than in a
	// second, array-shaped prop kind. Everything downstream — the store's save
	// format, the scene channel vocabulary, the renderer — keeps seeing a string,
	// and a one-item list is byte-identical to what a single-valued enum wrote.
	// The whole feature is these two helpers plus a different click handler.

	function selection(value: string): string[] {
		return value
			.split(',')
			.map((v) => v.trim())
			.filter(Boolean);
	}

	/**
	 * Toggle one option, preserving the order things were added in — that order
	 * is meaningful wherever a multi enum describes layers.
	 */
	function toggle(value: string, opt: string): string {
		const sel = selection(value);
		const next = sel.includes(opt) ? sel.filter((v) => v !== opt) : [...sel, opt];
		return next.join(',');
	}
</script>

<div class="pe-list">
	{#each Object.entries(meta.props) as [key, def]}
		{@const show = !def.showWhen || (def.showWhen.values as readonly string[]).includes(String(values[def.showWhen.key] ?? ''))}
		{#if show}
			{#if def.section}
				<div class="pe-divider">{def.section}</div>
			{/if}
			{@const current = String(values[key] ?? def.default)}
			<div class="pe-row">
				<div class="pe-label-row">
					<label class="pe-label" for="pe-{meta.id}-{key}">{def.label}</label>
					<!-- Reset appears only once the prop has actually moved. A revert
					     control that is always there reads as a thing you are supposed to
					     use, and it cannot tell you what you have changed. -->
					{#if modified(key, def)}
						<button
							type="button"
							class="pe-reset"
							title="Reset to {String(def.default)}"
							onclick={() => onchange(key, def.default)}
						>
							reset
						</button>
					{/if}
				</div>

				{#if def.kind === 'enum' && def.presentation === 'chips'}
					{@const picked = def.multi ? selection(current) : [current]}
					<div class="pe-chips" role="group" aria-label={def.label}>
						{#each def.options ?? [] as opt (opt)}
							{@const on = picked.includes(opt)}
							<button
								type="button"
								class="pe-chip"
								class:pe-chip--on={on}
								aria-pressed={on}
								onclick={() => onchange(key, def.multi ? toggle(current, opt) : opt)}
							>
								{opt}
							</button>
						{/each}
					</div>
				{:else if def.kind === 'enum' && def.presentation === 'swatches'}
					<div class="pe-swatches" role="group" aria-label={def.label}>
						{#each def.options ?? [] as opt (opt)}
							<button
								type="button"
								class="pe-swatch"
								class:pe-swatch--on={current === opt}
								style:background={opt}
								title={opt}
								aria-label={opt}
								aria-pressed={current === opt}
								onclick={() => onchange(key, opt)}
							></button>
						{/each}
					</div>
				{:else if def.kind === 'enum' && def.presentation === 'icons'}
					<div class="pe-icons" role="group" aria-label={def.label}>
						{#each def.options ?? [] as opt (opt)}
							<button
								type="button"
								class="pe-icon"
								class:pe-icon--on={current === opt}
								title={opt}
								aria-label={opt}
								aria-pressed={current === opt}
								onclick={() => onchange(key, opt)}
							>
								{#if isIcon(opt)}<Icon name={opt} size={14} />{:else}?{/if}
							</button>
						{/each}
					</div>
				{:else if def.kind === 'enum'}
					<select
						id="pe-{meta.id}-{key}"
						class="pe-select"
						value={current}
						onchange={(e) => onchange(key, e.currentTarget.value)}
					>
						{#each def.options ?? [] as opt}
							<option value={opt}>{opt}</option>
						{/each}
					</select>
				{:else if def.kind === 'boolean'}
					<label class="pe-toggle-wrap">
						<input
							id="pe-{meta.id}-{key}"
							type="checkbox"
							class="pe-checkbox"
							checked={Boolean(values[key] ?? def.default)}
							onchange={(e) => onchange(key, e.currentTarget.checked)}
						/>
						<span class="pe-toggle-track">
							<span class="pe-toggle-thumb"></span>
						</span>
					</label>
				{:else if def.kind === 'number'}
					<div class="pe-number-row">
						<input
							id="pe-{meta.id}-{key}"
							type="range"
							class="pe-range"
							min={def.min ?? 0}
							max={def.max ?? 100}
							step={def.step ?? 1}
							value={Number(values[key] ?? def.default)}
							oninput={(e) => onchange(key, Number(e.currentTarget.value))}
						/>
						<span class="pe-number-val">{values[key] ?? def.default}</span>
					</div>
				{:else if def.kind === 'textarea'}
					<textarea
						id="pe-{meta.id}-{key}"
						class="pe-textarea"
						oninput={(e) => onchange(key, e.currentTarget.value)}
						rows={4}
					>{String(values[key] ?? def.default)}</textarea>
				{:else}
					<input
						id="pe-{meta.id}-{key}"
						type="text"
						class="pe-input"
						value={String(values[key] ?? def.default)}
						oninput={(e) => onchange(key, e.currentTarget.value)}
					/>
				{/if}
			</div>
		{/if}
	{/each}
</div>

<style>
	.pe-list {
		display: flex;
		flex-direction: column;
	}

	.pe-divider {
		font-family: var(--mono);
		font-size: 0.45rem;
		letter-spacing: 0.3em;
		text-transform: uppercase;
		color: var(--fg-dim);
		padding: 10px 12px 4px;
		border-top: 1px solid var(--border);
		margin-top: 4px;
	}

	.pe-row {
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: 5px 12px;
	}

	.pe-label-row {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 6px;
		min-width: 0;
	}

	.pe-label {
		font-size: 0.65rem;
		color: var(--fg-dim);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.pe-reset {
		flex: none;
		font-family: var(--mono);
		font-size: 0.55rem;
		letter-spacing: 0.06em;
		color: var(--accent);
		background: none;
		border: none;
		padding: 0;
		cursor: pointer;
	}
	.pe-reset:hover {
		text-decoration: underline;
	}

	/* ── Enum presentations ──────────────────────────────────────────────────
	   All three are the same control with a different body: a row of buttons
	   carrying aria-pressed. Shared so a chip, a swatch and a glyph agree on
	   what "selected" looks like. */
	.pe-chips,
	.pe-swatches {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
	}

	.pe-chip {
		font-family: var(--mono);
		font-size: 0.6rem;
		padding: 3px 7px;
		border: 1px solid var(--border);
		border-radius: 3px;
		background: var(--input-bg);
		color: var(--fg-muted);
		cursor: pointer;
		transition: color 0.12s, border-color 0.12s, background 0.12s;
	}
	.pe-chip:hover {
		color: var(--fg);
		border-color: var(--border-strong);
	}
	.pe-chip--on {
		color: var(--accent);
		border-color: var(--accent);
		background: var(--accent-faint);
	}

	.pe-swatch {
		width: 20px;
		height: 20px;
		border-radius: 3px;
		border: 1px solid var(--border);
		cursor: pointer;
		padding: 0;
	}
	/* Ring OUTSIDE the swatch — a border would eat into the colour it is meant
	   to be showing you. */
	.pe-swatch--on {
		outline: 2px solid var(--fg);
		outline-offset: 2px;
	}

	.pe-icons {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(24px, 1fr));
		gap: 3px;
	}
	.pe-icon {
		display: grid;
		place-items: center;
		aspect-ratio: 1;
		border: 1px solid var(--border);
		border-radius: 3px;
		background: var(--input-bg);
		color: var(--fg-muted);
		cursor: pointer;
		padding: 0;
	}
	.pe-icon:hover {
		color: var(--fg);
		border-color: var(--border-strong);
	}
	.pe-icon--on {
		color: var(--accent);
		border-color: var(--accent);
		background: var(--accent-faint);
	}

	.pe-select,
	.pe-input {
		width: 100%;
		padding: 4px 6px;
		font-size: 0.72rem;
		color: var(--fg);
		background: var(--input-bg);
		border: 1px solid var(--border);
		border-radius: 3px;
		outline: none;
		font-family: var(--sans);
		transition: border-color 0.12s;
	}
	.pe-select:focus,
	.pe-input:focus {
		border-color: var(--accent);
	}

	.pe-toggle-wrap {
		display: inline-flex;
		align-items: center;
		cursor: pointer;
	}

	.pe-checkbox {
		display: none;
	}

	.pe-toggle-track {
		position: relative;
		width: 28px;
		height: 16px;
		background: var(--border-strong);
		border-radius: 8px;
		transition: background 0.15s;
		flex-shrink: 0;
	}

	.pe-checkbox:checked + .pe-toggle-track {
		background: var(--accent);
	}

	.pe-toggle-thumb {
		position: absolute;
		top: 2px;
		left: 2px;
		width: 12px;
		height: 12px;
		border-radius: 50%;
		background: #fff;
		transition: left 0.15s;
	}

	.pe-checkbox:checked + .pe-toggle-track .pe-toggle-thumb {
		left: 14px;
	}

	.pe-number-row {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.pe-range {
		flex: 1;
		accent-color: var(--accent);
		cursor: pointer;
	}

	.pe-number-val {
		font-family: var(--mono);
		font-size: 0.65rem;
		color: var(--fg-muted);
		min-width: 24px;
		text-align: right;
	}

	.pe-textarea {
		width: 100%;
		padding: 4px 6px;
		font-size: 0.65rem;
		color: var(--fg);
		background: var(--input-bg);
		border: 1px solid var(--border);
		border-radius: 3px;
		resize: vertical;
		font-family: var(--mono);
		outline: none;
		line-height: 1.5;
		transition: border-color 0.12s;
		box-sizing: border-box;
	}
	.pe-textarea:focus {
		border-color: var(--accent);
	}
</style>
