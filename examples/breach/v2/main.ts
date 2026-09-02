// ── Entry ────────────────────────────────────────────────────────────────────
// One mount, no router, no server. v2 is a local table: the rules are in this
// directory, the dice are in this directory, and there is nothing to connect to.
// That is what makes it a version you can change in an afternoon.
import { mount } from 'svelte';
import '../app.css';
import Table from './Table.svelte';

export default mount(Table, { target: document.getElementById('app')! });
