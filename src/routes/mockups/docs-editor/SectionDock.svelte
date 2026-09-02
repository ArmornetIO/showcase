<script lang="ts">
	// The rail docked to a clause's right edge — the same furniture a question
	// card carries in the assessments UI.
	//
	// It replaces a whole side panel. A panel forces you to hold two things in
	// your head at once: which clause is selected, and what the panel is
	// currently showing about it. Docking the affordances to the clause removes
	// that indirection — every icon is about the thing it is attached to, and a
	// lit icon means "there is something here", which is the only cue needed to
	// know a clause has work outstanding.
	//
	// Icons light for CONTENT, not for open state, so a document scanned at rest
	// already shows where its controls, comments and unresolved bindings are.

	import { Icon } from 'showcase';
	import { BINDING_STATUS, type BindingStatus } from './looks.js';

	export type DockPanel = 'evidence' | 'comments' | 'identity' | 'checks';

	interface Props {
		/** Which panel this clause currently has open, if any. */
		open: DockPanel | null;
		/** Controls claimed by this clause. Lights the shield. */
		control_count: number;
		/** Citations backing them. A claim with none is the expensive state. */
		evidence_count: number;
		/** Claims a control and cites nothing — the shield goes red. */
		gap: boolean;
		/** Cited evidence has aged past its cadence — the shield goes amber. */
		stale: boolean;
		comment_count: number;
		/** Commands bound to this clause. */
		check_count: number;
		/** Worst status across them — the whole point of the icon's tone. */
		check_status: BindingStatus | null;
		/** Only set when the clause carries an unresolved re-anchoring decision. */
		drift: boolean;
		ontoggle: (p: DockPanel) => void;
	}

	let {
		open,
		control_count,
		evidence_count,
		gap,
		stale,
		comment_count,
		check_count,
		check_status,
		drift,
		ontoggle
	}: Props = $props();

	const shield_tone = $derived(
		gap
			? 'var(--palette-red)'
			: stale
				? 'var(--palette-amber)'
				: evidence_count > 0
					? 'var(--palette-emerald-l)'
					: 'var(--fg-dim)'
	);

	const check_tone = $derived(
		check_status ? BINDING_STATUS[check_status].color : 'var(--fg-dim)'
	);

	const check_title = $derived(
		check_status
			? `${check_count} check${check_count === 1 ? '' : 's'} · ${BINDING_STATUS[check_status].label}`
			: 'Bind a command that proves this clause'
	);
	const shield_lit = $derived(control_count > 0 || evidence_count > 0);

	const shield_title = $derived(
		gap
			? 'Claims a control and cites nothing'
			: stale
				? 'Evidence past its cadence'
				: evidence_count > 0
					? `${evidence_count} citation${evidence_count === 1 ? '' : 's'}`
					: 'Map a control · cite evidence'
	);

	function btn(active: boolean, tone: string) {
		return active
			? `color:${tone};border-color:color-mix(in srgb, ${tone} 45%, transparent);background:color-mix(in srgb, ${tone} 12%, transparent)`
			: '';
	}
</script>

<div class="flex flex-col items-center gap-1.5 w-[44px] py-2">
	<!-- Controls + the evidence that proves them. The clause's whole job. -->
	<button
		class="relative flex items-center justify-center w-[26px] h-[26px] rounded-[5px] border
		       {open === 'evidence' || shield_lit
			? ''
			: 'border-transparent text-[var(--fg-dim)] hover:text-[var(--accent)] hover:border-[var(--border-strong)]'}"
		style={btn(open === 'evidence' || shield_lit, shield_tone)}
		onclick={() => ontoggle('evidence')}
		aria-pressed={open === 'evidence'}
		aria-label={shield_title}
		title={shield_title}
	>
		<Icon name="shield-check" size={13} />
		{#if control_count > 0}
			<span
				class="absolute -top-1 -right-1 min-w-[13px] h-[13px] px-[3px] rounded-full
				       font-mono text-[0.5rem] leading-[13px] text-center"
				style:color="var(--bg)"
				style:background={shield_tone}
			>
				{control_count}
			</span>
		{/if}
	</button>

	<!-- Checks. The clause's runnable proof — bound, never embedded, because a
	     policy is a legal document and holds no commands of its own. -->
	<button
		class="relative flex items-center justify-center w-[26px] h-[26px] rounded-[5px] border
		       {open === 'checks' || check_count > 0
			? ''
			: 'border-transparent text-[var(--fg-dim)] hover:text-[var(--accent)] hover:border-[var(--border-strong)]'}"
		style={btn(open === 'checks' || check_count > 0, check_tone)}
		onclick={() => ontoggle('checks')}
		aria-pressed={open === 'checks'}
		aria-label={check_title}
		title={check_title}
	>
		<Icon name="zap" size={13} />
		{#if check_count > 0}
			<span
				class="absolute -top-1 -right-1 min-w-[13px] h-[13px] px-[3px] rounded-full
				       font-mono text-[0.5rem] leading-[13px] text-center"
				style:color="var(--bg)"
				style:background={check_tone}
			>
				{check_count}
			</span>
		{/if}
	</button>

	<!-- Comments. Approval is a document-level act, so nothing here votes. -->
	<button
		class="relative flex items-center justify-center w-[26px] h-[26px] rounded-[5px] border
		       {open === 'comments' || comment_count > 0
			? ''
			: 'border-transparent text-[var(--fg-dim)] hover:text-[var(--accent)] hover:border-[var(--border-strong)]'}"
		style={btn(open === 'comments' || comment_count > 0, 'var(--accent)')}
		onclick={() => ontoggle('comments')}
		aria-pressed={open === 'comments'}
		aria-label="{comment_count} comment{comment_count === 1 ? '' : 's'}"
		title={comment_count > 0
			? `${comment_count} comment${comment_count === 1 ? '' : 's'}`
			: 'Comment on this clause'}
	>
		<Icon name="message-square" size={13} />
		{#if comment_count > 0}
			<span
				class="absolute -top-1 -right-1 min-w-[13px] h-[13px] px-[3px] rounded-full
				       font-mono text-[0.5rem] leading-[13px] text-center"
				style:color="var(--bg)"
				style:background="var(--accent)"
			>
				{comment_count}
			</span>
		{/if}
	</button>

	{#if drift}
		<span class="w-4 h-px bg-[var(--border)]"></span>
		<!-- Only appears when a binding is genuinely waiting on a person. -->
		<button
			class="flex items-center justify-center w-[26px] h-[26px] rounded-[5px] border"
			style={btn(true, '#fbbf24')}
			onclick={() => ontoggle('identity')}
			aria-pressed={open === 'identity'}
			aria-label="A binding needs a decision"
			title="A binding needs a decision"
		>
			<Icon name="alert-triangle" size={13} />
		</button>
	{/if}
</div>
