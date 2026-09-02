<script lang="ts">
	// Source-code sibling to ConfigBlock (YAML values) and TerminalBlock (terminal
	// sessions / plain output). Highlights Svelte markup and TypeScript with a
	// single-pass tokenizer — no dependency, same approach ConfigBlock already
	// takes. ConfigBlock is really `lang="yaml"` of this component and should be
	// absorbed here once its call sites can be swept.
	import Icon from '../../icons/Icon.svelte';

	interface Props {
		code: string;
		/** Label in the header strip. Omit for a bare block. */
		title?: string;
		/** Strip the common leading indent so the block starts at column 0. */
		dedent?: boolean;
		/** CSS length capping the body height; overflow scrolls. */
		maxHeight?: string;
		/** Show a copy-to-clipboard button in the header strip. */
		copy?: boolean;
		/** Wrap long lines instead of scrolling them — for narrow columns. */
		wrap?: boolean;
		class?: string;
	}

	let {
		code,
		title,
		dedent = true,
		maxHeight,
		copy = false,
		wrap = false,
		class: cls = ''
	}: Props = $props();

	// Reverts on a timer rather than staying green: the button is the only
	// feedback, so it has to be reusable a second time without a remount.
	let copied = $state(false);

	async function copyCode() {
		await navigator.clipboard.writeText(dedent ? stripIndent(code) : code);
		copied = true;
		setTimeout(() => (copied = false), 2000);
	}

	function esc(s: string): string {
		return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
	}

	function stripIndent(raw: string): string {
		const lines = raw.replace(/^\n+/, '').replace(/\s+$/, '').split('\n');
		const indents = lines.filter((l) => l.trim()).map((l) => l.match(/^\t*/)?.[0].length ?? 0);
		const strip = indents.length ? Math.min(...indents) : 0;
		return lines.map((l) => l.slice(strip)).join('\n');
	}

	// Order is load-bearing. HTML and block comments win outright; strings come
	// before line comments so a `"// like this"` inside a string stays a string;
	// tag names come before bare identifiers.
	const TOKENS = new RegExp(
		[
			'(<!--[\\s\\S]*?-->|/\\*[\\s\\S]*?\\*/)', // 1 · block comments
			'("(?:[^"\\\\\\n]|\\\\.)*"|\'(?:[^\'\\\\\\n]|\\\\.)*\'|`(?:[^`\\\\]|\\\\.)*`)', // 2 · strings
			'(//[^\\n]*)', // 3 · line comments
			'(\\{[#/:@][a-zA-Z]+)', // 4 · svelte block tags
			'(</?)([A-Za-z][\\w.-]*)', // 5 punctuation · 6 tag name
			'(\\b(?:import|export|from|const|let|function|return|if|else|try|catch|new|await|async|interface|type|true|false|null|undefined)\\b)', // 7 · keywords
			'([{}])' // 8 · braces
		].join('|'),
		'g'
	);

	function highlight(raw: string): string {
		let out = '';
		let last = 0;
		for (const m of raw.matchAll(TOKENS)) {
			const at = m.index ?? 0;
			out += esc(raw.slice(last, at));
			last = at + m[0].length;

			if (m[1]) out += `<span class="c-comment">${esc(m[1])}</span>`;
			else if (m[2]) out += `<span class="c-string">${esc(m[2])}</span>`;
			else if (m[3]) out += `<span class="c-comment">${esc(m[3])}</span>`;
			else if (m[4]) out += `<span class="c-block">${esc(m[4])}</span>`;
			else if (m[6]) {
				// A capitalised tag is a component; a lowercase one is an element.
				const kind = /^[A-Z]/.test(m[6]) ? 'c-component' : 'c-tag';
				out += `<span class="c-punct">${esc(m[5])}</span><span class="${kind}">${esc(m[6])}</span>`;
			} else if (m[7]) out += `<span class="c-keyword">${esc(m[7])}</span>`;
			else if (m[8]) out += `<span class="c-brace">${esc(m[8])}</span>`;
		}
		out += esc(raw.slice(last));
		return out;
	}

	const html = $derived(highlight(dedent ? stripIndent(code) : code));
</script>

<div class="code-block {cls}">
	{#if title || copy}
		<div class="code-title">
			<span>{title ?? ''}</span>
			{#if copy}
				<button class="copy-btn" onclick={copyCode} aria-label="Copy code">
					<Icon name={copied ? 'check' : 'copy'} size={11} />
					{copied ? 'Copied' : 'Copy'}
				</button>
			{/if}
		</div>
	{/if}
	<pre
		class:wrap
		style={maxHeight ? `max-height:${maxHeight};overflow-y:auto` : undefined}><code
			>{@html html}</code
		></pre>
</div>

<style>
	.code-block {
		border: 1px solid var(--border);
		border-radius: var(--radius-control);
		background: rgba(3, 7, 18, 0.8);
		overflow: hidden;
	}

	.code-title {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		font-family: var(--mono);
		font-size: 0.62rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--fg-dim);
		padding: 0.4rem 0.75rem;
		border-bottom: 1px solid var(--border);
		background: var(--surface-raised);
	}

	.copy-btn {
		display: flex;
		align-items: center;
		gap: 0.3rem;
		background: none;
		border: 1px solid var(--border);
		border-radius: var(--radius-control);
		padding: 0.1rem 0.4rem;
		font-family: inherit;
		font-size: inherit;
		letter-spacing: inherit;
		color: var(--fg-dim);
		cursor: pointer;
		transition:
			color 0.12s,
			border-color 0.12s;
	}

	.copy-btn:hover {
		color: var(--accent);
		border-color: var(--accent);
	}

	pre {
		margin: 0;
		padding: 0.85rem 0.95rem;
		overflow-x: auto;
	}

	code {
		font-family: var(--mono);
		font-size: 0.72rem;
		line-height: 1.7;
		color: var(--fg-muted);
		white-space: pre;
		tab-size: 2;
	}

	pre.wrap {
		overflow-x: hidden;
	}

	pre.wrap code {
		white-space: pre-wrap;
		word-break: break-word;
	}

	.code-block :global(.c-comment) {
		color: var(--fg-dim);
		font-style: italic;
	}
	.code-block :global(.c-string) {
		color: var(--palette-emerald-l);
	}
	.code-block :global(.c-block) {
		color: var(--palette-amber);
	}
	.code-block :global(.c-component) {
		color: var(--palette-cyan-l);
	}
	.code-block :global(.c-tag) {
		color: var(--palette-blue);
	}
	.code-block :global(.c-keyword) {
		color: var(--palette-blue-l);
	}
	.code-block :global(.c-punct),
	.code-block :global(.c-brace) {
		color: var(--fg-dim);
	}
</style>
