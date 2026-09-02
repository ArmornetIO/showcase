// ── What the moves actually do ───────────────────────────────────────────────
// `cards.yaml` and the `power:` blocks in `rules.yaml` carry a move's VOICE —
// the sentence printed on the face. This file carries its BEHAVIOUR: the state
// the engine changes when the move resolves, in the words a player would use at
// the table.
//
// The two are deliberately separate, and the separation is the point of this
// file. Flavour is written to be read once and remembered; behaviour has to be
// checkable line by line. Where the two have drifted apart — a move whose
// sentence promises something the engine never learned to do — `caveat` says so
// out loud rather than letting a player lose a game to a rule that was never
// implemented.
//
// KEEP IN STEP WITH: `applyStrike`, `applyRedSupport`, `applyBlue` and
// `applyRecon` in `internal/breach/match.go`. The Go engine is the authority —
// the TypeScript in `internal/` is the offline demo's copy of it and decides
// nothing on a real table. This is documentation of that code and nothing else
// reads it.
//
// Keyed by MOVE key, so the four character powers sit here beside the twelve
// deck cards: they roll down the same path and the only thing they do
// differently is where they live.

export interface CardNote {
	/** What happens on any success. One sentence, present tense. */
	play: string;
	/** What a partial gets you, when it is not simply "half". */
	partial?: string;
	/** What the miss costs, beyond the AP. */
	miss?: string;
	/** Where the printed sentence and the engine disagree. */
	caveat?: string;
}

