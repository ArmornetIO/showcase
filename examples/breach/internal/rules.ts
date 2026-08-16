// ── /examples/breach · the rules ──────────────────────────────────────────
// BREACH is a 2v2 tabletop skirmish played on the armornet globe. One side runs
// a supply-chain intrusion; the other side runs the estate it is aimed at. The
// board is the same four-territory sphere the console's overview draws, and the
// buildings are the same pieces — so a player who learns this map has learned
// where a real compromise actually happens.
//
// Everything here is PURE: shapes, rosters, the dice maths. The page owns the
// live match state and the fog it shows each seat. That split is the whole
// reason the rules are legible — you can read what a Release Divergence does
// without reading a component.
//
// ── API stub ────────────────────────────────────────────────────────────────
// GET  /api/match/{match_id}/state?seat={seat_id}   → MatchState  (fog-filtered
//        server-side: a blue seat never receives an unrevealed red implant)
// POST /api/match/{match_id}/action                 → ActionResult
//        { seat_id, ability_key, target_id }
// POST /api/match/{match_id}/end-turn               → MatchState
// WS   /api/match/{match_id}/stream                 → MatchEvent[]  (battle log)
//
// MatchState  { match_id, round, phase_seat, initiative[], seats[], board_state{},
//               detection{}, footholds[], log[] }
// Foothold    { structure_id, seat_id, persistent, revealed, placed_round }
// ActionResult{ roll, modifier, target_number, success, critical, noise_added,
//               foothold_id?, revealed_ids[] }

// ── Territory ────────────────────────────────────────────────────────────────
// Four regions, each one phase of a real supply chain wearing a map name. The
// fantasy name is what a player says out loud; the real one is what they are
// actually learning. Both are always on screen — the joke stops being useful
// the moment it hides the thing it stands for.

export type Faction = 'red' | 'blue';
export type TerritoryKey = 'staging' | 'commons' | 'foundry' | 'marches' | 'outlands';

/**
 * Who owns the ground.
 *
 * This is 2v2, and a side with nothing to lose is not a side — it is a hazard.
 * So the board is three things, not one estate with weather:
 *
 *   blue      the defended estate: source, build, runtime. What red is trying to
 *             get into.
 *   red       the staging grounds: the attacker's OWN infrastructure — the relay
 *             that implants call home to, the workshop the zero-day lives in, the
 *             farm the persona was grown on. Real, standing, and reachable.
 *   neutral   the supply chain itself. Upstream projects, mirrors, the vendor
 *             market: owned by neither, consumed by both, and the reason there is
 *             a game. Almost everything worth fighting over is here.
 *
 * You cannot play a card on your own ground — the interesting consequence is that
 * blue finally has somewhere to attack, and red finally has something to defend.
 */
export type Owner = Faction | 'neutral';

export interface TerritoryDef {
	name: string;
	real: string;
	color: string;
	glow: string;
	biome: 'rolling' | 'terraced' | 'ridged' | 'scattered';
	blurb: string;
	owner: Owner;
}

export const TERRITORY_ORDER: TerritoryKey[] = [
	'staging',
	'outlands',
	'commons',
	'foundry',
	'marches'
];

export const TERRITORIES: Record<TerritoryKey, TerritoryDef> = {
	// Red's own ground. Deliberately small and deliberately reachable: three
	// buildings, each one holding up a thing red depends on, each one something
	// blue can go and break once it works out where to look.
	staging: {
		name: 'The Staging Grounds',
		real: 'Adversary infrastructure',
		color: '#F472B6',
		glow: '#FBCFE8',
		biome: 'scattered',
		blurb: 'Rented, disposable and somewhere else. Everything red owns is here.',
		owner: 'red'
	},
	commons: {
		name: 'The Commons',
		real: 'Source & development',
		color: '#34D399',
		glow: '#6EE7B7',
		biome: 'rolling',
		blurb: 'Open ground. Anyone may walk in and offer you a patch.',
		owner: 'blue'
	},
	foundry: {
		name: 'The Foundry',
		real: 'Build & registry',
		color: '#38BDF8',
		glow: '#7DD3FC',
		biome: 'terraced',
		blurb: 'Where source becomes an artifact — and stops being readable.',
		owner: 'blue'
	},
	marches: {
		name: 'The Marches',
		real: 'Runtime & network',
		color: '#818CF8',
		glow: '#A5B4FC',
		biome: 'ridged',
		blurb: 'The high, watched ground between the estate and the world.',
		owner: 'blue'
	},
	// Neither side's, and the only region both may act in. This is where the
	// game actually happens — which is the point being made about supply chains.
	outlands: {
		name: 'The Outlands',
		real: 'Third parties & upstream',
		color: '#FB923C',
		glow: '#FDBA74',
		biome: 'scattered',
		blurb: 'Islands both sides depend on and neither owns. The siege starts here.',
		owner: 'neutral'
	}
};

