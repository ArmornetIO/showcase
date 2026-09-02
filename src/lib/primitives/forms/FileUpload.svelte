<script lang="ts">
	interface FileUploadProps {
		value?: string;
		filename?: string;
		accept?: string;
		placeholder?: string;
		disabled?: boolean;
		class?: string;
	}

	let {
		value = $bindable(''),
		filename = $bindable(''),
		accept = '*',
		placeholder = 'Drag & drop, paste, or click to browse',
		disabled = false,
		class: cls = ''
	}: FileUploadProps = $props();

	let dragging = $state(false);
	let fileInputEl = $state<HTMLInputElement | null>(null);
	let pasteMode = $state(false);
	let pasteText = $state('');

	function toBase64(file: File): Promise<string> {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = () => resolve((reader.result as string).split(',')[1] ?? '');
			reader.onerror = reject;
			reader.readAsDataURL(file);
		});
	}

	async function handleFile(file: File) {
		filename = file.name;
		value = await toBase64(file);
		pasteMode = false;
		pasteText = '';
	}

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		dragging = false;
		if (disabled) return;
		const file = e.dataTransfer?.files[0];
		if (file) handleFile(file);
	}

	function handleDragover(e: DragEvent) {
		e.preventDefault();
		if (!disabled) dragging = true;
	}

	async function handleFileInput(e: Event) {
		const file = (e.currentTarget as HTMLInputElement).files?.[0];
		if (file) handleFile(file);
	}

	function handlePasteSubmit() {
		if (!pasteText.trim()) return;
		value = btoa(pasteText);
		filename = 'pasted-content.pem';
		pasteMode = false;
		pasteText = '';
	}

	function clear() {
		value = '';
		filename = '';
		pasteText = '';
		pasteMode = false;
		if (fileInputEl) fileInputEl.value = '';
	}
</script>

<div class="file-upload {cls}" class:disabled>
	{#if value && filename}
		<!-- File selected state -->
		<div class="file-selected">
			<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/></svg>
			<span class="file-name">{filename}</span>
			{#if !disabled}
				<button type="button" class="file-clear" onclick={clear} aria-label="Remove file">×</button>
			{/if}
		</div>
	{:else if pasteMode}
		<!-- Paste mode -->
		<div class="paste-area">
			<textarea
				bind:value={pasteText}
				placeholder="Paste PEM content here…"
				rows={5}
				class="paste-textarea"
			></textarea>
			<div class="paste-actions">
				<button type="button" class="paste-confirm" onclick={handlePasteSubmit}>Confirm</button>
				<button type="button" class="paste-cancel" onclick={() => (pasteMode = false)}>Cancel</button>
			</div>
		</div>
	{:else}
		<!-- Drop zone -->
		<!-- svelte-ignore a11y_interactive_supports_focus -->
		<div
			class="drop-zone"
			class:dragging
			role="button"
			aria-label="Upload file"
			ondrop={handleDrop}
			ondragover={handleDragover}
			ondragleave={() => (dragging = false)}
			onclick={() => !disabled && fileInputEl?.click()}
			onkeydown={(e) => e.key === 'Enter' && !disabled && fileInputEl?.click()}
		>
			<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="drop-icon" aria-hidden="true"><path d="M12 3v12"/><path d="m17 8-5-5-5 5"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/></svg>
			<span class="drop-label">{placeholder}</span>
			<span class="drop-hint">— or —</span>
			<button
				type="button"
				class="paste-btn"
				onclick={(e) => { e.stopPropagation(); if (!disabled) pasteMode = true; }}
			>Paste text</button>
		</div>
	{/if}
	<input
		bind:this={fileInputEl}
		type="file"
		{accept}
		{disabled}
		class="hidden-input"
		onchange={handleFileInput}
		tabindex="-1"
		aria-hidden="true"
	/>
</div>

<style>
	.file-upload {
		width: 100%;
	}
	.file-upload.disabled {
		opacity: 0.5;
		pointer-events: none;
	}
	.drop-zone {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
		padding: 20px 16px;
		background: var(--surface-raised);
		border: 1.5px dashed var(--border-strong);
		border-radius: var(--radius-surface);
		cursor: pointer;
		text-align: center;
		transition: border-color 0.2s ease, background 0.2s ease;
	}
	.drop-zone:hover,
	.drop-zone.dragging {
		border-color: var(--accent);
		background: var(--accent-faint);
	}
	.drop-icon {
		color: var(--fg-dim);
	}
	.drop-zone:hover .drop-icon,
	.drop-zone.dragging .drop-icon {
		color: var(--accent);
	}
	.drop-label {
		font-family: var(--sans-brand);
		font-size: 13px;
		color: var(--fg-muted);
	}
	.drop-hint {
		font-family: var(--mono);
		font-size: 11px;
		color: var(--fg-dim);
	}
	.paste-btn {
		background: none;
		border: 1px solid var(--border-strong);
		border-radius: var(--radius-control);
		color: var(--accent);
		font-family: var(--mono);
		font-size: 11px;
		letter-spacing: 0.1em;
		padding: 4px 12px;
		cursor: pointer;
		margin-top: 2px;
		transition: border-color 0.15s, background 0.15s;
	}
	.paste-btn:hover {
		border-color: var(--accent);
		background: var(--accent-faint);
	}
	.paste-area {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.paste-textarea {
		width: 100%;
		background: var(--surface-raised);
		border: 1px solid var(--border);
		border-radius: var(--radius-control);
		color: var(--fg);
		font-family: var(--mono);
		font-size: 12px;
		padding: 10px 12px;
		resize: vertical;
		outline: none;
		min-height: 110px;
		transition: border-color 0.2s ease;
	}
	.paste-textarea:focus {
		border-color: var(--accent);
	}
	.paste-textarea::placeholder {
		color: var(--fg-dim);
	}
	.paste-actions {
		display: flex;
		gap: 8px;
	}
	.paste-confirm,
	.paste-cancel {
		padding: 6px 16px;
		border-radius: var(--radius-control);
		font-family: var(--mono);
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		cursor: pointer;
		border: 1px solid;
		transition: background 0.15s, border-color 0.15s, color 0.15s;
	}
	.paste-confirm {
		background: var(--accent-faint);
		border-color: rgba(94, 234, 212, 0.4);
		color: var(--accent);
	}
	.paste-confirm:hover {
		background: rgba(94, 234, 212, 0.2);
	}
	.paste-cancel {
		background: transparent;
		border-color: var(--border-strong);
		color: var(--fg-muted);
	}
	.paste-cancel:hover {
		border-color: var(--fg-muted);
		color: var(--fg);
	}
	.file-selected {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 10px 14px;
		background: var(--accent-faint);
		border: 1px solid rgba(94, 234, 212, 0.35);
		border-radius: var(--radius-control);
		color: var(--accent);
	}
	.file-name {
		flex: 1;
		min-width: 0;
		font-family: var(--mono);
		font-size: 12px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.file-clear {
		background: none;
		border: none;
		color: var(--accent);
		cursor: pointer;
		font-size: 1rem;
		line-height: 1;
		padding: 0 2px;
		opacity: 0.7;
		transition: opacity 0.15s;
	}
	.file-clear:hover {
		opacity: 1;
	}
	.hidden-input {
		display: none;
	}
</style>
