// ── Entry ────────────────────────────────────────────────────────────────────
// The whole standalone app. Five lines, because everything the game needs
// travels with the game and everything it renders with comes from one import.
import { mount } from 'svelte';
import './app.css';
import Breach from './Breach.svelte';

export default mount(Breach, {
	target: document.getElementById('app')!
});
