// The emails /mockups/emails can build. Adding one is an entry here: its merge
// fields, and a render that composes blocks.ts. Field values arrive already
// escaped, or as their `{{key}}` merge tag when left blank.

import * as b from './blocks.js';

export interface EmailField {
	key: string;
	label: string;
	placeholder?: string;
}

export interface EmailTemplate {
	slug: string;
	name: string;
	subject: string;
	fields: EmailField[];
	render(v: Record<string, string>): string;
}

const alphaInvite: EmailTemplate = {
	slug: 'alpha-invite',
	name: 'Alpha invite',
	subject: "You're in: your Armornet alpha invite",
	fields: [
		{ key: 'first_name', label: 'First name', placeholder: 'Dana' },
		{ key: 'invite_link', label: 'Invite link', placeholder: 'https://armornet.io/invite/anet_invite_…' }
	],
	render: (v) =>
		b.page({
			title: "You're in: your Armornet alpha invite",
			preheader: 'Your seat is held for 30 days. Plus a mystery BREACH skin only alpha members can earn.',
			rows: [
				b.hero(
					b.chip('ALPHA OPEN &middot; LIMITED SEATS') +
						b.display(`You're in, ${v.first_name}.<br>Draw the line ${b.us('today.')}`) +
						b.lede(
							`The Armornet alpha is open and your seat is held for 30 days&mdash;${b.stress('the link below works once, and only for you.')}`,
							17
						) +
						b.button({ label: 'Accept invite', href: v.invite_link }) +
						b.note('Sign in with GitHub or Google. That sign-in becomes your account.')
				),

				// Illustrative, not a captured run: flatmap-stream@0.1.1 is the real 2018
				// package that went after Copay wallets through event-stream.
				b.section(
					b.label('WHAT THE RELAY DOES') +
						b.heading('See what your build actually pulled.') +
						b.lede(`Every package your machines fetch passes the relay first&mdash;${b.stress('the bad ones never arrive.')}`),
					44
				),
				b.terminal([
					`${b.us('$')} <span style="color:${b.C.fg};">npm install event-stream@3.3.6</span>`,
					'&nbsp;&nbsp;armornet: checking 47 packages',
					`&nbsp;&nbsp;<span style="color:${b.C.orange};font-weight:600;">BLOCK flatmap-stream@0.1.1</span>`,
					`&nbsp;&nbsp;&nbsp;&nbsp;${b.threat('targets Copay wallets')}`,
					`&nbsp;&nbsp;added 46, ${b.us('1 stopped at the line')}`
				]),

				b.bracketCard(
					b.label('REWARD &mdash; BREACH') +
						b.image({ src: 'https://armornet.io/email/mystery-skin.png', width: 220, alt: 'A mystery BREACH skin, locked' }) +
						b.heading('A mystery BREACH skin.', 28) +
						b.lede(
							`Once you're in, you get five invite links. Fill all 5 seats and an unreleased skin unlocks for your player&mdash;${b.stress("you'll see who when the last one joins.")} Only alpha members can earn it.`
						) +
						b.pips(5, 0, '0 / 5 seats') +
						b.button({ label: 'Your invites', href: 'https://armornet.io/invites', tone: 'line' })
				),

				b.section(
					b.label('BREACH') +
						b.heading('Play our open-source game.') +
						b.lede(
							`BREACH is attack and defend, played with cards, in your browser. Take on people or bots&mdash;${b.stress('the leaderboard is still wide open.')}`
						) +
						b.button({ label: 'Play BREACH', href: 'https://armornet.io/breach', tone: 'line', glyph: 'external' })
				),
				b.callout(
					b.chip('COMING SOON', 'threat') +
						b.heading(`BREACH: ${b.threat('Insider Threat')}`, 22) +
						b.lede('First person. This time the attacker already has a badge.', 15)
				),

				// The site's how-it-works, word for word.
				b.section(b.label('HOW IT WORKS') + b.heading('Identify. Detect. Enforce.')),
				b.steps([
					{
						title: 'Identify',
						body: 'Deploy the agent and .npmrc, pip.conf, GOPROXY, Docker and DNS relay through it &mdash; local or cloud, your choice. Every package, version and vendor behind your code is named.'
					},
					{
						title: 'Detect',
						body: 'Every dependency is checked against live threat feeds. Unknowns are safely sandboxed, ready to execute without ever touching your network or credentials.'
					},
					{
						title: 'Enforce',
						body: 'Flagged packages hit a wall. The terminal tells developers exactly what was blocked and why, and every stop scores the vendor that shipped it. Clean code flows untouched. You set the rules per source: log, warn, or block.'
					}
				]),
				b.section(b.lede('Start with one command:'), 0),
				b.terminal([`${b.us('$')} <span style="color:${b.C.fg};">curl -fsSL https://armornet.io/install | sh</span>`]),
				b.section(b.note(`On Windows: <span style="font-family:${b.MONO};color:${b.C.fg};">irm https://armornet.io/install.ps1 | iex</span>`), 0),

				b.section(b.label('GUIDES')),
				b.links([
					{ title: 'Connect a codebase', body: 'Install the GitHub App on the repositories you pick.', href: 'https://armornet.io/docs/how-to/codebase' },
					{ title: 'Install an agent', body: 'Put a scanner in the path of every package, query and pull.', href: 'https://armornet.io/docs/agents/install' },
					{ title: 'Use package proxies', body: 'Block malicious npm, pip, Go and Docker packages before they land.', href: 'https://armornet.io/docs/how-to/package-proxies' },
					{ title: 'Use the terminal', body: 'Install, sign in, and browse Armornet with armornet tui.', href: 'https://armornet.io/docs/how-to/tui' }
				]),

				b.section(
					b.lede(
						`It is an alpha and it will show. If something is broken, confusing or missing, write to ${b.link('mailto:alpha@armornet.io', 'alpha@armornet.io')}&mdash;${b.stress('it reaches a person, and it is the most useful thing you can send us.')}`
					),
					32
				)
			]
		})
};

export const EMAILS: EmailTemplate[] = [alphaInvite];
