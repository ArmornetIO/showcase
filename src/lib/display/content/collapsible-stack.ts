import { getContext, setContext } from 'svelte';

export const COLLAPSIBLE_STACK = Symbol('collapsible-stack');

export interface CollapsibleStackCtx {
	/** The key of the row last opened, or null. */
	readonly openKey: string | null;
	/** Toggle a row. The stack decides whether opening one closes another. */
	toggle: (key: string) => void;
	/** Whether a row is open. Asked rather than derived from `openKey`, because
	 *  in multi-open mode several rows are open and only one is the latest. */
	isOpen: (key: string) => boolean;
}

export function setStackContext(ctx: CollapsibleStackCtx) {
	setContext(COLLAPSIBLE_STACK, ctx);
}

/** Null when a row is used outside a stack, in which case it owns its own state. */
export function getStackContext(): CollapsibleStackCtx | null {
	return getContext<CollapsibleStackCtx | null>(COLLAPSIBLE_STACK) ?? null;
}