// ── The board ────────────────────────────────────────────────────────────────
// Fifteen structures and the PROTECTED CORE. Five of them sit on the PAYLOAD
// PATH, in order — the only route a compromise can actually travel. Red has to
// take them in sequence, which is why the game teaches a chain rather than a
// list of scary words.

export interface Structure {
	id: string;
	name: string;
	role: string;
	territory: TerritoryKey;
	/** Whose ground this is. Derived from the region for every building today,
	 *  but stated per building because a captured one should be able to change
	 *  hands without moving. */
	owner: Owner;
	/** Shape from the settlement catalogue — the building that stands on the plot. */
	piece: string;
	/** The number an attack roll has to beat. */
	hardening: number;
	/** Blue controls standing on it. Each is worth its bonus in `hardening` already. */
	controls: string[];
	/** 1-based position on the payload path. Absent = off the chain. */
	chain?: number;
	/** Flavour shown in the inspector. */
	note: string;
}

export const CORE_ID = 'core';

export const STRUCTURES: Structure[] = [
	// ── The Staging Grounds · RED ─────────────────────────────────────────────
	// Three things red cannot run the operation without. None of them are on the
	// payload path — losing one does not lose the game, it takes a tool away, and
	// that is exactly the pressure blue has never had a way to apply.
	{
		id: 'beacon',
		name: 'Relay Beacon',
		role: 'Command & control',
		territory: 'staging',
		owner: 'red',
		piece: 'beacon',
		hardening: 9,
		controls: ['fast flux', 'domain rotation'],
		note: 'Every implant calls home to this. Cut it and the things red has planted go dark — and visible.'
	},
	{
		id: 'workshop',
		name: 'Exploit Workshop',
		role: 'Capability development',
		territory: 'staging',
		owner: 'red',
		piece: 'factory',
		hardening: 11,
		controls: ['air gap'],
		note: 'Where the zero-day is kept until it is worth spending. Burn it down and it cannot be spent at all.'
	},
	{
		id: 'personas',
		name: 'Persona Farm',
		role: 'Identity manufacture',
		territory: 'staging',
		owner: 'red',
		piece: 'hut',
		hardening: 7,
		controls: [],
		note: 'Two years of plausible commit history, grown from nothing. The Maintainer came out of here.'
	},

	// ── The Outlands · NEUTRAL ────────────────────────────────────────────────
	{
		id: 'forum',
		name: 'Maintainer Circle',
		role: 'Upstream project',
		territory: 'outlands',
		owner: 'neutral',
		piece: 'forum',
		hardening: 8,
		controls: ['two-person review'],
		chain: 1,
		note: 'One exhausted volunteer, two years of unanswered issues, and a very helpful newcomer.'
	},
	{
		id: 'mark',
		name: 'Vendor Market',
		role: 'Third-party registry',
		territory: 'outlands',
		owner: 'neutral',
		piece: 'mark',
		hardening: 10,
		controls: ['vendor assessment'],
		note: 'Everyone you buy from, standing in one square, priced by how much they can hurt you.'
	},
	{
		id: 'observatory',
		name: 'The Observatory',
		role: 'Threat intelligence',
		territory: 'outlands',
		owner: 'neutral',
		piece: 'observatory',
		hardening: 11,
		controls: ['feed ingest', 'IOC match'],
		note: 'Sees far, and always a little late. Blue may spend a turn here to look at any region.'
	},
	{
		id: 'house',
		name: 'Package Mirror',
		role: 'Dependency mirror',
		territory: 'outlands',
		owner: 'neutral',
		piece: 'house',
		hardening: 9,
		controls: ['checksum pin'],
		note: 'A copy of the world, kept close for speed. Poison the copy, skip the world.'
	},
	// ── The Commons ───────────────────────────────────────────────────────────
	{
		id: 'archive',
		name: 'The Archive',
		role: 'Source repository',
		territory: 'commons',
		owner: 'blue',
		piece: 'archive',
		hardening: 11,
		controls: ['branch protection', 'CODEOWNERS'],
		chain: 2,
		note: 'Everything here is readable by everyone. That is the defence, and it is thinner than it sounds.'
	},
	{
		id: 'precinct',
		name: 'Developer Precinct',
		role: 'Engineer endpoints',
		territory: 'commons',
		owner: 'blue',
		piece: 'precinct',
		hardening: 10,
		controls: ['extension policy'],
		note: 'Forty laptops, each one a door into the Commons with a person holding it open.'
	},
	{
		id: 'hut',
		name: 'Contributor Sandbox',
		role: 'Untrusted workspace',
		territory: 'commons',
		owner: 'blue',
		piece: 'hut',
		hardening: 6,
		controls: [],
		note: 'Deliberately cheap. Red is meant to take this one — it is what taking it BUYS that matters.'
	},
	// ── The Foundry ───────────────────────────────────────────────────────────
	{
		id: 'forge',
		name: 'The Forge',
		role: 'Build runner (CI)',
		territory: 'foundry',
		owner: 'blue',
		piece: 'forge',
		hardening: 12,
		controls: ['ephemeral runners', 'egress policy'],
		chain: 3,
		note: 'Runs whatever the build script says, with credentials, on a machine nobody watches.'
	},
	{
		id: 'silos',
		name: 'The Silos',
		role: 'Artifact registry',
		territory: 'foundry',
		owner: 'blue',
		piece: 'silos',
		hardening: 12,
		controls: ['signing'],
		chain: 4,
		note: 'What ships lives here — and what ships is not always what was written.'
	},
	{
		id: 'mill',
		name: 'Dependency Mill',
		role: 'Build cache',
		territory: 'foundry',
		owner: 'blue',
		piece: 'mill',
		hardening: 8,
		controls: [],
		note: 'Grinds thousands of upstream packages into your build. Nobody reads the grain.'
	},
	{
		id: 'court',
		name: 'Attestation Court',
		role: 'Provenance & signing',
		territory: 'foundry',
		owner: 'blue',
		piece: 'court',
		hardening: 13,
		controls: ['SLSA provenance', 'key custody'],
		note: 'The only building that can testify that an artifact came from the source it claims.'
	},
	// ── The Marches ───────────────────────────────────────────────────────────
	{
		id: 'checkpoint',
		name: 'The Checkpoint',
		role: 'Egress & DNS relay',
		territory: 'marches',
		owner: 'blue',
		piece: 'checkpoint',
		hardening: 13,
		controls: ['DNS policy', 'relay interception'],
		chain: 5,
		note: 'The last gate before the world. A payload that cannot call home is a payload that failed.'
	},
	{
		id: 'keep',
		name: 'The Keep',
		role: 'Control plane',
		territory: 'marches',
		owner: 'blue',
		piece: 'keep',
		hardening: 15,
		controls: ['mTLS', 'break-glass audit'],
		note: 'Take the Keep and you do not need the chain. Which is why it is priced like that.'
	},
	{
		id: 'bastion',
		name: 'Posture Bastion',
		role: 'Configuration posture',
		territory: 'marches',
		owner: 'blue',
		piece: 'bastion',
		hardening: 11,
		controls: ['CIS baseline'],
		note: 'Holds the standard everything else is measured against. Bend it and the map lies to Blue.'
	},
	{
		id: 'redoubt',
		name: 'Hardened Runtime',
		role: 'Production workload',
		territory: 'marches',
		owner: 'blue',
		piece: 'redoubt',
		hardening: 14,
		controls: ['sandboxing', 'read-only rootfs'],
		note: 'The prize. Red does not attack it — Red arrives inside it, carried by something you trust.'
	}
];

