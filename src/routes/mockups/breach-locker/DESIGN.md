# THE LOCKER — BREACH customisation

**Routes:** `/showcase/mockups/breach-locker` (the locker) · `/showcase/mockups/breach-cards` (the deck)
**Opens from:** an icon in the board's right rail.

Modelled on the builder's **Theme Studio** (`src/lib/builder/themes/`) — slot rail left, live
preview centre, detail rail right, one full-bleed `<dialog>`. That layout already solved this
problem: choose from a set, see the choice immediately, commit it in one place.

---

## 1. A cosmetic is a LAYER on a BASE

This is the sentence the whole screen turns on, and the reason it is not a settings page.

A player owns two things worth dressing — **the figure they play** and **the cards they play it
with** — and both already exist in the game as data. So the locker picks a base first and adds to
it. Nothing here invents a character or a card.

| subject | base | drawn by |
|---|---|---|
| Operator | a `Klass` off `ROSTER` | `$lib/character/Figure.svelte` — the real faceted figure |
| Cards | an `Ability` out of `CATALOGUE` | `examples/breach/CardFace.svelte` — the real printed face |

**Nothing is forked to make this work.** Headwear is an SVG layer over `Figure`, anchored to the
`bust` rect that `art()` already publishes — same viewBox, same `preserveAspectRatio`, so a
coordinate in one is that coordinate in the other, at any size, on any character, at any camera
angle. Frames and finishes are layers over `CardFace` in its own 136×188 box.

That is a design constraint, not an implementation detail: **because no cosmetic is inside
`CardFace`, no cosmetic can move a number, hide a cost or change what a card does.** A new frame
ships without anybody re-reading the rules, and it works on every card in the game for free —
including the ones that do not exist yet.

## 2. The stage previews the whole table

The Theme Studio previews the one component you selected. The locker previews everything at once:
the figure, the seat plate, the 30px roster chip, the card face, the card turned over, the feed. A
hat you can only see while shopping for hats is a hat nobody buys — what sells it is the flag still
flying beside it and the hand behind that, all moving under the choice together.

Close the dialog and the board underneath has changed too. A customisation screen that previews
only inside itself is a screen you cannot tell is working.

## 3. The model that has to survive into the backend

Three sets, and the whole feature is the join between them:

| | what it is | who writes it |
|---|---|---|
| `lock` | the **price tag** on an item — what a stranger would pay, or the deed that earns it | the catalogue, forever |
| `entitlements` | what this account **has** | purchase, or a grant somebody else writes |
| `loadout` | what is **on** right now | the player, among what they have |

`lock` is *not* ownership. An item keeps its price tag after you own it — which is precisely what
makes "give the first hundred tables the crown" a **backfill into `entitlements`**, not a feature,
and what makes the ALPHA ribbon still mean something on an item that was never paid for.

A `lock` of kind `reward` carries **no number**, so it cannot be bought by anyone at any price.
That is the alpha tier, expressed in the type rather than in a policy somebody has to remember.

The header's **New / Alpha** switch is a demo control and the most load-bearing one on the page:
an owned-but-priced item only exists on a granted account, and there is no other way to look at one.

## 4. Slots

**Operator** — `headwear`, `banner`, `emblem`, plus the **side name**, the one cosmetic a player
types instead of picks.
**Cards** — `cardback`, `frame`, `finish`, `stamp`.

The card back is composed rather than picked whole: the pattern is the card-back item, the tint is
the banner and the mark in the middle is the emblem off the flag. A player's back is recognisably
theirs without a third thing to choose.

Emblems reuse the six the game already ships (`hud/team-flags.svelte.ts`) rather than being
redrawn — a second copy of a flag glyph is a flag that can disagree with itself at 14px in the
hero stack.

## 5. The deck page

`/showcase/mockups/breach-cards` — every card in the game, printed by the real component from the
generated catalogue, wearing the locker's layers at any size, face up or face down.

There was no such page before: the only way to look at a `CardFace` was to deal yourself one in a
match, which made the surface a player reads for a whole game the one surface nobody could review a
change to. It is also where a frame gets its real test — a treatment that looks fine on one card
has to look fine on forty, next to each other, at the size a hand is read at.

## 6. API this implies

```
GET  /api/breach/locker      → { balance_marks, callsign, entitlements[], loadout{} }
POST /api/breach/locker/equip     { slot, item_key }
POST /api/breach/locker/purchase  { item_key }
POST /api/breach/locker/callsign  { callsign }
```

Grants are deliberately **not** an endpoint here.

## 7. Files

| file | holds |
|---|---|
| `catalog.ts` | subjects, slots, rarities, every item, the art, the locks |
| `locker.svelte.ts` | `LockerState` — base, entitlements, loadout, buy/equip, the two personas |
| `Mannequin.svelte` | the real `Figure` + the anchored headwear layer |
| `CardSkin.svelte` | the real `CardFace` + frame / finish / stamp / back |
| `ItemGrid.svelte` | the tiles, each drawing its item on the real base |
| `Locker.svelte` | the studio shell |
| `+page.svelte` | the board behind it and the icon that opens it |
