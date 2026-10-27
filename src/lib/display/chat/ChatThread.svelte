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
		/** Slack-style threading: id of the parent entry this one replies to.
		 *  Absent = a top-level message. Replies render indented under their
		 *  parent; every thread but the newest collapses to an "N replies"
		 *  toggle, so live replies stay visible while history stays short. */
		threadId?: string;
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

	// Threading. Roots keep message order; replies group under their parent.
	// A reply whose parent never arrived degrades to a root rather than vanish.
	const roots = $derived(
		messages.filter((m) => !m.threadId || !messages.some((p) => p.id === m.threadId))
	);
	const repliesOf = $derived.by(() => {
		const map = new Map<string, ChatEntry[]>();
		for (const m of messages) {
			if (!m.threadId || !messages.some((p) => p.id === m.threadId)) continue;
			const list = map.get(m.threadId) ?? [];
			list.push(m);
			map.set(m.threadId, list);
		}
		return map;
	});
	const lastThreadedRootId = $derived.by(() => {
		for (let i = roots.length - 1; i >= 0; i--) {
			if (repliesOf.has(roots[i].id)) return roots[i].id;
		}
		return undefined;
	});
	// User toggles override the default (only the newest thread open).
	let threadOverrides = $state<Record<string, boolean>>({});
	const threadOpen = (id: string) => threadOverrides[id] ?? id === lastThreadedRootId;
	const toggleThread = (id: string) => {
		threadOverrides = { ...threadOverrides, [id]: !threadOpen(id) };
	};

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
		{#each roots as msg (msg.id)}
			<ChatMessage
				role={msg.role}
				author={msg.author}
				content={msg.content}
				timestamp={msg.timestamp}
			/>
			{#if repliesOf.has(msg.id)}
				{@const replies = repliesOf.get(msg.id)!}
				<button class="chat-thread-toggle" onclick={() => toggleThread(msg.id)}>
					{threadOpen(msg.id) ? '▾' : '▸'}
					{replies.length}
					{replies.length === 1 ? 'reply' : 'replies'}
				</button>
				{#if threadOpen(msg.id)}
					<div class="chat-thread-replies">
						{#each replies as reply (reply.id)}
							<ChatMessage
								role={reply.role}
								author={reply.author}
								content={reply.content}
								timestamp={reply.timestamp}
							/>
						{/each}
					</div>
				{/if}
			{/if}
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

	/* ── Threads ─────────────────────────────────────────────────────────────── */
	.chat-thread-toggle {
		display: block;
		margin: 0 0 4px 24px;
		padding: 2px 6px;
		background: transparent;
		border: none;
		cursor: pointer;
		font-family: var(--mono);
		font-size: 10px;
		letter-spacing: 0.15em;
		text-transform: uppercase;
		color: var(--fg-dim);
	}

	.chat-thread-toggle:hover {
		color: var(--fg-muted);
	}

	.chat-thread-replies {
		margin-left: 24px;
		padding-left: 12px;
		border-left: 1px solid var(--border);
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
