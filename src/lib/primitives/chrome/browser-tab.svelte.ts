/**
 * The browser tab is one piece of global state that every mounted component
 * wants a say in: the root layout knows the favicon and the unread count, the
 * page knows its title, a panel inside the page may know better still. A raw
 * `<svelte:head><title>` is last-write-wins and never hands the tab back, so
 * a panel had to stay silent or clobber its page.
 *
 * Here every BrowserTab is a layer, stacked in mount order, and each field
 * resolves to the newest layer that sets it. Unmounting a layer re-resolves,
 * which is what hands the tab back.
 */
import { onDestroy } from 'svelte';

export interface BrowserTabProps {
	title?: string;
	/** Appended after the title: `Relays — Armornet`. */
	site?: string;
	/** Unread count shown as a `(3)` prefix; 0 hides it. */
	count?: number;
	/** Favicon href; a data: URL works for generated SVG. */
	icon?: string;
}

export interface ResolvedTab {
	title: string;
}

/** Newest layer that sets a field wins it, field by field. */
export function resolveTab(layers: readonly BrowserTabProps[]): ResolvedTab {
	const merged: BrowserTabProps = {};
	for (const layer of layers) {
		for (const key of Object.keys(layer) as (keyof BrowserTabProps)[]) {
			if (layer[key] !== undefined) (merged as Record<string, unknown>)[key] = layer[key];
		}
	}
	const count = merged.count ?? 0;
	const badge = count > 0 ? `(${count > 99 ? '99+' : count}) ` : '';
	const text = [merged.title, merged.site].filter(Boolean).join(' — ');
	return { title: badge + text };
}

const layers: (() => BrowserTabProps)[] = $state([]);
const resolved = $derived(resolveTab(layers.map((read) => read())));

/**
 * Join the stack for the life of the calling component. Must run during
 * component init.
 *
 * On the server there is no stack: module state there is shared by every
 * request, so each instance renders its own layer and the last one rendered
 * fills the `<title>` a crawler sees.
 */
export function claimTab(read: () => BrowserTabProps): ResolvedTab {
	if (typeof window === 'undefined') return resolveTab([read()]);
	layers.push(read);
	onDestroy(() => {
		const i = layers.indexOf(read);
		if (i >= 0) layers.splice(i, 1);
	});
	return {
		get title() {
			return resolved.title;
		}
	};
}
