// Email blocks in the marketing site's style (app-ui/src/routes/+page.svelte,
// components/marketing/*), as HTML strings.
//
// Strings, not components: an email has to survive Gmail stripping <style> and
// Outlook's Word renderer, so it is tables, inline styles, no flex, no webfont.
// Every block returns one `<tr>` of the 600px column `page()` lays out.
//
// The site's two hues hold here too: teal is us (mark, CTA, the claim word),
// orange is what we stand in front of (a threat). color-mix() values are
// flattened over the page colour, because no mail client has color-mix.

export const C = {
	bg: '#06070b',
	inset: '#0a0c10',
	fg: '#eef4f6',
	dim: '#97a3aa',
	faint: '#6b757b',
	rule: '#15181d',
	teal: '#5eead4',
	/** teal 7% over bg — GateAction's fill */
	tealFill: '#0c1719',
	/** teal 38% over bg — GateAction's border */
	tealEdge: '#275d57',
	/** teal ~33% over bg — card brackets' long edges, chip borders */
	tealLine: '#24564f',
	/** teal 30% over bg — the how-it-works numerals */
	tealNum: '#204b47',
	/** fg-dim 34% over bg — GateAction tone="line" */
	lineEdge: '#373c41',
	orange: '#FB923C',
	orangeLine: '#6b4426'
};

export const SANS = "Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
export const MONO = "'JetBrains Mono','SF Mono',Menlo,Consolas,monospace";
const MARK = 'https://armornet.io/email/armornet-mark@2x.png';

const TABLE = 'role="presentation" cellpadding="0" cellspacing="0" border="0"';

export const esc = (s: string) => s.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);

/** The word that carries the claim, in teal. */
export const us = (html: string) => `<span style="color:${C.teal};">${html}</span>`;
/** A threat, in orange. */
export const threat = (html: string) => `<span style="color:${C.orange};">${html}</span>`;
/** The lede's closing clause, as the hero underlines it. */
export const stress = (html: string) =>
	`<span style="color:${C.fg};text-decoration:underline;">${html}</span>`;

const row = (pad: string, inner: string) => `<tr><td style="padding:${pad};">${inner}</td></tr>`;

const chipCell = (text: string, color: string, edge: string, dot: string) =>
	`<table ${TABLE}><tr><td style="padding:4px 9px;border:1px solid ${edge};border-radius:2px;font-family:${MONO};font-size:10px;line-height:12px;font-weight:600;letter-spacing:0.16em;color:${color};"><span style="color:${dot};">&#9679;</span>&nbsp;${text}</td></tr></table>`;

/** "● ALPHA OPEN · LIMITED SEATS" */
export const chip = (text: string, tone: 'us' | 'threat' = 'us') =>
	tone === 'us' ? chipCell(text, C.teal, C.tealLine, '#2f7a70') : chipCell(text, C.orange, C.orangeLine, C.orange);

/** "/ HOW IT WORKS" */
export const label = (text: string) =>
	`<div style="font-family:${MONO};font-size:11px;font-weight:600;letter-spacing:0.18em;color:${C.teal};">/ ${text}</div>`;

export const heading = (html: string, size = 30) =>
	`<div style="padding-top:12px;font-family:${SANS};font-size:${size}px;line-height:${size + 4}px;font-weight:700;color:${C.fg};">${html}</div>`;

export const lede = (html: string, size = 16) =>
	`<div style="padding-top:12px;font-family:${SANS};font-size:${size}px;line-height:${Math.round(size * 1.62)}px;font-weight:300;color:${C.dim};">${html}</div>`;

/** Small print under a control. */
export const note = (html: string) =>
	`<div style="padding-top:14px;font-family:${SANS};font-size:13px;line-height:20px;font-weight:300;color:${C.dim};">${html}</div>`;

/** GateAction: mono, 0.18em tracking, corner ticks inside the border.
 *  `gate` is the teal ask; `line` is the quiet one beside it. */
export function button(o: { label: string; href: string; tone?: 'gate' | 'line'; glyph?: 'arrow' | 'external' }) {
	const gate = (o.tone ?? 'gate') === 'gate';
	const ink = gate ? C.teal : C.fg;
	const tick = gate ? C.teal : C.dim;
	const t = gate ? 9 : 8;
	const glyph = o.glyph === 'external' ? '&#8599;' : '&#8594;';
	const cell = (sides: string) =>
		`<td width="${t}" height="${t}" style="width:${t}px;height:${t}px;${sides}font-size:0;line-height:0;">&nbsp;</td>`;
	return `<table ${TABLE} style="margin-top:${gate ? 30 : 22}px;"><tr>
  <td${gate ? ` bgcolor="${C.tealFill}"` : ''} style="${gate ? `background:${C.tealFill};` : ''}border:1px solid ${gate ? C.tealEdge : C.lineEdge};border-radius:3px;">
    <table ${TABLE} width="100%">
      <tr><td style="padding:3px 0 0 3px;font-size:0;line-height:0;"><table ${TABLE} align="left"><tr>${cell(`border-top:1px solid ${tick};border-left:1px solid ${tick};`)}</tr></table></td></tr>
      <tr><td><a href="${o.href}" style="display:inline-block;padding:${gate ? '4px 26px' : '2px 20px'};font-family:${MONO};font-size:${gate ? 13 : 12}px;line-height:${gate ? 20 : 18}px;font-weight:600;letter-spacing:0.18em;color:${ink};text-decoration:none;">${o.label.toUpperCase()} &nbsp;${glyph}</a></td></tr>
      <tr><td align="right" style="padding:0 3px 3px 0;font-size:0;line-height:0;"><table ${TABLE} align="right"><tr>${cell(`border-bottom:1px solid ${tick};border-right:1px solid ${tick};`)}</tr></table></td></tr>
    </table>
  </td></tr></table>`;
}

