// ── Your name, once ──────────────────────────────────────────────────────────
// The handle is shown in two places now — the footer control that edits it and
// the nameplate under your own figure — and those two must never disagree. A
// component that fetched its own copy would have made renaming a thing you do
// in the footer and see in the line-up on the next reload.
//
// It is also one GET instead of one per mount, which is why `load` is idempotent
// rather than an `onMount` in each consumer.
import { getHandle, setHandle } from '../api.js';

class HandleStore {
	/** The handle the server knows. `''` means "asked and never chosen". */
	value = $state<string>('');
	/** Whether names exist at all here. A server without them — or the
	 *  standalone build with no server — answers null, and every control that
	 *  edits a name has to draw nothing rather than a broken field. */
	available = $state(false);
	loaded = $state(false);
	#inflight: Promise<void> | null = null;

	load(): Promise<void> {
		if (this.#inflight) return this.#inflight;
		// SSR has no origin to resolve `/api/...` against, and SvelteKit throws
		// on the attempt; the browser asks once it hydrates.
		if (typeof window === 'undefined') return Promise.resolve();
		this.#inflight = getHandle().then((h) => {
			this.available = h !== null;
			this.value = h ?? '';
			this.loaded = true;
		});
		return this.#inflight;
	}

	/** Throws the server's reason on refusal — the caller shows it. */
	async set(name: string): Promise<void> {
		this.value = await setHandle(name);
	}
}

export const handle = new HandleStore();
