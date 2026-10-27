<script lang="ts">
	// ── Your name ────────────────────────────────────────────────────────────
	// Two jobs, one component, because they must show the same string: `readonly`
	// is the nameplate under your own figure, and the editable one is the control
	// in the footer. Both read `handle`, so a rename lands in the line-up in the
	// same frame it is saved.
	//
	// It moved to the footer because that is where the screen keeps the things
	// that are YOURS to change — the pencil on the nameplate was a control
	// hidden inside a picture of a person.
	//
	// A host feature. A server without names, or the standalone build with no
	// server at all, answers `null` and this draws nothing but the fallback —
	// the game must not grow a broken control for everybody not running armornet.
	import { onMount } from 'svelte';
	import { Icon } from 'showcase';
	import { HANDLE_PATTERN } from '../api.js';
	import { handle } from './handle.svelte.js';

	interface Props {
		/** Show the name and nothing else — no pencil, no form. */
		readonly?: boolean;
	}

	let { readonly = false }: Props = $props();

	let editing = $state(false);
	let draft = $state('');
	let saving = $state(false);
	let error = $state('');

	const draftValid = $derived(HANDLE_PATTERN.test(draft.trim()));
	/** The server's discriminator. Shown beside the field so a rename does not
	 *  look like it throws the number away — it is kept. */
	const tag = $derived(handle.value.match(/#\d+$/)?.[0] ?? '');

	function onkey(e: KeyboardEvent) {
		// Nowhere to go back to on a first name: the field IS the nameplate.
		if (e.key === 'Escape' && handle.value) {
			e.stopPropagation();
			editing = false;
		}
	}

	onMount(async () => {
		await handle.load();
		// Nobody is anonymous on purpose: a first-time player is asked straight
		// away rather than left standing under the word "You".
		if (!readonly && handle.available && handle.value === '') edit();
	});

	function edit() {
		draft = handle.value.replace(/#\d+$/, '');
		error = '';
		editing = true;
	}

	async function save(e: SubmitEvent) {
		e.preventDefault();
		if (!draftValid || saving) return;
		saving = true;
		error = '';
		try {
			await handle.set(draft.trim());
			editing = false;
		} catch (err) {
			error = err instanceof Error ? err.message : String(err);
		} finally {
			saving = false;
		}
	}
</script>

{#if !handle.available}
	<span class="text">You</span>
{:else if readonly}
	<span class="text">{handle.value || 'you'}</span>
{:else if editing}
	<form onsubmit={save} class:bad={draft.trim() !== '' && !draftValid}>
		<!-- svelte-ignore a11y_autofocus -->
		<input
			class="field text"
			aria-label="Your name"
			placeholder="your name"
			bind:value={draft}
			onkeydown={onkey}
			maxlength={16}
			autocomplete="off"
			spellcheck="false"
			autofocus
		/>
		{#if tag}<span class="tag">{tag}</span>{/if}
		<button type="submit" class="save" disabled={!draftValid || saving} aria-label="Save name">
			{#if saving}…{:else}<Icon name="check" size={12} />{/if}
		</button>
	</form>
	{#if error}
		<span class="rule err">{error}</span>
	{:else}
		<span class="rule">3–16 letters, digits or _{handle.value ? ' · esc to cancel' : ''}</span>
	{/if}
{:else}
	<button type="button" class="name" onclick={edit}>
		<span class="text">{handle.value || 'you'}</span>
		<Icon name="pencil" size={10} />
	</button>
{/if}

<style>
	.name {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		max-width: 100%;
		padding: 0;
		border: 0;
		background: none;
		color: inherit;
		font: inherit;
		cursor: pointer;
		opacity: 0.85;
	}
	.name:hover {
		opacity: 1;
	}
	.text {
		font-family: var(--mono);
		font-size: 0.6rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--fg);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	/* Edited in place: the field is the nameplate with an underline, not a box
	   dropped on top of it, so the card does not change shape while you type. */
	form {
		display: flex;
		align-items: center;
		gap: 4px;
		border-bottom: 1px solid color-mix(in srgb, var(--sc, var(--fg)) 70%, transparent);
	}
	form.bad {
		border-bottom-color: var(--danger, #f87171);
	}
	.field {
		min-width: 0;
		width: 11ch;
		padding: 1px 0;
		border: 0;
		outline: none;
		background: transparent;
		caret-color: var(--sc, var(--fg));
	}
	.field::placeholder {
		color: var(--fg-dim);
		opacity: 0.6;
	}
	.tag {
		font-family: var(--mono);
		font-size: 0.6rem;
		letter-spacing: 0.1em;
		color: var(--fg-dim);
	}
	.save {
		display: grid;
		place-items: center;
		width: 20px;
		height: 20px;
		margin-left: 2px;
		padding: 0;
		border: 0;
		border-radius: 4px;
		background: var(--sc, var(--fg));
		color: #05070c;
		cursor: pointer;
	}
	.save:disabled {
		background: rgb(255 255 255 / 0.08);
		color: var(--fg-dim);
		cursor: default;
	}
	.rule {
		font-size: 0.5rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--fg-dim);
		white-space: nowrap;
	}
	.err,
	form.bad + .rule {
		color: var(--danger, #f87171);
	}
</style>
