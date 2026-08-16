// ── Entry ────────────────────────────────────────────────────────────────────
// The standalone dbmgr console. The Go binary serves the built output of this
// app from its own embed, so nothing here may assume a dev server.
import { mount } from 'svelte';
import './app.css';
import Console from './Console.svelte';

export default mount(Console, {
	target: document.getElementById('app')!
});
