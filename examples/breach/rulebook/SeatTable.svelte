<script lang="ts">
	// ── The four chairs ──────────────────────────────────────────────────────────
	// What a PLAYER is, as opposed to what a card is. The single most-asked
	// question about this game is what "TECH" and "SOCIAL" are doing on a card,
	// and the answer is here: a card names one skill, the seat holding it supplies
	// the rating, and that is the entire reason the same card is a different card
	// in two pairs of hands.
	import { Icon, type IconName } from 'showcase';
	import { SKILL_GLYPH } from '../parts/skill-glyphs.js';
	import {
		INITIATIVE,
		SKILL_BLURB,
		SKILL_LABEL,
		klassByKey,
		type Skill
	} from '../internal/rules.js';
	import { UPGRADE_KIND, trackFor } from '../internal/upgrades.js';

	const SKILLS: Skill[] = ['social', 'tech', 'opsec', 'analysis'];
	const seats = $derived(INITIATIVE.map(klassByKey));

	/** What the seat's resource actually does today. Three of the four are
	 *  printed on the sheet and read by nothing — saying so is kinder than
	 *  letting a player plan around them. */
	const RESOURCE: Record<string, string> = {
		REP: 'Spent automatically as up to +3 on any red ATTACK roll. Gains +1 at the top of every round, and Attribution resets it to 0. It is not consumed by spending.',
		BANK: 'Dead. The roll would read it — the Handler is red — but nothing ever puts anything in it, so it is 0 for the whole match. AP does not bank either.',
		BUDGET: 'Seeded at 2 and never looked at again. Only red attack rolls read a resource.',
		SIGNAL: 'Seeded at 2 and never looked at again. Only red attack rolls read a resource.'
	};

	/** Passives are the other half of a seat, and only one of the four is fully
	 *  wired. A rules page that hid that would be teaching a strategy that does
	 *  not exist. */
	const PASSIVE_STATE: Record<string, string> = {
		maintainer: 'Partly live: REP goes up 1 every round regardless of how loud you were. The “no loud action” condition is not checked, and the gain is 1, not 2.',
		state: 'Not implemented. AP is reset to 3 (plus track) every round and does not carry.',
		architect: 'Live. The Forge and the Silos each read +2 hardening while the Architect still has an AP left — spend your last point and the wall drops.',
		hunter: 'Not implemented. There is no free sweep; play the card.'
	};
</script>