export const CHAIN: Structure[] = STRUCTURES.filter((s) => s.chain).sort(
	(a, b) => (a.chain ?? 0) - (b.chain ?? 0)
);

export const structureById = (id: string): Structure | undefined =>
	STRUCTURES.find((s) => s.id === id);

/**
 * Where a card may be played.
 *
 * The default is the obvious one and it is worth stating: you may act on ground
 * the other side owns, and on the neutral supply chain both sides live off. You
 * may NOT act on your own — attacking your own registry is not a move, and
 * hardening the enemy's relay is not either.
 *
 * `ability.on` overrides it, which is how blue gets a counter-offensive: a card
 * that names `['red']` reaches into the staging grounds, and that is the only way
 * the defenders ever get to be the ones arriving somewhere.
 */
export function canTarget(a: Ability, s: Structure, actor: Faction): boolean {
	if (a.targets && !a.targets.includes(s.id)) return false;
	const allowed: Owner[] = a.on ?? ['neutral', actor === 'red' ? 'blue' : 'red'];
	// Blue's estate-tending cards (harden, quarantine, rebuild) are the exception
	// the default cannot express: they act on blue's OWN ground.
	return allowed.includes(s.owner);
}

// ── Classes ──────────────────────────────────────────────────────────────────
// Two seats a side. Every ability is a real technique with the paperwork filed
// off; the flavour line is the teaching, the numbers are the game.

