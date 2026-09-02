<script lang="ts">
	import type { Snippet } from 'svelte';
	import { tick } from 'svelte';
	import ChatMessage from './ChatMessage.svelte';

	import type { ChatRole } from './ChatMessage.svelte';
	export type { ChatRole };

	export interface ChatEntry {
		id: string;
		role: ChatRole;
		content: string;
		timestamp?: number;
		/** Display name shown above the bubble (e.g. the commenter). */
		author: string;
	}

	interface Props {
		messages: ChatEntry[];
		placeholder?: string;
		disabled?: boolean;
		onSend: (text: string) => void;
		/** Rendered between the message list and the textarea — use for action buttons. */
		actions?: Snippet;
		class?: string;
	}

	let {
		messages,
		placeholder = 'Describe what you want to build…',
		disabled = false,
		onSend,
		actions,
		class: cls = ''
	}: Props = $props();

	let draft = $state('');
	let listEl = $state<HTMLElement | undefined>();

	$effect(() => {
		const _ = messages.length;
		tick().then(() => {
			if (listEl) listEl.scrollTop = listEl.scrollHeight;
		});
	});

	function send() {
		const text = draft.trim();
		if (!text || disabled) return;
		draft = '';
		onSend(text);
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			send();
		}
	}
</script>

<div class="chat-thread {cls}">
	<div class="chat-messages" bind:this={listEl}>
		{#if messages.length === 0}
			<div class="chat-empty">
				<div class="chat-empty-text">Start by describing the feature you want to design</div>
			</div>
		{/if}
		{#each messages as msg (msg.id)}
			<ChatMessage
				role={msg.role}
				author={msg.author}
				content={msg.content}
				timestamp={msg.timestamp}
			/>
		{/each}
	</div>

	{#if actions}
		<div class="chat-actions">
			{@render actions()}
		</div>
	{/if}

	<div class="chat-input-area">
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<textarea
			class="chat-textarea"
			{placeholder}
			{disabled}
			bind:value={draft}
			onkeydown={handleKeydown}
			rows="3"
		></textarea>
		<button class="chat-send" onclick={send} {disabled} aria-label="Send message">
			↵ SEND
		</button>
	</div>
</div>

<style>
	.chat-thread {
		display: flex;
		flex-direction: column;
		height: 100%;
		min-height: 0;
		overflow: hidden;
	}

	/* ── Messages ─────────────────────────────────────────────────────────────── */
	.chat-messages {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		padding: 8px 0;
		scroll-behavior: smooth;
	}

	.chat-empty {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 100%;
		min-height: 80px;
		padding: 24px;
	}

	.chat-empty-text {
		font-family: var(--mono);
		font-size: 10px;
		letter-spacing: 0.12em;
		color: rgba(94, 234, 212, 0.2);
		text-align: center;
		line-height: 1.6;
	}

	/* ── Actions slot ─────────────────────────────────────────────────────────── */
	.chat-actions {
		flex-shrink: 0;
		padding: 8px 12px;
		border-top: 1px solid var(--border);
	}

	/* ── Input ────────────────────────────────────────────────────────────────── */
	.chat-input-area {
		flex-shrink: 0;
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 10px 12px;
		border-top: 1px solid var(--border);
		background: var(--bg-elev);
	}

	.chat-textarea {
		width: 100%;
		box-sizing: border-box;
		font-family: var(--mono);
		font-size: 11px;
		line-height: 1.5;
		padding: 8px 10px;
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: var(--radius-hairline);
		color: var(--fg);
		outline: none;
		resize: none;
		transition: border-color 0.15s;
	}
	.chat-textarea:focus {
		border-color: var(--accent);
	}
	.chat-textarea::placeholder {
		color: var(--fg-dim);
	}
	.chat-textarea:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.chat-send {
		align-self: flex-end;
		font-family: var(--mono);
		font-size: 9px;
		font-weight: 700;
		letter-spacing: 0.18em;
		padding: 6px 14px;
		border: 1px solid rgba(94, 234, 212, 0.25);
		background: transparent;
		color: var(--fg-muted);
		cursor: pointer;
		border-radius: var(--radius-hairline);
		transition:
			border-color 0.15s,
			color 0.15s,
			background 0.15s;
	}
	.chat-send:hover:not(:disabled) {
		border-color: var(--accent);
		color: var(--accent);
		background: rgba(94, 234, 212, 0.05);
	}
	.chat-send:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}
</style>
