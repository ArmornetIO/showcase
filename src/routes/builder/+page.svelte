<script lang="ts">
	import { tick, onMount } from 'svelte';
	import { base } from '$app/paths';
	import { REGISTRY, REGISTRY_MAP, CATEGORIES } from '$lib/builder/registry.js';
	import { builder } from '$lib/builder/store.svelte.js';
	import LayerControls from '$lib/builder/LayerControls.svelte';
	import AlertBladeHost from '$lib/display/drawer/AlertBladeHost.svelte';
	import ChatThread from '$lib/display/chat/ChatThread.svelte';
	import type { ChatEntry } from '$lib/display/chat/ChatThread.svelte';
	import type { CanvasItem, Group } from '$lib/builder/store.svelte.js';
	import type { CanvasCamera, TourController, TourStep } from '$lib/primitives/canvas-camera.js';
	import Canvas from '$lib/primitives/Canvas.svelte';
	import CompositorLayer from '$lib/primitives/CompositorLayer.svelte';
	import CameraControls from '$lib/primitives/CameraControls.svelte';
	import ThemeStudio from '$lib/builder/themes/ThemeStudio.svelte';
	import PropEditor from '$lib/builder/PropEditor.svelte';

	// ── Preview / split modes ────────────────────────────────────────────────────
	let previewMode = $state(false);
	let splitView = $state(false);
	let iframeKey = $state(0);

	// ── Theme Studio ─────────────────────────────────────────────────────────────
	let themeStudioOpen = $state(false);

	// ── Canvas camera binding ────────────────────────────────────────────────────
	let camera = $state<CanvasCamera | undefined>();

	// ── Right panel tab ──────────────────────────────────────────────────────────
	let rightTab = $state<'props' | 'ai' | 'tours'>('props');

	// ── Toolbox search ──────────────────────────────────────────────────────────
	let searchQuery = $state('');

	const filteredItems = $derived(
		REGISTRY.filter(
			(m) =>
				m.placeable &&
				(!searchQuery || m.label.toLowerCase().includes(searchQuery.toLowerCase()))
		)
	);

	function itemsByCategory(cat: string) {
		return filteredItems.filter((m) => m.category === cat);
	}

	// ── Toolbox → canvas HTML5 drag-and-drop ─────────────────────────────────────
	function handleToolboxDragStart(e: DragEvent, id: string) {
		e.dataTransfer?.setData('component-id', id);
		e.dataTransfer!.effectAllowed = 'copy';
	}

	// ── Group bounding boxes ─────────────────────────────────────────────────────
	function computeGroupBounds(groupId: string) {
		const members = builder.items.filter((i) => i.groupId === groupId && i.visible);
		if (members.length === 0) return null;
		const minX = Math.min(...members.map((i) => i.x));
		const minY = Math.min(...members.map((i) => i.y));
		const maxX = Math.max(...members.map((i) => i.x + Math.max(i.w, 60)));
		const maxY = Math.max(...members.map((i) => i.y + Math.max(i.h, 40)));
		const maxZ = Math.max(...members.map((i) => i.zIndex));
		return { x: minX, y: minY, w: maxX - minX, h: maxY - minY, maxZ };
	}

	// ── Keyboard shortcuts ───────────────────────────────────────────────────────
	function handleKeyDown(e: KeyboardEvent) {
		const tag = (document.activeElement as HTMLElement)?.tagName;
		if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

		if ((e.key === 'Delete' || e.key === 'Backspace') && builder.selectedId) {
			e.preventDefault();
			builder.deleteItem(builder.selectedId);
		}
		if (e.key === 'Escape') {
			builder.clearSelection();
			addingToGroupId = null;
		}

		const mod = e.metaKey || e.ctrlKey;

		// Cmd+G → group selection / create empty group
		if (mod && !e.shiftKey && e.key === 'g') {
			e.preventDefault();
			if (builder.selectionMode === 'multi' || builder.selectionMode === 'item') {
				const ids =
					builder.selectionMode === 'multi'
						? [...builder.multiSelectedIds]
						: [builder.selectedId!];
				const grp = builder.createGroup(undefined, ids);
				scheduleRename(grp.id, grp.name);
			}
		}

		// Cmd+Shift+G → ungroup
		if (mod && e.shiftKey && e.key === 'G') {
			e.preventDefault();
			if (builder.selectedGroupId) builder.deleteGroup(builder.selectedGroupId);
		}

		// Cmd+[ → send back
		if (mod && e.key === '[') {
			e.preventDefault();
			if (builder.selectedId) builder.sendBack(builder.selectedId);
		}

		// Cmd+] → bring forward
		if (mod && e.key === ']') {
			e.preventDefault();
			if (builder.selectedId) builder.bringForward(builder.selectedId);
		}
	}

	// ── Props panel ──────────────────────────────────────────────────────────────
	const selectedMeta = $derived(
		builder.selected ? REGISTRY_MAP.get(builder.selected.componentId) : null
	);

	function updateProp(key: string, value: unknown) {
		if (builder.selectedId) builder.updateProp(builder.selectedId, key, value);
	}

	// ── Layers panel state ───────────────────────────────────────────────────────
	let layerSearch = $state('');
	let expandedGroups = $state(new Set<string>());
	let renamingId = $state<string | null>(null);
	let renameValue = $state('');
	let renameInputEl = $state<HTMLInputElement | undefined>();

	// Layer HTML5 drag state
	let layerDragId = $state<string | null>(null);
	let layerDropTarget = $state<string | null>(null);

	// "Add from canvas…" mode
	let addingToGroupId = $state<string | null>(null);

	function displayName(item: CanvasItem) {
		return item.name || REGISTRY_MAP.get(item.componentId)?.label || item.componentId;
	}

	type LayerEntry =
		| { type: 'group'; group: Group; children: CanvasItem[]; sortZ: number }
		| { type: 'item'; item: CanvasItem; sortZ: number };

	const sortedLayers = $derived.by(() => {
		const q = layerSearch.toLowerCase().trim();
		const entries: LayerEntry[] = [];

		for (const group of builder.groups) {
			const children = builder.items
				.filter((i) => i.groupId === group.id)
				.sort((a, b) => b.zIndex - a.zIndex);
			const sortZ = children.length > 0 ? Math.max(...children.map((i) => i.zIndex)) : 0;
			entries.push({ type: 'group', group, children, sortZ });
		}
		for (const item of builder.items.filter((i) => !i.groupId)) {
			entries.push({ type: 'item', item, sortZ: item.zIndex });
		}
		entries.sort((a, b) => b.sortZ - a.sortZ);

		if (!q) return entries;
		return entries.filter((e) => {
			if (e.type === 'group') {
				return (
					e.group.name.toLowerCase().includes(q) ||
					e.children.some((c) => displayName(c).toLowerCase().includes(q))
				);
			}
			return displayName(e.item).toLowerCase().includes(q);
		});
	});

	const selectedGroupMembers = $derived(
		builder.selectedGroupId
			? builder.items
					.filter((i) => i.groupId === builder.selectedGroupId)
					.sort((a, b) => b.zIndex - a.zIndex)
			: []
	);

	const selectedGroupBounds = $derived.by(() => {
		if (!builder.selectedGroupId) return null;
		return computeGroupBounds(builder.selectedGroupId);
	});

	function toggleExpanded(groupId: string) {
		const next = new Set(expandedGroups);
		if (next.has(groupId)) next.delete(groupId);
		else next.add(groupId);
		expandedGroups = next;
	}

	async function scheduleRename(id: string, currentName: string) {
		renamingId = id;
		renameValue = currentName;
		await tick();
		renameInputEl?.focus();
		renameInputEl?.select();
	}

	function commitRename() {
		if (!renamingId) return;
		const trimmed = renameValue.trim();
		if (trimmed) {
			// Check if it's a group or an item
			const isGroup = builder.groups.some((g) => g.id === renamingId);
			if (isGroup) builder.renameGroup(renamingId!, trimmed);
			else builder.renameItem(renamingId!, trimmed);
		}
		renamingId = null;
	}

	function handleRenameKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') commitRename();
		if (e.key === 'Escape') renamingId = null;
	}

	function handleAddGroup() {
		let ids: string[] = [];
		if (builder.selectionMode === 'multi') ids = [...builder.multiSelectedIds];
		else if (builder.selectionMode === 'item' && builder.selectedId) ids = [builder.selectedId];
		const grp = builder.createGroup(undefined, ids);
		expandedGroups = new Set([...expandedGroups, grp.id]);
		scheduleRename(grp.id, grp.name);
	}

	// Layer panel drag-to-reorder / drag-to-group
	function handleLayerDragStart(e: DragEvent, id: string) {
		layerDragId = id;
		e.dataTransfer?.setData('layer-id', id);
		e.dataTransfer!.effectAllowed = 'move';
	}

	function handleLayerDragEnd() {
		layerDragId = null;
		layerDropTarget = null;
	}

	function handleLayerDragOver(e: DragEvent, targetId: string) {
		e.preventDefault();
		layerDropTarget = targetId;
	}

	function handleLayerDropOnGroup(e: DragEvent, groupId: string) {
		e.preventDefault();
		const id = e.dataTransfer?.getData('layer-id') || layerDragId;
		if (id && id !== groupId) {
			// If it's an item, add to group; if it's a group, ignore
			const isItem = builder.items.some((i) => i.id === id);
			if (isItem) builder.addToGroup(id, groupId);
		}
		layerDragId = null;
		layerDropTarget = null;
	}

	function handleLayerDropOnItem(e: DragEvent, targetItemId: string) {
		e.preventDefault();
		const id = e.dataTransfer?.getData('layer-id') || layerDragId;
		if (id && id !== targetItemId && builder.items.some((i) => i.id === id)) {
			builder.swapZIndex(id, targetItemId);
		}
		layerDragId = null;
		layerDropTarget = null;
	}

	// ── AI panel state ───────────────────────────────────────────────────────────
	let mockupSlug = $state('');
	let variants = $state<{ slug: string; version: number; timestamp: number }[]>([]);

	let chatMessages = $state<ChatEntry[]>([
		{
			id: 'init',
			role: 'assistant',
			author: 'CLAUDE',
			content:
				'Place components on the canvas to sketch a layout, set a slug, then describe the feature.\n\nHit "Copy brief" and paste it into your Claude Code session — Claude will write the mockup file directly and Vite will hot-reload the preview.',
			timestamp: Date.now()
		}
	]);

	function uid() {
		return Math.random().toString(36).slice(2, 9);
	}

	// ── Brief serialization ──────────────────────────────────────────────────────
	function serializeBrief(): string {
		const sorted = [...builder.items].sort((a, b) => a.y - b.y || a.x - b.x);
		if (sorted.length === 0)
			return '(empty canvas — drag components from the toolbox to sketch the layout)';
		return sorted
			.map((item, i) => {
				const meta = REGISTRY_MAP.get(item.componentId);
				const label = meta?.label ?? item.componentId;
				const wStr = item.w > 0 ? `${item.w}px` : 'auto';
				const hStr = item.h > 0 ? `${item.h}px` : 'auto';
				const pos = `@ (${item.x}, ${item.y})  ${wStr} × ${hStr}`;
				const customProps = Object.entries(item.props).filter(([k, v]) => {
					if (k.startsWith('__')) return false;
					return meta?.props[k] !== undefined && v !== meta.props[k].default;
				});
				const propStr = customProps.length
					? '\n' + customProps.map(([k, v]) => `     ${k}: ${JSON.stringify(v)}`).join('\n')
					: '';
				return `${i + 1}. ${label} ${pos}${propStr}`;
			})
			.join('\n\n');
	}

	function sendChat(text: string) {
		chatMessages = [
			...chatMessages,
			{ id: uid(), role: 'user', author: 'YOU', content: text, timestamp: Date.now() }
		];
		const slug = mockupSlug || 'my-feature';
		chatMessages = [
			...chatMessages,
			{
				id: uid(),
				role: 'assistant',
				author: 'CLAUDE',
				content: `Got it. Hit "Copy brief" below and paste into your Claude Code session — Claude will write the mockup to \`mockups/${slug}/+page.svelte\` and HMR will reload the preview.`,
				timestamp: Date.now()
			}
		];
	}

	let copyState = $state<'idle' | 'copied'>('idle');

	function buildClaudePrompt(): string {
		const brief = serializeBrief();
		const slug = mockupSlug || 'my-feature';
		const userContext = chatMessages
			.filter((m) => m.role === 'user')
			.map((m) => m.content)
			.join('\n\n');
		return [
			`/design-mockup`,
			``,
			`Mockup slug: ${slug}`,
			`Route: showcase/src/routes/mockups/${slug}/+page.svelte`,
			``,
			`## Feature description`,
			userContext || '(add a description in the AI chat panel before copying)',
			``,
			`## Canvas layout`,
			`These components have been placed on the canvas as a layout sketch.`,
			`Use them as a structural guide — arrange in natural page flow matching`,
			`approximate positions. Add realistic stub data throughout.`,
			``,
			brief
		].join('\n');
	}

	async function copyBrief() {
		try {
			await navigator.clipboard.writeText(buildClaudePrompt());
			copyState = 'copied';
			setTimeout(() => (copyState = 'idle'), 2000);
		} catch {
			// clipboard unavailable in non-secure contexts
		}
	}

	function compareUrl(): string {
		const recent = variants.slice(-4);
		const params = recent.map((v, i) => `${'abcd'[i]}=${v.slug}`).join('&');
		return `/compare?${params}`;
	}

	// ── Split view ───────────────────────────────────────────────────────────────
	function toggleSplit() {
		splitView = !splitView;
		if (splitView && !mockupSlug) rightTab = 'ai';
	}

	// ── Export / Print ───────────────────────────────────────────────────────────
	function printPdf() {
		window.print();
	}

	async function savePng() {
		alert('PNG export: install html-to-image, then wire up toPng(canvasEl) here.');
	}

	// ── Tour recording ───────────────────────────────────────────────────────────
	let recordingMode = $state(false);
	let draftSteps = $state<TourStep[]>([]);
	let draftTourName = $state('');

	// ── Tour playback ────────────────────────────────────────────────────────────
	let activeTourController = $state<TourController | null>(null);
	let activeTourName = $state('');
	let activeTourStep = $state(0);
	let activeTourPlaying = $state(false);

	$effect(() => {
		if (rightTab !== 'tours') recordingMode = false;
	});

	function stepTargetLabel(step: TourStep): string {
		if (step.target === 'fit-all') return 'Fit all';
		if (typeof step.target === 'string') {
			const item = builder.items.find((i) => i.id === step.target);
			return item ? displayName(item) : (step.target as string);
		}
		return `(${(step.target as { x: number; y: number }).x}, ${(step.target as { x: number; y: number }).y})`;
	}

	function addRecordedStep(itemId: string) {
		const item = builder.items.find((i) => i.id === itemId);
		draftSteps = [...draftSteps, { target: itemId, label: item ? displayName(item) : itemId }];
	}

	function addFitAllStep() {
		draftSteps = [...draftSteps, { target: 'fit-all', label: 'Fit all' }];
	}

	function removeDraftStep(idx: number) {
		draftSteps = draftSteps.filter((_, i) => i !== idx);
	}

	function moveDraftStep(idx: number, dir: -1 | 1) {
		const target = idx + dir;
		if (target < 0 || target >= draftSteps.length) return;
		const next = [...draftSteps];
		[next[idx], next[target]] = [next[target], next[idx]];
		draftSteps = next;
	}

	function updateDraftStep(idx: number, patch: Partial<TourStep>) {
		draftSteps = draftSteps.map((s, i) => (i === idx ? { ...s, ...patch } : s));
	}

	function saveDraftTour() {
		const name = draftTourName.trim();
		if (!name || draftSteps.length === 0) return;
		builder.saveTour(name, [...draftSteps]);
		draftSteps = [];
		draftTourName = '';
		recordingMode = false;
	}

	function clearDraft() {
		draftSteps = [];
		draftTourName = '';
		recordingMode = false;
	}

	function launchTour(name: string) {
		if (!camera) return;
		activeTourController?.stop();
		const steps = builder.tours[name];
		const ctrl = camera.playTour(steps);
		ctrl.onUpdate = (step, playing) => {
			activeTourStep = step;
			activeTourPlaying = playing;
		};
		activeTourController = ctrl;
		activeTourName = name;
		activeTourStep = 0;
		activeTourPlaying = false;
		ctrl.play();
	}

	function stopTour() {
		activeTourController?.stop();
		activeTourController = null;
		activeTourName = '';
		activeTourStep = 0;
		activeTourPlaying = false;
	}

	onMount(() => {
		// The saved canvas comes back here rather than at store-import time, so
		// importing the builder store costs nothing anywhere else.
		builder.hydrate();
		window.addEventListener('keydown', handleKeyDown);
		return () => window.removeEventListener('keydown', handleKeyDown);
	});
