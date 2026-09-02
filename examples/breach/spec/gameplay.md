<!-- markdownlint-disable MD013 -->

# BREACH — systems (unmigrated)

**Applies to:** `showcase/examples/breach/**`

This file is the **remainder** of the original single-document specification.
Everything still here is authoritative for its area; everything that has
migrated has left a pointer and no duplicate.

Start at [`README.md`](./README.md) for the document map and the migration
order.

| You want | Read |
| --- | --- |
| Notation, identifiers, status, how to change a rule | [`conventions.md`](./conventions.md) |
| Pillars and tiebreakers | [`pillars.md`](./pillars.md) |
| Terms | [`glossary.md`](./glossary.md) |
| Everything else | below |

---

## 1. The match

**MATCH-1.** `built` A match is 2 sides and a horizon of `rounds` rounds. Seats
act in fixed initiative `R1 → B1 → R2 → B2`, and any smaller table is a **prefix
of that order**, never a re-shuffle of it.

> `breach.Initiative` and `breach.SeatOrder` in `internal/breach/rules.go`.
>
> The interleave is a rule, not a seating accident: every seat acts between two
> enemies and never beside its ally, so a plan must survive an enemy turn taken
> in the middle of it. Stated as a prefix so the alternation survives every size
> and `Match.Phase` keeps meaning the same thing.

**MATCH-2.** `built` Red wins by holding all 5 chain structures. Blue wins by
reaching the horizon with the chain incomplete.

**MATCH-3.** `built` The two win conditions are not symmetric: blue wins **by the
clock**. Any change to the economy or the horizon **MUST** be evaluated as a
change to blue's win rate.

> Halving both sides' action points does not halve both sides' chances. It
> shortens the attacker's runway and leaves the defender's timer intact.

**MATCH-4.** `proposed` A match size of `1v1` **MUST** seat one player driving
**both chairs on their side**, in the same initiative order.

> Not built, and the engine shipped the alternative — see `MATCH-5`. Two thirds
> of the objection stand: the economy halves against an unchanged horizon, and
> each side loses the skill spread its own cards are priced against. A third has
> appeared — the unseated character's **power** never enters the match at all, so
> red at `1v1` has no Zero-Day Reserve and blue has no Attribution.
>
> The signature-card third is void, and it is worth saying why rather than
> deleting it. Cards belong to a **side**, not a seat (`ROLE-3`), and `deal`
> builds one pile per side from `DeckFor`. Leaving a chair empty withholds no
> card: the Maintainer draws and plays the Handler's cards, rolled through the
> Maintainer's ratings. That is a real balance effect, but it is the *skill
> spread* leg, not a deleted-content leg.

**MATCH-5.** `built` A `1v1` match seats **one chair per side**: the first red
and the first blue in initiative order. The other two characters do not act.

> `SeatOrder` in `internal/breach/rules.go`, `Match.seatOrder` in `match.go`.
>
> Recorded because it is what runs, not because it is what `MATCH-4` asked for.
> The two are in genuine conflict and `MATCH-4` is the open design question; this
> requirement exists so nobody reads a `proposed` rule as behaviour. Filed as
> `MATCH-DEF-1`.
>
> One consequence is observable and probably wrong: `HardeningOf` sums the
> **whole blue roster's** harden upgrades over blue's estate, not the seated
> ones. At `1v1` blue therefore collects the absent Threat Hunter's Attribution
> Engine (+2 from round 9) without anybody playing the Hunter. Filed as
> `MATCH-DEF-2`.

---

## 2. Match configuration — *withdrawn*

