<script lang="ts">
	// ── SceneInspector — one panel, five faces ────────────────────────────────
	// beat · node · edge · component · cue. Which face shows is a function of the
	// selection, never a tab the user has to remember to switch.
	//
	// The placement row is the load-bearing bit of copy in the whole tool: it is
	// where a person learns that some things are placed by the solver and some by
	// them, and that dragging converts one into the other.
	import type { Scene, SceneObject, Beat, Cue } from './types.js';
	import { PLACEMENT_LABEL } from './place.js';
	import { NODE_TYPES, NODE_STATES, EDGE_STYLES, channelById, burstById } from './vocabulary.js';
	import { beatEnd, cueAt } from './state.js';
	import { MESH_LAYOUTS } from '../mesh-studio/layout/mesh-layout.js';
	import { validateScene } from './validate.js';
	import SceneConversation from './SceneConversation.svelte';
	import { serializeScene, sceneBrief } from './serialize.js';
	import { CHANNELS, BURSTS } from './vocabulary.js';
	import { channelsForComponent } from './component-channels.js';
	import PropEditor from '../builder/PropEditor.svelte';
	import { REGISTRY } from '../builder/registry.js';

	let {
		scene = $bindable(),
		selectedObject = null,
		selectedId = null,
		selectedBeat = null,
		selectedCue = null,
		onAddCue,
		onDeleteCue,
		onDeleteObject,
		onUnpin,
		onSelectBeat,
	}: {
		scene: Scene;
		selectedObject?: SceneObject | null;
		/** Raw selection id — the hub selects but resolves to no scene object. */
		selectedId?: string | null;
		selectedBeat?: Beat | null;
		selectedCue?: Cue | null;
		onAddCue?: () => void;
		onDeleteCue?: (id: string) => void;
		onDeleteObject?: (id: string) => void;
		onUnpin?: (id: string) => void;
		onSelectBeat?: (id: string) => void;
	} = $props();

	const census = $derived([
		{ label: 'nodes', n: scene.objects.filter((o) => o.kind === 'mesh.node').length },
		{ label: 'edges', n: scene.objects.filter((o) => o.kind === 'mesh.edge').length },
		{ label: 'components', n: scene.objects.filter((o) => o.kind === 'component').length },
		{ label: 'cues', n: scene.cues.length },
	]);

	let tab = $state<'inspect' | 'handoff'>('inspect');
	let ask = $state('');
	let copied = $state('');
	let styleKey = $state('');
	let styleVal = $state('');
	let patchIn = $state('');
	let patchMsg = $state('');
	let patchBad = $state(false);

	const issues = $derived(validateScene(scene));

	/**
	 * Accept a scene back from an assistant. Tolerant about the wrapper — a reply
	 * is usually a fenced block around `export const SCENE = {...}` — and strict
	 * about the contents: it must parse, and it must validate, or nothing is
	 * applied. Refusing a bad patch loudly beats half-applying one.
	 */
	function applyPatch() {
		patchMsg = '';
		patchBad = false;
		const raw = patchIn.trim().replace(/^```[a-z]*\n?/i, '').replace(/```$/, '');
		const start = raw.indexOf('{');
		const end = raw.lastIndexOf('}');
		if (start < 0 || end <= start) {
			patchBad = true;
			patchMsg = 'Could not find a scene object in that.';
			return;
		}
		let parsed: Scene;
		try {
			// The literal is JS, not JSON (unquoted keys, single quotes), so it is
			// evaluated rather than JSON.parsed. Same trust boundary as pasting into
			// the source file — which is the alternative this replaces.
			parsed = new Function(`return (${raw.slice(start, end + 1)})`)() as Scene;
		} catch (e) {
			patchBad = true;
			patchMsg = `Could not parse: ${(e as Error).message}`;
			return;
		}
		if (!parsed?.beats?.length || !parsed?.objects) {
			patchBad = true;
			patchMsg = 'That parsed, but it has no beats or no objects.';
			return;
		}
		const bad = validateScene(parsed).filter((i) => i.severity === 'error');
		if (bad.length) {
			patchBad = true;
			patchMsg = `Rejected — ${bad.length} error${bad.length > 1 ? 's' : ''}: ${bad[0].message}`;
			return;
		}
		scene = parsed;
		patchIn = '';
		patchMsg = 'Applied.';
	}

	function patchObject(id: string, fn: (o: SceneObject) => void) {
		scene = {
			...scene,
			objects: scene.objects.map((o) => {
				if (o.id !== id) return o;
				const next = {
					...o,
					node: o.node ? { ...o.node } : undefined,
					edge: o.edge ? { ...o.edge } : undefined,
					component: o.component ? { ...o.component } : undefined,
					place: { ...o.place },
				};
				fn(next);
				return next;
			}),
		};
	}

	function patchBeat(id: string, fn: (b: Beat) => void) {
		scene = {
			...scene,
			beats: scene.beats.map((b) => {
				if (b.id !== id) return b;
				const next = { ...b };
				fn(next);
				return next;
			}),
		};
	}

	function patchCue(id: string, fn: (c: Cue) => void) {
		scene = {
			...scene,
			cues: scene.cues.map((c) => {
				if (c.id !== id) return c;
				const next = { ...c };
				fn(next);
				return next;
			}),
		};
	}

	/** Roll: this beat's length changes and the next absorbs it, total fixed. */
	function setBeatDuration(id: string, ms: number) {
		const i = scene.beats.findIndex((b) => b.id === id);
		if (i < 0) return;
		const next = Math.max(1200, Math.round(ms));
		const delta = next - (beatEnd(scene, i) - scene.beats[i].at);
		if (!delta) return;
		if (i === scene.beats.length - 1) {
			scene = { ...scene, runMs: Math.max(scene.beats[i].at + 1200, scene.runMs + delta) };
			return;
		}
		if (beatEnd(scene, i + 1) - (beatEnd(scene, i) + delta) < 1200) return;
		scene = {
			...scene,
			beats: scene.beats.map((b, j) => (j === i + 1 ? { ...b, at: b.at + delta } : b)),
		};
	}

	const describe = (c: { id: string; type: string; options?: string[] }) =>
		`${c.id} (${c.type}${c.options ? `: ${c.options.join('|')}` : ''})`;

	/** Generated prop channels are included ONLY for components actually in the
	 *  scene. Emitting all ~1000 registry channels would bury the ask. */
	const vocabIds = $derived([
		...CHANNELS.map(describe),
		...[...new Set(scene.objects.map((o) => o.component?.componentId).filter(Boolean))].flatMap(
			(id) => channelsForComponent(id as string).map(describe),
		),
		...BURSTS.map((b) => `${b.id} (burst, ≤${b.maxMs}ms)`),
	]);

	async function copy(what: 'scene' | 'brief') {
		const text = what === 'scene' ? serializeScene(scene) : sceneBrief(scene, ask, vocabIds);
		try {
			await navigator.clipboard.writeText(text);
			copied = what;
			setTimeout(() => (copied = ''), 1600);
		} catch {
			copied = 'failed';
			setTimeout(() => (copied = ''), 1600);
		}
	}

	const place = $derived(selectedObject ? PLACEMENT_LABEL[selectedObject.place.mode] : null);
	const cueChannel = $derived(selectedCue?.channel ? channelById(selectedCue.channel) : undefined);
	const cueBurst = $derived(selectedCue?.burst ? burstById(selectedCue.burst) : undefined);