export type AbilityKind = 'strike' | 'implant' | 'recon' | 'control' | 'econ' | 'utility';

/**
 * What a seat is GOOD at.
 *
 * The class used to be a hand of cards and a passive. Skills make it a person:
 * the same card played by two different seats is not the same card, because the
 * Maintainer talks and the Handler does not. Four ratings, spent across a class,
 * one of them usually negative — a class that is good at everything is a class
 * with no shape.
 */
export type Skill = 'social' | 'tech' | 'opsec' | 'analysis';

export const SKILL_LABEL: Record<Skill, string> = {
	social: 'SOCIAL',
	tech: 'TECH',
	opsec: 'OPSEC',
	analysis: 'ANALYSIS'
};

export const SKILL_BLURB: Record<Skill, string> = {
	social: 'Persuasion, personas, and being the helpful one for two years.',
	tech: 'Exploits, builds, and knowing what the code actually does.',
	opsec: 'Not being seen doing any of it.',
	analysis: 'Looking at a thing long enough to notice it is wrong.'
};

/**
 * How well it went — the dice say degree, not just yes or no.
 *
 * The number printed on the card is what a CLEAN roll gets you. Everything else
 * is measured against that, which means one table covers every card in the game
 * and a player only ever has to learn it once.
 *
 *   botch     −5 or worse. It goes wrong in a way that costs you something.
 *   fail      short of the mark, including an exact tie — ties go to the defender.
 *   partial   just over. Half the printed effect, rounded up.
 *   clean     +4 or better. Exactly what the card says.
 *   critical  +8 or better. The card, and then some.
 */
export type Outcome = 'botch' | 'fail' | 'partial' | 'clean' | 'critical';

export const OUTCOME_LABEL: Record<Outcome, string> = {
	botch: 'BOTCHED',
	fail: 'FAILED',
	partial: 'PARTIAL',
	clean: 'CLEAN',
	critical: 'CRITICAL'
};

export const OUTCOME_COLOR: Record<Outcome, string> = {
	botch: '#EF4444',
	fail: '#94A3B8',
	partial: '#FBBF24',
	clean: '#34D399',
	critical: '#7DD3FC'
};

export const outcomeFor = (margin: number): Outcome =>
	margin <= -5 ? 'botch' : margin <= 0 ? 'fail' : margin <= 3 ? 'partial' : margin <= 7 ? 'clean' : 'critical';

export const succeeded = (o: Outcome) => o === 'partial' || o === 'clean' || o === 'critical';

/** The printed number, scaled by how well the roll went. */
export function scaleEffect(o: Outcome, base: number): number {
	if (!succeeded(o)) return 0;
	if (o === 'partial') return Math.max(1, Math.ceil(base / 2));
	if (o === 'critical') return base + 1;
	return base;
}

export interface Ability {
	key: string;
	name: string;
	kind: AbilityKind;
	/** Action points. Every seat gets 3 a round. */
	ap: number;
	/** Which of the seat's skills carries this card. The same card is a different
	 *  card in a different pair of hands, and this is the field that makes it so. */
	skill: Skill;
	/** What the roll is measured against when there is no building defending —
	 *  every card rolls now, and a control needs a number to be short of.
	 *  Attacks ignore this and use the building's hardening instead. */
	dc?: number;
	/** Roll bonus the card itself brings. */
	mod: number;
	/** Heat added to the target's territory on use. Failure doubles it. */
	noise: number;
	text: string;
	/** Only legal against these structure ids; absent = anywhere the ownership
	 *  rule below allows. */
	targets?: string[];
	/** Whose ground this card may be played on. Defaults to the sane thing for
	 *  the seat's faction (see `canTarget`); set it to say otherwise — a blue
	 *  counter-offensive card names `['red']`, a card that only touches your own
	 *  estate names your own side. */
	on?: Owner[];
}

