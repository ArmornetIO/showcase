<script lang="ts">
	// The colour swatch row. Each swatch shows the token's TRUE current value;
	// the native picker sitting on top of it can only speak opaque hex, so
	// translucent tokens are marked rather than silently flattened.
	import type { ColorControl } from './types.js';
	import { isPickable, toHex } from './defaults.js';

	interface Props {
		controls: ColorControl[];
		/** Resolve a token to its current value (override or theme default). */
		valueOf: (token: string) => string;
		isOverridden: (token: string) => boolean;
		onpick: (token: string, value: string) => void;
	}
	let { controls, valueOf, isOverridden, onpick }: Props = $props();
</script>

<div class="bar">
	{#each controls as ctrl (ctrl.token)}
		{@const current = valueOf(ctrl.token)}
		{@const changed = isOverridden(ctrl.token)}
		{@const pickable = isPickable(current)}
		<div class="swatch" class:changed>
			<label class="label" title="{ctrl.label}: {current}{pickable ? '' : ' — picking will drop transparency'}">
				<input
					type="color"
					class="input"
					value={toHex(current)}
					oninput={(e) => onpick(ctrl.token, (e.currentTarget as HTMLInputElement).value)}
				/>
				<span class="square" style="background:{current}">
					{#if changed}<span class="pip"></span>{/if}
					<!-- The picker cannot round-trip alpha, so say so rather than
					     letting a click quietly flatten the token to opaque. -->
					{#if !pickable}<span class="alpha" aria-hidden="true">α</span>{/if}
				</span>
			</label>
			<span class="name">{ctrl.label}</span>
		</div>
	{/each}
</div>

<style>
	.bar {
		display: flex;
		align-items: flex-end;
		gap: 12px;
		padding: 20px 24px 16px;
		overflow-x: auto;
		scrollbar-width: none;
	}

	.swatch {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
		flex-shrink: 0;
	}
	.swatch.changed .square {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}

	.label {
		position: relative;
		cursor: pointer;
		display: block;
	}

	.input {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		opacity: 0;
		cursor: pointer;
		padding: 0;
		border: 0;
	}

	.square {
		display: block;
		width: 56px;
		height: 56px;
		border-radius: 8px;
		border: 1px solid var(--border);
		position: relative;
		transition: transform 0.12s;
	}
	.label:hover .square {
		transform: scale(1.06);
	}

	.pip {
		position: absolute;
		top: 5px;
		right: 5px;
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--fg);
		box-shadow: 0 0 0 1.5px var(--bg);
	}

	.alpha {
		position: absolute;
		bottom: 3px;
		left: 5px;
		font-family: var(--mono);
		font-size: 0.6rem;
		line-height: 1;
		color: var(--fg-dim);
	}

	.name {
		font-family: var(--mono);
		font-size: 0.48rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--fg-dim);
		white-space: nowrap;
		max-width: 56px;
		text-align: center;
		overflow: hidden;
		text-overflow: ellipsis;
	}
</style>