export const CARD_NOTES: Record<string, CardNote> = {
	// ── The Maintainer ────────────────────────────────────────────────────────
	contribution: {
		play: 'Adds REP to the Maintainer: +3 clean, +4 critical. REP is spent automatically as up to +3 on any red ATTACK roll, and it never runs out — spending it does not consume it.',
		partial: '+2 REP.',
		miss: 'Nothing on a plain fail. A botch puts +6 heat into the territory.',
		caveat:
			'Costs 1 AP and rolls against DC 6 — with the Maintainer’s SOCIAL 3 that is a 92% hit. This is the safest card in the game and the reason red opens with it.'
	},
	pressure: {
		play: 'Cuts 3 off the target building’s hardening for 2 rounds (2 on a partial, 4 on a critical). Adds 6 heat.',
		miss: '3 heat on a fail, 9 on a botch.',
		caveat:
			'Softening expires at the start of the round two later — play it the turn BEFORE the strike, not four turns before. Commit Rights does not make it quieter: quiet upgrades come off attacks only.'
	},
	fixture: {
		play: 'The Maintainer’s POWER, one charge a match. A real attack roll against the building’s hardening; on a hit red takes a foothold AND leaves 2 implant figures standing in it, hidden.',
		partial: 'The foothold is “dislodgeable” — it is not persistent. Everything else is the same.',
		miss: 'Chips 1 off the building’s hardening anyway (a botch does not even manage that, and costs you a figure). Heat: 6 on a hit, 12 on a fail, 18 on a botch.',
		caveat:
			'The implants are what make this move. Each one left standing burrows at the start of every round: −1 more hardening and +2 heat, each, forever, until somebody reads the tree.'
	},
	divergence: {
		play: 'A hard attack roll (+4) at the Forge or the Silos — steps 3 and 4 of the payload path. Takes the foothold and leaves nothing behind.',
		partial: 'Foothold is dislodgeable, not persistent.',
		miss: 'Chips 1 hardening. Heat: 12 on a hit, 24 on a fail, 36 on a botch.',
		caveat:
			'“Only an artifact-to-source diff can see it” is not a rule. It leaves an ordinary foothold with no sleeper flag, so Sweep reveals it exactly like anything else, and the region surfaces it at detection 80.'
	},

	// ── The Handler ───────────────────────────────────────────────────────────
	lotl: {
		play: 'An attack roll that makes NO heat at all, win or lose. Only +1 to the roll, so it wants leverage or a softened target.',
		miss: 'Chips 1 hardening and costs nothing else. The quietest way to fail in the game.',
		caveat:
			'This is the chain-pusher. Everything else red owns is either loud or narrow; this one can be thrown at any blue or neutral building, repeatedly, for free.'
	},
	sleeper: {
		play: 'An attack roll that, on a hit, plants a foothold flagged SLEEPER plus 2 implant figures.',
		miss: 'Chips 1 hardening. No heat either way.',
		caveat:
			'A sleeper is invisible to Sweep AND survives the heat-80 auto-surface — the two things that otherwise turn red’s board over. Diff the Tarball, Provenance Attestation and Rebuild From Source still find it. The card says “for 2 rounds”; the engine has no timer, so it hides from sweeps permanently.'
	},
	ca: {
		play: 'Cuts 4 off the Checkpoint’s or the Attestation Court’s hardening for 2 rounds (2 on a partial, 5 on a critical). Adds 6 heat.',
		miss: '3 heat on a fail, 9 on a botch.',
		caveat:
			'The card says the Checkpoint loses the hardening “this round”; the engine gives 2, expiring at the start of the round two later. It also rolls on SOCIAL, and the Handler’s SOCIAL is −1 — a Handler card the Handler is bad at, on purpose.'
	},
	zeroday: {
		play: 'The Handler’s POWER, one charge a match. The biggest attack roll in the game: +6, playable at any blue or neutral building.',
		miss: 'Chips 1 hardening and lights the region up.',
		caveat:
			'3 AP — a whole round — and the heat is brutal: 18 on a hit, 36 on a fail, 54 on a botch. Above 80 the territory surfaces every non-sleeper foothold in it. Missing with this can lose red the match on its own.'
	},

	// ── The Architect ─────────────────────────────────────────────────────────
	harden: {
		play: 'Posts 3 defender figures on one of your own (or a neutral) building. Each figure is worth +1 hardening while it stands.',
		partial: 'Still all 3 figures — any success posts the full squad.',
		miss: 'Nothing but the AP.',
		caveat:
			'The “permanently” on the card is not quite true: the +3 IS the three figures, they are visible to red, and a successful red hit routs one of them (two on a critical). A building holds at most 5 figures per side.'
	},
	segment: {
		play: 'The Architect’s POWER, one charge a match. On the RELAY BEACON: seals it for 2 rounds and reveals EVERY hidden foothold red has anywhere on the board. Anywhere else: reveals hidden footholds at that one building and pulls out its implants.',
		partial: 'Off the Beacon, a partial reveals one foothold and pulls one implant.',
		caveat:
			'“Cut a lane for 2 rounds. Nothing crosses it — including everything of yours that used it” describes a mechanic that does not exist. Only the Beacon branch seals anything; played anywhere else it is a plain reveal-and-clean, and it never costs blue a thing. It needs a DC 9 roll on TECH; the Architect has TECH 3.'
	},
	attest: {
		play: 'Reveals hidden footholds at the Forge, the Silos or the Attestation Court, and pulls implants out of it — one on a partial, every one of them on a clean or critical.',
		miss: 'Nothing but the AP. Blue’s failures are quiet.',
		caveat: 'Finds sleepers. Sweep cannot.'
	},
	rebuild: {
		play: 'At 3 AP, does the same job as Provenance Attestation but at ANY blue or neutral building: reveals hidden footholds there and pulls out implants (all of them on a clean or better).',
		caveat:
			'The printed text promises it “evicts any non-persistent foothold in the Foundry”. It does not — no card in the game removes a foothold. It removes the implant FIGURES, which is what stops the burrowing.'
	},

	// ── The Threat Hunter ─────────────────────────────────────────────────────
	sweep: {
		play: 'Reveals every hidden foothold in the WHOLE territory — the widest look in the game, for 1 AP — and pulls one implant out of each building in it.',
		partial: 'Reveals just one foothold.',
		caveat:
			'Sleepers are inert and stay hidden, and a sweep never reads deep enough to pull more than one implant per building. It tells you WHERE to look; Diff or Rebuild is what actually cleans.'
	},
	diff: {
		play: 'Reveals hidden footholds at one of the Silos, the Forge, the Package Mirror or the Dependency Mill, and pulls implants out — one on a partial, all of them on a clean or critical.',
		caveat: 'The counter to Obfuscated Test Fixture, and it finds sleepers.'
	},
	quarantine: {
		play: 'Seals a building for 2 rounds (1 on a partial, 3 on a critical) and posts 2 defenders on it. While it is sealed nothing red throws at it can land: the attack is blocked before the roll, the AP is burned and the payload path cannot advance through it.',
		miss: 'Nothing but the AP.',
		caveat:
			'“Anything held inside it cannot advance the chain” is only half true. A seal stops red attacking THROUGH the building, but the victory check never reads the quarantine list — so sealing a chain step red already holds does not take that step back off the board, and red still wins the moment the other four are held. The seal also stops implants inside it burrowing, and the two defenders stand down when it lapses. Red can see a sealed door.'
	},
	attribute: {
		play: 'The Threat Hunter’s POWER, one charge a match. On the PERSONA FARM: resets the Maintainer’s REP to 0 and clears every red figure standing there. Anywhere else on red ground: a reveal-and-clean at that one building.',
		caveat:
			'3 AP and DC 11 on SOCIAL, which the Hunter has at 0 — an 8% clean. The face reads “WIN”; it does not win the game, it takes red’s accumulated roll bonus away.'
	}
};

/**
 * Heat a red move puts into the target’s territory, by outcome.
 *
 * Mirrors `applyStrike` (attacks) and `applyRedSupport` (everything else red
 * plays) in `internal/breach/match.go` — those two functions are the authority
 * and this is a reader for the rules page. The two branches are genuinely
 * different formulas, which is exactly why a player cannot infer these numbers
 * from the noise pip on the card face, and why they are printed here.
 *
 * Quiet upgrades are NOT modelled, and on the support branch there is nothing to
 * model: `applyStrike` subtracts the quiet bonus before the ×6, `applyRedSupport`
 * uses the raw noise and never looks at it. So this is the round-1 price list for
 * an attack and the price list for every round for a control or an econ card.
 */
export function heatFor(kind: string, noise: number): { hit: number; fail: number; botch: number } {
	const attack = kind === 'strike' || kind === 'implant';
	if (attack) return { hit: noise * 6, fail: noise * 12, botch: noise * 18 };
	return { hit: noise * 6, fail: noise * 3, botch: noise * 3 + 6 };
}
