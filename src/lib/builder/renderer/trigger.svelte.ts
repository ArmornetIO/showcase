import { alertBlade } from '$lib/display/drawer/alertBlade.svelte.js';

/**
 * What a triggerable component does when clicked on the canvas. Mirrors the
 * `__trigger` enum in the registry's `TRIGGER_PROPS`.
 */
export type TriggerKind =
	| 'none'
	| 'alert-info'
	| 'alert-success'
	| 'alert-warn'
	| 'alert-danger'
	| 'open-drawer'
	| 'open-modal';

/**
 * Overlay state for one triggerable component instance.
 *
 * Buttons in the builder can be wired to raise an alert or open a drawer/modal
 * so a mockup demonstrates an interaction, not just a shape. The state is
 * per-instance — two buttons on the same canvas open their own overlays — so it
 * lives in a class the renderer instantiates rather than in a module singleton.
 *
 * Reads the prop bag through a getter for the same reason `accessors` does: the
 * builder replaces the object on every edit.
 */
export class Trigger {
	drawerOpen = $state(false);
	modalOpen = $state(false);

	readonly #props: () => Record<string, unknown>;

	constructor(props: () => Record<string, unknown>) {
		this.#props = props;
	}

	get kind(): TriggerKind {
		return (this.#props().__trigger as TriggerKind) ?? 'none';
	}

	/** Whether to wire a click handler at all. */
	get enabled(): boolean {
		return this.kind !== 'none';
	}

	fire = () => {
		const kind = this.kind;
		if (kind === 'none') return;
		if (kind.startsWith('alert-')) {
			const variant = kind.replace('alert-', '') as 'info' | 'success' | 'warn' | 'danger';
			const bag = this.#props();
			alertBlade.show({
				title: ((bag.__triggerTitle as string) ?? '') || undefined,
				message: (bag.__triggerMessage as string) ?? 'Action triggered',
				variant
			});
		} else if (kind === 'open-drawer') {
			this.drawerOpen = true;
		} else if (kind === 'open-modal') {
			this.modalOpen = true;
		}
	};

	closeDrawer = () => {
		this.drawerOpen = false;
	};

	closeModal = () => {
		this.modalOpen = false;
	};
}
