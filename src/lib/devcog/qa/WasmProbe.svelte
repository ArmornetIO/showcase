<script lang="ts">
	// ── WASM agent probe ─────────────────────────────────────────────────────
	// Connects the browser's WebAssembly Agent Line client to the live server, from
	// wherever you happen to be standing.
	//
	// It tests the CONNECTION and nothing above it: load the module, dial the
	// server, introduce the agent, watch it close. No capability is required to
	// do any of that — an agent that declares none is fully connected and simply
	// has nothing it is allowed to say, which is also exactly what the server
	// grants a page that has not been given one.
	//
	// That is why this loads cmd/agentwasm rather than the game's module. A probe
	// that had to open a table to prove a socket works would be testing the game.
	//
	// The steps are in the order they happen so a failure names itself: these
	// fail in different places for different reasons — a cookie that did not
	// travel, an Origin the upgrade refused, a frame the codec could not encode —
	// and from the outside they all look like "it didn't work".
	//
	// See docs/development/browser-wasm-agents.md (ENG-055).

	interface Agent {
		version: string;
		connect(
			url: string,
			token: string,
			capabilities: string[]
		): Promise<{ instance_uid: string; capabilities: number }>;
		send(capability: string, type: string, payload: string): Promise<void>;
		close(): Promise<void>;
		onMessage?: (m: { capability: string; type: string; data: Uint8Array }) => void;
		onClose?: (reason: string) => void;
	}

	type Tone = 'ok' | 'bad' | 'warn' | 'dim';
	interface Line {
		at: string;
		tag: string;
		text: string;
		tone: Tone;
	}

	/** Written by `make build-agent-wasm`. Both gitignored. */
	const WASM_URL = '/agent-wasm/agent.wasm';
	const EXEC_URL = '/agent-wasm/wasm_exec.js';

	let log = $state<Line[]>([]);
	// The query capability is a round trip that does nothing: the server answers
	// with who it decided you are. Default it, because proving the connection is
	// what this panel is for.
	const PING_CAP = 'io.armornet.query';
	let capsInput = $state(PING_CAP);
	let sentAt = 0;
	let agent = $state<Agent | null>(null);
	let busy = $state(false);
	let connected = $state(false);

	function say(tag: string, text: string, tone: Tone = 'dim') {
		log = [...log, { at: new Date().toISOString().slice(11, 19), tag, text, tone }];
	}

	const reason = (e: unknown) => (e instanceof Error ? e.message : String(e));

	const caps = () =>
		capsInput
			.split(',')
			.map((s) => s.trim())
			.filter(Boolean);

	/** wasm_exec.js is a classic script defining a global `Go`, not a module, so
	 *  it cannot simply be imported. */
	function loadExec(): Promise<void> {
		if ('Go' in window) return Promise.resolve();
		return new Promise((resolve, reject) => {
			const s = document.createElement('script');
			s.src = EXEC_URL;
			s.onload = () => resolve();
			s.onerror = () =>
				reject(new Error(`${EXEC_URL} did not load — run \`make build-agent-wasm\``));
			document.head.appendChild(s);
		});
	}

	async function load() {
		busy = true;
		try {
			await loadExec();
			/* eslint-disable @typescript-eslint/no-explicit-any */
			const go = new (window as any).Go();
			const res = await WebAssembly.instantiateStreaming(fetch(WASM_URL), go.importObject);
			// NOT awaited: the module's main parks forever on purpose. Returning
			// from it would tear down the Go runtime under the callbacks we hold.
			void go.run(res.instance);
			const published = (window as any).armornetAgent as Agent | undefined;
			/* eslint-enable @typescript-eslint/no-explicit-any */
			if (!published) throw new Error('module ran but published no namespace');
			agent = published;
			say('module', `loaded, version ${published.version}`, 'ok');
		} catch (e) {
			say('module', reason(e), 'bad');
		} finally {
			busy = false;
		}
	}

	async function connect() {
		if (!agent) return;
		busy = true;
		const dec = new TextDecoder();
		agent.onMessage = (m) =>
			say('inbound', `${m.capability} · ${m.type} · ${m.data.length}b`, 'ok');
		agent.onClose = (why) => {
			connected = false;
			say('closed', why || '(clean)', 'warn');
		};

		try {
			// Same origin as this page — required, not preferred. The Line server
			// upgrades with gorilla's origin check, which compares Origin to Host
			// including the PORT, so dialling the Line's port directly is a 403 before any
			// armornet auth runs.
			const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
			// No token: the session cookie IS the credential.
			const r = await agent.connect(`${proto}//${location.host}/v1/opamp`, '', caps());
			connected = true;
			say('connected', `uid ${r.instance_uid.slice(0, 12)}… · ${r.capabilities} capabilities`, 'ok');
		} catch (e) {
			say('connect', reason(e), 'bad');
			say('hint', 'a 401 here is the cookie or the origin, not the codec', 'warn');
		} finally {
			busy = false;
		}
	}

	/** Sends on the first declared capability, or demonstrates the refusal when
	 *  none was declared — which is the more interesting answer of the two. */
	async function ping() {
		const [first] = caps();
		try {
			await agent?.send(first ?? 'io.armornet.probe', 'ping', '{}');
			say('sent', `${first ?? 'io.armornet.probe'} · ping`, 'ok');
		} catch (e) {
			say('refused', reason(e), first ? 'bad' : 'ok');
		}
	}

	async function hangUp() {
		await agent?.close();
		connected = false;
		say('closed', 'by request', 'dim');
	}