export interface Klass {
	key: string;
	seat: string;
	name: string;
	faction: Faction;
	color: string;
	icon: string;
	/** The resource this seat spends besides AP. */
	resource: string;
	skills: Record<Skill, number>;
	tagline: string;
	passive: { name: string; text: string };
	abilities: Ability[];
}

export const ROSTER: Klass[] = [
	{
		key: 'maintainer',
		seat: 'R1',
		name: 'The Maintainer',
		faction: 'red',
		color: '#F472B6',
		icon: 'user',
		resource: 'REP',
		// Talks better than anyone on the board and cannot hide worth a damn once
		// somebody actually looks — which is the whole shape of the archetype.
		skills: { social: 3, tech: 1, opsec: 1, analysis: 0 },
		tagline: 'Patient, helpful, and eventually holding the keys.',
		passive: {
			name: 'Trust Accrual',
			text: 'End a round having taken no loud action and gain 2 REP. Spend REP 1-for-1 as a roll bonus — nobody audits a friend.'
		},
		abilities: [
			{
				key: 'contribution',
				name: 'Earnest Contribution',
				kind: 'econ',
				skill: 'social',
				dc: 6,
				ap: 1,
				mod: 0,
				noise: 0,
				text: 'Fix real bugs for real people. +3 REP, no heat. This is the majority of the attack and it is not an attack.'
			},
			{
				key: 'pressure',
				name: 'Co-maintainer Pressure',
				kind: 'control',
				skill: 'social',
				dc: 8,
				ap: 1,
				mod: 0,
				noise: 1,
				text: 'Sock-puppets complain the project is unmaintained until the owner shares commit rights. Target −3 hardening for 2 rounds.'
			},
			{
				key: 'fixture',
				name: 'Obfuscated Test Fixture',
				kind: 'implant',
				skill: 'tech',
				ap: 2,
				mod: 3,
				noise: 1,
				text: 'The payload ships as corrupt binary test data. Review reads diffs, and this has no diff worth reading.',
				targets: ['archive', 'hut', 'forum']
			},
			{
				key: 'divergence',
				name: 'Release Divergence',
				kind: 'strike',
				skill: 'tech',
				ap: 2,
				mod: 4,
				noise: 2,
				text: 'The build script in the release tarball is not the one in the repo. Only an artifact-to-source diff can see it.',
				targets: ['forge', 'silos']
			}
		]
	},
	{
		key: 'state',
		seat: 'R2',
		name: 'The Handler',
		faction: 'red',
		color: '#FB923C',
		icon: 'radar',
		resource: 'BANK',
		// The opposite: quiet and capable, and hopeless at getting anybody to
		// volunteer anything.
		skills: { social: -1, tech: 3, opsec: 3, analysis: 1 },
		tagline: 'A state has no deadline. You do.',
		passive: {
			name: 'Patience',
			text: 'Unspent AP banks, to a maximum of 6. A zero-day loses no value sitting in a drawer for a year.'
		},
		abilities: [
			{
				key: 'lotl',
				name: 'Living off the Land',
				kind: 'strike',
				skill: 'opsec',
				ap: 2,
				mod: 1,
				noise: 0,
				text: 'Every tool used is one the estate installed itself. Nothing to detect, because nothing is foreign.'
			},
			{
				key: 'sleeper',
				name: 'Sleeper Implant',
				kind: 'implant',
				skill: 'opsec',
				ap: 2,
				mod: 1,
				noise: 0,
				text: 'Dormant and inert. Cannot be found by a sweep for 2 rounds — there is nothing running to find.'
			},
			{
				key: 'ca',
				name: 'Certificate Pressure',
				kind: 'control',
				skill: 'social',
				dc: 9,
				ap: 2,
				mod: 0,
				noise: 1,
				text: 'A cooperative authority signs. The Checkpoint loses 4 hardening this round: the traffic is valid.',
				targets: ['checkpoint', 'court']
			},
			{
				key: 'zeroday',
				name: 'Zero-Day Reserve',
				kind: 'strike',
				skill: 'tech',
				ap: 3,
				mod: 6,
				noise: 3,
				text: 'Burn it. It works once, it is loud once, and afterwards it is a signature everyone has.'
			}
		]
	},
	{
		key: 'architect',
		seat: 'B1',
		name: 'The Architect',
		faction: 'blue',
		color: '#38BDF8',
		icon: 'shapes',
		resource: 'BUDGET',
		skills: { social: 0, tech: 3, opsec: 1, analysis: 2 },
		tagline: 'Cannot see the attacker. Can make the ground refuse to carry them.',
		passive: {
			name: 'Reproducible Builds',
			text: 'While you hold at least 1 AP, the Forge and the Silos each stand at +2 hardening. Determinism is a wall.'
		},
		abilities: [
			{
				key: 'harden',
				name: 'Harden',
				kind: 'control',
				skill: 'tech',
				dc: 6,
				ap: 1,
				mod: 0,
				noise: 0,
				// Your own estate and the upstream you consume — you cannot reinforce
				// somebody else's relay.
				on: ['blue', 'neutral'],
				text: 'Spend budget on one building: +3 hardening, permanently. Slow, unglamorous, and how the game is actually won.'
			},
			{
				key: 'segment',
				name: 'Segment',
				kind: 'control',
				skill: 'tech',
				dc: 9,
				ap: 2,
				mod: 0,
				noise: 0,
				// The Architect's reach into the staging grounds. Sinkholing a relay is
				// a real thing defenders do, and it is the moment blue stops only
				// building walls and goes and takes something off the other side.
				on: ['red', 'blue', 'neutral'],
				text: 'Cut a lane for 2 rounds. Nothing crosses it — including everything of yours that used it. Played on the Relay Beacon it sinkholes the callback, and every implant red is running goes dark.'
			},
			{
				key: 'attest',
				name: 'Provenance Attestation',
				kind: 'recon',
				skill: 'analysis',
				dc: 9,
				ap: 2,
				mod: 0,
				noise: 0,
				on: ['blue', 'neutral'],
				text: 'Sign the whole chain from source to artifact. Any divergence between the two is revealed outright.',
				targets: ['forge', 'silos', 'court']
			},
			{
				key: 'rebuild',
				name: 'Rebuild From Source',
				kind: 'control',
				skill: 'tech',
				dc: 8,
				ap: 3,
				mod: 0,
				noise: 0,
				on: ['blue', 'neutral'],
				text: 'Throw the artifact away and make it again from readable source. Evicts any non-persistent foothold in the Foundry.'
			}
		]
	},
	{
		key: 'hunter',
		seat: 'B2',
		name: 'The Threat Hunter',
		faction: 'blue',
		color: '#34D399',
		icon: 'radar',
		resource: 'SIGNAL',
		skills: { social: 0, tech: 1, opsec: 1, analysis: 4 },
		tagline: 'Assumes the breach already happened and goes looking for it.',
		passive: {
			name: 'Baseline',
			text: 'One free sweep each round in the territory you stand in. You know what normal looks like here.'
		},
		abilities: [
			{
				key: 'sweep',
				name: 'Sweep',
				kind: 'recon',
				skill: 'analysis',
				dc: 7,
				ap: 1,
				mod: 0,
				noise: 0,
				on: ['blue', 'neutral'],
				text: 'Reveal every active implant in one territory. Sleepers are inert and stay hidden — that is the point of them.'
			},
			{
				key: 'diff',
				name: 'Diff the Tarball',
				kind: 'recon',
				skill: 'analysis',
				dc: 9,
				ap: 2,
				mod: 0,
				noise: 0,
				on: ['blue', 'neutral'],
				text: 'Compare what shipped against what was written. Reveals Release Divergence outright, wherever it hides.',
				targets: ['silos', 'forge', 'house', 'mill']
			},
			{
				key: 'quarantine',
				name: 'Quarantine',
				kind: 'control',
				skill: 'tech',
				dc: 8,
				ap: 2,
				mod: 0,
				noise: 0,
				on: ['blue', 'neutral'],
				text: 'A building goes dark for 2 rounds. Anything held inside it cannot advance the chain.'
			},
			{
				key: 'attribute',
				name: 'Attribution',
				kind: 'utility',
				skill: 'social',
				dc: 11,
				ap: 3,
				mod: 0,
				noise: 0,
				// Played where the persona was MADE. Naming an actor is not something
				// you do to your own estate — it is something you do to theirs.
				on: ['red'],
				text: 'Name the actor while a revealed foothold stands. Played on the Persona Farm it burns the identity: the account, the history and the trust go with it.'
			}
		]
	}
];

