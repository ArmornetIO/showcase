<!-- markdownlint-disable MD013 -->

# Pillars and tiebreakers

What BREACH is, and how to settle an argument about it.

## Why these are two different lists

The old document had one list of seven "design principles", which mixed two
kinds of statement that behave very differently in an argument:

- Statements about **what the game is**. Break one and you are making a
  different game. There are very few of these, and they are expensive to change.
- Statements about **how to choose between two correct options**. Break one and
  you have made a worse version of the same game. There are many of these, and
  they are cheap to change.

Keeping them in one list means every disagreement is escalated to an identity
crisis, or — more often — a genuine identity question gets settled as if it were
a style preference. Separating them is the first practice this specification
adopts, and the reason the configuration documents can be blunt about what a
setting is allowed to do.

**Three pillars. Everything else is a tiebreaker.**

---

## The pillars

**PILLAR-1. Asymmetric information is the game.**

Blue commits without knowing the approach; red chooses after reading the wall.
Every mechanic either creates that gap, exploits it, or pays to close it.

> This is the load-bearing one. A change that lets blue see what red is doing —
> a face-up discard, a "helpful" log row, a hardening number red can read after
> blue paid to raise it — does not make the game easier or harder. It makes it a
> different game, one where both players are solving the same problem.

**PILLAR-2. Blue wins by the clock. Red wins by the ground.**

The two win conditions are not mirror images and **MUST NOT** be balanced as if
they were. Red must take all five chain structures; blue must merely still be
standing at the horizon.

> The practical consequence is that almost nothing in this game is symmetric,
> including the effect of a symmetric change. Halving both sides' action points
> does not halve both sides' chances — it shortens the attacker's runway and
> leaves the defender's timer untouched. Any change to the economy, the horizon
> or the turn clock is a change to blue's win rate until measured otherwise.

**PILLAR-3. The categories are the curriculum.**

Red's cards are grouped by the Cyber Kill Chain and blue's by the NIST CSF
functions, because the claim the game makes is that playing it teaches where a
real compromise happens.

> A category invented for game-design convenience breaks that claim. A real
> category left empty is a content gap worth admitting rather than papering
> over — which is why red's Reconnaissance stage is documented as empty instead
> of being filled with flavour and a die roll.

---

## Tiebreakers

Where two designs are both defensible, resolve toward these, in this order.

**TIE-1. A control that does not reach a rule is worse than no control.**

If a setting, a card, a status or a printed passive does not change what the
engine evaluates, it is a lie told in the game's own voice. Cut it or wire it.

> Worse than no control, not merely equal to it: a dead control teaches the
> player that the controls do not matter, which devalues the live ones beside it.

**TIE-2. A control that reaches a rule it has no business reaching is the same
defect, inverted.**

A cosmetic option that changes a number, a difficulty setting that quietly
changes the board, a "presentation" flag read during resolution. Both halves of
this pair are failures of the same property: a control's reach must match what
it claims to be.

> This half is new, and it outlived the parameter classes it was written for: a
> control's reach is a promise, and a promise you can only break in one
> direction is not a promise.

**TIE-3. Secrets are earned, never granted.**

Any rule that hands a side information it did not pay for is a defect, however
convenient for the interface.

**TIE-4. Commitment before information.**

Where a decision could be taken before or after the other side reveals, prefer
before. This is `PILLAR-1` expressed as a scheduling rule.

**TIE-5. No dominant opening.**

A first move that is correct in most matches is a scripted move, and a scripted
move is not a decision. This applies to the configuration screen too: a default
nobody sensibly changes is a constant wearing a slider.

**TIE-6. Randomness sets the problem; it never resolves it.**

A deal may decide what you are working with. It may not decide who won.

**TIE-7. Keyboard first.**

A game that cannot be played without a pointer is not finished. This includes
the setup screen.

**TIE-8. One decision per rule.**

Where two designs are equally correct, the one that gives a player a choice they
can be wrong about wins.

---

## Using these

Every requirement in this specification should be traceable to a pillar or a
tiebreaker. Where it is not obvious, the requirement's rationale says which.

The configuration documents lean on `TIE-1` and `TIE-2` more than anything else,
because a settings screen is where dead and leaky controls accumulate: it is the
one surface where adding an option is nearly free and removing one feels like a
regression.
