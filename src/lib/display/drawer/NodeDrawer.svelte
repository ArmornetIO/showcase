<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { MeshNodeType, NodeState } from '../../primitives/canvas/canvas.types.js';
	import { MESH_NODE_COLOR, MESH_NODE_LABEL } from '../../primitives/canvas/canvas.types.js';
	import { useBreakpoint } from '../../useBreakpoint.svelte.js';

	export type { MeshNodeType, NodeState };
	export type DrawerPosition = 'bottom' | 'top' | 'left' | 'right';

	// ── Tab definitions per node type ─────────────────────────────────────────

	export type TabId =
		| 'overview'
		| 'agents'
		| 'pushQueue'
		| 'authLog'
		| 'queries'
		| 'tools'
		| 'feed'
		| 'intercepts'
		| 'blockLog'
		| 'config'
		| 'taskLog'
		| 'history'
		| 'deploy';

	const TYPE_TABS: Record<MeshNodeType, { id: TabId; label: string }[]> = {
		'control-plane': [
			{ id: 'overview',   label: 'Overview'    },
			{ id: 'agents',     label: 'Agents'      },
			{ id: 'pushQueue',  label: 'Push Queue'  },
			{ id: 'authLog',    label: 'Auth Log'    },
			{ id: 'history',    label: 'History'     },
		],
		'agentic': [
			{ id: 'overview',   label: 'Overview'    },
			{ id: 'tools',      label: 'Tools'       },
			{ id: 'intercepts', label: 'Relays'      },
			{ id: 'history',    label: 'History'     },
			{ id: 'deploy',     label: 'Deploy'      },
		],
		'proxy': [
			{ id: 'overview',   label: 'Overview'    },
			{ id: 'intercepts', label: 'Intercepts'  },
			{ id: 'blockLog',   label: 'Block Log'   },
			{ id: 'config',     label: 'Config'      },
			{ id: 'history',    label: 'History'     },
		],
		'daemon': [
			{ id: 'overview',   label: 'Overview'    },
			{ id: 'taskLog',    label: 'Task Log'    },
			{ id: 'config',     label: 'Config'      },
			{ id: 'history',    label: 'History'     },
		],
	};

	// ── Type palette ──────────────────────────────────────────────────────────

	const TYPE_STYLE: Record<MeshNodeType, {
		border: string; glow: string; accent: string; accentFaint: string;
	}> = {
		'control-plane': {
			border:      'rgba(95,234,213,0.55)',
			glow:        'rgba(95,234,213,0.4)',
			accent:      '#5FEAD5',
			accentFaint: 'rgba(95,234,213,0.12)',
		},
		'agentic': {
			border:      'rgba(196,168,255,0.55)',
			glow:        'rgba(196,168,255,0.4)',
			accent:      '#C4A8FF',
			accentFaint: 'rgba(196,168,255,0.12)',
		},
		'proxy': {
			border:      'rgba(56,189,248,0.55)',
			glow:        'rgba(56,189,248,0.4)',
			accent:      '#38BDF8',
			accentFaint: 'rgba(56,189,248,0.12)',
		},
		'daemon': {
			border:      'rgba(110,231,183,0.55)',
			glow:        'rgba(110,231,183,0.4)',
			accent:      '#6EE7B7',
			accentFaint: 'rgba(110,231,183,0.12)',
		},
	};

	// ── Props ─────────────────────────────────────────────────────────────────

	interface NodeDrawerProps {
		open: boolean;
		position?: DrawerPosition;
		/** Override the default 460px side-drawer width (e.g. 680 for supply-chain detail). */
		drawerWidth?: number;
		type: MeshNodeType;
		/** Short text glyph (e.g. 'GO', 'PX'). Ignored when `iconMarkup` is set. */
		icon: string;
		/** Inner SVG markup on a 24×24 grid — pass glyphForMode(mode) to show what
		 *  the node actually runs instead of a text abbreviation. */
		iconMarkup?: string;
		title: string;
		nodeId: string;
		nodeState: NodeState;
		onclose: () => void;
		/** Tabs that are rendered but non-clickable and visually dimmed. */
		disabledTabs?: string[];
		/** Tabs to omit entirely — never rendered in the tab bar or content. */
		hiddenTabs?: string[];
		/** Hide the tab bar entirely — only the active tab's content is shown. */
		hideTabs?: boolean;
		/** Tab to activate when the drawer first opens. Defaults to 'overview'. */
		defaultTab?: TabId;
		/** Bindable active tab — lets the parent drive/read the current tab. */
		activeTab?: TabId;
		/** Extra chips for the header metadata row (mode, version, last seen…). */
		meta?: Snippet;
		// Snippets — one per possible tab across all node types
		overview?:   Snippet;
		agents?:     Snippet;
		pushQueue?:  Snippet;
		authLog?:    Snippet;
		queries?:    Snippet;
		tools?:      Snippet;
		feed?:       Snippet;
		intercepts?: Snippet;
		blockLog?:   Snippet;
		config?:     Snippet;
		taskLog?:    Snippet;
		history?:    Snippet;
		deploy?:     Snippet;
	}

	let {
		open,
		position = 'bottom',
		drawerWidth = 460,
		type,
		icon,
		iconMarkup,
		title,
		nodeId,
		nodeState,
		onclose,
		disabledTabs = [] as string[],
		hiddenTabs = [] as string[],
		hideTabs = false,
		defaultTab,
		activeTab = $bindable(defaultTab ?? 'overview'),
		meta,
		overview, agents, pushQueue, authLog,
		queries, tools, feed,
		intercepts, blockLog, config,
		taskLog, history, deploy,
	}: NodeDrawerProps = $props();

	const SNIPPET_MAP: Record<TabId, Snippet | undefined> = $derived({
		overview, agents, pushQueue, authLog,
		queries, tools, feed,
		intercepts, blockLog, config,
		taskLog, history, deploy,
	});

	const mobile = useBreakpoint('sm');
	const effectivePosition = $derived(mobile.matches ? 'bottom' : position);

	// The open/close slide animates `transform`. When the effective position flips
	// (e.g. a resize crosses the mobile breakpoint), the transform's axis changes
	// from translateX to translateY; CSS interpolates that as a matrix and the
	// panel slides *diagonally* across the screen — the "half-expanded" glitch.
	// Snap on a position change instead: drop the transition for the frame the
	// axis flips, then restore it so open/close stays animated. `lastPos` is a
	// plain (non-reactive) local so writing it doesn't re-run this effect.
	let lastPos: DrawerPosition | undefined;
	let suppressTransition = $state(false);
	$effect(() => {
		const pos = effectivePosition;
		if (lastPos !== undefined && lastPos !== pos) {
			suppressTransition = true;
			requestAnimationFrame(() => requestAnimationFrame(() => (suppressTransition = false)));
		}
		lastPos = pos;
	});

	// Last-resort path: a caller that still passes a raw id as the title. Brand
	// type at 20px wraps a UUID to four lines, so drop to mono and let it truncate.
	// Callers should pass a real display name — this only keeps the header intact.
	const titleIsId = $derived(title === nodeId || /^[0-9a-f-]{16,}$/i.test(title));

	// Nobody reads a 36-char UUID; they copy it for the CLI or a support thread.
	// Only opaque hex ids get shortened — a readable id like 'ctrl.plane.01' is
	// already the useful thing to show, so truncating it would lose information.
	const shortId = $derived(
		/^[0-9a-f]{8}-[0-9a-f-]{8,}$/i.test(nodeId) ? `${nodeId.slice(0, 8)}…` : nodeId,
	);
	let copied = $state(false);
	let copyTimer: ReturnType<typeof setTimeout>;
	async function copyId() {
		try {
			await navigator.clipboard.writeText(nodeId);
			copied = true;
			clearTimeout(copyTimer);
			copyTimer = setTimeout(() => (copied = false), 1200);
		} catch {
			// Clipboard is unavailable (insecure origin / denied) — the full id is
			// still in the title tooltip, so leave the chip as-is rather than lie.
		}
	}

	const cfg  = $derived(TYPE_STYLE[type]);
	const tabs = $derived(TYPE_TABS[type].filter((t) => !hiddenTabs.includes(t.id)));

	// Reset the active tab when it is no longer valid — the node type changed, or
	// the current tab is now hidden. Prefer the default tab when it is visible.
	$effect(() => {
		const validIds = tabs.map((t) => t.id);
		if (!validIds.includes(activeTab)) {
			const fallback = defaultTab && validIds.includes(defaultTab) ? defaultTab : tabs[0]?.id;
			if (fallback) activeTab = fallback;
		}
	});

	// When a disabled tab is currently active, redirect to the first enabled tab.
	$effect(() => {
		if (disabledTabs.includes(activeTab)) {
			const first = tabs.find((t) => !disabledTabs.includes(t.id));
			if (first) activeTab = first.id;
		}
	});

	const statusBorder = $derived(
		nodeState === 'degraded' ? 'rgba(252,211,77,0.4)'   :
		nodeState === 'offline'  ? 'rgba(100,116,139,0.4)'  :
		'rgba(52,211,153,0.35)',
	);
	const statusBg = $derived(
		nodeState === 'degraded' ? 'rgba(252,211,77,0.06)'  :
		nodeState === 'offline'  ? 'rgba(100,116,139,0.06)' :
		'rgba(52,211,153,0.06)',
	);
	const statusColor = $derived(
		nodeState === 'degraded' ? '#FDE68A' :
		nodeState === 'offline'  ? '#94A3B8' :
		'#6EE7B7',
	);

	const positionStyle = $derived.by(() => {
		const pos   = effectivePosition;
		const isVert = pos === 'bottom' || pos === 'top';
		const mobileHeight = mobile.matches ? '80%' : '70%';

		const geometry = isVert
			? `left:0;right:0;width:auto;height:${mobileHeight};${pos === 'bottom' ? 'bottom:0;top:auto;' : 'top:0;bottom:auto;'}`
			: `top:0;bottom:0;height:auto;width:${drawerWidth}px;${pos === 'left' ? 'left:0;right:auto;' : 'right:0;left:auto;'}`;

		const border = ({
			bottom: 'border-top:1px solid var(--type-border);',
			top:    'border-bottom:1px solid var(--type-border);',
			left:   'border-right:1px solid var(--type-border);',
			right:  'border-left:1px solid var(--type-border);',
		} as const)[pos];

		const shadow = ({
			bottom: 'box-shadow:0 -20px 60px -20px var(--type-glow),0 -1px 0 var(--type-border);',
			top:    'box-shadow:0 20px 60px -20px var(--type-glow),0 1px 0 var(--type-border);',
			left:   'box-shadow:20px 0 60px -20px var(--type-glow),1px 0 0 var(--type-border);',
			right:  'box-shadow:-20px 0 60px -20px var(--type-glow),-1px 0 0 var(--type-border);',
		} as const)[pos];

		const bg = ({
			bottom: 'background:linear-gradient(180deg,var(--bg-elev),var(--bg));',
			top:    'background:linear-gradient(0deg,var(--bg-elev),var(--bg));',
			left:   'background:linear-gradient(270deg,var(--bg-elev),var(--bg));',
			right:  'background:linear-gradient(90deg,var(--bg-elev),var(--bg));',
		} as const)[pos];

		const transform = ({
			bottom: open ? 'transform:translateY(0);' : 'transform:translateY(100%);',
			top:    open ? 'transform:translateY(0);' : 'transform:translateY(-100%);',
			left:   open ? 'transform:translateX(0);' : 'transform:translateX(-100%);',
			right:  open ? 'transform:translateX(0);' : 'transform:translateX(100%);',
		} as const)[pos];

		return geometry + border + shadow + bg + transform;
	});