/** Seats sat in initiative order — red moves first, which is the whole problem. */
export const INITIATIVE = ['maintainer', 'architect', 'state', 'hunter'];

export const klassByKey = (k: string): Klass => ROSTER.find((r) => r.key === k) ?? ROSTER[0];

/** Classes drawn but not seated in this match — the rest of the box. */
export const BENCH = [
	{ name: 'Access Broker', faction: 'red' as Faction, note: 'Buys footholds nobody had to earn.' },
	{ name: 'Hacktivist', faction: 'red' as Faction, note: 'Loud on purpose. Heat is the objective.' },
	{
		name: 'Incident Commander',
		faction: 'blue' as Faction,
		note: 'Contains fast, understands later.'
	},
	{ name: 'Auditor', faction: 'blue' as Faction, note: 'Turns evidence into a control that holds.' }
];

// ── Resolution ───────────────────────────────────────────────────────────────
// 2d6 + modifiers against the building's hardening. Ties go to the defender —
// an attack that only just works did not work. A margin of 4 or better plants a
// PERSISTENT foothold, which survives the first eviction: this is why real
// intrusions are cheap to start and expensive to remove.

const TWO_D6_COUNTS = [0, 0, 1, 2, 3, 4, 5, 6, 5, 4, 3, 2, 1];

