// ── Entry ────────────────────────────────────────────────────────────────────
// The whole standalone app. Everything the game needs travels with the game and
// everything it renders with comes from one import.
import { mount } from 'svelte';
import { buildWatch } from 'showcase';
import './app.css';
import Breach from './Breach.svelte';
import Rulebook from './Rulebook.svelte';
import { BreachMatch } from './internal/match.svelte.js';
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

const match = new BreachMatch();

// ── A newer deploy ───────────────────────────────────────────────────────────
// A tab left open across a deploy runs the old client against the new server's
// wire. Reload it onto the new build, but only when the player is away (tab
// hidden, or no input for AWAY_MS) and not in a game. Coming back to the tab
// after a long absence counts as away, so that is usually when it happens.
//
// `remote` is set on joining a live table and never cleared, so a tab that has
// sat at one is never reloaded: dropping somebody out of a table's seating is
// worse than leaving them on an old build.
if (!rules) {
	const AWAY_MS = 2 * 60_000;
	let lastInput = Date.now();
	const away = () => document.hidden || Date.now() - lastInput > AWAY_MS;
	const inGame = () => match.stage !== 'select' || !!match.remote;
	const reloadIfStale = async () => {
		if (inGame() || !away()) return;
		if ((await buildWatch.check()) && !inGame()) location.reload();
	};
	for (const type of ['pointerdown', 'keydown'] as const) {
		addEventListener(type, () => (lastInput = Date.now()), { capture: true, passive: true });
	}
	document.addEventListener('visibilitychange', () => {
		if (!document.hidden) void reloadIfStale();
	});
	setInterval(() => void reloadIfStale(), 60_000);
}

export default rules
	? mount(Rulebook, { target, props: { playHref: playHref() } })
	: mount(Breach, { target, props: { match } });
