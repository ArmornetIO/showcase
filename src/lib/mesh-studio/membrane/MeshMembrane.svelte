<script lang="ts" module>
	import type { NodeState } from '../../primitives/canvas/canvas.types.js';

	export interface MembraneRegistry {
		id: string;
		label: string;
		/** Ecosystem key drives the palette + upstream match (npm/pip/go/docker/git). */
		kind?: string;
	}
	export interface MembraneProxy {
		id: string;
		label: string;
		kind?: string;
		policy?: 'block' | 'warn' | 'log';
		enabled?: boolean;
		agentCount?: number;
		/** How many proxy configs / rules this guard rolls up (for grouped views). */
		count?: number;
	}
	export interface MembraneAgent {
		id: string;
		label: string;
		status?: NodeState;
	}
	/**
	 * A third-party vendor the mesh monitors. Vendors are *intermediary* nodes:
	 * threat feeds flow in from the world, the vendor agent watches each vendor
	 * against them, and the assessment verdict flows on to the core. `status`
	 * drives the vendor→agent link treatment (approved = clean verdict, in_review
	 * = scanning, unassessed = latent, critical = a red blind-spot edge to core).
	 */
	export type VendorStatus = 'approved' | 'in_review' | 'unassessed' | 'critical';
	export interface MembraneVendor {
		id: string;
		label: string;
		status?: VendorStatus;
	}
</script>

