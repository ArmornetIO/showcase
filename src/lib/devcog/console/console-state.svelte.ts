// Which group the console is showing, remembered across reloads.
//
// Same shape as the nits engine next door — injected key, tolerant read,
// best-effort write — so the console has one persistence style rather than two.
// The key is the host's so this never collides with storage owned by the
// product being inspected.
import { DEFAULT_CONSOLE_CONFIG, type ConsoleConfig } from './types.js';

export class ConsoleState {
	/** Selected group id. May be stale — resolve it against the live registry. */
	selected = $state<string>('');

	/**
	 * Whether `selected` came from a click this session rather than storage.
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
		if (typeof localStorage === 'undefined') return;
		try {
			this.selected = localStorage.getItem(this.#config.stateKey) ?? '';
		} catch {
			// disabled storage — the console still works, it just forgets.
		}
	}

	select(id: string): void {
		this.selected = id;
		this.#touched = true;
		if (typeof localStorage === 'undefined') return;
		try {
			localStorage.setItem(this.#config.stateKey, id);
		} catch {
			// quota / disabled storage — ignored.
		}
	}

	/**
	 * The group to actually show. A stored id can outlive the group it names —
	 * the route changed, the host dropped a group, the globe unregistered — and
	 * a console rendering nothing is worse than one that moved.
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