</script>

<div class="wasm-probe">
	<div class="row">
		<button onclick={load} disabled={busy || !!agent}>1 · load</button>
		<button onclick={connect} disabled={busy || !agent || connected}>2 · connect</button>
		<button onclick={ping} disabled={!connected}>3 · send</button>
		<button onclick={hangUp} disabled={!connected}>close</button>
	</div>

	<input
		class="caps"
		bind:value={capsInput}
		placeholder="capabilities, comma separated (blank = connect only)"
	/>

	<div class="log" role="log">
		{#each log as line, i (i)}
			<div class="line">
				<span class="at">{line.at}</span>
				<span class="tag {line.tone}">{line.tag}</span>
				<span class="text">{line.text}</span>
			</div>
		{:else}
			<div class="line empty">nothing yet — start at step 1</div>
		{/each}
	</div>
</div>

<style>
	.wasm-probe {
		display: flex;
		flex-direction: column;
		gap: 6px;
		font-family: var(--font-mono, ui-monospace, monospace);
		font-size: 10px;
	}
	.row {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
	}
	button {
		background: color-mix(in srgb, var(--fg, #d7e0ea) 8%, transparent);
		border: 1px solid color-mix(in srgb, var(--fg, #d7e0ea) 22%, transparent);
		color: inherit;
		border-radius: 3px;
		padding: 3px 7px;
		font: inherit;
		cursor: pointer;
	}
	button:hover:not(:disabled) {
		background: color-mix(in srgb, var(--fg, #d7e0ea) 16%, transparent);
	}
	button:disabled {
		opacity: 0.35;
		cursor: default;
	}
	.caps {
		background: color-mix(in srgb, var(--fg, #d7e0ea) 6%, transparent);
		border: 1px solid color-mix(in srgb, var(--fg, #d7e0ea) 18%, transparent);
		color: inherit;
		border-radius: 3px;
		padding: 3px 6px;
		font: inherit;
	}
	.log {
		max-height: 190px;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 1px;
	}
	.line {
		display: flex;
		gap: 6px;
		align-items: baseline;
		line-height: 1.45;
	}
	.at {
		opacity: 0.4;
		flex: none;
	}
	.tag {
		flex: none;
		min-width: 58px;
	}
	.text {
		word-break: break-word;
		opacity: 0.85;
	}
	.empty {
		opacity: 0.4;
	}
	.ok {
		color: #6ee7b7;
	}
	.bad {
		color: #f87171;
	}
	.warn {
		color: #fbbf24;
	}
	.dim {
		opacity: 0.55;
	}
</style>
