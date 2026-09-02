<!-- markdownlint-disable MD013 -->

# Card Supply

**Version:** 0.1.0 · **Applies to:** `showcase/examples/breach/internal/deck.ts`,
`internal/match.svelte.ts`, `internal/cards.yaml`

How a card reaches a hand, and what to do when the hand it reaches is unplayable.

Implements `DECK-6`, `DECK-7` and `DECK-8` of
[`gameplay.md`](./gameplay.md). That document owns the rules; this one owns the
mechanism, the data shape, and the edges. Where the two disagree, `gameplay.md`
governs.

| § | Section | Stability | Status |
| --- | --- | --- | --- |
| 1 | The problem | `beta` | measured |
| 2 | Slice 1 — relief | `beta` | `proposed` |
| 3 | Slice 2 — gated supply | `alpha` | `proposed` |
| 4 | Fog | `beta` | `proposed` |
| 5 | Touchpoints | `beta` | — |
| 6 | Edges | `alpha` | — |

Requirements carry `SUP-n`. Notation, status and stability as in
[`conventions.md`](./conventions.md); pillars and tiebreakers in
[`pillars.md`](./pillars.md); terms in [`glossary.md`](./glossary.md).

---

## 1. The problem

Slice 0 replaced four welded cards with a dealt hand. That trades a fixed
opening for a variable one, and the cost is a hand you cannot legally play.

