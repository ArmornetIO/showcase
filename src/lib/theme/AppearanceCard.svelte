<script lang="ts">
	// Appearance — the glass/flat switch, as a card that IS the thing it sets.
	//
	// The card wears `.glass` deliberately: it is a live preview, not a
	// description of one. Flip to flat and this card goes flat with everything
	// else, so the control demonstrates its own effect and there is no separate
	// swatch to keep in sync with reality.
	import { appearance, type AppearanceMode } from './appearance.svelte.js';

	interface AppearanceCardProps {
		/** Extra classes for the host, so a page can size or place it. */
		class?: string;
	}

	let { class: cls = '' }: AppearanceCardProps = $props();

	const OPTIONS: { value: AppearanceMode; label: string; description: string }[] = [
		{
			value: 'glass',
			label: 'Glass',
			description: 'Frosted panels over a drifting field. The designed surface.'
		},
		{
			value: 'flat',
			label: 'Flat',
			description: 'Opaque panels, no blur, no ground. Easier on projectors and screen shares.'
		}
	];
</script>

<section class="glass appearance-card {cls}" aria-labelledby="appearance-heading">
	<header class="ac-head">
		<h3 id="appearance-heading" class="ac-title">Appearance</h3>
		<p class="ac-lede">How surfaces are painted. Applies everywhere, and sticks to this browser.</p>
	</header>

	<!-- radiogroup, not a toggle: there are exactly two options now, but the axis
	     is "which surface treatment", which is the kind of thing that grows a
	     third. A checkbox would have to be renamed to add one. -->
	<div class="ac-options" role="radiogroup" aria-labelledby="appearance-heading">
		{#each OPTIONS as opt (opt.value)}
			<button
				type="button"
				role="radio"
				aria-checked={appearance.mode === opt.value}
				class="ac-opt"
				class:is-active={appearance.mode === opt.value}
				onclick={() => appearance.set(opt.value)}
			>
				<span class="ac-opt-dot" aria-hidden="true"></span>
				<span class="ac-opt-text">
					<span class="ac-opt-label">{opt.label}</span>
					<span class="ac-opt-desc">{opt.description}</span>
				</span>
			</button>
		{/each}
	</div>
</section>

<style>
	.appearance-card {
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
		padding: 1rem 1.1rem 1.1rem;
	}
	.ac-head {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
	}
	.ac-title {
		margin: 0;
		font-family: var(--mono);
		font-size: 0.62rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--fg-muted);
	}
	.ac-lede {
		margin: 0;
		font-family: var(--mono);
		font-size: 0.66rem;
		line-height: 1.45;
		color: var(--fg-dim);
	}
	.ac-options {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}
	.ac-opt {
		display: flex;
		align-items: flex-start;
		gap: 0.6rem;
		padding: 0.6rem 0.7rem;
		border: 1px solid var(--border);
		border-radius: calc(var(--glass-radius) - 3px);
		background: transparent;
		text-align: left;
		cursor: pointer;
		transition:
			border-color 0.15s ease,
			background 0.15s ease;
	}
	.ac-opt:hover {
		border-color: var(--border-strong, var(--border));
		background: var(--accent-faint);
	}
	.ac-opt.is-active {
		border-color: var(--accent);
		background: var(--accent-faint);
	}
	.ac-opt:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}
	/* The dot is the radio. A real <input type=radio> would drag in the UA
	   appearance and need resetting on every browser; this is a button with the
	   radio ROLE, so assistive tech reads it correctly and the visual is ours. */
	.ac-opt-dot {
		flex: none;
		width: 0.62rem;
		height: 0.62rem;
		margin-top: 0.18rem;
		border-radius: 50%;
		border: 1px solid var(--fg-dim);
		transition:
			border-color 0.15s ease,
			box-shadow 0.15s ease;
	}
	.ac-opt.is-active .ac-opt-dot {
		border-color: var(--accent);
		/* Inset ring rather than a filled dot — matches the hairline language the
		   rest of the chrome uses. */
		box-shadow: inset 0 0 0 3px var(--accent);
	}
	.ac-opt-text {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		min-width: 0;
	}
	.ac-opt-label {
		font-family: var(--mono);
		font-size: 0.7rem;
		color: var(--fg);
	}
	.ac-opt-desc {
		font-family: var(--mono);
		font-size: 0.62rem;
		line-height: 1.4;
		color: var(--fg-dim);
	}
</style>
