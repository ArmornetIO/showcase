<script lang="ts">
	/**
	 * Right-click menu for a canvas item — the discoverable half of the keyboard
	 * shortcuts. Every entry here is something the builder could already do and
	 * only a shortcut could reach, which is the same as not existing for anyone
	 * who hasn't read the source.
	 *
	 * Reads `builder` directly rather than taking a dozen callbacks: it is a
	 * builder menu, the store IS the document, and threading each action through
	 * props would put a second copy of "what does Duplicate mean" in the page.
	 * The two things it cannot know — where it was opened, and that renaming
	 * happens in the layers panel — come in as props.
	 */
	import { builder } from './store.svelte.js';

	interface Props {
		/** Viewport coordinates of the click that opened it. */
		x: number;
		y: number;
		onclose: () => void;
		/** Hand renaming back to the layers panel, which owns the inline input. */
		onrename?: (id: string) => void;
	}

	let { x, y, onclose, onrename }: Props = $props();

	const selection = $derived(builder.selectionItems());
	const single = $derived(selection.length === 1 ? selection[0] : null);
	const isMulti = $derived(selection.length > 1);
	const groupId = $derived(builder.selectedGroupId);

	let menuEl = $state<HTMLDivElement | undefined>();

	/** Flip the menu back inside the viewport rather than letting it run off the
	 *  edge — a right-click near the bottom is the common case, not the corner. */
	const pos = $derived.by(() => {
		const w = menuEl?.offsetWidth ?? 190;
		const h = menuEl?.offsetHeight ?? 300;
		const vw = typeof window === 'undefined' ? 1200 : window.innerWidth;
		const vh = typeof window === 'undefined' ? 800 : window.innerHeight;
		return {
			left: Math.max(8, Math.min(x, vw - w - 8)),
			top: Math.max(8, Math.min(y, vh - h - 8))
		};
	});

	function run(fn: () => void) {
		fn();
		onclose();
	}

	$effect(() => {
		function onDown(e: MouseEvent) {
			if (menuEl && !menuEl.contains(e.target as Node)) onclose();
		}
		function onKey(e: KeyboardEvent) {
			if (e.key === 'Escape') onclose();
		}
		// `capture` so a click that also lands on a canvas item still closes us
		// first, rather than the item's own handler swallowing it.
		document.addEventListener('pointerdown', onDown, true);
		document.addEventListener('keydown', onKey);
		return () => {
			document.removeEventListener('pointerdown', onDown, true);
			document.removeEventListener('keydown', onKey);
		};
	});
</script>

<div
	class="ctx"
	bind:this={menuEl}
	style:left="{pos.left}px"
	style:top="{pos.top}px"
	role="menu"
	tabindex="-1"
>
	<button class="ctx-row" role="menuitem" onclick={() => run(() => builder.duplicateSelection())}>
		<span>Duplicate</span><kbd>⌘D</kbd>
	</button>
	<button class="ctx-row" role="menuitem" onclick={() => run(() => builder.copySelection())}>
		<span>Copy</span><kbd>⌘C</kbd>
	</button>
	<button
		class="ctx-row"
		role="menuitem"
		disabled={!builder.hasClipboard}
		onclick={() => run(() => builder.paste())}
	>
		<span>Paste</span><kbd>⌘V</kbd>
	</button>

	{#if single && onrename}
		<button class="ctx-row" role="menuitem" onclick={() => run(() => onrename(single.id))}>
			<span>Rename…</span>
		</button>
	{/if}

	<div class="ctx-sep"></div>

	{#if isMulti}
		<button
			class="ctx-row"
			role="menuitem"
			onclick={() => run(() => builder.createGroup(undefined, selection.map((i) => i.id)))}
		>
			<span>Group</span><kbd>⌘G</kbd>
		</button>
	{/if}
	{#if groupId}
		<button class="ctx-row" role="menuitem" onclick={() => run(() => builder.deleteGroup(groupId))}>
			<span>Ungroup</span><kbd>⇧⌘G</kbd>
		</button>
	{/if}

	{#if single}
		<button
			class="ctx-row"
			role="menuitem"
			onclick={() => run(() => builder.bringToFront(single.id))}
		>
			<span>Bring to front</span><kbd>⌘]</kbd>
		</button>
		<button class="ctx-row" role="menuitem" onclick={() => run(() => builder.sendBack(single.id))}>
			<span>Send back</span><kbd>⌘[</kbd>
		</button>

		<div class="ctx-sep"></div>

		<button
			class="ctx-row"
			role="menuitem"
			onclick={() => run(() => builder.toggleItemVisible(single.id))}
		>
			<span>{single.visible ? 'Hide' : 'Show'}</span>
		</button>
		<button
			class="ctx-row"
			role="menuitem"
			onclick={() => run(() => builder.toggleItemLocked(single.id))}
		>
			<span>{single.locked ? 'Unlock' : 'Lock'}</span>
		</button>
	{/if}

	<div class="ctx-sep"></div>

	<button
		class="ctx-row ctx-row--danger"
		role="menuitem"
		onclick={() => run(() => builder.deleteItems(selection.map((i) => i.id)))}
	>
		<span>Delete{isMulti ? ` ${selection.length} items` : ''}</span><kbd>⌫</kbd>
	</button>
</div>

<style>
	.ctx {
		position: fixed;
		z-index: 200;
		min-width: 190px;
		padding: 4px;
		background: var(--bg-elev, #0a1120);
		border: 1px solid var(--border, rgba(94, 234, 212, 0.2));
		border-radius: 4px;
		box-shadow: 0 12px 32px rgba(0, 0, 0, 0.55);
	}

	.ctx-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		width: 100%;
		padding: 6px 10px;
		background: none;
		border: 0;
		border-radius: 2px;
		font-family: var(--mono);
		font-size: 11px;
		color: var(--fg-muted, #9fb3c8);
		text-align: left;
		cursor: pointer;
	}
	.ctx-row:hover:not(:disabled) {
		background: rgba(94, 234, 212, 0.08);
		color: var(--accent);
	}
	.ctx-row:disabled {
		opacity: 0.35;
		cursor: default;
	}
	.ctx-row--danger:hover:not(:disabled) {
		background: rgba(248, 113, 113, 0.12);
		color: #f87171;
	}

	kbd {
		font-family: var(--mono);
		font-size: 9px;
		color: var(--fg-dim);
	}

	.ctx-sep {
		height: 1px;
		margin: 4px 2px;
		background: var(--border, rgba(94, 234, 212, 0.12));
	}
</style>