<div class="flex flex-col gap-8">
	<!-- Skills first: the four words, and what they mean, before any character
	     wears them. -->
	<section class="rounded-lg border border-[var(--border)] p-4">
		<h3 class="m-0 mb-2 text-sm font-black">The four skills</h3>
		<p class="m-0 mb-3 text-[0.82rem] leading-snug text-[var(--fg-dim)]">
			Every card names exactly one of these. When you play it, YOUR rating in that skill is
			added to the dice. Nothing else about a card cares which skill it is — no card is
			blocked, discounted or made louder by it.
		</p>
		<dl class="m-0 grid gap-2 sm:grid-cols-2">
			{#each SKILLS as skill (skill)}
				<div class="flex items-start gap-2 rounded-md border border-[var(--border)] p-2.5">
					<span class="mt-0.5 text-[var(--accent)]"><Icon name={SKILL_GLYPH[skill]} size={14} /></span>
					<div class="min-w-0">
						<dt class="font-mono text-[0.65rem] font-black tracking-widest">{SKILL_LABEL[skill]}</dt>
						<dd class="m-0 text-[0.78rem] leading-snug text-[var(--fg-dim)]">
							{SKILL_BLURB[skill]}
						</dd>
					</div>
				</div>
			{/each}
		</dl>
	</section>

	<!-- The ratings side by side. A grid is the only way to see that the
	     Maintainer's +3 SOCIAL is the Handler's −1. -->
	<section class="overflow-x-auto">
		<table class="w-full border-collapse text-left">
			<thead>
				<tr class="font-mono text-[0.55rem] uppercase tracking-widest text-[var(--fg-dim)]">
					<th class="py-1 pr-3 font-normal">Seat</th>
					{#each SKILLS as skill (skill)}
						<th class="py-1 pr-3 font-normal text-right">{SKILL_LABEL[skill]}</th>
					{/each}
					<th class="py-1 pr-3 font-normal">Resource</th>
					<th class="py-1 font-normal">Acts</th>
				</tr>
			</thead>
			<tbody class="text-[0.8rem]">
				{#each seats as k, i (k.key)}
					<tr class="border-t border-[var(--border)]">
						<td class="py-2 pr-3">
							<span class="flex items-center gap-2 font-bold" style:color={k.color}>
								<Icon name={k.icon as IconName} size={13} />
								{k.name}
							</span>
							<span class="font-mono text-[0.6rem] text-[var(--fg-dim)]">{k.seat} · {k.faction}</span>
						</td>
						{#each SKILLS as skill (skill)}
							{@const v = k.skills[skill]}
							<td
								class="py-2 pr-3 text-right font-mono tabular-nums font-black"
								style:color={v > 0 ? '#34D399' : v < 0 ? '#FB7185' : 'var(--fg-dim)'}
								>{v >= 0 ? '+' : ''}{v}</td
							>
						{/each}
						<td class="py-2 pr-3 font-mono text-[0.65rem]">{k.resource}</td>
						<td class="py-2 font-mono text-[0.65rem] text-[var(--fg-dim)]">{i + 1}{i === 0 ? 'st' : i === 1 ? 'nd' : i === 2 ? 'rd' : 'th'}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</section>

	<!-- Then each seat in full: tagline, passive, resource, upgrade track. -->
	{#each seats as k (k.key)}
		<section class="flex flex-col gap-3 rounded-lg border border-[var(--border)] p-4">
			<header class="flex flex-wrap items-baseline gap-x-3">
				<h3 class="m-0 text-sm font-black" style:color={k.color}>{k.name}</h3>
				<span class="text-[0.8rem] italic text-[var(--fg-dim)]">{k.tagline}</span>
			</header>

			<dl class="m-0 flex flex-col gap-2 text-[0.8rem] leading-snug">
				<div>
					<dt class="font-mono text-[0.6rem] uppercase tracking-widest text-[var(--accent)]">
						Passive · {k.passive.name}
					</dt>
					<dd class="m-0">
						<span class="italic text-[var(--fg-dim)]">“{k.passive.text}”</span>
						<span class="mt-0.5 block">{PASSIVE_STATE[k.key]}</span>
					</dd>
				</div>
				<div>
					<dt class="font-mono text-[0.6rem] uppercase tracking-widest text-[var(--accent)]">
						Resource · {k.resource}
					</dt>
					<dd class="m-0">{RESOURCE[k.resource]}</dd>
				</div>
			</dl>

			<div>
				<span class="font-mono text-[0.6rem] uppercase tracking-widest text-[var(--accent)]"
					>Upgrade track</span
				>
				<p class="m-0 mb-2 text-[0.75rem] text-[var(--fg-dim)]">
					Unlocked by ROUND, not bought. Nothing to spend, nothing to choose — every seat gets
					all three, at rounds 3, 6 and 9.
				</p>
				<ul class="m-0 flex list-none flex-col gap-1.5 p-0 sm:flex-row">
					{#each trackFor(k) as u (u.key)}
						{@const kind = UPGRADE_KIND[u.kind]}
						<li
							class="flex flex-1 items-start gap-2 rounded-md border border-[var(--border)] p-2.5"
						>
							<span style:color={kind.hue}><Icon name={u.icon as IconName} size={14} /></span>
							<div class="min-w-0">
								<b class="block text-[0.78rem]">R{u.at} · {u.name}</b>
								<span class="font-mono text-[0.6rem] uppercase tracking-widest" style:color={kind.hue}
									>+{u.value} {kind.label}</span
								>
								<span class="mt-0.5 block text-[0.74rem] leading-snug text-[var(--fg-dim)]"
									>{u.text}</span
								>
							</div>
						</li>
					{/each}
				</ul>
			</div>
		</section>
	{/each}
</div>
