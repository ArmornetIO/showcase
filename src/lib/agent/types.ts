// ── What the browser agent is ────────────────────────────────────────────────
// The transport is a WebAssembly module: the same Go Agent Line client every
// armornet agent runs, compiled for the browser. See
// docs/development/browser-wasm-agents.md (ENG-055).
//
// The interface lives on its own so the loader and the capability registry can
// both name it without importing each other — the registry needs the loader,
// and a type in the registry would point the loader back at it.

/** What the browser agent module publishes on `window.armornet`.
 *
 *  Bytes both ways, deliberately. The module decodes nothing: a payload is a
 *  Uint8Array in and a Uint8Array out, so adding a capability needs no change
 *  to the module, the build, or this interface. */
export interface ArmornetAgent {
	version: string;
	/** Opens the connection. Resolves once the agent has introduced itself. */
	connect(
		url: string,
		token: string,
		opts: { capabilities: string[]; agent_type?: string }
	): Promise<{ capabilities: string[] }>;
	send(capability: string, type: string, payload: Uint8Array): Promise<void>;
	on(capability: string, handler: (type: string, payload: Uint8Array) => void): Promise<void>;
	off(capability: string): Promise<void>;
	close(): Promise<void>;

	/** Connection-level, so it is a property rather than a subscription: it is
	 *  not about any one capability, and every session on the socket needs it. */
	onClose?: (reason: string) => void;
}

declare global {
	// wasm_exec.js, loaded by the host page or by the loader, defines this.
	const Go: { new (): { importObject: WebAssembly.Imports; run(i: WebAssembly.Instance): void } };
	interface Window {
		armornet?: ArmornetAgent;
	}
}