</script>

<div class="ins">
	<div class="tabs">
		<button class:on={tab === 'inspect'} onclick={() => (tab = 'inspect')}>INSPECT</button>
		<button class:on={tab === 'handoff'} onclick={() => (tab = 'handoff')}>HANDOFF</button>
	</div>

	{#if tab === 'handoff'}
		<!-- The conversation is the primary seam; the clipboard is the fallback for
		     when no bridge session is running.
		     DEV-GATED: the spool middleware is `apply: 'serve'`, so the endpoint
		     does not exist in a built SPA — and showcase is embedded in the product
		     binary. `import.meta.env.DEV` is replaced with `false` at build time, so
		     this branch is eliminated rather than shipping a dead fetch. -->
		{#if import.meta.env.DEV}
			<SceneConversation bind:scene />
		{:else}
			<div class="sec">CONVERSATION</div>
			<div class="cap">
				Available on the dev server only — it talks to a local Claude Code session through the
				repo's filesystem spool.
			</div>
		{/if}

		<div class="sec">CLIPBOARD</div>
		<div class="cap">
			For when no bridge session is up: hand the brief to any assistant, or take the scene source to
			paste into <code>sample-scene.ts</code>.
		</div>
		<textarea rows="3" bind:value={ask} placeholder="optional: what you want changed…"></textarea>
		<div class="rowb">
			<button class="btn" onclick={() => copy('brief')}>{copied === 'brief' ? '✓ copied' : 'Copy brief'}</button>
			<button class="btn" onclick={() => copy('scene')}>{copied === 'scene' ? '✓ copied' : 'Copy scene.ts'}</button>
		</div>
		{#if copied === 'failed'}<div class="cap warn">clipboard blocked by the browser</div>{/if}

		<!-- The return leg. Without it this tab is an exporter, not a loop — you
		     could hand work out and never get it back. -->
		<div class="sec">RETURN</div>
		<div class="cap">
			Paste the assistant’s <code>SCENE</code> literal (or raw JSON) back in. It is validated before
			anything is applied.
		</div>
		<textarea rows="5" bind:value={patchIn} placeholder="paste the reply here…"></textarea>
		<div class="rowb">
			<button class="btn" disabled={!patchIn.trim()} onclick={applyPatch}>Parse → apply</button>
		</div>
		{#if patchMsg}<div class="cap" class:warn={patchBad}>{patchMsg}</div>{/if}

		<div class="sec">CHECKS</div>
		{#if !issues.length}
			<div class="cap">No problems found.</div>
		{:else}
			{#each issues as p (p.where + p.message)}
				<div class="issue" class:issue--err={p.severity === 'error'}>
					<b>{p.severity === 'error' ? '✕' : '!'}</b>
					<span>{p.message}</span>
				</div>
			{/each}
		{/if}

	{:else if selectedCue}
		<!-- ── Cue face ─────────────────────────────────────────────────── -->
		<div class="sec">CUE</div>
		<div class="kv"><span>target</span><b>{selectedCue.target}</b></div>
		<div class="kv">
			<span>{selectedCue.burst ? 'burst' : 'channel'}</span>
			<b>{selectedCue.burst ?? selectedCue.channel}</b>
		</div>
		{#if cueBurst}<div class="cap">{cueBurst.hint}</div>{/if}

		{#if cueChannel && cueChannel.type === 'lerp'}
			<div class="rowb">
				<label class="f f--n"><span>from</span>
					<input type="number" step="0.05" value={String(selectedCue.from ?? '')}
						oninput={(e) => patchCue(selectedCue!.id, (c) => (c.from = Number(e.currentTarget.value)))} />
				</label>
				<label class="f f--n"><span>to</span>
					<input type="number" step="0.05" value={String(selectedCue.to ?? '')}
						oninput={(e) => patchCue(selectedCue!.id, (c) => (c.to = Number(e.currentTarget.value)))} />
				</label>
			</div>
		{:else if cueChannel}
			<label class="f"><span>to</span>
				{#if cueChannel.options}
					<select value={String(selectedCue.to ?? '')}
						onchange={(e) => patchCue(selectedCue!.id, (c) => (c.to = e.currentTarget.value))}>
						{#each cueChannel.options as o (o)}<option value={o}>{o}</option>{/each}
					</select>
				{:else}
					<input type="text" value={String(selectedCue.to ?? '')}
						oninput={(e) => patchCue(selectedCue!.id, (c) => (c.to = e.currentTarget.value))} />
				{/if}
			</label>
		{/if}

		<div class="rowb">
			<!-- Editable in BOTH cases. An anchored cue edits its offset from the
			     beat so it keeps travelling with that beat; an absolute one edits its
			     own onset. Disabling this was the only way to retime a cue, gone. -->
			<label class="f f--n">
				<span>{selectedCue.anchor ? 'offset (ms)' : 'onset (ms)'}</span>
				<input
					type="number"
					step="50"
					value={selectedCue.anchor ? selectedCue.anchor.offset : selectedCue.at}
					oninput={(e) =>
						patchCue(selectedCue!.id, (c) => {
							const v = Math.round(+e.currentTarget.value);
							if (c.anchor) c.anchor = { ...c.anchor, offset: v };
							else c.at = Math.max(0, v);
						})}
				/>
			</label>
			<label class="f f--n"><span>dur (ms)</span>
				<input type="number" step="50" value={selectedCue.dur}
					oninput={(e) => patchCue(selectedCue!.id, (c) => (c.dur = Math.max(50, +e.currentTarget.value)))} />
			</label>
		</div>
		<div class="kv"><span>fires at</span><b>{(cueAt(scene, selectedCue) / 1000).toFixed(2)}s</b></div>
		<label class="chk">
			<input
				type="checkbox"
				checked={!!selectedCue.anchor}
				onchange={(e) =>
					patchCue(selectedCue!.id, (c) => {
						if (e.currentTarget.checked) {
							const b = scene.beats[Math.max(0, scene.beats.findIndex((x) => x.at > c.at) - 1)];
							c.anchor = { beatId: b.id, offset: Math.max(0, c.at - b.at) };
						} else {
							c.at = cueAt(scene, c);
							c.anchor = undefined;
						}
					})}
			/>
			<span>anchored to a beat</span>
		</label>

		{#if selectedCue.anchor}
			<div class="cap">
				Travels with <b>{selectedCue.anchor.beatId}</b> when that beat is retimed.
			</div>
		{:else}
			<div class="cap">Absolute — retiming a beat will not move it.</div>
		{/if}
		{#if selectedCue.stagger}
			<div class="cap">Staggered {selectedCue.stagger}ms per target across the matched set.</div>
		{/if}
		<button class="btn btn--warn" onclick={() => onDeleteCue?.(selectedCue!.id)}>Delete cue</button>

	{:else if selectedId === '__hub__'}
		<!-- The crest is scene-level, not a cast member — it has no cues and cannot
		     be deleted — but it is clickable, so it owes the panel a face. -->
		<div class="sec">HUB · the crest</div>
		<div class="cap">
			The fixed point every arrangement is built around. It is not a scene object: it has no cues and
			cannot be removed.
		</div>
		<div class="rowb">
			<label class="f f--n"><span>radius</span>
				<input type="number" step="2" value={scene.hub.r}
					oninput={(e) => (scene = { ...scene, hub: { ...scene.hub, r: Math.max(12, +e.currentTarget.value) } })} />
			</label>
			<label class="f f--n"><span>x</span>
				<input type="number" step="10" value={scene.hub.x}
					oninput={(e) => (scene = { ...scene, hub: { ...scene.hub, x: +e.currentTarget.value } })} />
			</label>
			<label class="f f--n"><span>y</span>
				<input type="number" step="10" value={scene.hub.y}
					oninput={(e) => (scene = { ...scene, hub: { ...scene.hub, y: +e.currentTarget.value } })} />
			</label>
		</div>
		<div class="cap">Moving the crest re-solves every un-pinned node around it.</div>

	{:else if selectedObject}
		<!-- ── Object faces ─────────────────────────────────────────────── -->
		<div class="sec">{selectedObject.kind.replace('mesh.', '').toUpperCase()} · {selectedObject.name}</div>

		<div class="place" title={place?.hint}>
			<span class="pg">{place?.glyph}</span>
			<span class="pl">{place?.label}</span>
			{#if selectedObject.place.mode === 'pinned'}
				<button class="lnk" onclick={() => onUnpin?.(selectedObject!.id)}>release</button>
			{/if}
		</div>
		<div class="cap">{place?.hint}</div>

		{#if selectedObject.node}
			<label class="f"><span>label</span>
				<input type="text" value={selectedObject.node.label}
					oninput={(e) => patchObject(selectedObject!.id, (o) => (o.node!.label = e.currentTarget.value))} />
			</label>
			<div class="rowb">
				<label class="f f--n"><span>type</span>
					<select value={selectedObject.node.type}
						onchange={(e) => patchObject(selectedObject!.id, (o) => (o.node!.type = e.currentTarget.value as never))}>
						{#each NODE_TYPES as t (t)}<option value={t}>{t}</option>{/each}
					</select>
				</label>
				<label class="f f--n"><span>state</span>
					<select value={selectedObject.node.state}
						onchange={(e) => patchObject(selectedObject!.id, (o) => (o.node!.state = e.currentTarget.value as never))}>
						{#each NODE_STATES as s (s)}<option value={s}>{s}</option>{/each}
					</select>
				</label>
			</div>
			<div class="rowb">
				<label class="f f--n"><span>radius</span>
					<input type="number" step="2" value={selectedObject.node.r}
						oninput={(e) => patchObject(selectedObject!.id, (o) => (o.node!.r = +e.currentTarget.value))} />
				</label>
				<label class="f f--n"><span>flow</span>
					<input type="number" step="0.05" min="0" max="1" value={selectedObject.node.flow}
						oninput={(e) => patchObject(selectedObject!.id, (o) => (o.node!.flow = +e.currentTarget.value))} />
				</label>
			</div>
			<div class="cap">These set the BASE value. A cue on the same field overrides it from its onset.</div>
		{/if}

		{#if selectedObject.edge}
			<div class="kv"><span>from</span><b>{selectedObject.edge.from}</b></div>
			<div class="kv"><span>to</span><b>{selectedObject.edge.to}</b></div>
			<label class="f"><span>style</span>
				<select value={selectedObject.edge.style}
					onchange={(e) => patchObject(selectedObject!.id, (o) => (o.edge!.style = e.currentTarget.value as never))}>
					{#each EDGE_STYLES as s (s)}<option value={s}>{s}</option>{/each}
				</select>
			</label>
			<label class="f"><span>signal</span>
				<input type="number" step="0.05" min="0" max="1" value={selectedObject.edge.sig}
					oninput={(e) => patchObject(selectedObject!.id, (o) => (o.edge!.sig = +e.currentTarget.value))} />
			</label>
		{/if}

		{#if selectedObject.component}
			{@const cmeta = REGISTRY.find((r) => r.id === selectedObject!.component!.componentId)}
			<div class="kv"><span>component</span><b>{selectedObject.component.componentId}</b></div>
			<label class="f"><span>width</span>
				<input type="number" step="10" value={selectedObject.component.w}
					oninput={(e) => patchObject(selectedObject!.id, (o) => (o.component!.w = +e.currentTarget.value))} />
			</label>

			{#if cmeta}
				<div class="sec">PROPS</div>
				<!-- The builder's own props form, unmodified. Same PropDef schema drives
				     this, the builder's panel, AND the animatable channel list — so what
				     you can set here is exactly what you can animate. -->
				<div class="pe">
					<PropEditor
						meta={cmeta}
						values={selectedObject.component.props}
						onchange={(key, value) =>
							patchObject(selectedObject!.id, (o) => {
								o.component!.props = { ...o.component!.props, [key]: value };
							})}
					/>
				</div>
				<div class="cap">
					These are BASE values. A cue on the same prop overrides it from its onset — select this
					component and press <b>A</b>.
				</div>
			{/if}

			<div class="sec">STYLE OVERRIDES</div>
			<div class="cap">
				Raw CSS on the rendered component — the escape hatch for anything its props don’t expose.
				Same plumbing as the builder’s per-item overrides.
			</div>
			{#each Object.entries(selectedObject.component.styleOverrides ?? {}) as [k, v] (k)}
				<div class="rowb">
					<input class="mono" type="text" value={k} readonly />
					<input
						class="mono"
						type="text"
						value={v}
						oninput={(e) =>
							patchObject(selectedObject!.id, (o) => {
								o.component!.styleOverrides = { ...o.component!.styleOverrides, [k]: e.currentTarget.value };
							})}
					/>
					<button
						class="lnk"
						onclick={() =>
							patchObject(selectedObject!.id, (o) => {
								const next = { ...o.component!.styleOverrides };
								delete next[k];
								o.component!.styleOverrides = Object.keys(next).length ? next : undefined;
							})}>✕</button
					>
				</div>
			{/each}
			<div class="rowb">
				<input class="mono" type="text" placeholder="border" bind:value={styleKey} />
				<input class="mono" type="text" placeholder="1px solid #5fead4" bind:value={styleVal} />
				<button
					class="lnk"
					disabled={!styleKey.trim()}
					onclick={() => {
						const k = styleKey.trim();
						const v = styleVal.trim();
						if (!k) return;
						patchObject(selectedObject!.id, (o) => {
							o.component!.styleOverrides = { ...o.component!.styleOverrides, [k]: v };
						});
						styleKey = '';
						styleVal = '';
					}}>add</button
				>
			</div>
		{/if}

		<div class="rowb">
			<button class="btn" onclick={() => onAddCue?.()}>+ Add cue (A)</button>
			<button class="btn btn--warn" onclick={() => onDeleteObject?.(selectedObject!.id)}>Delete</button>
		</div>

	{:else if selectedBeat}
		<!-- ── Beat face ────────────────────────────────────────────────── -->
		{@const i = scene.beats.findIndex((b) => b.id === selectedBeat!.id)}
		<div class="sec">BEAT {i + 1} / {scene.beats.length}</div>
		<label class="f"><span>caption</span>
			<textarea rows="2" value={selectedBeat.caption}
				oninput={(e) => patchBeat(selectedBeat!.id, (b) => (b.caption = e.currentTarget.value))}></textarea>
		</label>
		<label class="f"><span>sub</span>
			<textarea rows="2" value={selectedBeat.sub ?? ''} placeholder="(none)"
				oninput={(e) => patchBeat(selectedBeat!.id, (b) => (b.sub = e.currentTarget.value || undefined))}></textarea>
		</label>
		<div class="rowb">
			<label class="f f--n"><span>at (ms)</span>
				<input type="number" step="100" value={selectedBeat.at} disabled={i === 0}
					oninput={(e) => patchBeat(selectedBeat!.id, (b) => (b.at = Math.max(0, +e.currentTarget.value)))} />
			</label>
			<label class="f f--n"><span>dur (ms)</span>
				<input type="number" step="100" value={beatEnd(scene, i) - selectedBeat.at}
					oninput={(e) => setBeatDuration(selectedBeat!.id, +e.currentTarget.value)} />
			</label>
		</div>
		<div class="cap">Duration rolls into the next beat — the run length stays put.</div>
		<label class="chk">
			<input type="checkbox" checked={selectedBeat.spin}
				onchange={(e) => patchBeat(selectedBeat!.id, (b) => (b.spin = e.currentTarget.checked))} />
			<span>spin the globe through this beat</span>
		</label>
		<div class="sec">CAMERA</div>
		<div class="rowb">
			<label class="chk chk--r">
				<input type="radio" checked={selectedBeat.camera.kind === 'fit'}
					onchange={() => patchBeat(selectedBeat!.id, (b) => (b.camera = { kind: 'fit' }))} />
				<span>fit all</span>
			</label>
			<label class="chk chk--r">
				<input type="radio" checked={selectedBeat.camera.kind === 'flyTo'}
					onchange={() => patchBeat(selectedBeat!.id, (b) => (b.camera = { kind: 'flyTo', target: scene.objects[0]?.id ?? '', zoom: 1.4 }))} />
				<span>fly to</span>
			</label>
		</div>
		{#if selectedBeat.camera.kind === 'flyTo'}
			<label class="f"><span>target</span>
				<select value={selectedBeat.camera.target}
					onchange={(e) => patchBeat(selectedBeat!.id, (b) => { if (b.camera.kind === 'flyTo') b.camera = { ...b.camera, target: e.currentTarget.value }; })}>
					{#each scene.objects.filter((o) => o.kind !== 'mesh.edge') as o (o.id)}
						<option value={o.id}>{o.name}</option>
					{/each}
				</select>
			</label>
		{/if}

	{:else}
		<!-- Nothing selected is not nothing to show: this is the scene face, and it
		     is where run length and the cast census belong. -->
		<div class="sec">SCENE</div>
		<label class="f"><span>label</span>
			<input type="text" value={scene.label}
				oninput={(e) => (scene = { ...scene, label: e.currentTarget.value })} />
		</label>
		<div class="rowb">
			<label class="f f--n"><span>run (s)</span>
				<input type="number" step="0.5" min="1" value={(scene.runMs / 1000).toFixed(1)}
					oninput={(e) => (scene = { ...scene, runMs: Math.max(2000, +e.currentTarget.value * 1000) })} />
			</label>
			<label class="f f--n"><span>arrangement</span>
				<select value={scene.layout}
					onchange={(e) => (scene = { ...scene, layout: e.currentTarget.value as Scene['layout'] })}>
					{#each MESH_LAYOUTS as l (l.id)}<option value={l.id}>{l.label}</option>{/each}
				</select>
			</label>
		</div>

		<div class="sec">CAST</div>
		{#each census as c (c.label)}
			<div class="kv"><span>{c.label}</span><b>{c.n}</b></div>
		{/each}

		<div class="sec">BEATS</div>
		{#each scene.beats as b, i (b.id)}
			<button class="beatrow" onclick={() => onSelectBeat?.(b.id)}>
				<span class="beatrow-n">{i + 1}</span>
				<span class="beatrow-c">{b.caption}</span>
				<span class="beatrow-t">{(b.at / 1000).toFixed(1)}s</span>
			</button>
		{/each}

		<div class="cap">
			Select a beat, a lane, or something on the canvas to inspect it. Press <b>A</b> with an object
			selected to add a cue.
		</div>
	{/if}
</div>

<style>
	.ins {
		width: 19rem;
		flex: none;
		overflow-y: auto;
		padding: 0 0.7rem 2rem;
		border-left: 1px solid rgba(255, 255, 255, 0.12);
		background: rgba(5, 7, 12, 0.6);
		font-size: 0.7rem;
		color: var(--fg);
	}
	.tabs {
		display: flex;
		gap: 0.3rem;
		position: sticky;
		top: 0;
		padding: 0.5rem 0 0.4rem;
		background: rgba(5, 7, 12, 0.96);
		z-index: 2;
	}
	.tabs button {
		flex: 1;
		padding: 0.25rem;
		border: 1px solid rgba(255, 255, 255, 0.14);
		border-radius: 0.25rem;
		background: transparent;
		color: var(--fg-dim);
		cursor: pointer;
		font: inherit;
		font-size: 0.58rem;
		letter-spacing: 0.12em;
	}
	.tabs button.on {
		border-color: var(--accent);
		color: var(--accent);
	}
	.sec {
		margin: 0.7rem 0 0.35rem;
		padding-bottom: 0.15rem;
		font-size: 0.55rem;
		letter-spacing: 0.16em;
		color: var(--accent);
		border-bottom: 1px solid rgba(255, 255, 255, 0.1);
	}
	.kv {
		display: flex;
		justify-content: space-between;
		gap: 0.5rem;
		padding: 0.12rem 0;
		font-size: 0.66rem;
	}
	.kv span {
		color: var(--fg-dim);
	}
	.kv b {
		font-family: var(--mono);
		font-weight: 500;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.place {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		margin: 0.3rem 0 0.2rem;
		padding: 0.28rem 0.4rem;
		border: 1px dashed rgba(255, 255, 255, 0.2);
		border-radius: 0.3rem;
	}
	.pg {
		font-size: 0.8rem;
	}
	.pl {
		font-size: 0.58rem;
		letter-spacing: 0.14em;
		color: var(--fg-dim);
	}
	.f {
		display: block;
		margin-bottom: 0.35rem;
	}
	.f > span {
		display: block;
		font-size: 0.55rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--fg-dim);
		margin-bottom: 0.12rem;
	}
	.f--n {
		flex: 1;
	}
	.rowb {
		display: flex;
		gap: 0.4rem;
		align-items: flex-end;
		margin-bottom: 0.3rem;
	}
	input,
	select,
	textarea {
		width: 100%;
		padding: 0.26rem 0.3rem;
		border: 1px solid rgba(255, 255, 255, 0.16);
		border-radius: 0.25rem;
		background: rgba(255, 255, 255, 0.04);
		color: inherit;
		font: inherit;
		font-size: 0.68rem;
		resize: vertical;
	}
	input[type='checkbox'],
	input[type='radio'] {
		width: auto;
	}
	.chk {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		margin: 0.3rem 0;
		cursor: pointer;
	}
	.chk--r {
		flex: 1;
	}
	.cap {
		font-size: 0.58rem;
		line-height: 1.45;
		color: var(--fg-dim);
		margin: 0.2rem 0 0.4rem;
	}
	.cap code,
	.cap b {
		font-family: var(--mono);
		color: var(--fg);
		font-weight: 500;
	}
	.warn {
		color: #fbbf24;
	}
	.btn {
		flex: 1;
		padding: 0.32rem 0.4rem;
		border: 1px solid rgba(95, 234, 212, 0.4);
		border-radius: 0.3rem;
		background: rgba(95, 234, 212, 0.1);
		color: var(--accent);
		cursor: pointer;
		font: inherit;
		font-size: 0.62rem;
	}
	.btn--warn {
		border-color: rgba(251, 191, 36, 0.4);
		background: rgba(251, 191, 36, 0.08);
		color: #fbbf24;
	}
	.lnk {
		margin-left: auto;
		border: none;
		background: none;
		padding: 0;
		color: var(--accent);
		cursor: pointer;
		font: inherit;
		font-size: 0.58rem;
		text-decoration: underline;
	}
	.lnk:disabled {
		opacity: 0.4;
		cursor: default;
	}
	.mono {
		font-family: var(--mono);
		font-size: 0.62rem;
	}
	.issue {
		display: flex;
		gap: 0.35rem;
		align-items: baseline;
		padding: 0.22rem 0.3rem;
		margin-bottom: 2px;
		border-radius: 0.25rem;
		background: rgba(251, 191, 36, 0.08);
		font-size: 0.58rem;
		line-height: 1.4;
		color: #fbbf24;
	}
	.issue--err {
		background: rgba(248, 113, 113, 0.1);
		color: #f87171;
	}
	.issue b {
		flex: none;
	}
	.beatrow {
		display: flex;
		align-items: baseline;
		gap: 0.4rem;
		width: 100%;
		padding: 0.22rem 0.3rem;
		margin-bottom: 2px;
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 0.25rem;
		background: rgba(255, 255, 255, 0.03);
		color: inherit;
		cursor: pointer;
		font: inherit;
		font-size: 0.62rem;
		text-align: left;
	}
	.beatrow:hover {
		border-color: var(--accent);
	}
	.beatrow-n {
		font-weight: 700;
		color: var(--accent);
	}
	.beatrow-c {
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.beatrow-t {
		font-family: var(--mono);
		color: var(--fg-dim);
	}
	/* The builder's PropEditor ships its own layout; give it room and let it be. */
	.pe {
		margin: 0 -0.2rem 0.3rem;
	}
</style>
