<script lang="ts">
	// ── AuthSplit — the sign-in shell, on its own route ────────────────────────
	// Its own page rather than a block on /layout because the shell is
	// `position: fixed; inset: 0` by design — it IS the window. Dropped into a
	// demo card it escapes the card and covers the sidebar, so the only honest
	// exhibit is the whole screen, with a way back out of it.
	//
	// Both steps are here because the seam is what the shell exists to hold: a
	// one-field step and a stacked-provider step have very different form
	// heights, and the brand pane must not move between them.
	import { base } from '$app/paths';
	import AuthSplit from '$lib/layout/AuthSplit.svelte';
	import Button from '$lib/primitives/actions/Button.svelte';
	import Input from '$lib/primitives/forms/Input.svelte';
	import FormField from '$lib/primitives/forms/FormField.svelte';

	let step = $state<'slug' | 'provider'>('slug');
	let slug = $state('');
	let error = $state('');

	function submit(e: SubmitEvent) {
		e.preventDefault();
		if (!slug.trim()) {
			error = 'Enter a workspace to continue.';
			return;
		}
		error = '';
		step = 'provider';
	}
</script>

<svelte:head><title>AuthSplit — Armornet UI</title></svelte:head>

<AuthSplit
	mark="ARMORNET"
	statement={{ human: 'Every agent', machine: 'accounted for.' }}
	sub="Identity, posture and interception for the machines that act on your behalf."
	step={step === 'slug' ? '01 / WORKSPACE' : '02 / PROVIDER'}
>
	{#snippet form()}
		{#if step === 'slug'}
			<form onsubmit={submit}>
				<FormField
					label="Workspace"
					id="slug"
					hint="e.g. app.armornet.io/your-workspace"
					{error}
					required
				>
					<Input
						id="slug"
						placeholder="your-workspace"
						bind:value={slug}
						status={error ? 'error' : 'default'}
					/>
				</FormField>
				<Button variant="app-solid" size="lg" type="submit" full>Continue</Button>
			</form>
		{:else}
			<p class="auth-lede">Choose how you'd like to sign in to <strong>{slug}</strong>.</p>
			<div class="auth-stack">
				<Button variant="ghost" size="lg" full>Continue with Google</Button>
				<Button variant="ghost" size="lg" full>Continue with GitHub</Button>
				<Button variant="ghost" size="lg" full>Continue with Okta</Button>
			</div>
			<p class="auth-error">Example error: that provider is not configured.</p>
			<button class="auth-back" onclick={() => (step = 'slug')}>
				← Use a different workspace
			</button>
		{/if}
	{/snippet}

	{#snippet aside()}
		Demo only — nothing is submitted. <a href="{base}/overview">Back to the showcase</a>.
	{/snippet}
</AuthSplit>
