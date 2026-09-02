export type AlertBladeVariant = 'info' | 'success' | 'warn' | 'danger';

export interface AlertBladeItem {
	id: string;
	title?: string;
	message: string;
	variant: AlertBladeVariant;
	duration: number;
	action?: { label: string; onclick: () => void };
}

/** What a caller supplies: everything but the id, with sensible defaults. */
export type AlertBladeOptions = Omit<AlertBladeItem, 'id' | 'variant' | 'duration'> & {
	variant?: AlertBladeVariant;
	duration?: number;
};

/**
 * The toast queue. `AlertBladeHost` renders it; anything in the app can push to
 * it without wiring a prop down to the host.
 */
class AlertBladeQueue {
	items = $state<AlertBladeItem[]>([]);

	/** Queue a blade and hand back its id, so a caller can patch or dismiss it. */
	show(opts: AlertBladeOptions): string {
		const { variant = 'info', duration = 5000, ...rest } = opts;
		const id = crypto.randomUUID();
		this.items.push({ ...rest, variant, duration, id });
		return id;
	}

	/**
	 * Patch a live blade in place (same id), so a sticky "in progress" blade can
	 * transition to its success/failure result without popping a second toast.
	 * Changing `duration` re-arms the auto-dismiss timer (e.g. 0 → 4000 to let a
	 * resolved request fade out). No-op if the id is already gone.
	 */
	update(id: string, patch: Partial<Omit<AlertBladeItem, 'id'>>): void {
		const blade = this.items.find((b) => b.id === id);
		if (blade) Object.assign(blade, patch);
	}

	dismiss(id: string): void {
		this.items = this.items.filter((b) => b.id !== id);
	}

	clear(): void {
		this.items = [];
	}
}

export const alertBlade = new AlertBladeQueue();
