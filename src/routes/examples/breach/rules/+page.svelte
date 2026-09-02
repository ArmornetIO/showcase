<script lang="ts">
	// A mount point, like the game's own route next door. The rulebook travels
	// with the example — it is built out of the same `internal/` modules the
	// engine runs on, so it cannot drift from the game it documents.
	//
	// Deliberately NOT in the shell's full-screen list: the board is a HUD that
	// owns the viewport, and this is a document you scroll and navigate away from.
	import { base } from '$app/paths';
	import { Rulebook } from '$examples/breach/index.js';
</script>

<svelte:head>
	<title>BREACH — rules &amp; deck</title>
	<meta
		name="description"
		content="Plain-language rules for BREACH: the turn, the roll, the board, and every card in the deck."
	/>
</svelte:head>

<!-- 49px is the showcase's own floating toolbar; the docs rail is viewport-fixed
     and would otherwise start underneath it. -->
<Rulebook playHref="{base}/examples/breach" topOffset="49px" />
