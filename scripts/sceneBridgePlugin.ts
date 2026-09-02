/**
 * Dev-only Vite middleware that lets the scene builder talk to a local Claude
 * Code session through the SAME filesystem spool the agent's `bridge` provider
 * uses (`agent/provider/bridge/provider.go`).
 *
 * There is no server and no API key. The spool is a directory:
 *
 *   showcase (browser) ──POST /__scene-bridge/submit──▶ .armornet/bridge/inbox/<id>.json
 *                      ◀─GET  /__scene-bridge/result──  .armornet/bridge/outbox/<id>.json
 *
 * A backgrounded Claude session running the `armornet-bridge` skill watches the
 * inbox, composes the reply, and writes the outbox file. Because the request
 * shape here is byte-identical to the Go provider's (`intent` / `model` /
 * `messages`), that same brain serves the scene builder with no changes — this
 * adds a caller, not a protocol.
 *
 * DEV ONLY BY CONSTRUCTION: `configureServer` runs on the Vite dev server, which
 * does not exist in the built static SPA. There is nothing to disable in prod
 * because there is nothing to ship.
 */

import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, rmSync, writeFileSync, renameSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import type { Plugin } from 'vite';

/** Repo root is showcase/.. — the spool path the Go provider defaults to. */
const SPOOL = resolve(process.cwd(), '..', '.armornet', 'bridge');

interface BridgeMessage {
	role: string;
	content: string;
}

function readBody(req: NodeJS.ReadableStream): Promise<string> {
	return new Promise((res, rej) => {
		let buf = '';
		req.on('data', (c) => (buf += c));
		req.on('end', () => res(buf));
		req.on('error', rej);
	});
}

/** tmp + rename, so the watcher never reads a half-written request. */
function writeAtomic(path: string, data: string) {
	mkdirSync(dirname(path), { recursive: true });
	const tmp = `${path}.tmp`;
	writeFileSync(tmp, data, 'utf8');
	renameSync(tmp, path);
}

export function sceneBridgePlugin(): Plugin {
	return {
		name: 'scene-bridge',
		apply: 'serve',
		configureServer(server) {
			server.middlewares.use('/__scene-bridge', async (req, res) => {
				const url = new URL(req.url ?? '/', 'http://localhost');
				const send = (code: number, body: unknown) => {
					res.statusCode = code;
					res.setHeader('content-type', 'application/json');
					res.end(JSON.stringify(body));
				};

				try {
					if (url.pathname === '/submit' && req.method === 'POST') {
						const { messages, model } = JSON.parse(await readBody(req)) as {
							messages: BridgeMessage[];
							model?: string;
						};
						if (!Array.isArray(messages) || !messages.length) {
							return send(400, { error: 'messages required' });
						}
						const id = `scene-${Date.now()}-${randomUUID().slice(0, 8)}`;
						writeAtomic(
							join(SPOOL, 'inbox', `${id}.json`),
							JSON.stringify(
								{ intent: 'infer', model: model ?? 'scene-builder', messages },
								null,
								2,
							),
						);
						return send(200, { id, spool: SPOOL });
					}

					if (url.pathname === '/result' && req.method === 'GET') {
						const id = url.searchParams.get('id');
						if (!id) return send(400, { error: 'id required' });
						const out = join(SPOOL, 'outbox', `${id}.json`);
						if (!existsSync(out)) return send(200, { done: false });
						let parsed: { reply?: string };
						try {
							parsed = JSON.parse(readFileSync(out, 'utf8'));
						} catch {
							// Present but unparseable is almost certainly mid-write.
							return send(200, { done: false });
						}
						// Consume both sides, exactly as the Go provider does.
						rmSync(out, { force: true });
						rmSync(join(SPOOL, 'inbox', `${id}.json`), { force: true });
						return send(200, { done: true, reply: parsed.reply ?? '' });
					}

					if (url.pathname === '/cancel' && req.method === 'POST') {
						const id = new URL(req.url ?? '/', 'http://localhost').searchParams.get('id');
						if (id) rmSync(join(SPOOL, 'inbox', `${id}.json`), { force: true });
						return send(200, { ok: true });
					}

					send(404, { error: 'not found' });
				} catch (e) {
					send(500, { error: (e as Error).message });
				}
			});
		},
	};
}