<script lang="ts">
	import Canvas from '../../primitives/canvas/Canvas.svelte';
	import MeshStudio from '../MeshStudio.svelte';
	import type { StudioNode, StudioEdge } from '../studio.types.js';
	import Icon, { ICONS } from '../../icons/Icon.svelte';
	import type { IconName } from '../../icons/Icon.svelte';
	import CountUp from '../../display/metric/CountUp.svelte';
	import type { MeshNodeType } from '../../primitives/canvas/canvas.types.js';
	import {
		solveMeshLayout,
		MESH_LAYOUTS,
		type MeshLayoutId,
		type MeshLayoutOption
	} from '../layout/mesh-layout.js';
	import MeshLayoutPicker from '../layout/MeshLayoutPicker.svelte';
	import { packSphere, spin, project } from '../../physics/sphere.js';

	/**
	 * MeshMembrane — an ambient, non-interactive "security frontier" canvas:
	 * untrusted world (package registries) → the mesh membrane (proxies + agents) →
	 * protected core. Nodes boot in a world→core cascade, edges ignite into energy
	 * flow after the nodes settle, block-policy proxies periodically flare, and
	 * SEEN / BLOCKED / ALLOWED telemetry counts up on the glass.
	 *
	 * Ambient recipe: no pan/zoom, no camera, no node-select — it watches, it does
	 * not invite operation. Follows the ArchCanvas pattern (full composition, not a
	 * builder widget).
	 */
	interface Props {
		registries?: MembraneRegistry[];
		proxies?: MembraneProxy[];
		agents?: MembraneAgent[];
		/** Third-party vendors monitored via threat feeds + the vendor agent. */
		vendors?: MembraneVendor[];
		/** Label for the auto-added vendor-agent node. Default 'VENDOR AGENT'. */
		vendorAgentLabel?: string;
		/** Label for the auto-added threat-feeds source node. Default 'THREAT FEEDS'. */
		threatFeedLabel?: string;
		coreLabel?: string;
		coreValue?: string;
		/** Telemetry counters printed over the canvas. */
		seen?: number;
		blocked?: number;
		allowed?: number;
		showTelemetry?: boolean;
		/** Boot cascade + count-up on mount. Default true. */
		animate?: boolean;
		/** Periodic block-flares once settled. Default true. */
		ambient?: boolean;
		/** Enables hover preview + click detail card. Default false (pure ambient). */
		interactive?: boolean;
		/** CSS height of the hero. */
		height?: string;
		/**
		 * Node arrangement. 'membrane' (default) is the native left→right trust-
		 * gradient pipeline (world → guards → core in fixed columns). The other five
		 * are the SAME options the agent-management mesh offers — 'grouped', 'packed',
		 * 'radial', 'fan' and 'globe' — all arranged around the protected-core crest.
		 * Bindable, so a picker can drive it. */
		layout?: 'membrane' | MeshLayoutId;
		/** Show the arrangement picker docked over the canvas (drives `layout`). */
		showLayoutPicker?: boolean;
	}

	let {
		registries = [],
		proxies = [],
		agents = [],
		vendors = [],
		vendorAgentLabel = 'VENDOR AGENT',
		threatFeedLabel = 'THREAT FEEDS',
		coreLabel = 'CONTROL PLANE',
		coreValue,
		seen = 0,
		blocked = 0,
		allowed = 0,
		showTelemetry = true,
		animate = true,
		ambient = true,
		interactive = false,
		height = 'clamp(340px, 46vh, 520px)',
		layout = $bindable('membrane'),
		showLayoutPicker = false
	}: Props = $props();

	// The picker offers the native pipeline plus the five shared mesh arrangements.
	const layoutOptions = [
		{ id: 'membrane', label: 'Pipeline', hint: 'Trust pipeline — world → guards → core in columns' },
		...MESH_LAYOUTS
	] as MeshLayoutOption[];

	// ── Ecosystem palette (shared with the supply-chain topology) ──────────────
	const ECO_STROKE: Record<string, string> = {
		npm: '#FB923C',
		pip: '#38BDF8',
		go: '#5FEAD5',
		docker: '#60A5FA',
		git: '#A78BFA',
		mirror: '#6EE7B7'
	};
	const ECO_GLOW: Record<string, string> = {
		npm: 'rgba(251,146,60,0.7)',
		pip: 'rgba(56,189,248,0.7)',
		go: 'rgba(95,234,213,0.7)',
		docker: 'rgba(96,165,250,0.7)',
		git: 'rgba(167,139,250,0.7)',
		mirror: 'rgba(110,231,183,0.7)'
	};
	const ECO_FILL: Record<string, string> = {
		npm: 'rgba(251,146,60,0.1)',
		pip: 'rgba(56,189,248,0.1)',
		go: 'rgba(95,234,213,0.1)',
		docker: 'rgba(96,165,250,0.1)',
		git: 'rgba(167,139,250,0.1)',
		mirror: 'rgba(110,231,183,0.1)'
	};
	const stroke = (k?: string) => ECO_STROKE[k ?? ''] ?? '#6EE7B7';
	const glow = (k?: string) => ECO_GLOW[k ?? ''] ?? 'rgba(110,231,183,0.7)';
	const fill = (k?: string) => ECO_FILL[k ?? ''] ?? 'rgba(110,231,183,0.1)';

	// Layered "planes" drawn behind a guard that rolls up multiple configs/rules —
	// three offset colours, purely to signal "multiple layers here".
	const STACK_PLANES = ['#5FEAD5', '#60A5FA', '#A78BFA'];

	// ── Vendor status → stroke / edge treatment ──────────────────────────────────
	// approved: clean teal verdict · in_review: amber scan · unassessed: dim latent
	// · critical: red blind spot (an unmonitored path reaching the core).
	const VENDOR_STROKE: Record<VendorStatus, string> = {
		approved: '#5FEAD5',
		in_review: '#FBBF24',
		unassessed: '#71717a',
		critical: '#f87171'
	};
	const VENDOR_FILL: Record<VendorStatus, string> = {
		approved: 'rgba(95,234,213,0.1)',
		in_review: 'rgba(251,191,36,0.1)',
		unassessed: 'rgba(113,113,122,0.08)',
		critical: 'rgba(248,113,113,0.1)'
	};
	const VENDOR_EDGE: Record<VendorStatus, 'energy' | 'scanning' | 'latent' | 'blocked'> = {
		approved: 'energy',
		in_review: 'scanning',
		unassessed: 'latent',
		critical: 'blocked'
	};
	const VENDOR_STATE: Record<VendorStatus, NodeState> = {
		approved: 'healthy',
		in_review: 'degraded',
		unassessed: 'offline',
		critical: 'degraded'
	};
	const VENDOR_SLOT: Record<VendorStatus, string> = {
		approved: 'approved',
		in_review: 'in review',
		unassessed: 'unassessed',
		critical: 'CRITICAL'
	};

	// ── Inspection (hover preview + click detail card) ───────────────────────────
	let hoveredId = $state<string | null>(null);
	let hoverPos = $state<{ x: number; y: number } | null>(null);
	let selectedId = $state<string | null>(null);

	function onHover(id: string | null, pos: { x: number; y: number } | null) {
		hoveredId = id;
		hoverPos = pos;
	}
	function onSelect(id: string | null) {
		selectedId = selectedId === id ? null : id;
	}

	interface NodeInfo {
		title: string;
		role: string;
		accent: string;
		icon: IconName;
		stats: { label: string; value: string }[];
		note?: string;
	}
	function infoFor(id: string | null): NodeInfo | null {
		if (!id) return null;
		if (id === '__core__')
			return {
				title: coreLabel,
				role: 'Protected core',
				accent: '#5FEAD5',
				icon: 'crestlink',
				stats: coreValue
					? [{ label: 'Protected', value: coreValue }]
					: [{ label: 'State', value: 'Protected' }],
				note: 'Everything downstream of the guard membrane — nothing reaches it unscanned.'
			};
		const p = proxies.find((x) => x.id === id);
		if (p)
			return {
				title: p.label,
				role: 'Supply-chain guard',
				accent: p.enabled === false ? '#71717a' : stroke(p.kind),
				icon: p.enabled === false ? 'shield' : 'shield-check',
				stats: [
					{ label: 'Ecosystem', value: p.kind ?? '—' },
					{ label: 'Policy', value: (p.policy ?? 'log').toUpperCase() },
					{ label: 'Configs', value: String(p.count ?? 1) },
					{ label: 'Agents', value: String(p.agentCount ?? 0) },
					{ label: 'Status', value: p.enabled === false ? 'disabled' : 'active' }
				],
				note:
					p.enabled === false
						? 'This guard is disabled — pulls are not being scanned.'
						: `Intercepts ${p.kind ?? ''} pulls and applies the ${p.policy ?? 'log'} policy before packages reach the core.`
			};
		const r = registries.find((x) => x.id === id);
		if (r)
			return {
				title: r.label,
				role: 'Upstream source',
				accent: stroke(r.kind),
				icon: 'package',
				stats: [{ label: 'Ecosystem', value: r.kind ?? '—' }],
				note: 'Untrusted package registry — every pull crosses the guard membrane first.'
			};
		const a = agents.find((x) => x.id === id);
		if (a)
			return {
				title: a.label,
				role: 'Mesh agent',
				accent: '#C4A8FF',
				icon: 'network',
				stats: [{ label: 'Status', value: a.status ?? 'healthy' }]
			};
		if (id === '__vendor_agent__')
			return {
				title: vendorAgentLabel,
				role: 'Vendor monitor',
				accent: '#C4A8FF',
				icon: 'network',
				stats: [
					{ label: 'Monitoring', value: String(vendors.length) },
					{ label: 'Approved', value: String(vendors.filter((v) => v.status === 'approved').length) },
					{ label: 'In review', value: String(vendors.filter((v) => v.status === 'in_review').length) },
					{ label: 'Blind spots', value: String(vendors.filter((v) => v.status === 'critical').length) }
				],
				note: 'Correlates threat feeds against every third-party vendor and pushes the assessment verdict to the core — the agent does the work.'
			};
		if (id === '__threat_feeds__')
			return {
				title: threatFeedLabel,
				role: 'Intel source',
				accent: '#FB923C',
				icon: 'rss',
				stats: [{ label: 'Type', value: 'CVE · breach · OSINT' }],
				note: 'Upstream threat intelligence — breach disclosures, CVEs and OSINT the vendor agent picks off and matches to your vendors.'
			};
		const v = vendors.find((x) => x.id === id);
		if (v) {
			const st = v.status ?? 'unassessed';
			return {
				title: v.label,
				role: 'Monitored vendor',
				accent: VENDOR_STROKE[st],
				icon:
					st === 'critical'
						? 'shield-alert'
						: st === 'approved'
							? 'shield-check'
							: st === 'in_review'
								? 'clipboard-list'
								: 'shield',
				stats: [{ label: 'Assessment', value: VENDOR_SLOT[st].toUpperCase() }],
				note:
					st === 'critical'
						? 'Unassessed critical vendor — an unmonitored path straight to the core. Your biggest breach blind spot.'
						: st === 'approved'
							? 'Assessed and approved — the vendor agent watches it against live threat feeds.'
							: st === 'in_review'
								? 'Assessment in progress — the vendor agent is scanning it now.'
								: 'Not yet assessed — no assurance on this vendor.'
			};
		}
		return null;
	}
	const hoverInfo = $derived(interactive ? infoFor(hoveredId) : null);
	const selectedInfo = $derived(interactive ? infoFor(selectedId) : null);

	const isEmpty = $derived(
		registries.length === 0 &&
			proxies.length === 0 &&
			agents.length === 0 &&
			vendors.length === 0
	);
	const hasVendors = $derived(vendors.length > 0);

	// ── Layout columns ─────────────────────────────────────────────────────────
	const REG_X = 90;
	const PROXY_X = 330;
	const AGENT_X = 470;
	const CORE_X = 660;
	const ROW = 108;
	const startY = (n: number) => 90 - ((n - 1) / 2) * ROW;

	// popDelay cascade: 0.06 + col*0.20 + i*0.05 (world → membrane → core)
	const popDelay = (col: number, i: number) => 0.06 + col * 0.2 + i * 0.05;

	// ── Boot / ambient state ────────────────────────────────────────────────────
	let flowing = $state(false);
	let flareId = $state<string | null>(null);

	$effect(() => {
		if (!animate) {
			flowing = true;
			return;
		}
		flowing = false;
		const t = setTimeout(() => (flowing = true), 600);
		return () => clearTimeout(t);
	});

	$effect(() => {
		if (!ambient || !flowing) return;
		const blockers = proxies.filter((p) => p.enabled !== false && p.policy === 'block');
		if (blockers.length === 0) return;
		let flareTimer: ReturnType<typeof setTimeout>;
		let clearTimer: ReturnType<typeof setTimeout>;
		const schedule = () => {
			// randomised 8–14s so it never reads as metronomic
			const wait = 8000 + Math.random() * 6000;
			flareTimer = setTimeout(() => {
				const pick = blockers[Math.floor(Math.random() * blockers.length)];
				flareId = pick.id;
				clearTimer = setTimeout(() => {
					flareId = null;
					schedule();
				}, 600);
			}, wait);
		};
		schedule();
		return () => {
			clearTimeout(flareTimer);
			clearTimeout(clearTimer);
			flareId = null;
		};
	});

	// ── Graph construction ───────────────────────────────────────────────────────
	const graph = $derived.by((): { nodes: StudioNode[]; edges: StudioEdge[] } => {
		const nodes: StudioNode[] = [];
		const edges: StudioEdge[] = [];
		const live = flowing;
		const hasV = vendors.length > 0;

		// Columns are shared: threat-feeds joins the world column, vendors share the
		// membrane column with proxies, and the vendor agent joins the agent column.
		// Fold the counts so both lanes stack without overlapping. With no vendors
		// these collapse to the original per-column counts — package layout unchanged.
		const worldN = registries.length + (hasV ? 1 : 0);
		const membN = proxies.length + vendors.length;
		const agentN = agents.length + (hasV ? 1 : 0);

		// ① World — registries (left)
		registries.forEach((r, i) => {
			nodes.push({
				id: r.id,
				label: r.label,
				// Untrusted package source — a plain package/crate glyph.
				iconMarkup: ICONS.package,
				iconKey: 'package',
				type: 'daemon' as MeshNodeType,
				state: 'healthy',
				strokeColor: stroke(r.kind),
				fillColor: fill(r.kind),
				r: 30,
				x: REG_X,
				y: startY(worldN) + i * ROW,
				flow: animate ? 0.7 : 0,
				popDelay: popDelay(0, i),
				portFlow: {
					'task-out': { active: true, flowRate: 0.7 },
					'heartbeat-out': { active: true, flowRate: 0.2 }
				}
			});
		});

		// ② Membrane — proxies
		proxies.forEach((p, i) => {
			const enabled = p.enabled !== false;
			const flaring = flareId === p.id;
			nodes.push({
				id: p.id,
				// The guard membrane: a shield that scans each package. When a block
				// fires it flips to the alert shield + red; otherwise it's the clean
				// checking shield. One label line only (the ecosystem).
				label: p.label,
				value: flaring ? 'BLOCKED' : !enabled ? 'off' : undefined,
				iconMarkup: !enabled
					? ICONS.shield
					: flaring
						? ICONS['shield-alert']
						: ICONS['shield-check'],
				iconKey: !enabled ? 'shield' : flaring ? 'shield-alert' : 'shield-check',
				// Multiple configs rolled into this ecosystem guard → layered planes.
				stackColors: enabled && (p.count ?? 1) > 1 ? STACK_PLANES : undefined,
				type: 'proxy' as MeshNodeType,
				state: enabled ? (flaring ? 'degraded' : 'healthy') : 'offline',
				strokeColor: flaring ? '#f87171' : stroke(p.kind),
				fillColor: flaring ? 'rgba(248,113,113,0.1)' : fill(p.kind),
				r: 40,
				x: PROXY_X,
				y: startY(membN) + i * ROW,
				flow: animate && enabled ? 0.8 : 0,
				popDelay: popDelay(1, i),
				portFlow: enabled
					? {
							'intercept-in': { active: true, flowRate: 0.85 },
							'allow-out': { active: true, flowRate: p.policy === 'warn' ? 0.85 : 0.6 },
							'block-out': {
								active: p.policy === 'block',
								flowRate: flaring ? 1 : p.policy === 'block' ? 0.35 : 0
							},
							'config-in': { active: true, flowRate: 0.3 }
						}
					: {}
			});
		});

		// ③ Membrane — sampled mesh agents
		agents.forEach((a, i) => {
			const st = a.status ?? 'healthy';
			nodes.push({
				id: a.id,
				label: a.label,
				liveSlot: a.status ?? 'healthy',
				type: 'agentic' as MeshNodeType,
				state: st,
				r: 38,
				x: AGENT_X,
				y: startY(agentN) + i * ROW,
				flow: animate && st !== 'offline' ? 0.5 : 0,
				popDelay: popDelay(1, proxies.length + i),
				portFlow:
					st === 'offline'
						? {}
						: {
								'query-in': { active: true, flowRate: 0.5 },
								'answer-out': { active: true, flowRate: 0.5 },
								'feed-in': { active: true, flowRate: 0.3 }
							}
			});
		});

		// ③b Vendor lane — threat-feeds (world) → vendors (membrane) → vendor agent.
		if (hasV) {
			// Threat-feeds source — last node in the world column.
			nodes.push({
				id: '__threat_feeds__',
				label: threatFeedLabel,
				iconMarkup: ICONS.rss,
				iconKey: 'rss',
				type: 'daemon' as MeshNodeType,
				state: 'healthy',
				strokeColor: '#FB923C',
				fillColor: 'rgba(251,146,60,0.1)',
				r: 30,
				x: REG_X,
				y: startY(worldN) + registries.length * ROW,
				flow: animate ? 0.6 : 0,
				popDelay: popDelay(0, registries.length),
				portFlow: { 'task-out': { active: true, flowRate: 0.6 } }
			});

			// Vendors — intermediary nodes, stacked below the proxies in the membrane.
			vendors.forEach((v, i) => {
				const st = v.status ?? 'unassessed';
				nodes.push({
					id: v.id,
					label: v.label,
					liveSlot: VENDOR_SLOT[st],
					iconMarkup: ICONS.users,
					iconKey: 'users',
					type: 'daemon' as MeshNodeType,
					state: VENDOR_STATE[st],
					strokeColor: VENDOR_STROKE[st],
					fillColor: VENDOR_FILL[st],
					r: 34,
					x: PROXY_X,
					y: startY(membN) + (proxies.length + i) * ROW,
					flow: animate && st !== 'unassessed' ? 0.5 : 0,
					popDelay: popDelay(1, proxies.length + i),
					portFlow: {
						'intercept-in': { active: true, flowRate: 0.6 },
						'allow-out': { active: st !== 'critical', flowRate: 0.6 }
					}
				});
			});

			// Vendor agent — does the work; last node in the agent column.
			nodes.push({
				id: '__vendor_agent__',
				label: vendorAgentLabel,
				value: String(vendors.length),
				iconMarkup: ICONS.network,
				iconKey: 'network',
				glyphAsBody: true,
				type: 'agentic' as MeshNodeType,
				state: 'healthy',
				strokeColor: '#C4A8FF',
				fillColor: 'rgba(196,168,255,0.12)',
				stackColors: STACK_PLANES,
				r: 42,
				x: AGENT_X,
				y: startY(agentN) + agents.length * ROW,
				flow: animate ? 0.7 : 0,
				popDelay: popDelay(1, proxies.length + vendors.length),
				portFlow: {
					'query-in': { active: true, flowRate: 0.7 },
					'answer-out': { active: true, flowRate: 0.7 }
				}
			});
		}

		// ④ Protected core (right)
		const membraneCount = proxies.length + agents.length;
		nodes.push({
			id: '__core__',
			label: coreLabel,
			value: coreValue,
			// The protected core — the armornet crest.
			iconMarkup: ICONS.crestlink,
			iconKey: 'crestlink',
			// Container glyph — the crest keeps its sampled shield silhouette.
			glyphAsBody: true,
			type: 'control-plane' as MeshNodeType,
			state: 'healthy',
			strokeColor: '#5FEAD5',
			fillColor: 'rgba(95,234,213,0.1)',
			r: 46,
			x: CORE_X,
			y: 90,
			flow: animate ? 0.4 : 0,
			popDelay: popDelay(2, 0),
			portFlow: { 'config-in': { active: true, flowRate: 0.4 } }
		});

		// ── Edges ──────────────────────────────────────────────────────────────
		const proxyOf = (kind?: string) =>
			proxies.find((p) => p.kind === kind && p.enabled !== false) ??
			proxies.find((p) => p.enabled !== false);

		// world → membrane (intercept, amber)
		registries.forEach((r, i) => {
			const target = proxyOf(r.kind) ?? proxies[i % Math.max(1, proxies.length)];
			if (!target) return;
			const targetEnabled = target.enabled !== false;
			edges.push({
				id: `${r.id}->${target.id}`,
				from: r.id,
				to: target.id,
				fromPort: 'task-out',
				toPort: 'intercept-in',
				dataType: 'intercept',
				style: live && targetEnabled ? 'energy' : 'latent',
				active: live && targetEnabled,
				particleCount: 1
			});
		});

		// membrane → core (verdict, green)
		proxies.forEach((p) => {
			if (p.enabled === false) return;
			edges.push({
				id: `${p.id}->core`,
				from: p.id,
				to: '__core__',
				fromPort: 'allow-out',
				toPort: 'config-in',
				dataType: 'verdict',
				style: live ? 'energy' : 'latent',
				active: live,
				particleCount: 2
			});
		});
		agents.forEach((a) => {
			if (a.status === 'offline') return;
			edges.push({
				id: `${a.id}->core`,
				from: a.id,
				to: '__core__',
				fromPort: 'answer-out',
				toPort: 'config-in',
				dataType: 'verdict',
				style: live ? 'energy' : 'latent',
				active: live,
				particleCount: 1
			});
		});

		// ── Vendor-lane edges: feeds → vendor → agent → core ──────────────────────
		if (hasV) {
			vendors.forEach((v) => {
				const st = v.status ?? 'unassessed';
				// threat feeds → vendor (the agent picks off feeds and matches them)
				edges.push({
					id: `feeds->${v.id}`,
					from: '__threat_feeds__',
					to: v.id,
					fromPort: 'task-out',
					toPort: 'intercept-in',
					dataType: 'feed',
					style: live ? (st === 'unassessed' ? 'latent' : 'energy') : 'latent',
					active: live && st !== 'unassessed',
					particleCount: 1
				});
				// vendor → vendor agent (assessment signal), treatment by status
				if (st === 'critical') {
					// Blind spot: an unmonitored path reaching the core directly.
					edges.push({
						id: `${v.id}->core-blind`,
						from: v.id,
						to: '__core__',
						fromPort: 'allow-out',
						toPort: 'config-in',
						dataType: 'intercept',
						style: 'blocked',
						edgeState: 'degraded',
						active: false,
						particleCount: 1
					});
				} else {
					edges.push({
						id: `${v.id}->vagent`,
						from: v.id,
						to: '__vendor_agent__',
						fromPort: 'allow-out',
						toPort: 'query-in',
						dataType: st === 'in_review' ? 'query' : 'verdict',
						style: live ? VENDOR_EDGE[st] : 'latent',
						active: live && st === 'approved',
						particleCount: 1
					});
				}
			});
			// vendor agent → core (verdict pushed to the protected core)
			edges.push({
				id: `vagent->core`,
				from: '__vendor_agent__',
				to: '__core__',
				fromPort: 'answer-out',
				toPort: 'config-in',
				dataType: 'verdict',
				style: live ? 'energy' : 'latent',
				active: live,
				particleCount: 2
			});
		}

		// ── Crest-centred layouts ─────────────────────────────────────────────────
		// 'membrane' keeps the native pipeline columns built above. The other five
		// re-place every node around the protected-core crest using the shared mesh
		// arrangement solver — the same Grouped / Packed / Radial / Fan / Globe the
		// agent-management mesh offers. Their footprint grows with √count, so a mesh
		// that would overflow the tall columns fits the frame instead.
		if (layout !== 'membrane') {
			const core = nodes.find((n) => n.id === '__core__');
			const spokes = nodes.filter((n) => n.id !== '__core__');
			const hub = { x: 0, y: 0, r: core?.r ?? 46 };
			if (core) {
				core.x = hub.x;
				core.y = hub.y;
			}
			if (layout === 'globe') {
				// Solve for directions on a sphere, then project them at a fixed 3/4
				// orientation — perspective scale + a back-fade read as roundness.
				const radii = spokes.map((n) => n.r ?? 34);
				const sph = packSphere(radii, { margin: 26 });
				const R = Math.max(sph.radius, hub.r + 30 + Math.max(...radii, 0));
				const yaw = 0.6;
				const pitch = 0.32;
				const depth = new Map<string, number>();
				depth.set('__core__', 0);
				spokes.forEach((n, i) => {
					const p = project(spin(sph.dirs[i], yaw, pitch), R);
					n.x = hub.x + p.x;
					n.y = hub.y + p.y;
					n.r = (n.r ?? 34) * p.scale;
					n.inert = !p.front;
					n.opacity = p.front ? 1 : 1 + p.depth * 0.86;
					n.blur = p.front ? 0 : -p.depth * 2.4;
					depth.set(n.id, p.depth);
				});
				// Paint back-to-front: sorting the array IS the hidden-surface pass.
				nodes.sort((a, b) => (depth.get(a.id) ?? 0) - (depth.get(b.id) ?? 0));
			} else {
				// Grouped clusters like-with-like; the rest arrange the whole set.
				solveMeshLayout(spokes, {
					layout,
					hub,
					groupKeys: spokes.map((n) => n.iconKey ?? n.type)
				});
			}
		}

		void membraneCount;
		return { nodes, edges };
	});

	// MeshStudio takes bindable arrays; this canvas is ambient + derived, so the
	// bindings track the derived graph.
	let studioNodes = $state<StudioNode[]>([]);
	let studioEdges = $state<StudioEdge[]>([]);
	$effect(() => {
		studioNodes = graph.nodes;
		studioEdges = graph.edges;
	});