**The piles today**, signatures excluded (they are minted straight to their
owner's opening hand):

| Side | Pile | Distinct | Dead early |
| --- | --- | --- | --- |
| Red | 13 | 6 | `divergence` ×2 |
| Blue | 14 | 6 | none |

`divergence` targets `forge` (chain 3) and `silos` (chain 4). The chain runs in
order, so both are hard-blocked until red holds chain step 2 — roughly 15% of
red's pile is unplayable on round 1 and cannot be made playable by any decision
the player takes that turn.

**The problem is red's, not blue's.** Blue's restricted cards (`attest`, `diff`)
name blue-and-neutral ground that is legal from round 1, and blue is never
gated by chain order because blue is not advancing along it. This asymmetry is
the shape of the whole feature: **relief is mostly for red, and gated supply is
almost entirely a red mechanic.**

> Stated because the obvious instinct — give both sides the same relief valve
> and the same tiering — would spend content on a problem blue does not have.

Two smaller faults measured while writing this:

- **`SUP-DEF-1`** `fixture` and `segment` declare `copies: 2` and are signatures.
  `buildDeck` excludes every signature copy from the pile and `openingHand`
  mints exactly one, so **the second copy of each is unreachable**. Either the
  count is wrong or signature exclusion must be per-copy.
- **`SUP-DEF-2`** `zeroday` (3 AP, `mod` 6) is a signature, so it is in the
  Handler's opening hand on round 1 — the strongest card in the game, held from
  the first turn, when exactly one chain step is legal. This is the concrete
  absurdity Slice 2 exists to fix.

---

## 2. Slice 1 — relief

Two mechanisms. Both are cheap, neither touches the information model.

### 2.1 Discard to draw

**SUP-1.** A seat **MAY** spend 1 AP, once per turn, to discard one card from
hand and draw one.

> Priced in the same currency as an action, so a bad hand becomes a decision
> with a cost rather than a complaint. Once per turn, because a seat that can
> cycle its whole hand for 3 AP has bought certainty, and certainty is what the
> deal exists to remove.

**SUP-2.** The discarded card **MUST** go to its side's discard pile by the same
path a played card takes.

**SUP-3.** The action **MUST** be refused when the draw pile and the discard
pile are both empty, rather than silently consuming the AP.

**SUP-4.** Discard-to-draw **MUST NOT** produce a log row.

> It is a draw, and `DECK-9` makes draws silent. A row here would tell the other
> side you had nothing worth playing, which is a read they have not earned.

### 2.2 Opening-hand floor

**SUP-5.** The opening deal **MUST** guarantee red at least one card that is
legally playable on round 1, and blue at least one Detect and one Protect
card.

**SUP-6.** The floor **MUST** be enforced by re-drawing the offending card from
the pile, not by reordering a fixed list.

> A shuffle that is corrected by moving cards around is a shuffle whose seed no
> longer describes it. Draw, test, and put back if rejected.

**SUP-7.** The floor applies to the **opening deal only**. Mid-match refills are
unfiltered.

> One predicate, run once. A floor that ran every turn would be a rule that
> guarantees a playable hand forever, and that is a different game — the one
> where holding a dead card is never a thing you have to plan around.

### 2.3 Ally card-pass — *Withdrawn*

Proposed in the original slice as "pass a card to your ally for 1 AP".
Withdrawn: under `MATCH-4` a 1v1 is one player driving both chairs on their
side, so the action degenerates into passing a card to yourself, which is
strictly worse than the hands already being yours. If it returns it **MUST** be
gated to `2v2` and justified on its own.

---

## 3. Slice 2 — chain-gated supply

The real fix for the dead hand, and the one that is a game mechanic rather
than a relief valve.

**SUP-8.** Each side's deck **MUST** be split into a **basics** pile, present
from round 1, and a **payload** pile whose cards enter the draw pile as that
side advances.

> The board's own lesson restated in the deck: the chain runs in order, so the
> cards for later steps arrive later. A dead hand stops being possible by
> construction rather than by mitigation.

**SUP-9.** The advance triggers are **not symmetric**:

| Side | Trigger | Rationale |
| --- | --- | --- |
| Red | Chain steps held | Red advances by **position** |
| Blue | Footholds revealed | Blue advances by **knowledge** |

> This is the asymmetry getting a second expression. Red's deck opens as it
> gets further in; blue's opens as it works out what is happening. Two different
> games, two different supply curves.

**SUP-10.** A card declares its tier in `cards.yaml`:

```yaml
  - key: divergence
    tier: 2          # enters when its side reaches advance level 2
```

**SUP-11.** `tier` **MUST** default to `0` (basics). A card with no tier is
available from round 1.

> So the field is opt-in and the existing sixteen cards keep working unedited.

**SUP-12.** Entering cards **MUST** be shuffled into the remaining draw pile,
never placed on top.

> Placed on top, the trigger becomes "advance and immediately draw the good
> card", which is a reward schedule, not a supply curve.

**SUP-13.** A tier **MUST NOT** un-enter. Cards do not leave the deck when a
side loses ground.

> Otherwise blue evicting a foothold would silently confiscate red's hand, and a
> deck that shrinks under pressure punishes the losing side twice.

**SUP-14.** Tier assignment **SHOULD** track the kill-chain stage of the card
(`DECK-11`), not its power.

> Tiering by power makes a ladder. Tiering by stage makes a story — and the
> story is the thing the game claims to teach.

Proposed initial assignment, red:

| Tier | Enters at | Cards |
| --- | --- | --- |
| 0 | round 1 | `contribution`, `pressure`, `lotl`, `ca` |
| 1 | 1 chain step | `fixture`, `sleeper` |
| 2 | 2 chain steps | `divergence` |
| 3 | 3 chain steps | `zeroday` |

> Which fixes `SUP-DEF-2`: the game's strongest card stops being a round-1
> hand-warmer and becomes the thing red earns its way to.

---

## 4. Fog

**SUP-15.** No mechanism in this document **MAY** produce a log row visible to
the opposing side.

**SUP-16.** A tier entering the deck **MUST** be announced to its own side only,
or not at all.

> The trigger is a fact the owning side already knows — red knows what it holds,
> blue knows what it revealed — so announcing it to the owner leaks nothing. To
> the other side it would be a progress bar on the opponent's deck.

**SUP-17.** Neither pile counts, nor tier state, **MAY** appear in presence.

> `presence` derives from the fogged feed and nothing else (`FOG-5`). A second
> source is a second thing to get wrong.

---

## 5. Touchpoints

| File | Change |
| --- | --- |
| `internal/cards.yaml` | `tier:` per card. |
| `internal/deck.ts` | Parse and validate `tier`; `buildDeck` filters to tier 0; new `entering(side, level)`. |
| `internal/deck.ts` `openingHand` | The `SUP-5` floor predicate. |
| `internal/match.svelte.ts` | `advanceLevel(side)` derived; an effect or upkeep hook that shuffles in newly-entered tiers; `discardDraw(seatKey, uid)` for `SUP-1`. |
| `hud/ActionBar.svelte` | The discard-to-draw control, with its AP cost shown. |
| `CardFan.svelte` | A way to nominate the card to discard — keyboard-reachable. |

**SUP-18.** The discard-to-draw control **MUST** be operable from the keyboard.

> Noted here rather than assumed: there is currently no keyboard path to play a
> card at all (`DEF-4`), and this feature adds a second thing a pointer would
> otherwise be required for.

---

## 6. Edges

| Case | Required behaviour |
| --- | --- |
| Draw and discard both empty | Refill is a no-op; the seat plays a short hand. No error, no stall. |
| Tier enters while the draw pile is empty | Shuffle into the empty pile; it becomes the pile. |
| Reshuffle with tiers pending | Only entered tiers are ever in either pile, so reshuffle needs no tier logic. |
| Signature + tier on one card | Signatures bypass the pile entirely; a tier on a signature is meaningless and **MUST** be rejected at load. |
| 1v1 (`MATCH-4`) | One player, both chairs, one shared side deck. Two hands drawing from one pile is the intended behaviour, not a bug. |
| Advance level drops | Cannot happen — `SUP-13`. |

---

## 7. Test plan

All assertable in Node against the headless engine; none needs a browser.

1. A seeded deck deals identically twice. *(Regression for the bug found in
   Slice 0, where the character lot was unseeded.)*
2. Red's opening hand always contains a round-1-legal card (`SUP-5`), over many
   seeds.
3. Discard-to-draw costs 1 AP, moves exactly one card, and is refused twice in
   a turn (`SUP-1`) and on empty piles (`SUP-3`).
4. No mechanism here appends a row readable by the opposing side (`SUP-15`).
5. Tier 3 cards are absent from red's pile until three chain steps are held, and
   present after (`SUP-8`, `SUP-9`).
6. Every card in `cards.yaml` has a reachable copy count — the `SUP-DEF-1`
   regression.

---

## 8. Open questions

1. **Does blue need tiers at all?** Blue has no dead-hand problem today. "Blue
   advances by knowledge" is a satisfying symmetry, and satisfying symmetry is
   exactly what principle 7 warns about. Possible answer: blue gets tiers only
   when blue gets cards that are *responses to things that have happened*, which
   is a content question, not a mechanism one.
2. **Is discard-to-draw still needed once tiers land?** Tiers remove the
   structurally dead card. What remains is the merely *unaffordable* or
   *badly-matched* hand, which may be a decision worth keeping rather than a
   problem worth solving.
3. **Should the floor guarantee an attack or merely a legal play?** Guaranteeing
   an attack risks re-scripting the opening (`DEF-1`) — the thing Slice 2 is
   trying to un-script.