/** The site header: mark, tracked wordmark, orange ALPHA badge. */
export const header = () =>
	`<tr><td style="padding:8px 28px 18px 28px;border-bottom:1px solid ${C.rule};">
  <table ${TABLE}><tr>
    <td width="26" valign="middle" style="padding-right:12px;"><img src="${MARK}" width="26" height="26" alt="" style="display:block;width:26px;height:26px;border:0;"></td>
    <td valign="middle" style="padding-right:12px;font-family:${MONO};font-size:15px;font-weight:600;letter-spacing:0.22em;color:${C.fg};">ARMORNET</td>
    <td valign="middle"><span style="display:inline-block;padding:3px 8px;background:${C.orange};border-radius:2px;font-family:${MONO};font-size:10px;line-height:12px;font-weight:700;letter-spacing:0.12em;color:${C.bg};">ALPHA</span></td>
  </tr></table>
</td></tr>`;

/** The opening band, with the hero's teal glow from the top right. */
export const hero = (inner: string) =>
	`<tr><td bgcolor="${C.bg}" style="background-color:${C.bg};background-image:linear-gradient(235deg,#0f302c 0%,#081413 38%,${C.bg} 66%);padding:44px 28px;">${inner}</td></tr>`;

/** The hero's headline, larger than a section heading. */
export const display = (html: string) =>
	`<div style="padding-top:22px;font-family:${SANS};font-size:44px;line-height:46px;font-weight:700;letter-spacing:-0.005em;color:${C.fg};">${html}</div>`;

/** A plain section: any of label, heading, lede, button, in order. */
export const section = (inner: string, top = 52) => row(`${top}px 28px 0 28px`, inner);

/** A terminal transcript. Lines are HTML; indent with &nbsp;. */
export const terminal = (lines: string[]) =>
	row(
		'20px 28px 0 28px',
		`<table ${TABLE} width="100%" style="background:${C.inset};border:1px solid ${C.rule};border-radius:3px;"><tr>
  <td style="padding:16px 18px;font-family:${MONO};font-size:12px;line-height:22px;word-break:break-all;color:${C.dim};">${lines.join('<br>')}</td>
</tr></table>`
	);

/** The /alpha intake card: teal corner brackets on a faint teal frame. */
export function bracketCard(inner: string) {
	const corner = (sides: string) =>
		`<td width="18" height="18" style="width:18px;height:18px;font-size:0;line-height:0;${sides}">&nbsp;</td>`;
	const t = `1px solid ${C.teal}`;
	const e = `1px solid ${C.tealLine}`;
	return row(
		'48px 28px 0 28px',
		`<table ${TABLE} width="100%">
  <tr>${corner(`border-top:${t};border-left:${t};`)}<td style="font-size:0;line-height:0;border-top:${e};">&nbsp;</td>${corner(`border-top:${t};border-right:${t};`)}</tr>
  <tr><td style="border-left:${e};"></td><td style="padding:16px 22px 10px 22px;">${inner}</td><td style="border-right:${e};"></td></tr>
  <tr>${corner(`border-bottom:${t};border-left:${t};`)}<td style="font-size:0;line-height:0;border-bottom:${e};">&nbsp;</td>${corner(`border-bottom:${t};border-right:${t};`)}</tr>
</table>`
	);
}

/** A side-ruled panel; orange rule for a threat, teal for us. */
export const callout = (inner: string, tone: 'us' | 'threat' = 'threat') =>
	row(
		'24px 28px 0 28px',
		`<table ${TABLE} width="100%" style="border:1px solid ${C.rule};border-left:2px solid ${tone === 'us' ? C.teal : C.orange};border-radius:3px;"><tr><td style="padding:18px 20px;">${inner}</td></tr></table>`
	);

export const image = (o: { src: string; width: number; alt: string }) =>
	`<table ${TABLE} width="100%"><tr><td align="center" style="padding:18px 0 4px 0;"><img src="${o.src}" width="${o.width}" height="${o.width}" alt="${esc(o.alt)}" style="display:block;width:${o.width}px;max-width:100%;height:auto;border:0;font-family:${MONO};font-size:12px;color:${C.teal};"></td></tr></table>`;