The `CFG` family is retired along with the whole `configuration/` tree. See
[`README.md`](./README.md#retired-configuration) for why: it specified
`internal/config.ts`, which had no importers and has since been deleted.

What survives is what the server already does. A table carries a size and an
assignment mode, both validated on every path that can set them, and both
changed only before the characters go out.

| Was | Now |
| --- | --- |
| `CFG-1`–`CFG-3` | `breachview.Config` — two fields, on the table. |
| `CFG-4` | ***Withdrawn*** — factually wrong when written. |
| `CFG-5` | ***Withdrawn*** — a statement about one parameter. |
| The settings table | The `set_size` / `set_mode` intents. |

---

## 3. The table

**LOB-1.** `built` The lobby exists before the match. Joining, taking a side and
readying are lobby facts; the match is created from them.

**LOB-2.** `built` The client **MUST** treat lobby commands as intents and the
server as authoritative. A client **MUST NOT** optimistically mutate membership.

**LOB-3.** `built` Start eligibility **MUST** be re-derived from the membership
the client holds, never taken as a server assertion.

> So the disabled state and the reason printed beside it cannot disagree.

**LOB-4.** `built` A match phase is `lobby → in_progress → complete`. The lobby
outlives the match: finishing does not empty the room.

---

## 4. Roles

**ROLE-1.** `built` A role is a **price list**, not a verb list: skills, a
passive, a resource, an upgrade track, and a power.

> Cards were welded to roles until the deck existed. Skills were always the
> thing that made two seats feel different — the same card in two hands rolls
> against two different modifiers.

**ROLE-2.** `built` Skills are `social`, `tech`, `opsec`, `analysis`. Every card
names exactly one, and the seat's rating in it is added to the roll.

**ROLE-3.** `built` Each role contributes cards to its **side's** deck. A card's
side is derived from its owner and **MUST NOT** be authored independently.

> `Ability.on` is written from the owner's point of view, so a card filed to the
> wrong side would pass the legality check and let red harden blue's estate.

**ROLE-4.** `built` Each role has exactly one **power**: a move authored on the
character, never in any draw pile, limited by charges rather than by copies.

> `breachview.Power` and `Klass.Power`; `Match.claim` and `Match.spend` in
> `internal/breach/match.go`; the `power:` blocks in `rules.yaml`.
>
> This requirement previously said *signature*: a card guaranteed in its owner's
> opening hand and never shuffled into the deck. It was marked `built` and it was
> not — a spent card goes to its **side's** discard, and a dry pile reshuffles the
> whole discard, so the Handler could draw the Maintainer's signature and a card
> printed "it works once" came round again. The fix was to stop making the promise
> and change where the thing lives: a power cannot be shuffled out of a pile
> because there is no pile it is in. Filed as `ROLE-DEF-1`.

**ROLE-5.** `partial` A passive **MUST** reach a rule. Two of four do not, and a
third only half does:

| Passive | State |
| --- | --- |
| *Reproducible Builds* (Architect) | Built. The Forge and the Silos stand +2 while the Architect holds an AP. |
| *Trust Accrual* (Maintainer) | Half. REP accrues, but at 1 a round unconditionally — the "no loud action" condition is not checked and the printed gain is 2. It is also not *spent*: `min(res, 3)` is applied to red attack rolls automatically and never consumed. |
| *Patience* (Handler) | Not built. `upkeep` overwrites AP with `baseAP + track`; nothing banks. |
| *Baseline* (Hunter) | Not built. There is no free sweep and no notion of the territory a seat stands in. |

**ROLE-6.** `partial` A resource **MUST** be spendable. None of the four is.
`REP` is *read* — `min(res, 3)` added to red attack rolls — but never
decremented; `BUDGET` and `SIGNAL` are seeded at 2 and read by nothing; `BANK` is
never even seeded, though it would be read if it were, since the Handler is red.

> Amended. This previously named only `BUDGET` and `SIGNAL` as the gap and said
> `REP` "is wired to the roll", which reads as *satisfied for red*. It is not: an
> unspendable resource is a roll modifier with a misleading name, and a Maintainer
> on 9 REP has exactly the same bonus as one on 3.
>
> The mechanism that makes them spendable is [`economy.md`](./economy.md), which
> also proposes moving the pool off the role entirely (`ECON-1`, `ECON-20`) and
> withdrawing `SIGNAL` (`ECON-21`). If that lands, this requirement is satisfied
> by a system that no longer sits in this section, and `ROLE-1`'s "price list"
> loses its resource entry.

**ROLE-7.** `built` A power **MUST** stay on the sheet once spent, at zero
charges, rather than disappearing.

> `Match.powerFor` in `internal/breach/view.go`.
>
> It is recoverable — spent, not lost — and a control that vanishes reads as
> lost. Affordability is answered by the same projection, so a client cannot grey
> the wrong thing by keeping its own charge count.

> The mechanism that makes them spendable is [`economy.md`](./economy.md), which
> also proposes moving the pool off the role entirely (`ECON-1`, `ECON-20`) and
> withdrawing `SIGNAL` (`ECON-21`). If that lands, this requirement is satisfied
> by a system that no longer sits in this section, and `ROLE-1`'s "price list"
> loses its resource entry.

| Seat | Role | Skills (soc/tec/ops/ana) | Power | Charges |
| --- | --- | --- | --- | --- |
| R1 | The Maintainer | 3 / 1 / 1 / 0 | Obfuscated Test Fixture | 1 |
| R2 | The Handler | −1 / 3 / 3 / 1 | Zero-Day Reserve | 1 |
| B1 | The Architect | 0 / 3 / 1 / 2 | Segment | 1 |
| B2 | The Threat Hunter | 0 / 1 / 1 / 4 | Attribution | 1 |

---

## 5. Cards and the deck

**DECK-1.** `built` Cards are **data**. They live in `cards.yaml` and carry no
behaviour — a name, numbers, and the sentence printed on the card.

> A **power** is the same data shape (`breachview.Play`), authored on its
> character in `rules.yaml` instead. Same fields, same resolution path; see
> `ROLE-4`.

**DECK-2.** `built` There is one deck per side. Hands are per seat.

> `Match.decks` and `Match.hands` in `internal/breach/deal.go`. Both are
> unexported and untagged, so no projection can marshal a pile by accident.

**DECK-3.** `built` A hand is **4** cards, and a seat refills to 4 **the moment
it plays one**.

> `HandSize` and `discard` in `internal/breach/deal.go`; `HAND_SIZE` mirrors it
> in the client.
>
> This asked for five, refilled at the start of the turn, on the argument that a
> player should be able to hold one card they cannot play yet and still have
> three live options. Four shipped, and refill-on-play makes the start-of-turn
> half moot: a seat with AP left is already looking at a full hand, so a card
> drawn after blue moves can still answer blue. Amended to what runs rather than
> withdrawn, because the requirement — *a hand has a floor and nobody has to
> remember to refill it* — is satisfied.

**DECK-4.** `built` A card is spent when it is **committed**, not when it
resolves.

> `Match.spend` runs before the dice in `Perform`, and a sealed target still
> costs the card.
>
> A resolution takes seconds of beats. A card still in hand during them is a
> card that can be played twice.

**DECK-5.** `built` When a draw pile empties, its discard is reshuffled into it.

> `deck.draw` in `internal/breach/deal.go`. Both dry returns false and the seat
> plays on with a short hand — a loop that keeps hunting for a card that does not
> exist hangs the room.

**DECK-17.** `built` A seat **MUST NOT** play a card it is not holding, and the
refusal **MUST NOT** distinguish "you are not holding it" from "no such card".

> `Match.claim` in `internal/breach/match.go`.
>
> The check is in the engine rather than the transport because the demonstrator
> calls `Perform` directly and never goes through the table. Two distinct errors
> would be a hand-inference oracle: the other side could learn your hand a key at
> a time by asking.

**DECK-18.** `built` A seat **MUST** be told its own pile and discard depth, and
**MUST NOT** be told the other side's.

> `Match.deckCounts`, projected as `PileCount` / `DiscardCount` in `view.go`.
>
> Your own deck's thickness is visible at a physical table and derivable from
> what you have played. The opponent's is a running count of how many turns they
> have taken — including the quiet ones the fog exists to hide.

**DECK-6.** `proposed` A seat **MAY** spend 1 AP once per turn to discard a card
and draw one.

> The general answer to a dead hand: it makes "I drew badly" a decision priced
> in the same currency as an action, rather than a complaint.

**DECK-7.** `proposed` The opening hand **MUST** be filtered so that red opens
holding at least one card it can legally play on round 1, and blue opens holding
at least one Detection and one Protection.

> Cheapest available fix for a shapeless opening. Applies to the deal only, so
> it costs one predicate and no ongoing rule.

**DECK-8.** `proposed` Cards **SHOULD** enter a side's deck as that side
advances — red by chain position, blue by footholds revealed.

> The board's own lesson restated in the deck: the chain is walked from the
> front by anyone playing it well, so the cards for later steps arrive later. It makes a dead hand impossible by
> construction, and it gives the asymmetry a second expression — red's deck
> advances by *position*, blue's by *knowledge*.

**DECK-9.** `built` A draw is **silent**. It produces no log row.

> Announced to the table it hands the other side a clock on your tempo, which
> is strictly more than detection gives them. Announced to your own side it is
> noise for nothing.

**DECK-10.** `built` Discard piles are **side-private**. A face-up discard
**MUST NOT** exist.

> `deck.discard` is unexported and untagged (`internal/breach/deal.go`); only its
> depth is projected, and only to its owner (`DECK-18`).
>
> A face-up discard reconstructs the fogged history in a sidebar: a successful
> hidden implant leaves no log row, but would leave a face-up card.

### 5.1 The two frameworks

The categories are not invented. Each side's cards are grouped by the real
framework that side's practitioners actually use — red by the **Cyber Kill
Chain**, blue by the **NIST CSF functions**. This is the curriculum: a player
who finishes a match has walked both, in order, against each other.

**DECK-11.** `proposed` Red's categories **MUST** be the kill-chain stages;
blue's **MUST** be the CSF functions. Neither list **MAY** be padded or trimmed
to match the other's length.

> Seven against five is the correct shape. The frameworks are not mirror images
> in life and a game that forces them into symmetry teaches a symmetry that does
> not exist. An earlier draft of this section proposed three categories a side;
> both of the invented cells came out empty.

**DECK-12.** `proposed` The frameworks are a **grouping over** the engine's
`AbilityKind`, never a replacement for it.

> `strike` and `implant` are not one thing called Attack. Dwell, sleepers,
> persistence and targeted eviction all turn on the difference, and collapsing
> them trades those for a tidier word on a card frame. A stage is what a card
> *means*; a kind is what the engine *does* with it.
>
> Correction, so this is not read as a description of today's code: those four
> mechanics key off `CardFx.Leaves` and the card **key**, not off `AbilityKind`.
> The kind field itself is nearly inert — `strike` and `implant` are branched on
> together and never apart (`AttackBlocked`, `RollsDice`, `OddsFor`), `control`
> and `econ` are read only by the demonstrator's card-picking heuristic in
> `ai.go`, and nothing anywhere reads `recon` or `utility`. `DECK-12` is the rule
> that would give the field work to do. Filed as `DECK-DEF-1`.

**DECK-13.** `proposed` Every card **MUST** declare its stage or function, and
the printed card **SHOULD** show it.

Powers are marked †. They are moves, not cards, so a stage classifies them the
same way — but they never enter a pile, and a framework table read as a deck
list would be wrong by four.

| Red · kill chain | Moves today |
| --- | --- |
| Reconnaissance | *(empty — see `DECK-15`)* |
| Weaponization | Earnest Contribution · Certificate Pressure |
| Delivery | Obfuscated Test Fixture † |
| Exploitation | Co-maintainer Pressure · Zero-Day Reserve † |
| Installation | Sleeper Implant |
| Command & Control | *(board, not cards — see `DECK-14`)* |
| Actions on Objectives | Release Divergence · Living off the Land |

| Blue · CSF | Moves today |
| --- | --- |
| Identify | Provenance Attestation · Attribution † |
| Protect | Harden |
| Detect | Sweep · Diff the Tarball |
| Respond | Quarantine · Segment † |
| Recover | Rebuild From Source |

> Blue covers all five functions with eight moves — six cards and two powers.
> That is the shape of the framework showing through the content rather than
> being imposed on it, and it is the evidence that these categories fit where the
> invented ones did not.

**DECK-14.** `proposed` A kill-chain stage **MAY** be expressed as board
geography rather than as cards. Command & Control is the Relay Beacon, and blue
answers it by sinkholing that structure rather than by playing a C2 card.

> Worth stating because it looks like a gap and is not. The stage a defender
> most wants to sever is a *place* here, which is why blue has a card that
> attacks red's own ground at all.

**DECK-15.** `proposed` Red's **Reconnaissance** stage is empty and **MUST NOT**
be filled until red has something to learn. Blocked on `FOG-6`.

> Red owns no recon because red currently faces no unknown: walls are public and
> footholds are red's own. Reconnaissance cards written against a board with
> nothing hidden would be flavour with a die roll attached — which is exactly
> what the framework is supposed to stop us shipping.

**DECK-16.** `proposed` The board's five chain steps are the **supply chain**,
not the kill chain. The two axes **MUST NOT** be conflated.

> Source → build → registry → runtime is *where* the intrusion travels; recon →
> weaponize → deliver is *what* the intruder is doing. A player advances along
> both at once, and the game is more legible when each keeps its own name.

---

## 6. Effects

The layer the engine does not yet have. Today every defence collapses into one
integer and every modification is a hand-written mutation of one of five
parallel maps, with lifetimes keyed by string prefixes (`soft:`, `quar:`).

**EFF-1.** `proposed` An effect **MUST** carry: an identity, the card that
produced it, the side that owns it, a scope (structure · territory · side), a
target, a magnitude, a duration, and an audience.

**EFF-2.** `proposed` A structure's defence **MUST** be derived from its base
hardening plus its live effects. No effect may be stored pre-summed.

> Six sources currently add into one number, and nothing downstream can say why
> it moved. Derivation is what makes a status readable.

**EFF-3.** `proposed` An effect **MAY** declare which `AbilityKind`s it answers.
An effect that answers all of them **MUST** say so explicitly.

> This is what makes "a firewall that stops a strike but not an implant"
> expressible. It cannot be expressed against a single integer, because the
> integer is computed before anyone knows what is incoming.

**EFF-4.** `proposed` Effects **MUST** stack additively unless they declare
otherwise, and each **MUST** expire independently.

> One expiry map keyed by structure cannot hold two effects on one building with
> different lifetimes.

**EFF-5.** `proposed` Total immunity **SHOULD NOT** exist. A protection makes an
approach expensive; it does not make it impossible.

> In a game blue wins by running out the clock, an unbeatable structure on the
> chain is a won game with rounds left to play.

**EFF-6.** `proposed` A structure's **status** is the derived list of its live
effects, and is what the board and the log both read.

> One source, so the sheet, the bar and the narration cannot disagree.

**EFF-7.** `proposed` An effect's audience is declared at creation. An effect
red cannot see **MUST NOT** alter any number red is shown.

---

## 7. The turn

**TURN-1.** `built` A seat has 3 AP per turn. A card costs AP; a turn ends when
AP is exhausted, the clock expires, or the seat passes.

**TURN-2.** `built` The turn clock drains only while a player is thinking. A
resolution playing out is the game's time, not theirs.

**TURN-3.** `built` Upkeep runs per round: heat decays, effects expire,
unattended implants dwell, damage is repaired.

**TURN-4.** `proposed` A **setup phase** **MAY** precede round 1, in which blue
distributes a posture budget across its own and neutral structures.

**TURN-5.** `proposed` If a setup phase exists, both sides **MUST** act in it
simultaneously. Blue commits publicly; red reads and chooses an approach
privately.

> Sequential, with red waiting, turns a game with a 30-second clock into
> watching a loading bar.

**TURN-6.** `proposed` A setup phase **MUST NOT** ship before the chain
branches. *(Blocked on `BOARD-3`.)*

> With a single-lane chain, red's first attack is the same structure every
> match, so a defensive budget has one correct answer. That is arithmetic, not
> a decision.

---

## 8. The board

**BOARD-1.** `built` 18 structures across 5 territories. Hardening 6–15, floored
at 4 after modification.

**BOARD-2.** `built` The chain is 5 structures in a fixed position order, but
that order is an INCENTIVE, not a gate: the first four are attackable whenever,
in any order. Holding the step before a target is worth +1..+5 of leverage on
the roll (RES-1), which is what makes sequence the cheapest line rather than the
only one. Only the payload — the last step — is gated, and it requires the other
four held.

**BOARD-3.** `proposed` The chain **SHOULD** offer more than one entry,
converging at a later step.

> A single lane makes the opening scripted: red's first card against the first
> structure succeeds in roughly five matches out of six, so neither side has a
> decision on round 1. This is the prerequisite for a defensive budget meaning
> anything.

**BOARD-4.** `built` Heat is per territory, 0–100. At 80 a territory stops
keeping secrets and reveals what stands in it.

---

## 9. Resolution

**RES-1.** `built` A roll is `2d6 + skill + card + resource + leverage` against
a target number — a structure's hardening for attacks, the card's `dc`
otherwise.

**RES-2.** `built` Outcomes are graded, not binary: botch, fail, partial, clean,
critical. A failed attack still chips the wall.

> A wall worn down by attacks that all "failed" is the mechanic that stops a
> high roll being the only thing that matters.

**RES-3.** `built` Holding the previous chain step pays into the next: +1 held,
+1 per implant to a cap of 2, +2 if staged.

**RES-4.** `built` Two kinds of refusal: `hard` — the rule forbids it, and it is
unplayable; `sealed` — a quarantine is in the way, and the player **MAY** try
and watch it fail.

> A defender's move that silently greys out a target is a move nobody ever sees
> work.

---

## 10. Information

**FOG-1.** `built` Fog is **one-directional**. Blue's walls are public; red's
footholds and quiet actions are not.

> A wall red cannot see does not deter, and deterrence is half of what blue
> sells.

**FOG-2.** `built` Every log row carries an audience. A row a seat may not read
is absent, not redacted.

**FOG-3.** `built` Attribution carries its **own** audience, tighter than the
row's. A repelled attack reaches the whole table while the attacker's identity
does not.

**FOG-4.** `built` Attribution defaults **closed** — to the actor's own side —
and is widened only where the game has decided the actor is exposed.

> So adding a row addressed to everyone cannot silently widen the fog.

**FOG-5.** `built` Any read derived for presentation **MUST** be built from the
fogged feed and no other source.

> One gate, not two. A second source is a second thing to get wrong.

**FOG-6.** `proposed` Blue's hardening **delta** **SHOULD** be private while base
hardening stays public.

> This is what creates an information problem for red, which is what fills the
> Recon category with real cards rather than filler — and what makes a blue
> setup phase a commitment rather than a public declaration.

**FOG-7.** `built` The fog lifts at match end. The result screen reads the raw
log.

> Playing twelve rounds against something you can only infer is only satisfying
> if the inference is settled afterwards.

**FOG-8.** `built` Red's covert bookkeeping — `Softened` and `Chip`, and the
`soft:` expiry timers that name them — **MUST NOT** reach blue. A structure's
**live** hardening stays public.

> `coveredState` and `visibleExpiry` in `internal/breach/view.go`.
>
> These were copied wholesale to both sides, which handed blue a map of red's
> covert work for free. Softening is the tell — red weakens a building the turn
> before it strikes — so a blue player watching it knows the target *and* that a
> strike is coming, without spending a card. `Chip` is the same leak one step on:
> a building whose damage climbs with no attack against it has something living
> in it. What blue loses is the decomposition, never the number, which keeps
> `PILLAR-1`'s public-walls line intact.

**FOG-9.** `built` Somebody holding no chair **MUST** receive the pieces on the
board and nothing else: no feed, no hand, and no seat key.

> `Match.bystanderView` in `internal/breach/view.go`.
>
> A bystander used to be given *blue's* projection, on the reasoning that the
> defender's view leaks nothing. It carries blue's private feed and blue's hand,
> and `Table.Join` has no member cap — so anyone with the invite link could
> arrive, never sit down, and relay both to the red player. That is the fog gone
> for the price of a second browser tab. An empty `SeatKey` is how the client
> knows it is watching rather than playing.

---

## 11. Known defects

Recorded because a spec that only describes the intended game is not a spec.

| Id | Defect |
| --- | --- |
| `DEF-1` | The opening is scripted: one entry to the chain, one dominant first card. |
| `DEF-2` | Two passives and *three* resources are printed text with no engine behaviour. |
| `DEF-3` | `1v1` is declared in the rules and implemented nowhere. |
| `DEF-4` | There is no keyboard path to arm, target and resolve a card. |
| `DEF-5` | Defences are one integer, so no protection can answer one kind of attack. |
| `DEF-6` | Red's Reconnaissance stage has no cards, because the board hides nothing from red. |

Defects have started moving to the documents that own them. `DEF-*` numbers stay
here so links land somewhere, but the register that gets maintained is the local
one:

| Here | Owned by |
| --- | --- |
| `DEF-2`, the resource half | `ECON-DEF-3` in [`economy.md`](./economy.md), and `ROLE-6` — which now names `BANK` as well. The passive half stays with `ROLE-5`. |
| `DEF-3` | ***Superseded*** by `MATCH-DEF-1`. `1v1` is no longer implemented nowhere; it is implemented *differently from `MATCH-4`*, which is a sharper fault than the one recorded here. |
| `DEF-5` | Awaiting the effects migration. |
| `DEF-6` | Blocked on `FOG-6`; `ECON-14` depends on the same unblock. |

### Local register

| Id | Defect | Costs a player | Violates |
| --- | --- | --- | --- |
| `MATCH-DEF-1` | `1v1` seats one chair a side; `MATCH-4` requires one player driving both. | Half the economy against a full horizon, and one power a side that can never be played. Neither is signposted. | `MATCH-4` |
| `MATCH-DEF-2` | `HardeningOf` sums the whole blue roster's harden upgrades, not the seated ones. | At `1v1` blue silently collects the absent Hunter's +2 from round 9. | `MATCH-5` |
| `ROLE-DEF-1` | `ROLE-4` claimed `built` for a guarantee the discard broke. Fixed by moving the four moves to powers. | Historic — a "works once" card came round again, and an ally could draw it. | `ROLE-4` |
| `DECK-DEF-1` | `AbilityKind` is nearly inert: `recon` and `utility` are read by nothing, `control` and `econ` only by `ai.go`. | A card frame states a category that predicts nothing about resolution. | `DECK-12` |
| `DECK-DEF-2` | Card text promises rules the engine never grew — Sleeper's timer, Rebuild's eviction, Harden's permanence, Segment's lane, Quarantine's chain hold, Certificate Pressure's duration, Divergence's invisibility, Attribution's WIN. | A turn planned on the printed sentence loses to the implemented one. | `PILLAR`-level; no requirement asserts that printed text is normative, which is itself the gap. |
| `BOARD-DEF-1` | Four building notes read as rules and are none: the Observatory's free look, the Keep's alternate victory, the Workshop's disarm, the Bastion's lying map. The Sandbox's note promises leverage it cannot pay, being off-chain. | Same as `DECK-DEF-2`, and worse — a building note has no card frame to signal it is flavour. | As above. |

> `DECK-DEF-2` and `BOARD-DEF-1` are the reason the rulebook page carries a
> *Where the print lies* section at all. Either the text is corrected or the
> rules are built; enumerating them is the holding position, not the fix.

> A single global defect table stopped being readable at six rows and will not
> survive sixty. As each section migrates, its defects go with it.

---

## 12. Build order

Derived from the above; each item names what it unblocks.

1. **Keyboard play** (`DEF-4`) — a dealt hand makes a pointer-only game worse.
2. **Settle `1v1`** (`MATCH-4` vs `MATCH-5`) — one chair a side ships today. Either
   build both chairs as specified, or withdraw `MATCH-4` and rebalance the horizon
   for a half-size economy. The one thing that cannot stay is both texts standing.
3. **`DECK-6`, `DECK-7`** — dead-hand relief and a shaped opening.
4. **`DECK-8`** — chain-gated supply.
5. **`EFF-1`–`EFF-7`** — the effect model. Unblocks structured defences.
6. **`BOARD-3`** — branch the chain. Unblocks `TURN-4`.
7. **`FOG-6`** — private hardening delta. Unblocks red Reconnaissance
   (`DECK-15`, `DEF-6`) — the last empty cell in either framework.
8. **`TURN-4`–`TURN-6`** — the setup phase, last, because it depends on 6 and 7.

Two documents written since this list have their own place in it:

- [`card-supply.md`](./card-supply.md) is items 3 and 4 specified. `SUP-1`–`SUP-7`
  are item 3; `SUP-8`–`SUP-17` are item 4.
- [`economy.md`](./economy.md) sits **after item 5**, because blue's purchases
  are effects (`ECON-12`) and there is no effect model to buy into until then.
  Its Observatory half sits after item 7, with `DECK-15` — `ECON-14` and
  `DEF-6` are blocked on the same thing.

Nothing in this list is blocked on a setting, which is most of why the
configuration tree could be retired without disturbing it.
