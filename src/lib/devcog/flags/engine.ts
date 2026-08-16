// Generic feature-flag + serve-mode engine for the DevCog.
//
// This is the portable business logic behind the DevCog panel. It is
// intentionally framework-agnostic — no `$app/environment`, no SvelteKit
// imports — so a freshly bootstrapped app can consume it directly. Host
// specifics (localStorage key names, the window global the server injects,
// the set of flag keys) are passed in as config, not hardcoded.
//
// Two resolution layers, highest priority first:
//   1. localStorage override — per-flag, flipped in the browser, survives reload.
//   2. window[runtimeGlobal].features — injected by the server at runtime
//      (config / configmap). The single source of truth.
// All flags default OFF.

/** Shape of the object a host server injects onto `window[runtimeGlobal]`. */
export interface DevRuntime {
	features?: Record<string, boolean>;
	serve?: string;
	dev?: boolean;
	released?: boolean;
}

/**
 * Where a flag's resolved value came from. The engine emits 'override' or
 * 'server'; 'env' is reserved for hosts that surface a build-time env source.
 */
export type FlagSource = 'override' | 'server' | 'env';

/** Resolved state of a single flag, plus its provenance. */
export interface FlagSnapshot<K extends string = string> {
	key: K;
	enabled: boolean;
	source: FlagSource;
}

export interface FlagStoreConfig<K extends string = string> {
	/** localStorage key holding the per-flag override map. */
	overridesKey: string;
	/** localStorage key holding the serve-mode override. */
	serveModeKey: string;
	/** window property the server injects runtime config onto, e.g. '__ARMORNET__'. */
	runtimeGlobal: string;
	/** Serve mode returned when nothing overrides it. */
	defaultServeMode: string;
	/** Ordered flag keys — drives snapshot() output order. */
	keys: readonly K[];
}

export interface FlagStore<K extends string = string> {
	/** Effective state of a flag: override → server default → false. */
	isEnabled(key: K): boolean;
	/** Flip one flag in localStorage. Pass null to clear the override. */
	setOverride(key: K, value: boolean | null): void;
	/** Remove every override at once. */
	clearOverrides(): void;
	/** Resolved state + provenance for every known flag, in `keys` order. */
	snapshot(): FlagSnapshot<K>[];
	/** Current serve mode: localStorage → server → default. */
	serveMode(): string;
	/** Override the serve mode (reloads). Pass null to clear. */
	setServeModeOverride(mode: string | null): void;
	/** Whether the server marked this as a dev build. */
	isDevMode(): boolean;
}

function storageAvailable(): boolean {
	return typeof localStorage !== 'undefined';
}

function readRuntime(runtimeGlobal: string): DevRuntime | undefined {
	if (typeof window === 'undefined') return undefined;
	return (window as unknown as Record<string, DevRuntime | undefined>)[runtimeGlobal];
}

/**
 * createFlagStore builds a flag/serve-mode engine bound to a host's config.
 * The returned store owns all localStorage and window-global access; callers
 * (a layout, the DevCog) treat it as the single source of truth.
 */
export function createFlagStore<K extends string = string>(
	config: FlagStoreConfig<K>
): FlagStore<K> {
	function readOverrides(): Partial<Record<K, boolean>> {
		if (!storageAvailable()) return {};
		try {
			const raw = localStorage.getItem(config.overridesKey);
			if (!raw) return {};
			const parsed = JSON.parse(raw);
			if (parsed && typeof parsed === 'object') {
				return parsed as Partial<Record<K, boolean>>;
			}
		} catch {
			// unavailable / corrupted — fall through to empty.
		}
		return {};
	}

	function writeOverrides(overrides: Partial<Record<K, boolean>>): void {
		if (!storageAvailable()) return;
		try {
			localStorage.setItem(config.overridesKey, JSON.stringify(overrides));
		} catch {
			// quota / disabled storage — ignored.
		}
	}

	function serverDefault(key: K): boolean | undefined {
		const f = readRuntime(config.runtimeGlobal)?.features;
		if (f && key in f && typeof f[key] === 'boolean') return f[key];
		return undefined;
	}

	return {
		isEnabled(key) {
			const overrides = readOverrides();
			if (key in overrides && typeof overrides[key] === 'boolean') {
				return overrides[key] as boolean;
			}
			return serverDefault(key) ?? false;
		},

		setOverride(key, value) {
			const overrides = readOverrides();
			if (value === null) {
				delete overrides[key];
			} else {
				overrides[key] = value;
			}
			writeOverrides(overrides);
		},

		clearOverrides() {
			if (!storageAvailable()) return;
			try {
				localStorage.removeItem(config.overridesKey);
			} catch {
				// ignored.
			}
		},

		snapshot() {
			const overrides = readOverrides();
			return config.keys.map((key) => {
				if (key in overrides && typeof overrides[key] === 'boolean') {
					return { key, enabled: overrides[key] as boolean, source: 'override' as const };
				}
				return { key, enabled: serverDefault(key) ?? false, source: 'server' as const };
			});
		},

		serveMode() {
			if (!storageAvailable()) return config.defaultServeMode;
			return (
				localStorage.getItem(config.serveModeKey) ??
				readRuntime(config.runtimeGlobal)?.serve ??
				config.defaultServeMode
			);
		},

		setServeModeOverride(mode) {
			if (!storageAvailable()) return;
			if (mode === null) {
				localStorage.removeItem(config.serveModeKey);
			} else {
				localStorage.setItem(config.serveModeKey, mode);
			}
			if (typeof window !== 'undefined') window.location.reload();
		},

		isDevMode() {
			return readRuntime(config.runtimeGlobal)?.dev === true;
		}
	};
}