</script>

<!-- Root panel -->
<div
	class="drawer absolute flex flex-col overflow-hidden z-20 backdrop-blur-[14px] {suppressTransition
		? ''
		: 'transition-[transform,border-color,box-shadow] duration-[550ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)]'} {open
		? 'is-open pointer-events-auto'
		: 'pointer-events-none'}"
	style="
		{positionStyle}
		--type-border:{cfg.border};
		--type-glow:{cfg.glow};
		--type-accent:{cfg.accent};
		--type-accent-faint:{cfg.accentFaint};
	"
	aria-hidden={!open}
	role="dialog"
	aria-modal="true"
>
	<!-- ── Header ─────────────────────────────────────────────────────────── -->
	<div class="px-5 py-3 shrink-0 border-b border-[var(--border)] bg-[linear-gradient(90deg,var(--accent-line),transparent)]">

		<!-- Row 1: identity + close -->
		<div class="flex items-center gap-[12px]">
			<!-- Icon box -->
			<div
				class="dc-icon {iconMarkup
					? 'is-glyph'
					: ''} w-[32px] h-[32px] shrink-0 flex items-center justify-center border-[1.5px] border-solid relative font-[var(--mono)] text-[0.625rem] font-bold tracking-[0.1em]"
				style:border-color={cfg.accent}
				style:background={cfg.accentFaint}
				style:color={cfg.accent}
			>
				{#if iconMarkup}
					<!-- Same 24×24 glyph the canvas node draws, so the drawer opens on the
					     symbol that was clicked rather than a text abbreviation. -->
					<svg
						viewBox="0 0 24 24"
						class="w-[20px] h-[20px] relative z-[1]"
						stroke="currentColor"
						fill="none"
						stroke-width="1.5"
						stroke-linecap="round"
						stroke-linejoin="round"
						aria-hidden="true"
					>{@html iconMarkup}</svg>
				{:else}
					{icon}
				{/if}
			</div>

			<!-- Title block -->
			<div class="flex-1 min-w-0">
				<!-- Status sits above the title, where the node-type eyebrow used to. The
				     type is already carried by the icon and the tab set, so restating it
				     here bought nothing; whether the node is HEALTHY or DEGRADED is what
				     the reader opened the drawer to find. -->
				<div
					class="inline-flex items-center gap-[6px] px-2 py-[3px] border r-hairline font-[var(--mono)] text-[0.5rem] tracking-[0.2em]"
					style:border-color={statusBorder}
					style:background={statusBg}
					style:color={statusColor}
				>
					<span class="inline-block w-[5px] h-[5px] rounded-full bg-current shadow-[0_0_6px_currentColor] shrink-0"></span>
					{nodeState.toUpperCase()}
				</div>
				<div
					class="{titleIsId
						? 'font-[var(--mono)] text-[0.8125rem] tracking-[0.04em]'
						: `font-[var(--sans-brand)] text-[1.25rem] font-bold`} text-[var(--fg)] leading-[1.2] mt-[2px] truncate"
					title={title}
				>{title}</div>
			</div>

			<!-- Close button -->
			<button
				class="w-[28px] h-[28px] shrink-0 flex items-center justify-center border border-[var(--border-accent)] r-hairline bg-[var(--bg)] text-[var(--fg-muted)] font-[var(--mono)] text-[1rem] font-bold leading-none cursor-pointer p-0 transition-[color,border-color,background] duration-[150ms] hover:text-[var(--type-accent)] hover:border-[var(--type-accent)] hover:bg-[var(--type-accent-faint)] active:scale-[0.92]"
				onclick={onclose}
				title="Back to overview (Esc)"
				aria-label="Close"
			>×</button>
		</div>

		<!-- Row 2: metadata. No node-type badge and no status pill — the type is the
		     icon plus the tab set, and status now sits above the title. -->
		<div class="flex items-center gap-[8px] mt-[10px] pl-[44px]">
			{#if meta}{@render meta()}{/if}

			<!-- Short id, click to copy the full value -->
			{#if !titleIsId && nodeId}
				<button
					class="ml-auto shrink-0 flex items-center gap-[5px] px-2 py-[3px] border r-hairline bg-transparent font-[var(--mono)] text-[0.5625rem] tracking-[0.1em] cursor-pointer transition-[color,border-color] duration-[150ms] {copied
						? 'text-[var(--type-accent)] border-[var(--type-accent)]'
						: 'text-[var(--fg-dim)] border-[var(--border-accent)] hover:text-[var(--type-accent)] hover:border-[var(--type-accent)]'}"
					onclick={copyId}
					title={nodeId}
					aria-label="Copy node id {nodeId}"
				>{copied ? 'COPIED' : shortId}</button>
			{/if}
		</div>
	</div>

	<!-- ── Tab bar ────────────────────────────────────────────────────────── -->
	{#if !hideTabs}
	<div class="flex gap-0 px-5 shrink-0 border-b border-[var(--border)] bg-[var(--bg-elev)]" role="tablist">
		{#each tabs as tab (tab.id)}
			{@const isDisabled = disabledTabs.includes(tab.id)}
			<button
				role="tab"
				aria-selected={activeTab === tab.id}
				aria-disabled={isDisabled}
				disabled={isDisabled}
				class="dc-tab relative px-[16px] py-[12px] font-[var(--mono)] text-[0.625rem] tracking-[0.25em] uppercase bg-transparent border-none transition-colors duration-[200ms] ease-in-out {isDisabled
					? 'opacity-25 cursor-not-allowed text-[var(--fg-dim)]'
					: activeTab === tab.id
						? 'text-[var(--type-accent)] dc-tab-active cursor-pointer'
						: 'text-[var(--fg-dim)] hover:text-[var(--accent-bright)] cursor-pointer'}"
				onclick={() => { if (!isDisabled) activeTab = tab.id; }}
			>{tab.label}</button>
		{/each}
	</div>
	{/if}

	<!-- ── Content ───────────────────────────────────────────────────────── -->
	<div class="dc-content flex-1 overflow-y-auto px-6 py-5">
		{#each tabs as tab (tab.id)}
			{#if activeTab === tab.id}
				<div class="dc-pane" role="tabpanel">
					{#if SNIPPET_MAP[tab.id]}
						{@render SNIPPET_MAP[tab.id]?.()}
					{:else}
						<p class="font-[var(--mono)] text-[0.6875rem] text-[var(--fg-dim)] italic">
							No content provided for <span class="text-[var(--type-accent)]">{tab.label}</span>.
						</p>
					{/if}
				</div>
			{/if}
		{/each}
	</div>
</div>

<style>
	/* ── Icon inner inset ── */
	/* The inset frame reads as a plate behind two letters. A mode glyph has its own
	   silhouette, so the second border just crowds it — drop it in glyph mode. */
	.dc-icon:not(.is-glyph)::after {
		content: '';
		position: absolute;
		inset: 3px;
		border: 1px solid var(--border-strong);
	}

	/* ── Active tab underline ── */
	.dc-tab-active::after {
		content: '';
		position: absolute;
		left: 16px;
		right: 16px;
		bottom: -1px;
		height: 2px;
		background: var(--type-accent);
		box-shadow: 0 0 8px var(--type-accent);
	}

	/* ── Scrollbar ── */
	.dc-content {
		scrollbar-width: thin;
		scrollbar-color: var(--border-accent) transparent;
	}
	.dc-content::-webkit-scrollbar       { width: 6px; }
	.dc-content::-webkit-scrollbar-thumb { background: var(--border-accent); border-radius: var(--radius-inset); }
	.dc-content::-webkit-scrollbar-track { background: transparent; }

	/* ── Pane enter ── */
	.dc-pane { animation: pane-in 0.3s ease both; }

	@keyframes pane-in {
		from { opacity: 0; transform: translateY(6px); }
		to   { opacity: 1; transform: translateY(0);   }
	}
</style>
