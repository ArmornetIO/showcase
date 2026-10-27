<script lang="ts">
	// Fill in an email's merge fields, preview it, copy it into Gmail.
	// The emails themselves live in $lib/email/templates.ts; the preview is an
	// iframe so showcase's own CSS can't leak in and make it look better than it
	// will in an inbox.
	import { EMAILS } from '$lib/email/templates.js';
	import { esc } from '$lib/email/blocks.js';

	let slug = $state(EMAILS[0].slug);
	const tpl = $derived(EMAILS.find((e) => e.slug === slug) ?? EMAILS[0]);
	let values = $state<Record<string, string>>({});
	let width = $state<'desktop' | 'mobile'>('desktop');
	let status = $state('');
	let frame = $state<HTMLIFrameElement>();
	let height = $state(1200);

	// A blank field stays a merge tag, so the same output works in a mail-merge tool.
	const html = $derived(
		tpl.render(
			Object.fromEntries(
				tpl.fields.map((f) => {
					const v = values[f.key]?.trim();
					return [f.key, v ? esc(v) : `{{${f.key}}}`];
				})
			)
		)
	);

	function fit() {
		const doc = frame?.contentDocument;
		if (doc) height = doc.documentElement.scrollHeight;
	}

	// Rich HTML on the clipboard is what Gmail's compose box renders on paste.
	// The hidden preheader is dropped: compose keeps no head and may show it.
	async function copyForGmail() {
		const body = frame?.contentDocument?.body.cloneNode(true) as HTMLElement | undefined;
		if (!body) return;
		body.querySelector('[data-preheader]')?.remove();
		await navigator.clipboard.write([
			new ClipboardItem({
				'text/html': new Blob([body.innerHTML], { type: 'text/html' }),
				'text/plain': new Blob([body.innerText], { type: 'text/plain' })
			})
		]);
		status = `Copied. Paste into Gmail with ⌘V. Subject: ${tpl.subject}`;
	}

	async function copySource() {
		await navigator.clipboard.writeText(html);
		status = 'HTML source copied, for a mail tool.';
	}
</script>

<div class="page">
	<header class="bar">
		<select bind:value={slug} aria-label="Email">
			{#each EMAILS as e (e.slug)}
				<option value={e.slug}>{e.name}</option>
			{/each}
		</select>
		<div class="seg">
			<button class:on={width === 'desktop'} onclick={() => (width = 'desktop')}>Desktop</button>
			<button class:on={width === 'mobile'} onclick={() => (width = 'mobile')}>Mobile</button>
		</div>
	</header>

	<form class="fields" onsubmit={(e) => (e.preventDefault(), copyForGmail())}>
		{#each tpl.fields as f (f.key)}
			<label>
				{f.label}
				<input bind:value={values[f.key]} placeholder={f.placeholder} autocomplete="off" />
			</label>
		{/each}
		<div class="actions">
			<button class="primary">Copy for Gmail</button>
			<button type="button" onclick={copySource}>Copy HTML</button>
		</div>
		<p class="status">{status || `Subject: ${tpl.subject}`}</p>
	</form>

	<iframe
		bind:this={frame}
		srcdoc={html}
		onload={fit}
		title="{tpl.name} preview"
		style:width={width === 'mobile' ? '390px' : '680px'}
		style:height="{height}px"
	></iframe>
</div>

<style>
	.page {
		min-height: 100vh;
		background: var(--bg);
		padding: 1.25rem 1.25rem 3rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
	}
	.bar,
	.fields {
		width: 100%;
		max-width: 680px;
	}
	.bar {
		display: flex;
		justify-content: space-between;
		gap: 0.5rem;
	}
	.fields {
		display: grid;
		gap: 0.6rem;
	}
	label {
		display: grid;
		gap: 0.25rem;
		font-size: 0.75rem;
		color: var(--fg-dim);
	}
	input,
	select {
		padding: 0.5rem;
		font: inherit;
		font-size: 0.85rem;
		background: var(--surface-raised);
		color: var(--fg);
		border: 1px solid var(--border);
		border-radius: var(--radius-inset);
	}
	.actions {
		display: flex;
		gap: 0.5rem;
	}
	.seg {
		display: flex;
		border: 1px solid var(--border);
		border-radius: var(--radius-inset);
		overflow: hidden;
	}
	button {
		font-family: var(--mono);
		font-size: 0.7rem;
		letter-spacing: 0.06em;
		padding: 0.45rem 0.8rem;
		background: var(--surface-raised);
		color: var(--fg-muted);
		border: 1px solid var(--border);
		border-radius: var(--radius-inset);
		cursor: pointer;
	}
	.seg button {
		border: 0;
		border-radius: 0;
	}
	.seg button.on {
		background: var(--accent-faint-strong);
		color: var(--accent);
	}
	button.primary {
		background: var(--accent);
		color: var(--accent-deep);
		border-color: var(--accent);
		font-weight: 600;
	}
	button:focus-visible,
	input:focus-visible,
	select:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}
	.status {
		margin: 0;
		font-size: 0.75rem;
		color: var(--accent);
	}
	iframe {
		max-width: 100%;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: #06070b;
	}
</style>
