// Whether the console is open and which group it shows, remembered across
// reloads AND across apps.
//
// Kept in a cookie rather than storage — see align.ts for why. The name is the
// host's so this never collides with anything the product being inspected
// stores, and it is shared by every app on the host, which is the point: the
// console you left open on BROWSE in one app is open on BROWSE in the next.
import { DEFAULT_CONSOLE_CONFIG, type ConsoleConfig } from './types.js';
import { alignmentCookie, readAlignment } from './align.js';

export class ConsoleState {
	/** Selected group id. May be stale — resolve it against the live registry. */
	selected = $state<string>('');

	open = $state(false);

	/**
	 * Whether `selected` came from a click this session rather than the cookie.
	 * A restored id that is gated on this route should land somewhere usable; a
	 * gated tab you just clicked should say why it is gated. Same id, opposite
	 * answers, so the two cases have to be told apart.
	 */
	#touched = $state(false);

	#config: ConsoleConfig;

	constructor(config: ConsoleConfig = DEFAULT_CONSOLE_CONFIG) {
		this.#config = config;
	}

	load(): void {
		if (typeof document === 'undefined') return;
		try {
			const a = readAlignment(document.cookie, this.#config.stateKey);
			if (!a) return;
			this.selected = a.group;
			this.open = a.open;
		} catch {
			// cookies disabled — the console still works, it just forgets.
		}
	}

	select(id: string): void {
		this.selected = id;
		this.#touched = true;
		this.#save();
	}

	setOpen(open: boolean): void {
		this.open = open;
		this.#save();
	}

	#save(): void {
		if (typeof document === 'undefined') return;
		try {
			document.cookie = alignmentCookie(this.#config.stateKey, {
				group: this.selected,
				open: this.open
			});
		} catch {
			// cookies disabled — ignored.
		}
	}

	/**
	 * The group to actually show. A stored id can outlive the group it names —
	 * the route changed, the host dropped a group, the globe unregistered, or
	 * this is a different app with different groups — and a console rendering
	 * nothing is worse than one that moved.
	 *
	 * A group that exists but is gated is still returned once it has been
	 * clicked, so the panel can state the condition. Falling back there instead
	 * would make a dimmed tab look broken: you click it and land somewhere else
	 * with nothing saying why.
	 */
	resolve<T extends { id: string; available?: boolean }>(groups: T[]): T | undefined {
		if (groups.length === 0) return undefined;
		const stored = groups.find((g) => g.id === this.selected);
		if (stored && (stored.available !== false || this.#touched)) return stored;
		return groups.find((g) => g.available !== false) ?? groups[0];
	}
}