</script>

<svelte:head>
	<title>Builder — UI Component Library</title>
</svelte:head>

<AlertBladeHost />
<ThemeStudio open={themeStudioOpen} onclose={() => (themeStudioOpen = false)} />

<div class="builder-root">
	<!-- ── Header ───────────────────────────────────────────────────────────── -->
	<header class="builder-header">
		<a href="{base}" class="back-link">← SHOWCASE</a>
		<span class="builder-title">PAGE BUILDER</span>
		<div class="builder-toolbar">
			{#if builder.items.length > 0}
				<span class="item-count"
					>{builder.items.length} component{builder.items.length !== 1 ? 's' : ''}</span
				>
			{/if}
			<button
				class="toolbar-btn"
				class:toolbar-btn--active={splitView}
				onclick={toggleSplit}
				title={splitView ? 'Close split preview' : 'Split canvas with mockup preview'}
				>⊟ SPLIT</button
			>
			<button
				class="toolbar-btn"
				class:toolbar-btn--preview={previewMode}
				onclick={() => (previewMode = !previewMode)}
				title={previewMode
					? 'Exit preview — re-enable drag'
					: 'Preview mode — enable component interaction'}
				>{previewMode ? '◉ PREVIEW' : '◎ PREVIEW'}</button
			>
			<button
				class="toolbar-btn"
				class:toolbar-btn--active={themeStudioOpen}
				onclick={() => (themeStudioOpen = true)}
				title="Open Theme Studio to tune component styles and generate a Claude Code prompt"
				>◈ THEME STUDIO</button
			>
			<button class="toolbar-btn" onclick={() => builder.clearCanvas()}>CLEAR</button>
			<button class="toolbar-btn" onclick={savePng}>SAVE PNG</button>
			<button class="toolbar-btn toolbar-btn--accent" onclick={printPdf}>PRINT PDF</button>
		</div>
	</header>

	<!-- ── Body ─────────────────────────────────────────────────────────────── -->
	<div class="builder-body">
		<!-- TOOLBOX -->
		<aside class="builder-toolbox">
			<div class="toolbox-search-wrap">
				<input
					type="search"
					placeholder="Search components…"
					class="toolbox-search"
					bind:value={searchQuery}
				/>
			</div>
			<div class="toolbox-list">
				{#each CATEGORIES as cat}
					{@const catItems = itemsByCategory(cat)}
					{#if catItems.length > 0}
						<div class="tool-group">
							<div class="tool-group-label">{cat}</div>
							{#each catItems as meta}
								<!-- svelte-ignore a11y_no_static_element_interactions -->
								<div
									class="tool-item"
									draggable="true"
									ondragstart={(e) => handleToolboxDragStart(e, meta.id)}
									title="Drag onto canvas"
								>
									<span class="tool-icon">⊞</span>
									{meta.label}
								</div>
							{/each}
						</div>
					{/if}
				{/each}
				{#if filteredItems.length === 0}
					<div class="toolbox-empty">No components match "{searchQuery}"</div>
				{/if}
			</div>
		</aside>

		<!-- CANVAS -->
		<div class="canvas-wrap" class:canvas-split={splitView}>
			<Canvas bind:camera>
				<CompositorLayer
					onItemSelect={(id) => {
						if (id) {
							if (recordingMode && rightTab === 'tours') {
								addRecordedStep(id);
							} else {
								builder.select(id);
							}
						} else {
							if (!recordingMode) builder.clearSelection();
						}
					}}
				/>
				<CameraControls position="bottom-right" showFit={false} />
			</Canvas>
		</div>

		<!-- SPLIT PREVIEW PANE ──────────────────────────────────────────────── -->
		{#if splitView}
			<div class="split-pane">
				<div class="split-header">
					<span class="split-label">
						{#if mockupSlug}
							/mockups/{mockupSlug}
						{:else}
							<span class="split-no-slug">set a slug in the AI tab →</span>
						{/if}
					</span>
					<div class="split-actions">
						{#if mockupSlug}
							<button class="split-btn" onclick={() => iframeKey++} title="Reload preview">↺</button>
						{/if}
						<button class="split-btn" onclick={() => (splitView = false)} title="Close split view"
							>✕</button
						>
					</div>
				</div>
				{#if mockupSlug}
					{#key iframeKey}
						<iframe
							src="{base}/mockups/{mockupSlug}"
							title="Mockup preview — {mockupSlug}"
							class="split-iframe"
						></iframe>
					{/key}
				{:else}
					<div class="split-empty">
						<div class="split-empty-text"
							>Enter a mockup slug in the AI tab, then generate the mockup with Claude Code</div
						>
					</div>
				{/if}
			</div>
		{/if}

		<!-- RIGHT PANEL ─────────────────────────────────────────────────────── -->
		<aside class="builder-props" class:builder-props--ai={rightTab === 'ai'}>
			<!-- Tab bar -->
			<div class="panel-tabs">
				<button
					class="panel-tab"
					class:panel-tab--active={rightTab === 'props'}
					onclick={() => (rightTab = 'props')}
				>PROPS</button>
				<button
					class="panel-tab"
					class:panel-tab--active={rightTab === 'ai'}
					onclick={() => (rightTab = 'ai')}
				>
					AI
					{#if chatMessages.filter((m) => m.role === 'user').length > 0}
						<span class="panel-tab-badge"
							>{chatMessages.filter((m) => m.role === 'user').length}</span
						>
					{/if}
				</button>
				<button
					class="panel-tab"
					class:panel-tab--active={rightTab === 'tours'}
					onclick={() => (rightTab = 'tours')}
				>
					TOURS
					{#if Object.keys(builder.tours).length > 0}
						<span class="panel-tab-badge">{Object.keys(builder.tours).length}</span>
					{/if}
				</button>
			</div>

			<!-- ── PROPS TAB ──────────────────────────────────────────────────── -->
			{#if rightTab === 'props'}

				<!-- ── Nothing selected: Layers + Canvas panel ──────────────── -->
				{#if builder.selectionMode === 'none'}
					<div class="layers-panel">
						<!-- Header -->
						<div class="layers-header">
							<span class="layers-title">LAYERS</span>
							<button class="layers-add-btn" onclick={handleAddGroup} title="Create group (Cmd+G)">
								+ GROUP
							</button>
						</div>

						<!-- Search -->
						<div class="layers-search-wrap">
							<input
								type="search"
								placeholder="Search layers…"
								class="layers-search"
								bind:value={layerSearch}
							/>
						</div>

						<!-- Layer list -->
						<div class="layers-list">
							{#each sortedLayers as entry (entry.type === 'group' ? entry.group.id : entry.item.id)}
								{#if entry.type === 'group'}
									<!-- Group row -->
									<!-- svelte-ignore a11y_no_static_element_interactions -->
									<div
										class="layer-row layer-row--group"
										class:layer-row--drag-over={layerDropTarget === entry.group.id}
										ondragover={(e) => handleLayerDragOver(e, entry.group.id)}
										ondrop={(e) => handleLayerDropOnGroup(e, entry.group.id)}
										ondragleave={() => (layerDropTarget = null)}
									>
										<button
											class="layer-expand-btn"
											onclick={() => toggleExpanded(entry.group.id)}
											title={expandedGroups.has(entry.group.id) ? 'Collapse' : 'Expand'}
										>
											{expandedGroups.has(entry.group.id) ? '▾' : '▸'}
										</button>
										<span class="layer-type-icon">📁</span>
										{#if renamingId === entry.group.id}
											<!-- svelte-ignore a11y_autofocus -->
											<input
												bind:this={renameInputEl}
												class="layer-rename-input"
												bind:value={renameValue}
												onblur={commitRename}
												onkeydown={handleRenameKeydown}
												autofocus
											/>
										{:else}
											<!-- svelte-ignore a11y_click_events_have_key_events -->
											<span
												class="layer-name"
												onclick={() => builder.selectGroup(entry.group.id)}
												ondblclick={() => scheduleRename(entry.group.id, entry.group.name)}
												title="Click to select · double-click to rename"
											>
												{entry.group.name}
											</span>
										{/if}
										<div class="layer-row-right">
											<LayerControls
												visible={entry.group.visible}
												locked={entry.group.locked}
												onToggleVisible={() => builder.toggleGroupVisible(entry.group.id)}
												onToggleLocked={() => builder.toggleGroupLocked(entry.group.id)}
											/>
											<!-- svelte-ignore a11y_no_static_element_interactions -->
											<span
												class="layer-drag-handle"
												draggable="true"
												ondragstart={(e) => handleLayerDragStart(e, entry.group.id)}
												ondragend={handleLayerDragEnd}
												title="Drag to reorder"
											>⠿</span>
										</div>
									</div>

									<!-- Children (expanded) -->
									{#if expandedGroups.has(entry.group.id)}
										{#each entry.children as child (child.id)}
											<!-- svelte-ignore a11y_no_static_element_interactions -->
											<div
												class="layer-row layer-row--child"
												class:layer-row--drag-over={layerDropTarget === child.id}
												class:layer-row--dragging={layerDragId === child.id}
												draggable="true"
												ondragstart={(e) => handleLayerDragStart(e, child.id)}
												ondragend={handleLayerDragEnd}
												ondragover={(e) => handleLayerDragOver(e, child.id)}
												ondrop={(e) => handleLayerDropOnItem(e, child.id)}
												ondragleave={() => (layerDropTarget = null)}
											>
												<span class="layer-indent"></span>
												<span class="layer-type-icon layer-type-icon--sm">⊞</span>
												{#if renamingId === child.id}
													<!-- svelte-ignore a11y_autofocus -->
													<input
														bind:this={renameInputEl}
														class="layer-rename-input"
														bind:value={renameValue}
														onblur={commitRename}
														onkeydown={handleRenameKeydown}
														autofocus
													/>
												{:else}
													<!-- svelte-ignore a11y_click_events_have_key_events -->
													<span
														class="layer-name"
														onclick={() => builder.select(child.id)}
														ondblclick={() => scheduleRename(child.id, displayName(child))}
														title="Click to select · double-click to rename"
													>
														{displayName(child)}
													</span>
												{/if}
												<div class="layer-row-right">
													<LayerControls
														visible={child.visible}
														locked={child.locked}
														onToggleVisible={() => builder.toggleItemVisible(child.id)}
														onToggleLocked={() => builder.toggleItemLocked(child.id)}
													/>
													<span class="layer-drag-handle">⠿</span>
												</div>
											</div>
										{/each}
									{/if}

								{:else}
									<!-- Ungrouped item row -->
									<!-- svelte-ignore a11y_no_static_element_interactions -->
									<div
										class="layer-row"
										class:layer-row--drag-over={layerDropTarget === entry.item.id}
										class:layer-row--dragging={layerDragId === entry.item.id}
										draggable="true"
										ondragstart={(e) => handleLayerDragStart(e, entry.item.id)}
										ondragend={handleLayerDragEnd}
										ondragover={(e) => handleLayerDragOver(e, entry.item.id)}
										ondrop={(e) => handleLayerDropOnItem(e, entry.item.id)}
										ondragleave={() => (layerDropTarget = null)}
									>
										<span class="layer-type-icon">⊞</span>
										{#if renamingId === entry.item.id}
											<!-- svelte-ignore a11y_autofocus -->
											<input
												bind:this={renameInputEl}
												class="layer-rename-input"
												bind:value={renameValue}
												onblur={commitRename}
												onkeydown={handleRenameKeydown}
												autofocus
											/>
										{:else}
											<!-- svelte-ignore a11y_click_events_have_key_events -->
											<span
												class="layer-name"
												onclick={() => builder.select(entry.item.id)}
												ondblclick={() =>
													scheduleRename(entry.item.id, displayName(entry.item))}
												title="Click to select · double-click to rename"
											>
												{displayName(entry.item)}
											</span>
										{/if}
										<div class="layer-row-right">
											<LayerControls
												visible={entry.item.visible}
												locked={entry.item.locked}
												onToggleVisible={() => builder.toggleItemVisible(entry.item.id)}
												onToggleLocked={() => builder.toggleItemLocked(entry.item.id)}
											/>
											<span class="layer-drag-handle">⠿</span>
										</div>
									</div>
								{/if}
							{/each}

							{#if builder.items.length === 0}
								<div class="layers-empty">No components on canvas</div>
							{/if}
						</div>

						<!-- Canvas settings -->
						<div class="canvas-settings">
							<div class="cs-title">CANVAS</div>
							<div class="cs-row">
								<span class="cs-label">Grid</span>
								<input
									type="number"
									class="cs-num-input"
									value={builder.gridSize}
									min="4"
									max="80"
									step="4"
									oninput={(e) => builder.setGridSize(Number(e.currentTarget.value))}
								/>
								<span class="cs-unit">px</span>
								<label class="cs-check">
									<input
										type="checkbox"
										checked={builder.gridVisible}
										onchange={(e) => builder.setGridVisible(e.currentTarget.checked)}
									/>
									vis
								</label>
								<label class="cs-check">
									<input
										type="checkbox"
										checked={builder.snapToGrid}
										onchange={(e) => builder.setSnapToGrid(e.currentTarget.checked)}
									/>
									snap
								</label>
							</div>
							<div class="cs-row">
								<span class="cs-label">Canvas</span>
								<input
									type="number"
									class="cs-num-input cs-num-input--wide"
									value={builder.canvasW}
									min="400"
									step="100"
									oninput={(e) =>
										builder.setCanvasSize(Number(e.currentTarget.value), builder.canvasH)}
								/>
								<span class="cs-unit">×</span>
								<input
									type="number"
									class="cs-num-input cs-num-input--wide"
									value={builder.canvasH}
									min="400"
									step="100"
									oninput={(e) =>
										builder.setCanvasSize(builder.canvasW, Number(e.currentTarget.value))}
								/>
							</div>
						</div>
					</div>

				<!-- ── Single component selected: existing props panel ────── -->
				{:else if builder.selectionMode === 'item' && builder.selected && selectedMeta}
					<div class="props-header">
						<span class="props-component-name">{selectedMeta.label}</span>
						<button
							class="props-delete-btn"
							onclick={() => builder.deleteItem(builder.selected!.id)}
							title="Delete component (Delete key)"
						>✕</button>
					</div>

					<div class="props-list">
						<PropEditor
							meta={selectedMeta}
							values={builder.selected.props}
							onchange={(key, value) => updateProp(key, value)}
						/>

						<div class="prop-divider">Layout</div>
						<div class="prop-row prop-row--info">
							<span class="prop-label">X, Y</span>
							<span class="prop-info">{builder.selected.x}, {builder.selected.y}</span>
						</div>
						<div class="prop-row prop-row--info">
							<span class="prop-label">W × H</span>
							<span class="prop-info">
								{builder.selected.w || 'auto'} × {builder.selected.h || 'auto'}
							</span>
						</div>
						<div class="prop-row prop-row--info">
							<span class="prop-label">Group</span>
							<span class="prop-info"
								>{builder.selected.groupId
									? (builder.groups.find((g) => g.id === builder.selected!.groupId)?.name ??
										'—')
									: '—'}</span
							>
						</div>
					</div>

				<!-- ── Group selected: Group panel ───────────────────────── -->
				{:else if builder.selectionMode === 'group' && builder.selectedGroup}
					{@const grp = builder.selectedGroup}
					<div class="group-panel">
						<!-- Group name -->
						<div class="gp-header">
							<span class="gp-icon">📁</span>
							{#if renamingId === grp.id}
								<!-- svelte-ignore a11y_autofocus -->
								<input
									bind:this={renameInputEl}
									class="gp-name-input"
									bind:value={renameValue}
									onblur={commitRename}
									onkeydown={handleRenameKeydown}
									autofocus
								/>
							{:else}
								<span
									class="gp-name"
									role="button"
									tabindex="-1"
									ondblclick={() => scheduleRename(grp.id, grp.name)}
									onkeydown={(e) => {
										if (e.key === 'Enter') scheduleRename(grp.id, grp.name);
									}}
									title="Double-click to rename"
								>
									{grp.name}
								</span>
							{/if}
							<span class="gp-count">{selectedGroupMembers.length} items</span>
						</div>

						<!-- Member list -->
						<div class="gp-members">
							{#each selectedGroupMembers as item (item.id)}
								<div class="gp-member-row">
									<span class="gp-member-name">{displayName(item)}</span>
									<LayerControls
										visible={item.visible}
										locked={item.locked}
										onToggleVisible={() => builder.toggleItemVisible(item.id)}
										onToggleLocked={() => builder.toggleItemLocked(item.id)}
									/>
									<button
										class="gp-remove-btn"
										onclick={() => builder.removeFromGroup(item.id)}
										title="Remove from group (stays on canvas)"
									>✕</button>
								</div>
							{/each}
							{#if selectedGroupMembers.length === 0}
								<div class="gp-empty">No items in group</div>
							{/if}
						</div>

						<!-- Actions -->
						<div class="gp-actions">
							<button
								class="gp-action-btn"
								class:gp-action-btn--active={addingToGroupId === grp.id}
								onclick={() =>
									(addingToGroupId = addingToGroupId === grp.id ? null : grp.id)}
							>
								{addingToGroupId === grp.id ? '↩ Cancel' : '+ Add from canvas…'}
							</button>
							<button
								class="gp-action-btn gp-action-btn--danger"
								onclick={() => builder.deleteGroup(grp.id)}
							>
								Ungroup
							</button>
						</div>

						<!-- Bounding box readout -->
						{#if selectedGroupBounds}
							{@const b = selectedGroupBounds}
							<div class="gp-bounds">
								<div class="prop-divider">Layout</div>
								<div class="prop-row prop-row--info">
									<span class="prop-label">X, Y</span>
									<span class="prop-info">{b.x}, {b.y}</span>
								</div>
								<div class="prop-row prop-row--info">
									<span class="prop-label">W × H</span>
									<span class="prop-info">{b.w} × {b.h}</span>
								</div>
							</div>
						{/if}
					</div>

				<!-- ── Multi-select: action bar ───────────────────────────── -->
				{:else if builder.selectionMode === 'multi'}
					<div class="multi-panel">
						<div class="multi-header">{builder.multiSelectedIds.length} SELECTED</div>

						<div class="multi-section">
							<button class="multi-group-btn" onclick={handleAddGroup}>
								⊞ Group {builder.multiSelectedIds.length} items
							</button>
						</div>

						<div class="multi-section">
							<div class="multi-section-title">ALIGN</div>
							<div class="align-row">
								<button class="align-btn" onclick={() => builder.alignItems('left')} title="Align left edges">◧</button>
								<button class="align-btn" onclick={() => builder.alignItems('h-center')} title="Center horizontally">⬡</button>
								<button class="align-btn" onclick={() => builder.alignItems('right')} title="Align right edges">◨</button>
							</div>
							<div class="align-row">
								<button class="align-btn" onclick={() => builder.alignItems('top')} title="Align top edges">⬒</button>
								<button class="align-btn" onclick={() => builder.alignItems('v-center')} title="Center vertically">⬡</button>
								<button class="align-btn" onclick={() => builder.alignItems('bottom')} title="Align bottom edges">⬓</button>
							</div>
						</div>

						{#if builder.multiSelectedIds.length >= 3}
							<div class="multi-section">
								<div class="multi-section-title">DISTRIBUTE</div>
								<div class="align-row">
									<button class="align-btn align-btn--wide" onclick={() => builder.distributeItems('horizontal')} title="Distribute horizontal spacing">⟺ H</button>
									<button class="align-btn align-btn--wide" onclick={() => builder.distributeItems('vertical')} title="Distribute vertical spacing">↕ V</button>
								</div>
							</div>
						{/if}

						<div class="multi-section multi-section--danger">
							<button
								class="multi-delete-btn"
								onclick={() => builder.deleteItems([...builder.multiSelectedIds])}
							>
								Delete all
							</button>
						</div>
					</div>
				{/if}

			<!-- ── TOURS TAB ─────────────────────────────────────────────── -->
			{:else if rightTab === 'tours'}
				<div class="tours-panel">

					<!-- Draft section -->
					<div class="tours-section">
						<div class="tours-section-header">
							<span class="tours-section-title">DRAFT TOUR</span>
							<button
								class="tour-rec-btn"
								class:tour-rec-btn--active={recordingMode}
								onclick={() => (recordingMode = !recordingMode)}
								title={recordingMode ? 'Stop recording' : 'Start recording — click items on canvas'}
							>
								{recordingMode ? '◉ REC' : '○ REC'}
							</button>
						</div>

						{#if recordingMode}
							<div class="tour-rec-hint">Click canvas items to record steps</div>
						{/if}

						{#if draftSteps.length > 0}
							<div class="tour-steps">
								{#each draftSteps as step, i}
									<div class="tour-step-row">
										<div class="tour-step-reorder">
											<button class="tour-step-move" onclick={() => moveDraftStep(i, -1)} disabled={i === 0} title="Move up">↑</button>
											<button class="tour-step-move" onclick={() => moveDraftStep(i, 1)} disabled={i === draftSteps.length - 1} title="Move down">↓</button>
										</div>
										<span class="tour-step-icon">{step.target === 'fit-all' ? '⊙' : '⊞'}</span>
										<div class="tour-step-body">
											<div class="tour-step-target">{stepTargetLabel(step)}</div>
											<div class="tour-step-fields">
												<input
													type="text"
													class="tour-step-input tour-step-input--label"
													placeholder="label"
													value={step.label ?? ''}
													oninput={(e) => updateDraftStep(i, { label: e.currentTarget.value || undefined })}
												/>
												<input
													type="number"
													class="tour-step-input tour-step-input--hold"
													placeholder="hold ms"
													value={step.holdMs ?? 0}
													min="0"
													step="500"
													oninput={(e) => updateDraftStep(i, { holdMs: Number(e.currentTarget.value) })}
												/>
											</div>
										</div>
										<button class="tour-step-remove" onclick={() => removeDraftStep(i)} title="Remove step">✕</button>
									</div>
								{/each}
							</div>
						{:else}
							<div class="tour-steps-empty">No steps — {recordingMode ? 'click items above' : 'enable REC and click items'}</div>
						{/if}

						<button class="tour-add-btn" onclick={addFitAllStep}>+ Add fit-all step</button>

						<div class="tour-save-row">
							<input
								type="text"
								class="tour-name-input"
								placeholder="Tour name…"
								bind:value={draftTourName}
							/>
							<button
								class="tour-save-btn"
								disabled={!draftTourName.trim() || draftSteps.length === 0}
								onclick={saveDraftTour}
							>Save</button>
						</div>
						{#if draftSteps.length > 0 || draftTourName}
							<button class="tour-clear-btn" onclick={clearDraft}>Clear draft</button>
						{/if}
					</div>

					<!-- Saved tours -->
					{#if Object.keys(builder.tours).length > 0}
						<div class="tours-section">
							<div class="tours-section-header">
								<span class="tours-section-title">SAVED TOURS</span>
							</div>
							<div class="tour-saved-list">
								{#each Object.entries(builder.tours) as [name, steps]}
									<div class="tour-saved-row" class:tour-saved-row--active={activeTourName === name}>
										<div class="tour-saved-info">
											<span class="tour-saved-name">{name}</span>
											<span class="tour-saved-count">{steps.length} step{steps.length !== 1 ? 's' : ''}</span>
										</div>
										<div class="tour-saved-actions">
											<button
												class="tour-action-btn"
												onclick={() => launchTour(name)}
												title="Play tour"
											>▶</button>
											<button
												class="tour-action-btn tour-action-btn--edit"
												onclick={() => { draftSteps = [...steps]; draftTourName = name; }}
												title="Load into draft to edit"
											>✎</button>
											<button
												class="tour-action-btn tour-action-btn--del"
												onclick={() => { builder.deleteTour(name); if (activeTourName === name) stopTour(); }}
												title="Delete tour"
											>✕</button>
										</div>
									</div>
								{/each}
							</div>
						</div>
					{/if}

					<!-- Playback controls -->
					{#if activeTourController}
						{@const tourSteps = builder.tours[activeTourName] ?? []}
						<div class="tour-playback">
							<div class="tour-playback-header">
								<span class="tour-playback-name">{activeTourName}</span>
								<span class="tour-playback-progress">{activeTourStep + 1} / {tourSteps.length}</span>
							</div>
							{#if tourSteps[activeTourStep]}
								<div class="tour-playback-step">
									{stepTargetLabel(tourSteps[activeTourStep])}{tourSteps[activeTourStep].label ? ` — ${tourSteps[activeTourStep].label}` : ''}
								</div>
							{/if}
							<div class="tour-playback-controls">
								<button class="tour-ctrl-btn" onclick={() => activeTourController?.prev()} title="Previous">◀</button>
								{#if activeTourPlaying}
									<button class="tour-ctrl-btn tour-ctrl-btn--play" onclick={() => activeTourController?.pause()} title="Pause">⏸</button>
								{:else}
									<button class="tour-ctrl-btn tour-ctrl-btn--play" onclick={() => activeTourController?.play()} title="Play">▶</button>
								{/if}
								<button class="tour-ctrl-btn" onclick={() => activeTourController?.next()} title="Next">▶▶</button>
								<button class="tour-ctrl-btn tour-ctrl-btn--stop" onclick={stopTour} title="Stop">■</button>
							</div>
						</div>
					{/if}

				</div>

			<!-- ── AI TAB ──────────────────────────────────────────────────── -->
			{:else}
				<div class="ai-panel">

					<!-- Slug + compare row -->
					<div class="slug-row">
						<label class="slug-label" for="mockup-slug">MOCKUP SLUG</label>
						<div class="slug-input-wrap">
							<input
								id="mockup-slug"
								class="slug-input"
								type="text"
								placeholder="my-feature"
								bind:value={mockupSlug}
							/>
							{#if mockupSlug}
								<a
									href="{base}/mockups/{mockupSlug}"
									target="_blank"
									class="slug-link"
									title="Open mockup in new tab"
								>↗</a>
							{/if}
						</div>
						<div class="slug-hint">/mockups/{mockupSlug || '…'}/+page.svelte</div>
					</div>

					<!-- Version history chips -->
					{#if variants.length > 0}
						<div class="variants-bar">
							{#each variants as v (v.slug)}
								<button
									class="variant-chip"
									class:variant-chip--active={mockupSlug === v.slug}
									onclick={() => { mockupSlug = v.slug; if (splitView) iframeKey++; }}
									title={v.slug}
								>v{v.version}</button>
							{/each}
							{#if variants.length >= 2}
								<a href="{base}{compareUrl()}" target="_blank" class="compare-chip">⊟ compare</a>
							{/if}
						</div>
					{/if}

					<ChatThread messages={chatMessages} onSend={sendChat}>
						{#snippet actions()}
							<button
								class="copy-brief-btn"
								class:copy-brief-btn--copied={copyState === 'copied'}
								onclick={copyBrief}
							>
								{copyState === 'copied' ? '✓ COPIED' : '⊕ COPY BRIEF TO CLAUDE CODE'}
							</button>
						{/snippet}
					</ChatThread>
				</div>
			{/if}
		</aside>
	</div>
</div>

<style>
	/* ── Root layout ─────────────────────────────────────────────────────────── */
	.builder-root {
		display: flex;
		flex-direction: column;
		height: 100dvh;
		overflow: hidden;
		background: var(--bg, #060b14);
		color: var(--fg, #e2e8f0);
	}

	/* ── Header ──────────────────────────────────────────────────────────────── */
	.builder-header {
		display: flex;
		align-items: center;
		gap: 16px;
		padding: 0 16px;
		height: 48px;
		flex-shrink: 0;
		border-bottom: 1px solid var(--border, rgba(94, 234, 212, 0.12));
		background: var(--bg-elev, #0a1120);
	}

	.back-link {
		font-family: var(--mono);
		font-size: 10px;
		letter-spacing: 0.2em;
		color: var(--fg-dim);
		text-decoration: none;
		transition: color 0.15s;
	}
	.back-link:hover {
		color: var(--accent);
	}

	.builder-title {
		font-family: var(--mono);
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.3em;
		color: var(--accent);
		flex: 1;
	}

	.builder-toolbar {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.item-count {
		font-family: var(--mono);
		font-size: 9px;
		letter-spacing: 0.15em;
		color: var(--fg-dim);
		margin-right: 4px;
	}

	.toolbar-btn {
		font-family: var(--mono);
		font-size: 9px;
		font-weight: 700;
		letter-spacing: 0.18em;
		padding: 6px 12px;
		border: 1px solid var(--border, rgba(94, 234, 212, 0.2));
		background: transparent;
		color: var(--fg-muted);
		cursor: pointer;
		border-radius: 2px;
		transition:
			border-color 0.15s,
			color 0.15s;
	}
	.toolbar-btn:hover {
		border-color: var(--accent);
		color: var(--accent);
	}
	.toolbar-btn--accent {
		border-color: rgba(94, 234, 212, 0.4);
		color: var(--accent);
	}
	.toolbar-btn--accent:hover {
		background: rgba(94, 234, 212, 0.08);
	}
	.toolbar-btn--preview {
		border-color: rgba(250, 204, 21, 0.5);
		color: rgb(250, 204, 21);
		background: rgba(250, 204, 21, 0.06);
	}
	.toolbar-btn--preview:hover {
		background: rgba(250, 204, 21, 0.12);
	}
	.toolbar-btn--active {
		border-color: rgba(94, 234, 212, 0.5);
		color: var(--accent);
		background: rgba(94, 234, 212, 0.06);
	}

	/* ── Body ────────────────────────────────────────────────────────────────── */
	.builder-body {
		display: flex;
		flex: 1;
		overflow: hidden;
	}

	/* ── Toolbox ─────────────────────────────────────────────────────────────── */
	.builder-toolbox {
		width: 220px;
		flex-shrink: 0;
		display: flex;
		flex-direction: column;
		border-right: 1px solid var(--border, rgba(94, 234, 212, 0.12));
		background: var(--bg-elev, #0a1120);
		overflow: hidden;
	}

	.toolbox-search-wrap {
		padding: 10px 12px;
		border-bottom: 1px solid var(--border, rgba(94, 234, 212, 0.1));
	}

	.toolbox-search {
		width: 100%;
		box-sizing: border-box;
		font-family: var(--mono);
		font-size: 11px;
		padding: 6px 10px;
		background: var(--bg, #060b14);
		border: 1px solid var(--border, rgba(94, 234, 212, 0.15));
		border-radius: 2px;
		color: var(--fg);
		outline: none;
	}
	.toolbox-search:focus {
		border-color: var(--accent);
	}
	.toolbox-search::placeholder {
		color: var(--fg-dim);
	}

	.toolbox-list {
		flex: 1;
		overflow-y: auto;
		padding: 8px 0 16px;
	}

	.tool-group {
		margin-bottom: 12px;
	}

	.tool-group-label {
		font-family: var(--mono);
		font-size: 8px;
		font-weight: 700;
		letter-spacing: 0.3em;
		text-transform: uppercase;
		color: var(--fg-dim);
		padding: 8px 14px 4px;
	}

	.tool-item {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 7px 14px;
		font-family: var(--mono);
		font-size: 11px;
		color: var(--fg-muted);
		cursor: grab;
		user-select: none;
		transition:
			background 0.1s,
			color 0.1s;
		border-left: 2px solid transparent;
	}
	.tool-item:hover {
		background: rgba(94, 234, 212, 0.05);
		color: var(--accent);
		border-left-color: rgba(94, 234, 212, 0.4);
	}
	.tool-item:active {
		cursor: grabbing;
	}

	.tool-icon {
		font-size: 12px;
		opacity: 0.5;
	}

	.toolbox-empty {
		padding: 16px 14px;
		font-family: var(--mono);
		font-size: 10px;
		color: var(--fg-dim);
	}

	/* ── Canvas wrapper ──────────────────────────────────────────────────────── */
	.canvas-wrap {
		flex: 1;
		overflow: hidden;
		position: relative;
		background: var(--bg, #060b14);
		transition: flex 0.2s ease;
	}
	.canvas-wrap.canvas-split {
		flex: 0 0 50%;
		border-right: 1px solid var(--border, rgba(94, 234, 212, 0.12));
	}

	/* ── Split preview pane ──────────────────────────────────────────────────── */
	.split-pane {
		flex: 1;
		display: flex;
		flex-direction: column;
		border-left: 1px solid var(--border, rgba(94, 234, 212, 0.12));
		overflow: hidden;
		background: var(--bg, #060b14);
	}

	.split-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0 12px;
		height: 36px;
		flex-shrink: 0;
		border-bottom: 1px solid var(--border, rgba(94, 234, 212, 0.1));
		background: var(--bg-elev, #0a1120);
	}

	.split-label {
		font-family: var(--mono);
		font-size: 10px;
		letter-spacing: 0.12em;
		color: var(--fg-dim);
	}

	.split-no-slug {
		color: rgba(250, 204, 21, 0.6);
		font-style: italic;
	}

	.split-actions {
		display: flex;
		gap: 6px;
	}

	.split-btn {
		font-family: var(--mono);
		font-size: 11px;
		background: none;
		border: none;
		color: var(--fg-dim);
		cursor: pointer;
		padding: 4px 6px;
		border-radius: 2px;
		line-height: 1;
		transition: color 0.15s;
	}
	.split-btn:hover {
		color: var(--accent);
	}

	.split-iframe {
		flex: 1;
		width: 100%;
		border: none;
		background: var(--bg, #060b14);
	}

	.split-empty {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 32px;
	}

	.split-empty-text {
		font-family: var(--mono);
		font-size: 10px;
		letter-spacing: 0.1em;
		color: rgba(94, 234, 212, 0.2);
		text-align: center;
		line-height: 1.8;
		max-width: 260px;
	}

	/* ── Right panel ─────────────────────────────────────────────────────────── */
	.builder-props {
		width: 264px;
		flex-shrink: 0;
		display: flex;
		flex-direction: column;
		border-left: 1px solid var(--border, rgba(94, 234, 212, 0.12));
		background: var(--bg-elev, #0a1120);
		overflow: hidden;
		transition: width 0.15s ease;
	}
	.builder-props--ai {
		width: 300px;
	}

	/* ── Panel tabs ──────────────────────────────────────────────────────────── */
	.panel-tabs {
		display: flex;
		flex-shrink: 0;
		border-bottom: 1px solid var(--border, rgba(94, 234, 212, 0.12));
	}

	.panel-tab {
		flex: 1;
		font-family: var(--mono);
		font-size: 9px;
		font-weight: 700;
		letter-spacing: 0.2em;
		padding: 10px 0;
		background: none;
		border: none;
		border-bottom: 2px solid transparent;
		margin-bottom: -1px;
		color: var(--fg-dim);
		cursor: pointer;
		transition:
			color 0.15s,
			border-color 0.15s;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
	}
	.panel-tab:hover {
		color: var(--fg-muted);
	}
	.panel-tab--active {
		color: var(--accent);
		border-bottom-color: var(--accent);
	}

	.panel-tab-badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 16px;
		height: 16px;
		padding: 0 4px;
		border-radius: 8px;
		background: rgba(94, 234, 212, 0.15);
		color: var(--accent);
		font-size: 8px;
		font-weight: 700;
		letter-spacing: 0;
	}

	/* ── Layers panel ────────────────────────────────────────────────────────── */
	.layers-panel {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-height: 0;
		overflow: hidden;
	}

	.layers-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 10px 12px 6px;
		flex-shrink: 0;
	}

	.layers-title {
		font-family: var(--mono);
		font-size: 8px;
		font-weight: 700;
		letter-spacing: 0.3em;
		color: var(--fg-dim);
	}

	.layers-add-btn {
		font-family: var(--mono);
		font-size: 8px;
		font-weight: 700;
		letter-spacing: 0.15em;
		padding: 3px 8px;
		border: 1px solid rgba(94, 234, 212, 0.2);
		background: transparent;
		color: var(--fg-dim);
		cursor: pointer;
		border-radius: 2px;
		transition:
			border-color 0.15s,
			color 0.15s;
	}
	.layers-add-btn:hover {
		border-color: var(--accent);
		color: var(--accent);
	}

	.layers-search-wrap {
		padding: 0 10px 6px;
		flex-shrink: 0;
	}

	.layers-search {
		width: 100%;
		box-sizing: border-box;
		font-family: var(--mono);
		font-size: 10px;
		padding: 4px 8px;
		background: var(--bg, #060b14);
		border: 1px solid var(--border, rgba(94, 234, 212, 0.12));
		border-radius: 2px;
		color: var(--fg);
		outline: none;
	}
	.layers-search:focus {
		border-color: var(--accent);
	}
	.layers-search::placeholder {
		color: var(--fg-dim);
	}

	.layers-list {
		flex: 1;
		overflow-y: auto;
		padding-bottom: 8px;
	}

	.layers-empty {
		padding: 16px 14px;
		font-family: var(--mono);
		font-size: 9px;
		letter-spacing: 0.1em;
		color: rgba(94, 234, 212, 0.2);
		text-align: center;
	}

	/* ── Layer rows ──────────────────────────────────────────────────────────── */
	.layer-row {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 4px 8px 4px 10px;
		font-family: var(--mono);
		font-size: 10px;
		color: var(--fg-muted);
		cursor: default;
		transition: background 0.1s;
		min-height: 26px;
		box-sizing: border-box;
	}
	.layer-row:hover {
		background: rgba(94, 234, 212, 0.04);
	}
	.layer-row--group {
		border-top: 1px solid rgba(94, 234, 212, 0.06);
		padding-left: 6px;
	}
	.layer-row--child {
		padding-left: 10px;
	}
	.layer-row--drag-over {
		background: rgba(94, 234, 212, 0.08);
		outline: 1px dashed rgba(94, 234, 212, 0.3);
		outline-offset: -2px;
	}
	.layer-row--dragging {
		opacity: 0.4;
	}

	.layer-expand-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 14px;
		height: 14px;
		flex-shrink: 0;
		background: none;
		border: none;
		color: var(--fg-dim);
		cursor: pointer;
		font-size: 8px;
		padding: 0;
	}
	.layer-expand-btn:hover {
		color: var(--accent);
	}

	.layer-type-icon {
		font-size: 11px;
		flex-shrink: 0;
		opacity: 0.6;
	}
	.layer-type-icon--sm {
		font-size: 9px;
	}

	.layer-indent {
		width: 14px;
		flex-shrink: 0;
	}

	.layer-name {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		cursor: pointer;
		padding: 1px 2px;
		border-radius: 2px;
		transition: color 0.1s;
	}
	.layer-name:hover {
		color: var(--accent);
	}

	.layer-rename-input {
		flex: 1;
		min-width: 0;
		font-family: var(--mono);
		font-size: 10px;
		padding: 1px 5px;
		background: var(--bg, #060b14);
		border: 1px solid var(--accent);
		border-radius: 2px;
		color: var(--fg);
		outline: none;
	}

	.layer-row-right {
		display: flex;
		align-items: center;
		gap: 2px;
		flex-shrink: 0;
		margin-left: auto;
	}

	.layer-drag-handle {
		font-size: 10px;
		color: var(--fg-dim);
		cursor: grab;
		opacity: 0;
		transition: opacity 0.1s;
		padding: 0 2px;
		flex-shrink: 0;
	}
	.layer-row:hover .layer-drag-handle {
		opacity: 0.6;
	}
	.layer-drag-handle:active {
		cursor: grabbing;
		opacity: 1;
	}

	/* ── Canvas settings ─────────────────────────────────────────────────────── */
	.canvas-settings {
		flex-shrink: 0;
		border-top: 1px solid var(--border, rgba(94, 234, 212, 0.1));
		padding: 8px 10px 10px;
	}

	.cs-title {
		font-family: var(--mono);
		font-size: 8px;
		font-weight: 700;
		letter-spacing: 0.3em;
		color: var(--fg-dim);
		margin-bottom: 6px;
	}

	.cs-row {
		display: flex;
		align-items: center;
		gap: 5px;
		margin-bottom: 5px;
	}

	.cs-label {
		font-family: var(--mono);
		font-size: 9px;
		color: var(--fg-dim);
		min-width: 38px;
		letter-spacing: 0.05em;
	}

	.cs-num-input {
		width: 44px;
		font-family: var(--mono);
		font-size: 10px;
		padding: 2px 5px;
		background: var(--bg, #060b14);
		border: 1px solid var(--border, rgba(94, 234, 212, 0.12));
		border-radius: 2px;
		color: var(--fg);
		outline: none;
		text-align: center;
	}
	.cs-num-input--wide {
		width: 56px;
	}
	.cs-num-input:focus {
		border-color: var(--accent);
	}

	.cs-unit {
		font-family: var(--mono);
		font-size: 9px;
		color: var(--fg-dim);
	}

	.cs-check {
		display: flex;
		align-items: center;
		gap: 3px;
		font-family: var(--mono);
		font-size: 9px;
		color: var(--fg-dim);
		cursor: pointer;
		user-select: none;
	}
	.cs-check input {
		accent-color: var(--accent);
		cursor: pointer;
	}

	/* ── Props panel ─────────────────────────────────────────────────────────── */
	.props-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 12px 14px;
		border-bottom: 1px solid var(--border, rgba(94, 234, 212, 0.1));
		flex-shrink: 0;
	}

	.props-component-name {
		font-family: var(--mono);
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		color: var(--accent);
	}

	.props-delete-btn {
		font-size: 12px;
		color: var(--fg-dim);
		background: none;
		border: none;
		cursor: pointer;
		padding: 2px 6px;
		border-radius: 2px;
		transition:
			color 0.15s,
			background 0.15s;
		line-height: 1;
	}
	.props-delete-btn:hover {
		color: #fca5a5;
		background: rgba(252, 165, 165, 0.1);
	}

	.props-list {
		flex: 1;
		overflow-y: auto;
		padding: 8px 0 24px;
	}

	.prop-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		padding: 6px 14px;
	}
	.prop-row--info {
		opacity: 0.7;
	}

	.prop-label {
		font-family: var(--mono);
		font-size: 9px;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--fg-dim);
		flex-shrink: 0;
		min-width: 80px;
	}

	.prop-info {
		font-family: var(--mono);
		font-size: 10px;
		color: var(--fg-muted);
	}

	.prop-divider {
		font-family: var(--mono);
		font-size: 8px;
		font-weight: 700;
		letter-spacing: 0.3em;
		text-transform: uppercase;
		color: var(--fg-dim);
		padding: 14px 14px 4px;
		border-top: 1px solid var(--border, rgba(94, 234, 212, 0.08));
		margin-top: 8px;
	}
	/* ── Group panel ─────────────────────────────────────────────────────────── */
	.group-panel {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-height: 0;
		overflow-y: auto;
	}

	.gp-header {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 12px 12px 10px;
		border-bottom: 1px solid var(--border, rgba(94, 234, 212, 0.1));
		flex-shrink: 0;
	}

	.gp-icon {
		font-size: 13px;
		flex-shrink: 0;
	}

	.gp-name {
		flex: 1;
		font-family: var(--mono);
		font-size: 11px;
		font-weight: 700;
		color: var(--accent);
		letter-spacing: 0.1em;
		cursor: text;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.gp-name-input {
		flex: 1;
		font-family: var(--mono);
		font-size: 11px;
		font-weight: 700;
		padding: 2px 6px;
		background: var(--bg, #060b14);
		border: 1px solid var(--accent);
		border-radius: 2px;
		color: var(--accent);
		outline: none;
		min-width: 0;
	}

	.gp-count {
		font-family: var(--mono);
		font-size: 8px;
		letter-spacing: 0.1em;
		color: var(--fg-dim);
		flex-shrink: 0;
	}

	.gp-members {
		flex: 1;
		overflow-y: auto;
		padding: 4px 0;
	}

	.gp-member-row {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 5px 10px 5px 14px;
		transition: background 0.1s;
	}
	.gp-member-row:hover {
		background: rgba(94, 234, 212, 0.04);
	}

	.gp-member-name {
		flex: 1;
		font-family: var(--mono);
		font-size: 10px;
		color: var(--fg-muted);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.gp-remove-btn {
		font-size: 10px;
		color: var(--fg-dim);
		background: none;
		border: none;
		cursor: pointer;
		padding: 2px 4px;
		border-radius: 2px;
		flex-shrink: 0;
		transition: color 0.15s;
	}
	.gp-remove-btn:hover {
		color: #fca5a5;
	}

	.gp-empty {
		padding: 12px 14px;
		font-family: var(--mono);
		font-size: 9px;
		color: rgba(94, 234, 212, 0.2);
		text-align: center;
	}

	.gp-actions {
		display: flex;
		gap: 6px;
		padding: 8px 10px;
		border-top: 1px solid var(--border, rgba(94, 234, 212, 0.08));
		flex-shrink: 0;
	}

	.gp-action-btn {
		flex: 1;
		font-family: var(--mono);
		font-size: 9px;
		font-weight: 700;
		letter-spacing: 0.12em;
		padding: 5px 8px;
		border: 1px solid rgba(94, 234, 212, 0.15);
		background: transparent;
		color: var(--fg-dim);
		cursor: pointer;
		border-radius: 2px;
		transition:
			border-color 0.15s,
			color 0.15s,
			background 0.15s;
		text-align: center;
	}
	.gp-action-btn:hover {
		border-color: var(--accent);
		color: var(--accent);
	}
	.gp-action-btn--active {
		border-color: rgba(94, 234, 212, 0.5);
		color: var(--accent);
		background: rgba(94, 234, 212, 0.06);
	}
	.gp-action-btn--danger:hover {
		border-color: rgba(252, 165, 165, 0.5);
		color: #fca5a5;
		background: rgba(252, 165, 165, 0.05);
	}

	.gp-bounds {
		flex-shrink: 0;
	}

	/* ── Multi-select panel ──────────────────────────────────────────────────── */
	.multi-panel {
		flex: 1;
		display: flex;
		flex-direction: column;
		padding: 0;
	}

	.multi-header {
		font-family: var(--mono);
		font-size: 9px;
		font-weight: 700;
		letter-spacing: 0.25em;
		color: rgba(165, 180, 252, 0.8);
		padding: 12px 14px 8px;
		border-bottom: 1px solid var(--border, rgba(94, 234, 212, 0.1));
	}

	.multi-section {
		padding: 8px 10px;
		border-bottom: 1px solid var(--border, rgba(94, 234, 212, 0.06));
	}
	.multi-section--danger {
		margin-top: auto;
		border-top: 1px solid rgba(252, 165, 165, 0.1);
		border-bottom: none;
	}

	.multi-section-title {
		font-family: var(--mono);
		font-size: 8px;
		font-weight: 700;
		letter-spacing: 0.3em;
		color: var(--fg-dim);
		margin-bottom: 6px;
	}

	.multi-group-btn {
		width: 100%;
		font-family: var(--mono);
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.12em;
		padding: 7px 10px;
		border: 1px solid rgba(94, 234, 212, 0.25);
		background: transparent;
		color: var(--fg-muted);
		cursor: pointer;
		border-radius: 2px;
		transition:
			border-color 0.15s,
			color 0.15s,
			background 0.15s;
		text-align: center;
	}
	.multi-group-btn:hover {
		border-color: var(--accent);
		color: var(--accent);
		background: rgba(94, 234, 212, 0.04);
	}

	.align-row {
		display: flex;
		gap: 4px;
		margin-bottom: 4px;
	}

	.align-btn {
		flex: 1;
		font-family: var(--mono);
		font-size: 13px;
		padding: 5px 0;
		border: 1px solid rgba(94, 234, 212, 0.12);
		background: transparent;
		color: var(--fg-dim);
		cursor: pointer;
		border-radius: 2px;
		transition:
			border-color 0.15s,
			color 0.15s,
			background 0.15s;
		line-height: 1;
	}
	.align-btn:hover {
		border-color: rgba(94, 234, 212, 0.4);
		color: var(--accent);
		background: rgba(94, 234, 212, 0.05);
	}
	.align-btn--wide {
		font-size: 9px;
		letter-spacing: 0.1em;
	}

	.multi-delete-btn {
		width: 100%;
		font-family: var(--mono);
		font-size: 9px;
		font-weight: 700;
		letter-spacing: 0.15em;
		padding: 7px 10px;
		border: 1px solid rgba(252, 165, 165, 0.2);
		background: transparent;
		color: rgba(252, 165, 165, 0.6);
		cursor: pointer;
		border-radius: 2px;
		transition:
			border-color 0.15s,
			color 0.15s,
			background 0.15s;
	}
	.multi-delete-btn:hover {
		border-color: rgba(252, 165, 165, 0.5);
		color: #fca5a5;
		background: rgba(252, 165, 165, 0.05);
	}

	/* ── AI panel ────────────────────────────────────────────────────────────── */
	.ai-panel {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-height: 0;
		overflow: hidden;
	}

	.slug-row {
		flex-shrink: 0;
		padding: 10px 12px 8px;
		border-bottom: 1px solid var(--border, rgba(94, 234, 212, 0.1));
	}

	.slug-label {
		display: block;
		font-family: var(--mono);
		font-size: 8px;
		font-weight: 700;
		letter-spacing: 0.25em;
		color: var(--fg-dim);
		margin-bottom: 5px;
	}

	.slug-input-wrap {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.slug-input {
		flex: 1;
		font-family: var(--mono);
		font-size: 11px;
		padding: 5px 8px;
		background: var(--bg, #060b14);
		border: 1px solid var(--border, rgba(94, 234, 212, 0.15));
		border-radius: 2px;
		color: var(--fg);
		outline: none;
		transition: border-color 0.15s;
		min-width: 0;
	}
	.slug-input:focus {
		border-color: var(--accent);
	}
	.slug-input::placeholder {
		color: var(--fg-dim);
	}

	.slug-link {
		font-family: var(--mono);
		font-size: 13px;
		color: var(--fg-dim);
		text-decoration: none;
		transition: color 0.15s;
		line-height: 1;
		flex-shrink: 0;
	}
	.slug-link:hover {
		color: var(--accent);
	}

	.slug-hint {
		font-family: var(--mono);
		font-size: 9px;
		letter-spacing: 0.06em;
		color: rgba(94, 234, 212, 0.25);
		margin-top: 4px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	/* ── Variant history chips ───────────────────────────────────────────────── */
	.variants-bar {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 6px 12px;
		border-bottom: 1px solid var(--border, rgba(94, 234, 212, 0.08));
		flex-shrink: 0;
		flex-wrap: wrap;
	}

	.variant-chip {
		font-family: var(--mono);
		font-size: 9px;
		font-weight: 700;
		letter-spacing: 0.1em;
		padding: 3px 8px;
		border: 1px solid var(--border, rgba(94, 234, 212, 0.15));
		border-radius: 2px;
		background: transparent;
		color: var(--fg-dim);
		cursor: pointer;
		transition: all 0.12s;
	}
	.variant-chip:hover { color: var(--accent); border-color: rgba(94, 234, 212, 0.4); }
	.variant-chip--active { color: var(--accent); border-color: var(--accent); background: rgba(94, 234, 212, 0.06); }

	.compare-chip {
		font-family: var(--mono);
		font-size: 9px;
		font-weight: 700;
		letter-spacing: 0.1em;
		padding: 3px 8px;
		border: 1px solid rgba(94, 234, 212, 0.25);
		border-radius: 2px;
		color: var(--fg-muted);
		text-decoration: none;
		transition: all 0.12s;
		margin-left: auto;
	}
	.compare-chip:hover { border-color: var(--accent); color: var(--accent); }

	/* ── Tours panel ────────────────────────────────────────────────────────── */
	.tours-panel {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-height: 0;
		overflow-y: auto;
	}

	.tours-section {
		border-bottom: 1px solid var(--border, rgba(94, 234, 212, 0.1));
		padding: 10px 12px;
		flex-shrink: 0;
	}

	.tours-section-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 8px;
	}

	.tours-section-title {
		font-family: var(--mono);
		font-size: 8px;
		font-weight: 700;
		letter-spacing: 0.3em;
		color: var(--fg-dim);
	}

	.tour-rec-btn {
		font-family: var(--mono);
		font-size: 9px;
		font-weight: 700;
		letter-spacing: 0.12em;
		padding: 3px 8px;
		border: 1px solid rgba(252, 165, 165, 0.3);
		background: transparent;
		color: rgba(252, 165, 165, 0.7);
		cursor: pointer;
		border-radius: 2px;
		transition: border-color 0.15s, color 0.15s, background 0.15s;
	}
	.tour-rec-btn:hover {
		border-color: rgba(252, 165, 165, 0.6);
		color: #fca5a5;
	}
	.tour-rec-btn--active {
		border-color: rgba(252, 165, 165, 0.7);
		color: #fca5a5;
		background: rgba(252, 165, 165, 0.1);
		animation: rec-pulse 1.2s ease-in-out infinite;
	}

	@keyframes rec-pulse {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.55; }
	}

	.tour-rec-hint {
		font-family: var(--mono);
		font-size: 9px;
		letter-spacing: 0.06em;
		color: rgba(252, 165, 165, 0.5);
		margin-bottom: 6px;
		font-style: italic;
	}

	.tour-steps {
		display: flex;
		flex-direction: column;
		gap: 4px;
		margin-bottom: 8px;
	}

	.tour-step-row {
		display: flex;
		align-items: flex-start;
		gap: 4px;
		padding: 5px 6px;
		background: var(--bg, #060b14);
		border: 1px solid var(--border, rgba(94, 234, 212, 0.1));
		border-radius: 2px;
	}

	.tour-step-reorder {
		display: flex;
		flex-direction: column;
		gap: 1px;
		flex-shrink: 0;
	}

	.tour-step-move {
		font-size: 9px;
		line-height: 1;
		padding: 2px 3px;
		background: none;
		border: none;
		color: var(--fg-dim);
		cursor: pointer;
		border-radius: 1px;
		transition: color 0.1s;
	}
	.tour-step-move:hover:not(:disabled) { color: var(--accent); }
	.tour-step-move:disabled { opacity: 0.2; cursor: default; }

	.tour-step-icon {
		font-size: 11px;
		opacity: 0.6;
		flex-shrink: 0;
		padding-top: 2px;
	}

	.tour-step-body {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 3px;
	}

	.tour-step-target {
		font-family: var(--mono);
		font-size: 10px;
		color: var(--fg-muted);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.tour-step-fields {
		display: flex;
		gap: 4px;
	}

	.tour-step-input {
		font-family: var(--mono);
		font-size: 9px;
		padding: 2px 5px;
		background: rgba(94, 234, 212, 0.03);
		border: 1px solid var(--border, rgba(94, 234, 212, 0.1));
		border-radius: 2px;
		color: var(--fg-dim);
		outline: none;
		transition: border-color 0.15s;
	}
	.tour-step-input:focus { border-color: var(--accent); color: var(--fg); }
	.tour-step-input::placeholder { color: rgba(94, 234, 212, 0.2); }
	.tour-step-input--label { flex: 1; min-width: 0; }
	.tour-step-input--hold { width: 54px; flex-shrink: 0; }

	.tour-step-remove {
		font-size: 10px;
		color: var(--fg-dim);
		background: none;
		border: none;
		cursor: pointer;
		padding: 2px 3px;
		border-radius: 2px;
		flex-shrink: 0;
		align-self: center;
		transition: color 0.15s;
		line-height: 1;
	}
	.tour-step-remove:hover { color: #fca5a5; }

	.tour-steps-empty {
		font-family: var(--mono);
		font-size: 9px;
		letter-spacing: 0.06em;
		color: rgba(94, 234, 212, 0.2);
		text-align: center;
		padding: 8px 0;
		margin-bottom: 4px;
	}

	.tour-add-btn {
		width: 100%;
		font-family: var(--mono);
		font-size: 9px;
		letter-spacing: 0.1em;
		padding: 5px;
		border: 1px dashed rgba(94, 234, 212, 0.15);
		background: transparent;
		color: var(--fg-dim);
		cursor: pointer;
		border-radius: 2px;
		margin-bottom: 8px;
		transition: border-color 0.15s, color 0.15s;
	}
	.tour-add-btn:hover { border-color: rgba(94, 234, 212, 0.35); color: var(--accent); }

	.tour-save-row {
		display: flex;
		gap: 6px;
		align-items: center;
	}

	.tour-name-input {
		flex: 1;
		font-family: var(--mono);
		font-size: 10px;
		padding: 4px 8px;
		background: var(--bg, #060b14);
		border: 1px solid var(--border, rgba(94, 234, 212, 0.15));
		border-radius: 2px;
		color: var(--fg);
		outline: none;
		transition: border-color 0.15s;
		min-width: 0;
	}
	.tour-name-input:focus { border-color: var(--accent); }
	.tour-name-input::placeholder { color: var(--fg-dim); }

	.tour-save-btn {
		font-family: var(--mono);
		font-size: 9px;
		font-weight: 700;
		letter-spacing: 0.12em;
		padding: 4px 10px;
		border: 1px solid rgba(94, 234, 212, 0.3);
		background: transparent;
		color: var(--fg-muted);
		cursor: pointer;
		border-radius: 2px;
		flex-shrink: 0;
		transition: border-color 0.15s, color 0.15s, background 0.15s;
	}
	.tour-save-btn:hover:not(:disabled) {
		border-color: var(--accent);
		color: var(--accent);
		background: rgba(94, 234, 212, 0.05);
	}
	.tour-save-btn:disabled { opacity: 0.3; cursor: default; }

	.tour-clear-btn {
		width: 100%;
		font-family: var(--mono);
		font-size: 9px;
		letter-spacing: 0.1em;
		padding: 4px;
		border: none;
		background: transparent;
		color: rgba(252, 165, 165, 0.35);
		cursor: pointer;
		margin-top: 5px;
		transition: color 0.15s;
		text-align: center;
	}
	.tour-clear-btn:hover { color: #fca5a5; }

	.tour-saved-list {
		display: flex;
		flex-direction: column;
		gap: 3px;
	}

	.tour-saved-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 6px;
		padding: 6px 8px;
		border: 1px solid var(--border, rgba(94, 234, 212, 0.08));
		border-radius: 2px;
		transition: background 0.1s, border-color 0.1s;
	}
	.tour-saved-row:hover { background: rgba(94, 234, 212, 0.03); border-color: rgba(94, 234, 212, 0.15); }
	.tour-saved-row--active { border-color: rgba(94, 234, 212, 0.3); background: rgba(94, 234, 212, 0.04); }

	.tour-saved-info {
		display: flex;
		flex-direction: column;
		gap: 1px;
		flex: 1;
		min-width: 0;
	}

	.tour-saved-name {
		font-family: var(--mono);
		font-size: 10px;
		color: var(--fg-muted);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.tour-saved-count {
		font-family: var(--mono);
		font-size: 8px;
		letter-spacing: 0.08em;
		color: var(--fg-dim);
	}

	.tour-saved-actions {
		display: flex;
		gap: 3px;
		flex-shrink: 0;
	}

	.tour-action-btn {
		font-family: var(--mono);
		font-size: 10px;
		padding: 3px 6px;
		border: 1px solid transparent;
		background: transparent;
		color: var(--fg-dim);
		cursor: pointer;
		border-radius: 2px;
		transition: color 0.15s, border-color 0.15s, background 0.15s;
		line-height: 1;
	}
	.tour-action-btn:hover {
		color: var(--accent);
		border-color: rgba(94, 234, 212, 0.3);
		background: rgba(94, 234, 212, 0.05);
	}
	.tour-action-btn--edit:hover {
		color: rgba(250, 204, 21, 0.9);
		border-color: rgba(250, 204, 21, 0.3);
		background: rgba(250, 204, 21, 0.05);
	}
	.tour-action-btn--del:hover {
		color: #fca5a5;
		border-color: rgba(252, 165, 165, 0.3);
		background: rgba(252, 165, 165, 0.05);
	}

	.tour-playback {
		margin-top: auto;
		flex-shrink: 0;
		padding: 10px 12px;
		border-top: 1px solid rgba(94, 234, 212, 0.15);
		background: rgba(94, 234, 212, 0.025);
	}

	.tour-playback-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 3px;
	}

	.tour-playback-name {
		font-family: var(--mono);
		font-size: 10px;
		font-weight: 700;
		color: var(--accent);
		letter-spacing: 0.1em;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.tour-playback-progress {
		font-family: var(--mono);
		font-size: 9px;
		color: var(--fg-dim);
		flex-shrink: 0;
	}

	.tour-playback-step {
		font-family: var(--mono);
		font-size: 9px;
		color: var(--fg-dim);
		margin-bottom: 8px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.tour-playback-controls {
		display: flex;
		gap: 4px;
	}

	.tour-ctrl-btn {
		flex: 1;
		font-family: var(--mono);
		font-size: 11px;
		padding: 6px 0;
		border: 1px solid rgba(94, 234, 212, 0.18);
		background: transparent;
		color: var(--fg-dim);
		cursor: pointer;
		border-radius: 2px;
		transition: color 0.15s, border-color 0.15s, background 0.15s;
		line-height: 1;
	}
	.tour-ctrl-btn:hover {
		color: var(--accent);
		border-color: rgba(94, 234, 212, 0.4);
		background: rgba(94, 234, 212, 0.05);
	}
	.tour-ctrl-btn--play {
		color: var(--accent);
		border-color: rgba(94, 234, 212, 0.3);
	}
	.tour-ctrl-btn--stop:hover {
		color: #fca5a5;
		border-color: rgba(252, 165, 165, 0.4);
		background: rgba(252, 165, 165, 0.05);
	}

	/* ── Print styles ────────────────────────────────────────────────────────── */
	@media print {
		.builder-header,
		.builder-toolbox,
		.builder-props,
		.split-pane {
			display: none !important;
		}
		.builder-root {
			height: auto;
			overflow: visible;
		}
		.builder-body {
			overflow: visible;
		}
		.canvas-wrap {
			overflow: visible;
			flex: none;
		}
	}
</style>
