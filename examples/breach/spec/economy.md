<!-- markdownlint-disable MD013 -->

# Economy and the neutral ground

**Family:** `ECON` · **Layer:** Systems

What the Outlands is for. Currency, the two markets, and how a side takes one
away from the other.

| § | Section | Stability |
| --- | --- | --- |
| 1 | What is there today | `beta` |
| 2 | Currency | `alpha` |
| 3 | Claiming a market | `alpha` |
| 4 | The goods | `alpha` |
| 5 | Fog | `beta` |
| 6 | Boundaries | `beta` |
| 7 | Touchpoints and edges | `alpha` |
| 8 | Open questions | — |

Notation and status as in [`conventions.md`](./conventions.md); pillars in
[`pillars.md`](./pillars.md); terms in [`glossary.md`](./glossary.md).

---

## 1. What is there today

`rules.ts` calls the Outlands *"where the game actually happens"*. Four
buildings stand there. **Two of them do nothing.**

| Structure | Role | Referenced by |
| --- | --- | --- |
| `forum` Maintainer Circle | Upstream project | Chain step 1 |
| `house` Package Mirror | Dependency mirror | `diff` targets it |
| `mark` **Vendor Market** | Third-party registry | *nothing* |
| `observatory` **The Observatory** | Threat intelligence | *nothing* |

Both dead buildings are named for this system and one of them states a rule in
its flavour text that the engine never implemented:

> **The Observatory** — "Sees far, and always a little late. **Blue may spend a
> turn here to look at any region.**"

And the resources those purchases would spend are half-fiction: `res` is
credited by exactly one card (`contribution`) and read in exactly one place
(`resourceMod`, red-only, attacking-only, capped at 3). Blue's `BUDGET` and
`SIGNAL` are seeded at 2 and never touched again.

### Defects

| Id | Defect | Violates |
| --- | --- | --- |
| `ECON-DEF-1` | `mark` and `observatory` are named by no card and read by no code. Two of five neutral structures are scenery. | `PILLAR-3` |
| `ECON-DEF-2` | The Observatory's note states a rule the engine does not implement. Flavour text is making a promise. | `TIE-1` |
| `ECON-DEF-3` | Blue's resources are never credited or spent. A resource that cannot be spent is a label. | `ROLE-6` |

`ECON-DEF-3` is the economy's half of `DEF-2` in
[`gameplay.md`](./gameplay.md) §11, which bundles two dead passives with two
dead resources. The resources are owned here; the passives stay with `ROLE-5`.

---

## 2. Currency

**ECON-1.** `proposed` Each side **MUST** hold one currency pool, owned by the
side and not by a seat.

> Today `res` is per-seat, so the Maintainer farms reputation the Handler cannot
> spend. Pooling it makes the 2v2 division of labour real: one seat earns, the
> other strikes.

**ECON-2.** `proposed` Red's currency **MUST** be earned by acting quietly, and
blue's by surviving and by revealing.

| Side | Pool | Earned by |
| --- | --- | --- |
| Red | `REP` | Economy cards; rounds ended without raising detection |
| Blue | `BUDGET` | Each round survived; each foothold revealed |

> Each side earns by doing the thing its win condition already rewards, so the
> economy does not pull against the game. Red is paid for patience, blue for
> time and for looking.

**ECON-3.** `proposed` Red's pool **MUST** remain spendable as a roll bonus, and
purchases **MUST** draw from the same pool.

> The tension is the point: reputation spent on a stronger card is reputation
> not available to make this roll land. One pool, two uses, and a real decision
> between them. It also preserves the one resource mechanic that already works.

**ECON-4.** `proposed` A side's currency **MUST NOT** be visible to the other
side.

> A running total of red's patience is a countdown to red's next purchase.
> See §5.

---

## 3. Claiming a market

The contest. A market is not a vending machine both sides queue at — it is
ground, and holding it locks the other side out.

**ECON-5.** `proposed` A market **MUST** be in exactly one of three states:
`open`, `held(red)`, or `held(blue)`.

**ECON-6.** `proposed` A side **MUST** reach a currency threshold to claim an
`open` market, and claiming **MUST** spend that threshold.

> So the first purchase is a race and not a formality. The side that gets there
> first is the side that invested first, and it pays for the privilege rather
> than merely arriving.

**ECON-7.** `proposed` While a market is `held`, only the holding side **MAY**
buy there.

**ECON-8.** `proposed` A `held` market **MUST** be takeable by force: an attack
resolved against its hardening flips it to `open`.

> Which is what stops the race being the whole game. It also gives `mark`
> (hardening 10) and `observatory` (11) a reason to carry a number at all — both
> have had one since the board was written and it has never been rolled against.

**ECON-9.** `proposed` A market flipped to `open` **MUST NOT** refund the
threshold that claimed it.

> Otherwise taking a market back is free money, and the correct play becomes
> trading it back and forth rather than using it.

**ECON-10.** `proposed` A claim, and a flip, **MUST** be announced to both
sides.

> A market is a place. Standing in it is public in the same way blue's walls are
> public — the fog covers what you *did with it*, not that you are there. This
> is the same line `PILLAR-1` draws around hardening.

---

## 4. The goods

