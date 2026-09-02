<script lang="ts">
	// ── SceneConversation — talk to the scene ─────────────────────────────────
	// A conversation, not a one-shot button. Scene work is iterative — "tighten
	// that", "now make it urgent", "undo the last bit" — and a fire-and-forget
	// ask throws away the context that makes the second request cheap.
	//
	// The assistant is a local Claude Code session reached through the dev
	// filesystem spool, so this costs no API tokens and needs no key.
	//
	// A reply that carries a scene is NEVER auto-applied: it is parsed, validated,
	// and offered. `internal/riskimport` calls its equivalent step
	// "server-authoritative" and drops anything the model invented; this is the
	// same instinct, and it is what makes accepting a patch safe rather than
	// hopeful.
	import type { Scene } from './types.js';
	import { validateScene, type Issue } from './validate.js';
	import { submit, await_, contractFor, extractScene, type BridgeMessage } from './scene-bridge.js';

	let { scene = $bindable() }: { scene: Scene } = $props();

	interface Turn {
		role: 'user' | 'assistant';
		text: string;
		/** A parsed, validated scene this turn is offering. */
		offer?: Scene;
		issues?: Issue[];
		rejected?: string;
	}

	let turns = $state<Turn[]>([]);
	let draft = $state('');
	let busy = $state(false);
	let error = $state('');
	let controller: AbortController | null = null;

	/** The contract rides on the first turn only; after that the brain has it. */
	function wire(): BridgeMessage[] {
		const out: BridgeMessage[] = [{ role: 'user', content: contractFor(scene) }];
		for (const t of turns) out.push({ role: t.role, content: t.text });
		return out;
	}

	async function send() {
		const text = draft.trim();
		if (!text || busy) return;
		draft = '';
		error = '';
		turns = [...turns, { role: 'user', text }];
		busy = true;
		controller = new AbortController();
		try {
			const id = await submit(wire());
			const reply = await await_(id, controller.signal);
			const turn: Turn = { role: 'assistant', text: stripCode(reply) };

			const literal = extractScene(reply);
			if (literal) {
				try {
					// The literal is JS, not JSON (unquoted keys, single quotes), so it
					// is evaluated. Same trust boundary as pasting it into the source
					// file by hand, which is the alternative this replaces.
					const parsed = new Function(`return (${literal})`)() as Scene;
					const issues = validateScene(parsed);
					const errs = issues.filter((i) => i.severity === 'error');
					if (errs.length) turn.rejected = `${errs.length} error(s): ${errs[0].message}`;
					else {
						turn.offer = parsed;
						turn.issues = issues;
					}
				} catch (e) {
					turn.rejected = `could not parse the scene it returned: ${(e as Error).message}`;
				}
			}
			turns = [...turns, turn];
		} catch (e) {
			error = (e as Error).message;
		} finally {
			busy = false;
			controller = null;
		}
	}

	/** Keep the prose, drop the literal — the diff is what the Apply button is for. */
	function stripCode(s: string): string {
		return s.replace(/```[\s\S]*?```/g, '').trim() || '(scene updated)';
	}

	function apply(t: Turn) {
		if (!t.offer) return;
		scene = t.offer;
		t.offer = undefined;
		turns = [...turns, { role: 'assistant', text: '✓ Applied.' }];
	}

	function stop() {
		controller?.abort();
	}
</script>

<div class="sec">CONVERSATION</div>
<div class="cap">
	Talks to a local Claude Code session over the dev spool — no API key, no tokens. Start the
	<code>armornet-bridge</code> skill in a background session to answer.
</div>

<div class="log">
	{#each turns as t, i (i)}
		<div class="turn turn--{t.role}">
			<span class="who">{t.role === 'user' ? 'you' : 'claude'}</span>
			<div class="body">
				{t.text}
				{#if t.rejected}
					<div class="verdict verdict--bad">Rejected — {t.rejected}</div>
				{/if}
				{#if t.offer}
					<div class="verdict">
						Proposes a scene change.
						{#if t.issues?.length}
							<span class="warn">{t.issues.length} warning(s)</span>
						{/if}
					</div>
					<button class="btn" onclick={() => apply(t)}>Apply</button>
				{/if}
			</div>
		</div>
	{/each}
	{#if busy}
		<div class="turn turn--assistant">
			<span class="who">claude</span>
			<div class="body dim">thinking… <button class="lnk" onclick={stop}>cancel</button></div>
		</div>
	{/if}
	{#if !turns.length && !busy}
		<div class="cap">
			Try: “tighten the reroute — make beat 3 a second shorter and add a sparkle on the proxy”.
		</div>
	{/if}
</div>

{#if error}<div class="cap warn">{error}</div>{/if}

<textarea
	rows="3"
	bind:value={draft}
	placeholder="ask for a change…"
	disabled={busy}
	onkeydown={(e) => {
		if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
			e.preventDefault();
			send();
		}
	}}
></textarea>
<div class="rowb">
	<button class="btn" disabled={busy || !draft.trim()} onclick={send}>Send (⌘⏎)</button>
	{#if turns.length}
		<button class="lnk" onclick={() => (turns = [])}>clear</button>
	{/if}
</div>

<style>
	.sec {
		margin: 0.7rem 0 0.35rem;
		padding-bottom: 0.15rem;
		font-size: 0.55rem;
		letter-spacing: 0.16em;
		color: var(--accent);
		border-bottom: 1px solid rgba(255, 255, 255, 0.1);
	}
	.cap {
		font-size: 0.58rem;
		line-height: 1.45;
		color: var(--fg-dim);
		margin: 0.2rem 0 0.4rem;
	}
	.cap code {
		font-family: var(--mono);
		color: var(--fg);
	}
	.warn {
		color: #fbbf24;
	}
	.log {
		max-height: 18rem;
		overflow-y: auto;
		margin-bottom: 0.4rem;
	}
	.turn {
		display: flex;
		gap: 0.4rem;
		margin-bottom: 0.45rem;
		font-size: 0.64rem;
		line-height: 1.45;
	}
	.who {
		flex: none;
		width: 3rem;
		font-size: 0.52rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--fg-dim);
		padding-top: 0.1rem;
	}
	.turn--user .who {
		color: var(--accent);
	}
	.body {
		flex: 1;
		min-width: 0;
		white-space: pre-wrap;
		word-break: break-word;
	}
	.dim {
		color: var(--fg-dim);
	}
	.verdict {
		margin-top: 0.25rem;
		font-size: 0.56rem;
		color: var(--fg-dim);
	}
	.verdict--bad {
		color: #f87171;
	}
	textarea {
		width: 100%;
		padding: 0.3rem 0.35rem;
		border: 1px solid rgba(255, 255, 255, 0.16);
		border-radius: 0.25rem;
		background: rgba(255, 255, 255, 0.04);
		color: inherit;
		font: inherit;
		font-size: 0.66rem;
		resize: vertical;
	}
	.rowb {
		display: flex;
		gap: 0.4rem;
		align-items: center;
		margin: 0.3rem 0;
	}
	.btn {
		padding: 0.3rem 0.6rem;
		border: 1px solid rgba(95, 234, 212, 0.4);
		border-radius: 0.3rem;
		background: rgba(95, 234, 212, 0.1);
		color: var(--accent);
		cursor: pointer;
		font: inherit;
		font-size: 0.62rem;
	}
	.btn:disabled {
		opacity: 0.4;
		cursor: default;
	}
	.lnk {
		border: none;
		background: none;
		padding: 0;
		color: var(--accent);
		cursor: pointer;
		font: inherit;
		font-size: 0.58rem;
		text-decoration: underline;
	}
</style>
