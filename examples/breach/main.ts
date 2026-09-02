// ── Entry ────────────────────────────────────────────────────────────────────
// The whole standalone app. Everything the game needs travels with the game and
// everything it renders with comes from one import.
import { mount } from 'svelte';
import './app.css';
import Breach from './Breach.svelte';
import Rulebook from './Rulebook.svelte';
import { isRulesPath, playHref } from './api.js';

const target = document.getElementById('app')!;

// Two mounts, one page, and no router — which is the whole shape of this app.
//
// The rulebook needs a URL of its own: it is a document somebody links to, and
// `rulesHref()` has always pointed at one. In the showcase it was a real
// SvelteKit route next door. Mounted under the binary's /breach prefix there is
// no next door, so the server's SPA fallback answers /breach/rules with this
// index.html — and without this branch that silently serves the GAME at the
// rules URL, which reads as a broken link rather than a missing route.
//
// A path check rather than a router: one alternative page does not justify
// pulling in routing, and the fallback means every other path is already the
// game by construction.
const rules = isRulesPath();

// Which of the two pages this is decides whether the window may scroll, so the
// lock is set HERE rather than in a blanket `body { overflow: hidden }`. It was
// blanket, and the rulebook — a document that runs well past one screen —
// simply could not be scrolled.
if (!rules) document.body.classList.add('hud');

export default rules
	? mount(Rulebook, { target, props: { playHref: playHref() } })
	: mount(Breach, {
			target,
			// The standalone entry is the solo table, and changing chairs is a solo
			// table's setting: three of the four are demonstrators, and being able to
			// take one is the difference between watching the game and being in it.
			props: { takeover: true }
		});
