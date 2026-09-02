<script lang="ts">
	// The route is a mount point and nothing else. Everything the example needs
	// travels with the example — which is the property being demonstrated.
	//
	// Two things can be mounted here: the game, and the god-admin gallery that
	// watches other people's games. `?spectate` picks the second. That is a
	// convenience for reaching it from the showcase, not a permission — the
	// server refuses a spectator subscription from anybody who is not a god
	// admin, so typing the parameter in gets you an empty gallery.
	import { Breach, BreachSpectate } from '$examples/breach/index.js';
	import { arrivedToSpectate } from '$examples/breach/api.js';

	const spectating = arrivedToSpectate();
</script>

<svelte:head>
	<title>{spectating ? 'BREACH — spectate' : 'BREACH — supply-chain skirmish'}</title>
</svelte:head>

{#if spectating}
	<div class="h-screen"><BreachSpectate /></div>
{:else}
	<Breach />
{/if}