</script>

<div class="membrane" style:height>
	{#if isEmpty}
		<div class="membrane-empty">
			<Icon name="radio" size={30} strokeWidth={1.25} />
			<p class="empty-label">NO AGENTS CONNECTED</p>
			<p class="empty-sub">Deploy an agent to light up the mesh.</p>
		</div>
	{:else}
		<!-- Telemetry lives in a reserved header band (always on top); the graph
		     stage is inset below it, so nodes can never ride up under the numbers. -->
		{#if showTelemetry}
			<div class="telemetry" aria-hidden="false">
				<div class="tm tm--seen">
					<div class="tm-num"><CountUp value={seen} {animate} /></div>
					<div class="tm-label">Seen · 24h</div>
				</div>
				<div class="tm tm--blocked">
					<div class="tm-num tm-num--hero"><CountUp value={blocked} {animate} /></div>
					<div class="tm-label">Blocked · 24h</div>
				</div>
				<div class="tm tm--allowed">
					<div class="tm-num"><CountUp value={allowed} {animate} /></div>
					<div class="tm-label">Allowed · clean</div>
				</div>
			</div>
		{/if}

		{#if showLayoutPicker}
			<div class="mm-layout-pick">
				<MeshLayoutPicker
					options={layoutOptions}
					value={layout as MeshLayoutId}
					columns={3}
					onchange={(id) => (layout = id)}
				/>
			</div>
		{/if}

		<div class="membrane-stage" class:membrane-stage--headed={showTelemetry}>
			<Canvas fitOnLoad allowPan={false} allowZoom={false}>
				<MeshStudio
					concept="instrument"
					bind:nodes={studioNodes}
					bind:edges={studioEdges}
					edgeCurve="bezier"
					allowNodeDrag={false}
					allowLinkDraw={false}
					showGrid={false}
					onNodeHover={interactive ? onHover : undefined}
					onSelect={interactive ? onSelect : undefined}
				/>
			</Canvas>

			<!-- Hover preview — richer than a text tooltip, floats near the cursor. -->
			{#if hoverInfo && hoverPos && !selectedInfo}
				<div
					class="mm-hover"
					style:left="{hoverPos.x}px"
					style:top="{hoverPos.y}px"
					style:--accent={hoverInfo.accent}
				>
					<div class="mm-card-head">
						<span class="mm-ic"><Icon name={hoverInfo.icon} size={14} /></span>
						<div class="mm-titles">
							<div class="mm-title">{hoverInfo.title}</div>
							<div class="mm-role">{hoverInfo.role}</div>
						</div>
					</div>
					<div class="mm-mini">
						{#each hoverInfo.stats.slice(0, 3) as s}
							<div class="mm-mini-row"><span>{s.label}</span><b>{s.value}</b></div>
						{/each}
					</div>
					<div class="mm-hint">Click for detail →</div>
				</div>
			{/if}
		</div>

		<!-- Detail card — extended, pinned to the right on click. -->
		{#if selectedInfo}
			<div class="mm-detail" style:--accent={selectedInfo.accent}>
				<button class="mm-close" onclick={() => (selectedId = null)} aria-label="Close">✕</button>
				<div class="mm-card-head">
					<span class="mm-ic mm-ic--lg"><Icon name={selectedInfo.icon} size={20} /></span>
					<div class="mm-titles">
						<div class="mm-title mm-title--lg">{selectedInfo.title}</div>
						<div class="mm-role">{selectedInfo.role}</div>
					</div>
				</div>
				<dl class="mm-stats">
					{#each selectedInfo.stats as s}
						<div><dt>{s.label}</dt><dd>{s.value}</dd></div>
					{/each}
				</dl>
				{#if selectedInfo.note}
					<p class="mm-note">{selectedInfo.note}</p>
				{/if}
			</div>
		{/if}
	{/if}
</div>

<style>
	.membrane {
		position: relative;
		width: 100%;
		overflow: hidden;
		/* reserved header band for the telemetry numbers */
		--tm-h: clamp(92px, 13vh, 128px);
		/* trust gradient — red-tinged exposure edge (left) → teal protected core (right) */
		background:
			radial-gradient(120% 100% at 0% 50%, rgba(248, 113, 113, 0.05), transparent 55%),
			radial-gradient(120% 100% at 100% 50%, rgba(95, 234, 213, 0.05), transparent 55%);
	}

	/* Arrangement picker — docked top-right over the canvas. */
	.mm-layout-pick {
		position: absolute;
		top: 0.7rem;
		left: 0.7rem;
		z-index: 4;
		width: min(300px, 60%);
		padding: 0.6rem 0.7rem;
		border-radius: 8px;
		border: 1px solid var(--border);
		background: color-mix(in srgb, var(--bg-elev) 82%, transparent);
		backdrop-filter: blur(10px);
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
	}

	/* Graph stage — inset below the telemetry header so nodes never overlap it. */
	.membrane-stage {
		position: absolute;
		inset: 0;
	}
	.membrane-stage--headed {
		top: var(--tm-h);
	}

	/* ── Telemetry — a reserved header band, always in front ── */
	.telemetry {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		height: var(--tm-h);
		z-index: 2;
		pointer-events: none;
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: start;
		padding: 1.6rem 1.6rem 0;
		/* subtle scrim so the numbers stay legible over anything behind them */
		background: linear-gradient(
			to bottom,
			color-mix(in srgb, var(--bg) 80%, transparent),
			transparent
		);
	}
	.tm {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.tm--seen {
		align-items: flex-start;
		justify-self: start;
	}
	.tm--blocked {
		align-items: center;
		justify-self: center;
		text-align: center;
	}
	.tm--allowed {
		align-items: flex-end;
		justify-self: end;
		text-align: right;
	}
	.tm-num {
		font-family: var(--mono);
		font-weight: 700;
		font-size: clamp(1.1rem, 2vw, 1.6rem);
		line-height: 1;
		color: var(--fg);
		font-variant-numeric: tabular-nums;
	}
	.tm-num--hero {
		font-size: clamp(2.75rem, 6vw, 4.5rem);
		color: var(--palette-red);
		text-shadow: 0 0 24px rgba(248, 113, 113, 0.35);
	}
	.tm-label {
		font-family: var(--mono);
		font-size: 0.58rem;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--fg-dim);
	}

	/* ── Empty / dormant ── */
	.membrane-empty {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		color: var(--fg-dim);
	}
	.empty-label {
		margin: 0;
		font-family: var(--mono);
		font-size: 0.72rem;
		letter-spacing: 0.16em;
		color: var(--fg-dim);
	}
	.empty-sub {
		margin: 0;
		font-size: 0.72rem;
		color: var(--fg-dim);
		opacity: 0.7;
	}

	/* ── Inspection cards (hover preview + click detail) ── */
	.mm-card-head {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.mm-ic {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 26px;
		height: 26px;
		flex-shrink: 0;
		border-radius: 6px;
		color: var(--accent);
		background: color-mix(in srgb, var(--accent) 14%, transparent);
		border: 1px solid color-mix(in srgb, var(--accent) 35%, transparent);
	}
	.mm-ic--lg {
		width: 36px;
		height: 36px;
		border-radius: 8px;
	}
	.mm-titles {
		min-width: 0;
	}
	.mm-title {
		font-family: var(--mono);
		font-size: 0.78rem;
		font-weight: 700;
		color: var(--fg);
		line-height: 1.15;
	}
	.mm-title--lg {
		font-size: 0.95rem;
	}
	.mm-role {
		font-family: var(--mono);
		font-size: 0.58rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--accent);
		margin-top: 1px;
	}

	/* Hover preview — floats near the cursor, doesn't intercept pointer. */
	.mm-hover {
		position: absolute;
		z-index: 4;
		transform: translate(14px, 14px);
		pointer-events: none;
		width: 190px;
		padding: 0.6rem 0.7rem;
		border-radius: 8px;
		background: color-mix(in srgb, var(--bg-elev) 92%, transparent);
		border: 1px solid var(--border);
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
		backdrop-filter: blur(8px);
	}
	.mm-mini {
		margin-top: 0.5rem;
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}
	.mm-mini-row {
		display: flex;
		justify-content: space-between;
		gap: 0.5rem;
		font-family: var(--mono);
		font-size: 0.62rem;
	}
	.mm-mini-row span {
		color: var(--fg-dim);
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}
	.mm-mini-row b {
		color: var(--fg-muted);
		font-weight: 600;
	}
	.mm-hint {
		margin-top: 0.5rem;
		font-family: var(--mono);
		font-size: 0.56rem;
		letter-spacing: 0.08em;
		color: var(--accent);
		opacity: 0.8;
	}

	/* Detail card — pinned to the right, interactive. */
	.mm-detail {
		position: absolute;
		z-index: 5;
		top: 0.9rem;
		right: 0.9rem;
		bottom: 0.9rem;
		width: clamp(220px, 26%, 288px);
		padding: 1rem;
		border-radius: 10px;
		background: color-mix(in srgb, var(--bg-elev) 94%, transparent);
		border: 1px solid var(--border);
		border-left: 2px solid var(--accent);
		box-shadow: -12px 0 40px rgba(0, 0, 0, 0.5);
		backdrop-filter: blur(10px);
		display: flex;
		flex-direction: column;
		gap: 0.9rem;
		overflow: hidden auto;
		animation: mm-slide 0.24s cubic-bezier(0.2, 0.8, 0.2, 1);
	}
	@keyframes mm-slide {
		from {
			opacity: 0;
			transform: translateX(12px);
		}
	}
	.mm-close {
		position: absolute;
		top: 0.55rem;
		right: 0.6rem;
		width: 22px;
		height: 22px;
		border: none;
		border-radius: 5px;
		background: transparent;
		color: var(--fg-dim);
		font-size: 0.75rem;
		cursor: pointer;
	}
	.mm-close:hover {
		background: var(--surface-raised);
		color: var(--fg);
	}
	.mm-stats {
		margin: 0;
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.55rem 0.5rem;
	}
	.mm-stats div {
		min-width: 0;
	}
	.mm-stats dt {
		font-family: var(--mono);
		font-size: 0.55rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--fg-dim);
	}
	.mm-stats dd {
		margin: 1px 0 0;
		font-family: var(--mono);
		font-size: 0.8rem;
		font-weight: 600;
		color: var(--fg);
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.mm-note {
		margin: 0;
		font-size: 0.72rem;
		line-height: 1.5;
		color: var(--fg-muted);
		border-top: 1px solid var(--border);
		padding-top: 0.7rem;
	}
</style>
