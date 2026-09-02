<script lang="ts">
	interface ConfigBlockProps {
		yaml: string;
		accentColor?: string;
	}

	let { yaml, accentColor = 'var(--accent)' }: ConfigBlockProps = $props();

	function highlight(raw: string, accent: string): string {
		return raw
			.split('\n')
			.map((line) => {
				// Comment lines
				if (/^\s*#/.test(line)) {
					return `<span style="color:var(--fg-dim);font-style:italic">${esc(line)}</span>`;
				}

				// Key: value pairs
				return line.replace(
					/^(\s*)([^:#\s][^:]*?)(:)(.*)$/,
					(_, indent, key, colon, rest) => {
						const escapedKey = esc(key);
						const coloredKey = `<span style="color:${accent}">${escapedKey}</span>`;
						const coloredRest = colorizeValue(rest);
						return `${esc(indent)}${coloredKey}${esc(colon)}${coloredRest}`;
					}
				);
			})
			.join('\n');
	}

	function colorizeValue(rest: string): string {
		// Booleans
		if (/^\s*(true|false|yes|no|on|off)\s*$/.test(rest)) {
			return rest.replace(
				/(true|false|yes|no|on|off)/,
				`<span style="color:var(--palette-blue-l)">$1</span>`
			);
		}
		// Numbers
		if (/^\s*-?\d[\d._]*\s*$/.test(rest)) {
			return rest.replace(
				/(-?\d[\d._]*)/,
				`<span style="color:var(--palette-amber)">$1</span>`
			);
		}
		// Strings (non-empty remainder)
		if (rest.trim().length > 0) {
			return ` <span style="color:var(--palette-emerald-l)">${esc(rest.trim())}</span>`;
		}
		return esc(rest);
	}

	function esc(s: string): string {
		return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
	}

	const html = $derived(highlight(yaml, accentColor));
</script>

<pre class="config-block">{@html html}</pre>

<style>
	.config-block {
		font-family: var(--mono);
		font-size: 12px;
		line-height: 1.7;
		background: rgba(0, 0, 0, 0.4);
		border: 1px solid var(--border);
		border-radius: var(--radius-inset);
		padding: 16px 20px;
		margin: 0;
		overflow-x: auto;
		white-space: pre;
		color: var(--fg-muted);
	}
</style>