**ECON-11.** `proposed` Each market **MUST** sell a different good to each side.
A market **MUST NOT** sell the same good to whoever holds it.

> Symmetric goods would make the two markets one mechanic in two squares, and
> both sides would want them for identical reasons. Different goods are what
> make a market worth taking *from* somebody rather than merely worth having.

| Market | Red buys | Blue buys |
| --- | --- | --- |
| **Vendor Market** | **Capability** — access to a higher deck tier | **Hardware** — standing protection effects |
| **The Observatory** | **Reconnaissance** — what blue has learned | **Indicators** — standing detection effects |

**ECON-12.** `proposed` Blue **MUST NOT** buy cards. Blue's purchases are
effects.

> Blue's deck is not the problem blue has, and a bought card is a card whose
> tier was skipped. Effects are the right shape for blue anyway: an indicator or
> a piece of hardware is a thing that *stands*, which is exactly `EFF-1`.

**ECON-13.** `proposed` Red's Vendor Market purchase **MUST** be an alternative
trigger for an existing deck tier, never a new card outside the tier system.

> So there is one supply curve with two throttles — advance the chain, or pay —
> rather than two systems both handing red cards. See `SUP-8`.

**ECON-14.** `proposed` Red's Observatory purchase is the seed of the
**Reconnaissance** stage and **MUST NOT** be implemented before `FOG-6`.

> Red cannot buy information while nothing is hidden from red. This is the same
> block as `DECK-15`, and it is the reason the Observatory is red's *only*
> currently-defensible recon: it is the one square whose whole role is knowing
> things.

---

## 5. Fog

**ECON-15.** `proposed` A purchase **MUST NOT** reveal what was bought.

> Both sides see the market change hands. Neither sees the goods leave it.

**ECON-16.** `proposed` A red purchase **MUST** raise detection in the Outlands.

> Buying is loud. This is what keeps the economy inside `PILLAR-1` rather than
> beside it: red's spending is a tell, so blue watching a square that is not on
> the chain becomes a real read rather than a hunch.

**ECON-17.** `proposed` A blue purchase **MUST NOT** raise detection.

> Detection measures red's noise. Blue buying a firewall is not red being loud,
> and a shared meter would make the number mean two things.

---

## 6. Boundaries

**ECON-18.** `proposed` The economy **MUST NOT** replace the upgrade track.
Upgrades remain unlocked by round, free, and identical for every seat.

> `upgrades.ts` rejects shops on purpose — *"the curve is the same for
> everybody and nobody has to read a shop"*. That objection is about character
> progression, and it stands. This system is a **board objective**: you do not
> read a menu, you go to a square, hold it, and pay. The free curve and the
> contested one answer different questions.

**ECON-19.** `proposed` No purchase **MAY** grant an effect that another card
cannot also grant.

> A shop that sells things the game does not otherwise contain is a second game
> bolted to the first. Purchases buy *access* and *quantity*, never novelty.

**ECON-20.** `proposed` `Klass.resource` **MUST** be removed. The currency is a
side fact, and four per-role labels for two pools is three lies.

**ECON-21.** `proposed` `SIGNAL` **MUST** be withdrawn rather than pooled. Blue
holds one currency, `BUDGET`.

> The third resource is the one `ECON-2` has no row for, and it should not get
> one. Two pools is already the maximum the fog can carry — `ECON-4` hides each
> side's total from the other, and a side that has to track two hidden totals
> against one opponent is doing bookkeeping, not reading a game. Whatever
> `SIGNAL` was going to mean, detection already measures it and heat already
> displays it.

---

## 7. Touchpoints and edges

| File | Change |
| --- | --- |
| `internal/rules.ts` | Market flags on `mark`/`observatory`; drop `Klass.resource`. |
| `internal/match.svelte.ts` | `pool: Record<Faction, number>`; earn hooks in `upkeep` and on reveal; `claim`/`buy` actions; `resourceMod` reads the pooled value. |
| `internal/deck.ts` | Tier entry accepts a purchase trigger as well as an advance level (`SUP-8`). |
| `internal/effects` *(pending)* | Indicators and hardware are effects (`EFF-1`). |
| `cards.yaml` | Economy cards state what they credit. |

| Case | Required behaviour |
| --- | --- |
| Both sides reach the threshold in one round | Initiative decides. The earlier seat claims; the later one is refused and keeps its currency. |
| A market is claimed and never used | Legal. Denial is a use. |
| Red claims the Observatory before `FOG-6` | Cannot happen — `ECON-14` blocks the good, so the market is unclaimable by red until then. |
| Currency exceeds what there is to buy | Cap the pool. An unspendable pile is a resource that has stopped being a decision. |
| 1v1 (`MATCH-4`) | One player, both chairs, one pool. Unchanged. |

---

## 8. Open questions

1. **Is one threshold right for both markets?** A cheaper Vendor Market and a
   dearer Observatory would say information costs more than capability, which
   may be the more interesting claim.
2. **Should a flip be permanent?** As written a market can change hands
   repeatedly. A market that can only be taken once — after which it closes to
   everyone — would make the race final and the Outlands quieter later.
3. **Does blue's `BUDGET` trickle break `PILLAR-2`?** Blue already wins by the
   clock. Paying blue *for* time may be paying the defender twice, and the earn
   rule may need to be reveals only.