/** Hollow squares, `filled` of them lit — Pips, square, hollow. */
export function pips(total: number, filled: number, caption: string) {
	const pip = (lit: boolean) =>
		`<td width="12" height="12" style="width:12px;height:12px;font-size:0;line-height:0;border:1px solid ${lit ? C.teal : C.tealLine};${lit ? `background:${C.teal};` : ''}">&nbsp;</td>`;
	const gap = `<td width="6" style="width:6px;font-size:0;">&nbsp;</td>`;
	const cells = Array.from({ length: total }, (_, i) => pip(i < filled)).join(gap);
	return `<table ${TABLE} style="margin-top:20px;"><tr>${cells}<td style="padding-left:12px;font-family:${MONO};font-size:10px;letter-spacing:0.16em;color:${C.dim};">${caption.toUpperCase()}</td></tr></table>`;
}

/** The how-it-works row: big dim mono numeral, teal title, body. */
export const steps = (items: { title: string; body: string }[]) =>
	row(
		'22px 28px 0 28px',
		`<table ${TABLE} width="100%">${items
			.map(
				(s, i) => `<tr>
  <td width="56" valign="top" style="padding-bottom:22px;font-family:${MONO};font-size:28px;line-height:30px;color:${C.tealNum};">${String(i + 1).padStart(2, '0')}</td>
  <td valign="top" style="padding-bottom:22px;font-family:${SANS};"><span style="font-size:18px;line-height:26px;font-weight:600;color:${C.teal};">${s.title}</span><br><span style="font-size:15px;line-height:24px;font-weight:300;color:${C.dim};">${s.body}</span></td>
</tr>`
			)
			.join('')}</table>`
	);

/** Ruled link rows with a teal arrow. */
export const links = (items: { title: string; body: string; href: string }[]) =>
	row(
		'14px 28px 0 28px',
		`<table ${TABLE} width="100%" style="border-top:1px solid ${C.rule};">${items
			.map(
				(l) => `<tr>
  <td style="padding:16px 0;border-bottom:1px solid ${C.rule};font-family:${SANS};"><a href="${l.href}" style="font-size:16px;line-height:24px;font-weight:600;color:${C.fg};text-decoration:none;">${l.title}</a><br><span style="font-size:14px;line-height:22px;font-weight:300;color:${C.dim};">${l.body}</span></td>
  <td width="32" align="right" valign="middle" style="border-bottom:1px solid ${C.rule};"><a href="${l.href}" style="font-family:${MONO};font-size:16px;color:${C.teal};text-decoration:none;">&#8594;</a></td>
</tr>`
			)
			.join('')}</table>`
	);

export const link = (href: string, text: string) =>
	`<a href="${href}" style="color:${C.teal};text-decoration:underline;">${text}</a>`;

/** The site footer. */
export const footer = () =>
	`<tr><td style="padding:44px 28px 0 28px;">
  <table ${TABLE} width="100%" style="border-top:1px solid ${C.rule};"><tr><td style="padding-top:32px;">
    <table ${TABLE}><tr>
      <td width="22" valign="middle" style="padding-right:12px;"><img src="${MARK}" width="22" height="22" alt="" style="display:block;width:22px;height:22px;border:0;"></td>
      <td valign="middle" style="font-family:${MONO};font-size:15px;font-weight:600;letter-spacing:0.22em;color:${C.teal};">ARMORNET</td>
    </tr></table>
    <div style="padding-top:16px;font-family:${SANS};font-size:14px;line-height:22px;font-weight:300;color:${C.dim};">The line to your software supply chain. Point-of-use blocking for developer machines and build environments.</div>
    <div style="padding-top:16px;font-family:${MONO};font-size:10px;letter-spacing:0.18em;color:${C.faint};"><a href="mailto:alpha@armornet.io" style="color:${C.faint};text-decoration:none;">ALPHA@ARMORNET.IO</a> &nbsp;&middot;&nbsp; <a href="https://armornet.io" style="color:${C.faint};text-decoration:none;">ARMORNET.IO</a></div>
    <div style="padding-top:20px;font-family:${MONO};font-size:10px;letter-spacing:0.18em;color:#4a5257;">&copy; ${new Date().getFullYear()} ARMORNET</div>
  </td></tr></table>
</td></tr>`;

/** The whole document: header, the rows given, footer. */
export const page = (o: { title: string; preheader: string; rows: string[] }) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark">
<title>${esc(o.title)}</title>
</head>
<body style="margin:0;padding:0;background:${C.bg};">
<div data-preheader style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(o.preheader)}</div>
<table ${TABLE} width="100%" bgcolor="${C.bg}" style="background:${C.bg};"><tr>
<td align="center" style="padding:24px 12px 40px 12px;">
<table ${TABLE} width="600" style="width:100%;max-width:600px;">
${header()}
${o.rows.join('\n')}
${footer()}
</table>
</td>
</tr></table>
</body>
</html>`;
