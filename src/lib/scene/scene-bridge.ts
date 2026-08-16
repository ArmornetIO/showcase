// ── scene-bridge — talking to a local Claude Code session ──────────────────
// Submit-then-poll, deliberately mirroring `internal/riskimport`'s transport
// shape (submit returns an id; poll reports pending/done) — but over the dev
// filesystem spool instead of OpAMP, because this is an internal authoring tool
// and there is no tenant agent to route to.
//
// The request written to the spool is byte-identical to what the Go `bridge`
// provider writes, so the backgrounded `armornet-bridge` skill serves this
// without modification.

import type { Scene } from './types.js';
import { serializeScene } from './serialize.js';
import { CHANNELS, BURSTS } from './vocabulary.js';
import { channelsForComponent } from './component-channels.js';

export interface BridgeMessage {
	role: 'user' | 'assistant';
	content: string;
}

const BASE = '/__scene-bridge';

export async function submit(messages: BridgeMessage[]): Promise<string> {
	const r = await fetch(`${BASE}/submit`, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ messages }),
	});
	if (!r.ok) throw new Error(`bridge submit failed (${r.status}) — is the dev server running?`);
	return (await r.json()).id as string;
}

export async function poll(id: string): Promise<{ done: boolean; reply?: string }> {
	const r = await fetch(`${BASE}/result?id=${encodeURIComponent(id)}`);
	if (!r.ok) throw new Error(`bridge poll failed (${r.status})`);
	return r.json();
}

export async function cancel(id: string): Promise<void> {
	await fetch(`${BASE}/cancel?id=${encodeURIComponent(id)}`, { method: 'POST' }).catch(() => {});
}

/** Wait for a reply, polling at the same cadence the Go provider uses. */
export async function await_(id: string, signal?: AbortSignal): Promise<string> {
	for (;;) {
		if (signal?.aborted) {
			await cancel(id);
			throw new Error('cancelled');
		}
		const { done, reply } = await poll(id);
		if (done) return reply ?? '';
		await new Promise((r) => setTimeout(r, 500));
	}
}

/**
 * The contract the brain is held to. Sent once as the opening turn so the rest
 * of the conversation can be plain English.
 *
 * Enumerating the legal vocabulary is the highest-return part of this string —
 * an assistant that knows `blocked` is a legal edge style and `severed` is not
 * writes a patch that applies on the first try. Same reasoning as
 * `internal/riskimport`, which validates the model's targets against the real
 * catalog rather than trusting them.
 */
export function contractFor(scene: Scene): string {
	const describe = (c: { id: string; type: string; options?: string[] }) =>
		`${c.id} (${c.type}${c.options ? `: ${c.options.join('|')}` : ''})`;
	const componentChannels = [
		...new Set(scene.objects.map((o) => o.component?.componentId).filter(Boolean)),
	].flatMap((id) => channelsForComponent(id as string).map(describe));

	return `You are the authoring assistant for the armornet SCENE BUILDER, an internal tool for hand-made short animations. The user will ask for changes in plain English.

HOW TO REPLY
- Answer conversationally in one or two sentences.
- If (and only if) the ask requires changing the scene, ALSO include the complete updated scene as a single \`\`\`ts fenced block containing just the object literal (starting with \`{\` and ending with \`}\`). The tool parses that block and validates it before applying; anything invalid is rejected whole.
- If the ask is a question, just answer it — no code block.

RULES
- Object, beat and cue ids are stable. Reference them; never renumber.
- A cue anchored to a beat uses \`anchor: { beatId, offset }\` and travels when that beat is retimed. An absolute cue uses \`at\`.
- A channel cue needs \`channel\` and \`to\` (plus \`from\` for lerps). A burst cue needs \`burst\`.
- Every visible thing is a pure function of time. Do not invent fields.

LEGAL CHANNELS
${CHANNELS.map(describe).join('\n')}
${componentChannels.length ? componentChannels.join('\n') + '\n' : ''}
LEGAL BURSTS
${BURSTS.map((b) => `${b.id} (burst, <= ${b.maxMs}ms)`).join('\n')}

CURRENT SCENE
\`\`\`ts
${serializeScene(scene)}\`\`\``;
}

/** Pull a scene literal out of a conversational reply, if it carried one. */
export function extractScene(reply: string): string | null {
	const fenced = reply.match(/```(?:ts|typescript|js|json)?\s*([\s\S]*?)```/);
	const body = fenced ? fenced[1] : reply;
	const start = body.indexOf('{');
	const end = body.lastIndexOf('}');
	if (start < 0 || end <= start) return null;
	return body.slice(start, end + 1);
}