/** Probability that 2d6 lands at or above `n`. */
export function oddsAtLeast(n: number): number {
	if (n <= 2) return 1;
	if (n > 12) return 0;
	let c = 0;
	for (let s = n; s <= 12; s++) c += TWO_D6_COUNTS[s];
	return c / 36;
}

export function roll2d6(): { dice: [number, number]; total: number } {
	const a = 1 + Math.floor(Math.random() * 6);
	const b = 1 + Math.floor(Math.random() * 6);
	return { dice: [a, b], total: a + b };
}

export interface Odds {
	/** Everything the actor adds to the dice, itemised — the HUD shows the parts
	 *  because "+7" tells a player nothing about which of their choices earned it. */
	skill: number;
	abilityMod: number;
	resourceMod: number;
	/** What the ground you already hold is worth on this roll — see `leverage`. */
	holdMod: number;
	modifier: number;
	/** The number to beat: a building's live hardening, or the card's own DC. */
	target: number;
	/** What the dice alone must reach for each band. Ties go to the defender, so
	 *  the first success is at target + 1. */
	needed: number;
	neededClean: number;
	/** Probability of at least a partial, and of at least a clean. */
	chance: number;
	chanceClean: number;
	/** Chance the roll goes badly enough to cost you something. */
	chanceBotch: number;
}

export function computeOdds(opts: {
	/** The building's hardening, when a building is defending. */
	hardening?: number;
	/** The card's own difficulty, when nothing is. */
	dc?: number;
	skill: number;
	abilityMod: number;
	resourceMod: number;
	holdMod?: number;
	defenceMod: number;
}): Odds {
	const hold = opts.holdMod ?? 0;
	const modifier = opts.skill + opts.abilityMod + opts.resourceMod + hold;
	const target = (opts.hardening ?? opts.dc ?? 8) + opts.defenceMod;
	const needed = target - modifier + 1;
	const neededClean = target - modifier + 4;
	// A botch is margin ≤ −5, i.e. the dice landing at or below target − 5 − mod.
	const botchAtMost = target - modifier - 5;
	return {
		skill: opts.skill,
		abilityMod: opts.abilityMod,
		resourceMod: opts.resourceMod,
		holdMod: hold,
		modifier,
		target,
		needed,
		neededClean,
		chance: oddsAtLeast(needed),
		chanceClean: oddsAtLeast(neededClean),
		chanceBotch: 1 - oddsAtLeast(botchAtMost + 1)
	};
}

/** Heat → what the meter is called depends on which chair you are in. */
export const meterName = (f: Faction) => (f === 'red' ? 'HEAT' : 'DETECTION');
