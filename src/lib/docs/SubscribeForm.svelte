<script lang="ts">
	// SUBSCRIBE FORM — email capture for a publication.
	//
	// Not SearchInput with different copy: a search field reads as "find something
	// here", and the semantics differ where it matters — this is a form that submits,
	// with a real `type="email"` so a phone offers the right keyboard and the browser
	// can autofill.
	//
	// It owns no network call. Submission is the caller's, because where an address
	// goes is a product decision and a component that picked one would be an
	// undeclared dependency on a mailing provider.
	interface Props {
		/** Called with a trimmed, browser-validated address. */
		onsubmit: (email: string) => void;
		placeholder?: string;
		label?: string;
		cta?: string;
		/** Disables the form while a submission is in flight. */
		busy?: boolean;
		/** Shown in place of the form once the caller reports success. */
		done?: string;
	}

	let {
		onsubmit,
		placeholder = 'you@example.com',
		label = 'Get new posts by email',
		cta = 'Subscribe',
		busy = false,
		done
	}: Props = $props();

	let email = $state('');

	function submit(e: SubmitEvent) {
		e.preventDefault();
		const value = email.trim();
		if (!value) return;
		onsubmit(value);
	}
</script>

{#if done}
	<p class="sub-done">{done}</p>
{:else}
	<form class="sub" onsubmit={submit}>
		<label class="sub-label" for="sub-email">{label}</label>
		<div class="sub-row">
			<input
				id="sub-email"
				class="sub-input"
				type="email"
				required
				autocomplete="email"
				{placeholder}
				bind:value={email}
				disabled={busy}
			/>
			<button class="sub-btn" type="submit" disabled={busy || !email.trim()}>
				{busy ? '…' : cta}
			</button>
		</div>
	</form>
{/if}

<style>
	.sub {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.sub-label {
		font-family: var(--mono);
		font-size: 0.68rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--fg-dim);
	}

	.sub-row {
		display: flex;
		gap: 0.5rem;
	}

	.sub-input {
		flex: 1;
		min-width: 0;
		padding: 0.5rem 0.7rem;
		border: 1px solid var(--border);
		border-radius: var(--radius-control);
		background: var(--surface-raised);
		color: var(--fg);
		font-size: 0.88rem;
	}
	.sub-input::placeholder {
		color: var(--fg-dim);
	}
	.sub-input:focus-visible {
		outline: none;
		border-color: var(--accent);
	}

	.sub-btn {
		padding: 0.5rem 1rem;
		border: 1px solid var(--accent);
		border-radius: var(--radius-control);
		background: var(--accent-faint);
		color: var(--accent);
		font-family: var(--mono);
		font-size: 0.72rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		cursor: pointer;
		white-space: nowrap;
	}
	.sub-btn:disabled {
		opacity: 0.5;
		cursor: default;
	}

	.sub-done {
		margin: 0;
		font-size: 0.88rem;
		color: var(--accent);
	}
</style>
