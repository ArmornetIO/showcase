# BREACH — TURN HUD REDESIGN

**Targets:** `PlayTicker.svelte` → **THE BREECH** · `SeatClock.svelte` → **THE MAST** · `MyStats.svelte` → **THE LOADOUT**

**Status:** design spec. No code. Every value cited resolves to a field on `BreachMatch`
(`examples/breach/internal/match.svelte.ts`) or a constant in `rules.ts` / `upgrades.ts` / `fx.ts`.

---

## 1. The idea

**One instrument with three heads, driven by a single state colour.** Today the three surfaces are three
separate opinions about what colour "now" is: the ticker lights in the armed card's kind-hue, the clock
lights in the acting seat's hue with its own two-stop warning ramp, and MyStats lights in *your* seat hue
with a *third* copy of the same ramp. A player mid-turn is doing colour arithmetic across 900px of screen.
The redesign publishes **one** `--hud-state` colour from **one** priority ladder, and all three surfaces —
rim, numerals, meters, commit key — take it simultaneously. When it goes amber, the whole HUD goes amber at
once, and that synchronised flip is the entire tactical-shooter treatment: Valorant and CS do not tell you
you are in trouble in one widget, they tell you in the chrome. On top of that one colour we put one geometry
(a 10px chamfer, cut top-left and bottom-right, on every plate), one type voice (mono, black, tabular, caps
at `--track-caps`), and one reading order that runs **right rail top-to-bottom** — *how long* (MAST) → *what
I have* (LOADOUT) — then jumps to the **floor** — *what I am about to do* (BREECH). The clock and the seat
panel stop being two Panels and become two sections of one plate with a shared spine, because they answer
the same question — "what can I still do this turn" — and a border between them is a border between two
halves of one sentence.

---

## 2. Wireframes

### 2.0 Placement, whole screen @ 1600 × 900 (1 char ≈ 10px)

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                          ┌────────────── ConnectionBanner / Refusal / ObjectiveLine ───────────────┐                            │
│  ┌───────────────────────┐               └───────────────────────────────────────────────────────────────────────┘        ┌─────────────────┐  │
│  │  HeroStack            │                                                                                                │  BuildingStack  │  │
│  │  (unchanged)          │                                        ~ the globe ~                                           │  (unchanged)    │  │
│  ├───────────────────────┤                                     nothing lands here                        ┌──────────────┐ │                 │  │
│  │  LogFeed              │                                                                               │ GameEvents   │ │                 │  │
│  │  (unchanged)          │                                                                               │ VerdictCard  │ ├─────────────────┤  │
│  │                       │                                                                               └──────────────┘ │▓ THE MAST      ▓│  │← fused, one plate
│  │                       │                                                                                                │▓ THE LOADOUT   ▓│  │  340px wide
│  └───────────────────────┘                                                                                                └─────────────────┘  │
│                                          ░░░░░░░░░░░░░░░░░  the felt gradient + card fan  ░░░░░░░░░░░░░░░░░                                     │
│                     ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ THE BREECH — 1024 × 76 ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓                          │
└────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

The breech widens from `min(94vw,52rem)` (832px) to `min(94vw,64rem)` (1024px) and grows from 52px to 76px.
It is still nowhere near the centre of the board.

---

### 2.1 THE BREECH — 1024 × 76 (1 char ≈ 8px, 128 cols)

Three zones on a **fixed grid**: `168px | minmax(0,1fr) | 208px`. The outer two never change width, so
nothing the centre says can move the commit key or the AP bank. Row heights inside the centre are fixed at
`30px / 22px` and both rows are always rendered, empty or not.

#### STATE A — your turn, card armed, legal target *(the happy path)*

```
 ╱▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔ 3px state stripe · card kind hue ▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔╲
│ AP                    │                                                                    │                          │
│  ▌2▐ ◆◆◇  −1          │ ⚡ RELEASE DIVERGENCE [STRIKE]  ▸  THE FORGE            ⌁ 62% ANY   │   ┌──────────────────┐   │
│  ────────────────     │ 2d6 +2 OPS +1 CARD +3 HOLD  vs 9  ▏needs 5▕                        │   │  ⏎  C O M M I T  │   │
│  spend 1 · 1 left     │ ███████ BOTCH ▏█████████ FAIL ▏████████████ PARTIAL ▏█████ CLEAN    │   └──────────────────┘   │
│                       │                                                                    │      · end turn ·        │
 ╲▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁╱
   └── 168px ────────┘   └────────────────────── flexes, contents never move the sides ──────┘  └──── 208px ─────────┘
```

#### STATE B — your turn, nothing armed

```
 ╱▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔ state stripe · seat colour ▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔╲
│ AP                    │                                                                    │                          │
│  ▌3▐ ◆◆◆              │ ⬢ YOUR TURN                                                        │   ┌──────────────────┐   │
│  ────────────────     │ pick a card · drop it on the world                                 │   │   ·  a r m  ·    │   │  ← hollow, disabled
│  3 to spend           │                                                                    │   └──────────────────┘   │
│                       │ ░░░░░░░░░░░░░░░░ outcome band absent — row reserved ░░░░░░░░░░░░░░  │      · end turn ·        │
 ╲▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁╱
```

#### STATE C — illegal (`blockReason.kind === 'hard'`)

```
 ╱▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔ state stripe · ILLEGAL rose · 2 flashes then hold ▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔╲
│ AP                    │                                                                    │                          │
│  ▌2▐ ◆◆◇  −1          │ ⚡ RELEASE DIVERGENCE [STRIKE]  ▸  THE KEEP                         │   ┌──────────────────┐   │
│  ────────────────     │ ⚠ take the whole chain first — the payload needs every link         │   │ ╱╱ B L O C K ╱╱  │   │  ← struck through
│  spend 1 · 1 left     │                                                                    │   └──────────────────┘   │
│                       │                                                                    │      · end turn ·        │
 ╲▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁╱
```

`kind === 'sealed'` is the same shape in violet, the commit key stays **live** (you are allowed to run at a
wall — the sealed rule), and the key reads `COMMIT ⛨ SEALED`.

#### STATE D — resolving (`busy`), dice in the air then settled

```
 ╱▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔ state stripe · SLATE, desaturated, no glow ▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔╲
│ AP                    │                                                                    │                          │
│  ▌2▐ ◆◆◇   (dim)      │ ⚡ RELEASE DIVERGENCE  ▸  THE FORGE          ▰▰▰ ROLLING ▰▰▰        │   ┌──────────────────┐   │
│  ────────────────     │ ── the outcome band freezes at its last widths, drained to 30% ──  │   │  ▰▰▰▰▰▰▰▰▰▰▰▰▰▰  │   │  ← indeterminate
│  locked               │                                                                    │   └──────────────────┘   │
│                       │  …then:  4 + 6 → 10   [ C L E A N ]  +3                            │      (end turn hidden)   │
 ╲▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁╱
```

#### STATE E — not your turn

```
 ╱▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔ state stripe · acting seat colour, mixed 45% into --fg-dim, 0.5 opacity ▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔╲
│ AP                    │                                                                    │                          │
│  ▌3▐ ◇◇◇  (hollow)    │ ◈ ARCHITECT  ·  priya  is acting                                   │   ┌──────────────────┐   │
│  ────────────────     │ you act after the HUNTER                                           │   │ ⏱  W A I T I N G │   │  ← plate, not a button
│  banked for you       │                                                                    │   └──────────────────┘   │
│                       │                                                                    │                          │
 ╲▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁╱
```

#### STATE F — the takeover, t = 60–900ms *(see §4)*

```
 ╱▔▔▔▔▔▔▔▔▔ stripe races centre→ends, 140ms ▔▔▔▔▔▔▔▔▔┃▔▔▔▔▔▔▔▔▔ stripe races centre→ends, 140ms ▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔╲
│ AP                    │  ┌ ┐                                                        ┌ ┐    │                          │
│  ▌3▐ ◆◆◆  ← struck in │      Y O U R   T U R N            R5 · 30s          │   ┌──────────────────┐   │
│  ────────────────     │                                                                    │   │   ·  a r m  ·    │   │
│  3 to spend           │  └ ┘   ← HudCorners, seat colour, 6px inset          └ ┘    │   └──────────────────┘   │
│                       │                                                                    │      · end turn ·        │
 ╲▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁╱
    ↑ side zones do not move — the plate lives entirely inside the centre grid cell
```

#### STATE G — match over

```
 ╱▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔ WIN emerald (or LOSS red) · full-height wash 12% ▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔╲
│                       │                                                                    │                          │
│   ⬢ R E D             │        T H E   P A Y L O A D   L A N D E D                         │      (zone empty —       │
│   ────────────────    │        round 8 of 12 · the Maintainer held all five                │       the lobby owns     │
│   T A K E S   I T     │                                                                    │       what happens next) │
│                       │                                                                    │                          │
 ╲▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁╱
```

---

### 2.2 THE MAST + THE LOADOUT — one plate, 340 × ~300 (1 char ≈ 5px, 68 cols)

```
 ╱▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔╲   ← chamfer TL
│ CLOCK                                          ARCHITECT UP    │      header, Panel shape="chamfer"
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  ROUND                                          T U R N        │   ── THE MAST ──
│  ▛▀▜                                            ▛▀▜            │
│  ▌5▐ / 12                                       ▌27▐ s         │   28px black tabular, both
│  ▙▄▟                                            ▙▄▟            │
│  ■ ■ ■ ■ ▣ □ □ □ □ □ □ □                       ████████░░░░   │   12 round ticks · drain bar
│                                                                │
│  ORDER   ▸ R1 ── B1 ── R2 ── B2                                │   turn order, acting one lit
│               ▲you        ^^ acting                            │
├════════════════════════════════════════════════════════════════┤   ← the SPINE: 2px, --hud-state
│                                                                │
│  ╱▔▔╲   THE MAINTAINER  ⚡                          R1          │   ── THE LOADOUT ──
│  ▏ ⬢ ▕  red side                                              │   hex crest, 44px
│  ╲▁▁╱                                                          │
│                                                                │
│  EXPOSURE                                                  72  │   the life bar
│  ██████████████████████████████████████░░░░░░░░░░░░░░░░        │   full width, 8px, chamfered ends
│                                                                │
│  REP  ◆◆◇  4                     ⓘ only 3 ever rides a roll    │
│                                                                │
│  ─────────────────────────────────────────────────────────     │
│  TRACK   ┌───────┐   ┌───────┐   ┌───────┐                     │   ── the ult-charge rail ──
│          │▓▓▓▓▓▓▓│   │▓▓▓▓░░░│   │░░░░░░░│                     │
│          │  ⚡+1 │   │  🔒R7 │   │  🔒R10│                     │
│          └───────┘   └───────┘   └───────┘                     │
│           ONLINE      2 AWAY      5 AWAY                        │
│                                                                │
│  ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓  │   ── the ult key ──
│  ┃ ◈  OBFUSCATED TEST FIXTURE            2 AP    ◆   1 USE  ┃  │   full width, 34px
│  ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛  │
│                                                                │
 ╲▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁╱   ← chamfer BR
```

#### MAST, low time (`turnLeft / turnMs ≤ 0.17`), your turn

```
│  ROUND                                          T U R N        │
│  ▌5▐ / 12                                       ▌ 4▐ s   ◀ ▶   │   numeral in CRITICAL red,
│  ■ ■ ■ ■ ▣ □ □ □ □ □ □ □                       ██░░░░░░░░░░   │   scale 1→1.06→1, 2 Hz
```

#### LOADOUT, ult spent

```
│  ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓  │
│  ┃ ◈  OBFUSCATED TEST FIXTURE            ╱╱╱ S P E N T ╱╱╱  ┃  │   8% opacity fill, no border glow
│  ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛  │
```

#### LOADOUT, not your turn — everything holds shape, drops to 55% and loses its glow

```
│  EXPOSURE                                                  72  │   value stays legible (this is
│  ██████████████████████████████████████░░░░░░░░░░░░░░░░        │   the number blue is hunting)
│  ┏━ ult key, 40% opacity, not focusable ━━━━━━━━━━━━━━━━━━━━┓  │
```

---

## 3. Per-surface breakdown

### 3.1 THE BREECH

| # | Element | Engine field / expression | Type | Colour rule |
|---|---|---|---|---|
| B1 | State stripe (3px, full width, top edge) | `--hud-state` (§5) | — | `--hud-state`; `opacity` 1 when `isMyTurn`, 0.5 otherwise |
| B2 | `AP` over-label | literal | mono 9px / 700 / `--track-caps` / upper | `--fg-dim` |
| B3 | AP numeral | `match.ap[match.seat.key] ?? 0` | mono 26px / 900 / `tabular-nums` / tracking −0.02em | `--hud-state`; `OUTCOME_COLOR.botch` when 0 |
| B4 | AP pips | `Pips total={match.maxAp()} filled={ap}` shape `diamond` size 9 | — | `color={match.seat.color}`; `hollow` when `!isMyTurn` |
| B5 | Cost overlay on pips | `match.armed.ap` — the rightmost `armed.ap` **filled** pips take the card hue and a 1px inner ring | — | `KIND_COLOR[armed.kind]`; whole pip row → `OUTCOME_COLOR.botch` + 2-flash when `!match.canPay` |
| B6 | Cost caption | `armed ? \`spend ${armed.ap} · ${ap - armed.ap} left\` : \`${ap} to spend\`` | mono 9px / 600 / upper | `--fg-dim`; `--hud-state` when armed |
| B7 | Card glyph | `fxFor(card.key, seat.faction).icon` (`card = match.armed ?? match.inspected`) | 15px `Icon` | `fx.hue` |
| B8 | Card name | `card.name` | mono 15px / 900 / tracking 0.01em / upper | `--fg` |
| B9 | Kind chip | `card.kind` | mono 9px / 800 / 0.16em / upper, 2px pad, chamfered | fg `KIND_COLOR[card.kind]`, bg `color-mix(… 16%, transparent)` |
| B10 | Arrow | literal `▸` | mono 13px | `--fg-dim` |
| B11 | Target name | `match.target.name` | mono 15px / 700 / upper | `--fg` |
| B12 | Headline odds | `Math.round(match.odds.chance * 100) + '%'` + caption `ANY` | mono 17px / 900 / tabular + 9px caption | `OUTCOME_COLOR.partial`; the whole readout dims to 40% while `match.diceSpin` |
| B13 | The ledger | `2d6`, `odds.skill` + `SKILL_LABEL[armed.skill].slice(0,3)`, `odds.abilityMod` `CARD`, `odds.resourceMod` `seat.resource`, `odds.holdMod` `HOLD`, `vs odds.target`, `needs odds.needed` | mono 10px / 600 / tabular, labels 8px upper | signs in `--fg`; `skill` in `seat.color`; `holdMod` in `#F472B6`; `needs N` boxed in `--border` |
| B14 | **Outcome band** (the new graphic) | 4 segments, widths = `chanceBotch`, `1 − chance − chanceBotch`, `chance − chanceClean`, `chanceClean` | 10px tall, 1px gaps, labels 8px / 800 / upper inside segments ≥ 12% | `OUTCOME_COLOR.botch` / `.fail` / `.partial` / `.clean`, each at 85% into `--bg-elev` |
| B15 | Block reason | `match.blockReason.text`, prefixed `⚠` (`alert-triangle`) | mono 11px / 700 | `#FB7185` for `hard`, `#A78BFA` for `sealed` |
| B16 | Roll readout | `match.lastRoll.dice[0] + ' + ' + [1] + ' → ' + total`, band `OUTCOME_LABEL[outcome]`, `margin` signed | dice mono 12px tabular; band 10px / 900 / 0.14em / upper on a chamfered fill | band bg `OUTCOME_COLOR[outcome]`, fg `--bg-elev` |
| B17 | Rolling indicator | `match.diceSpin` | mono 10px / 0.2em / upper | `--palette-slate`, 3-cell marquee, 380ms loop |
| B18 | **COMMIT key** | enabled ⇔ `match.ready`; `onclick = match.resolve()`; label `COMMIT` / `ARM` (nothing armed) / `BLOCK` (hard) / `WAITING` (`!isMyTurn`) / spinner (`busy \|\| pending`) | mono 14px / 900 / 0.28em / upper, 40px tall, chamfered TL+BR | ready → solid `--hud-state`, text `--bg-elev`, 0 0 20px glow; blocked → transparent fill, 1px `#FB7185`, diagonal hatch; disabled → 1px `--border`, `--fg-dim` |
| B19 | End turn | `Button size="xs" variant="ghost"`, `match.endTurn()`, shown when `isMyTurn && !busy && !pending && !winner` | mono 10px / upper | `--fg-dim`, hover `--hud-state` |
| B20 | Waiting plate | `match.activeKlass.icon` + `.seat` + `match.players[activeKlass.key]?.name` | mono 12px / 800 / upper | `activeKlass.color` at 60% |
| B21 | "you act after…" | `match.seatOrder`, `match.phase`, `match.seat.key` → the seat immediately before yours in the cycle | mono 10px / 600 / upper | `--fg-dim`, the named seat in its own `klassByKey().color` |
| B22 | No-legal-site warning | shown **only** when `match.inspected && match.inspectedSites === 0` | mono 10px / 800 / 0.14em / upper | `#FB7185` |
| B23 | Win/loss headline | `match.winner`, `match.round`, `match.chainHeld.length` | mono 20px / 900 / 0.3em / upper | WIN `#34D399` / LOSS `OUTCOME_COLOR.botch` |

**Empty-row rule.** Rows 1 and 2 of the centre zone are always laid out at 30px and 22px even when their
contents are `null`. This is the one hard invariant on this surface — it is why the strip can never push the
hand down mid-turn.

### 3.2 THE MAST

| # | Element | Engine field | Type | Colour rule |
|---|---|---|---|---|
| M1 | Header tag | `match.isMyTurn ? 'YOUR TURN' : match.activeKlass.name + ' UP'` | mono 9px / 800 / 0.18em / upper | `--hud-state` |
| M2 | `ROUND` label | literal | mono 9px / 700 / `--track-caps` / upper | `--fg-dim` |
| M3 | Round numeral | `match.round` | mono 28px (`--t-display`) / 900 / tabular | `--fg` |
| M4 | `/ 12` | `match.rounds` | mono 12px / 600 / tabular | `--fg-dim` |
| M5 | Round ticks | 12 ticks, `i < match.round` filled, `i === match.round − 1` full opacity | `Pips shape="bar"` total=`match.rounds` filled=`match.round` size 5 | filled `match.activeKlass.color`, current at 1.0, earlier at 0.45, unfilled `--surface-strong` |
| M6 | `TURN` label | literal | mono 9px / 700 / `--track-caps` / upper | `--fg-dim` |
| M7 | Seconds numeral | `Math.ceil(match.turnLeft / 1000)`; `—` when `match.stage !== 'play' \|\| match.winner` | mono 28px / 900 / tabular | `--hud-state`; 45% opacity when `match.busy` |
| M8 | **Drain bar** (replaces the ring) | `match.turnLeft / match.turnMs` | 8px tall, chamfered ends, `transition: width 200ms linear` | fill `--hud-state`; track `--surface-strong`; 40% opacity when `match.busy`, and the label under it reads `RESOLVING` |
| M9 | `ORDER` rail | `match.seatOrder.map(klassByKey)`, `match.phase`, `match.seat.key` | each seat as its `seat` code (`R1`,`B1`,…) mono 10px / 900 | acting seat: solid fill in its `color`, text `--bg-elev`; your seat: 1px ring in `seat.color` + `▲you` caret; others: `--fg-dim` |

### 3.3 THE LOADOUT

| # | Element | Engine field | Type | Colour rule |
|---|---|---|---|---|
| L1 | Crest | `match.seat.icon`, hexagon clip, 44px | 20px `Icon` | `seat.color`; blur halo `opacity` 0.55 when `isMyTurn` else 0.22 |
| L2 | Seat name | `match.seat.name` | mono 13px / 900 / upper | `seat.color` |
| L3 | Passive sigil | `zap` icon, `Tooltip` = `match.seat.passive.name` + `.text` | 9px glyph in a 15px ring | `seat.color` |
| L4 | Faction line | `` `${match.seat.faction} side` `` + `match.seat.seat` | mono 9px / 600 / 0.1em / upper | `--fg-dim`; the seat code in `seat.color` |
| L5 | Standing label | `match.standingLabel` (`exposure` / `estate`) | mono 10px / 800 / `--track-caps` / upper | matches the bar |
| L6 | Standing value | `match.standing` | mono 20px / 900 / tabular | ramp below |
| L7 | **Standing bar** | `ProgressBar value={match.standing} max={100}`, 8px, chamfered ends | — | `> 60` `#34D399` · `> 30` `#FBBF24` · else `#FB7185`. Below 30 the bar gains a 1.4s 0.6↔1.0 opacity pulse — this is the only meter that gets a heartbeat, because it is the only one that ends the match |
| L8 | Resource | `match.seat.resource` label, `match.res[seat.key] ?? 0` value | label mono 10px upper, value mono 14px / 900 tabular | `seat.color`; `--fg-dim` at 0 |
| L9 | Resource pips | `Pips total={3} filled={Math.min(match.res[seat.key] ?? 0, 3)}` shape `diamond` | — | `seat.color` |
| L10 | Resource note | literal, `Tooltip` only | 9px | `--fg-dim` |
| L11 | **Track slots** (ult-charge) | `match.track()` → per `upgrade`: `open = match.round >= upgrade.at`, `pct = Math.min(1, match.round / upgrade.at)`, `away = Math.max(0, upgrade.at − match.round)` | 60×46 chamfered cell; glyph 14px; badge mono 9px / 900 tabular | open → `UPGRADE_KIND[kind].hue` fill at 18%, 1px border at 55%, glyph full, badge `+value`; locked → `--surface-strong` fill, `--border` border, `lock` glyph at `color-mix(--fg 30%)`, badge `R{at}`, **vertical** fill from the bottom at `pct` in `#FBBF24` at 22% |
| L12 | Slot caption | `open ? 'ONLINE' : \`${away} AWAY\`` | mono 8px / 800 / 0.1em / upper | open `UPGRADE_KIND[kind].hue`, locked `--fg-dim` |
| L13 | **Ult key** | `match.power`; enabled ⇔ `!!power && match.powerCharges > 0 && match.isMyTurn && !match.busy && !match.pending && !match.winner && (match.ap[seat.key] ?? 0) >= power.ap`; `onclick` sets `armedKey` + `inspectKey` | name mono 11px / 900 / upper; cost mono 11px / 900 tabular; charges mono 8px upper | armable → `fxFor(power.key, seat.faction).hue` fill 16%, 2px border 80%, `0 0 18px` glow; armed (`match.armedKey === power.key`) → fill 28%, border 100%, glow 26px; unaffordable → fill 8%, border 30%, no glow; spent (`match.powerCharges === 0`) → 6% fill, `color-mix(--fg 22%)` text, diagonal hatch, `SPENT` |
| L14 | Charge pips | `Pips total={match.power.uses} filled={match.powerCharges}` shape `diamond` size 7 | — | `fx.hue`, hollow when 0 |

---

## 4. The "YOUR TURN" moment

Fires on the **rising edge** of `match.isMyTurn` — track it with a plain (non-`$state`) `let seen` compared
inside an `$effect`, the same shape `ObjectiveLine` already uses for its link announcement, so the effect
cannot subscribe to its own output. Suppressed entirely when `match.busy`, `match.winner`, or
`match.stage !== 'play'`.

| t (ms) | What | Property | Easing |
|---|---|---|---|
| 0 | Edge vignette appears — an `inset 0 0 120px 0` box-shadow in `match.seat.color`, on a full-viewport `pointer-events-none` layer at **`z-[2]`** (above the globe, *below* every HUD panel) | `opacity 0 → 0.35` over 90ms | `linear` |
| 0 → 140 | Breech state stripe races from centre to both ends | `transform: scaleX(0 → 1)`, `transform-origin: center` | `cubic-bezier(.16,1,.3,1)` |
| 0 → 200 | Breech rim glow blooms | pre-composited glow layer `opacity 0 → 1 → 0.4` | `ease-out` |
| 60 → 320 | Takeover plate enters **inside the centre grid cell only** — `YOUR TURN` at 22px / 900 / 0.32em upper in `seat.color`, plus `R{match.round} · {Math.ceil(match.turnLeft/1000)}s`, wrapped in `HudCorners color={seat.color} size={9}` | `opacity 0 → 1`, `translateY(8px → 0)`, `letter-spacing 0.5em → 0.32em` | `cubic-bezier(.16,1,.3,1)` |
| 180 → 300 | **AP pips strike in**, one every 40ms from the left, `maxAp()` of them | each: `scale(1.6 → 1)` + `opacity 0 → 1` over 120ms | `cubic-bezier(.34,1.56,.64,1)` |
| 260 | Mast drain bar snaps to 100% width with **no** transition (a 30s countdown that eases up from 0 reads as loading), then resumes its `200ms linear` tick | `transition: none` for one frame | — |
| 320 → 360 | Mast seconds numeral one-shot: `scale(1 → 1.12 → 1)` | `transform` | `ease-out` |
| 900 → 1080 | Takeover plate cross-fades out into the idle sentence; the sentence enters at `opacity 0 → 1` over the same 180ms | `opacity` | `linear` |
| 1080 → 1320 | Vignette settles to its resting value | `opacity 0.35 → 0.18` | `ease-out` |
| turn ends | Vignette out | `opacity → 0` over 240ms | `ease-in` |

**Total: 1080ms of ceremony, 240ms of exit.** Under the ~1.2s at which a player starts hunting for the
information themselves.

**Constraints.**
- The plate is `aria-hidden="true"`. The centre zone's `aria-live="polite"` already announces the sentence;
  two live regions saying the same thing double-speaks it.
- Nothing in this sequence changes any element's **layout size**. The vignette is a box-shadow on a
  positioned layer, the plate lives inside an existing fixed grid cell, the pips are already in the DOM at
  `opacity: 0`. No reflow, no jank on the globe's rAF.
- `@media (prefers-reduced-motion: reduce)`: vignette appears at its resting 0.18 with no fade, the stripe
  is present at full width immediately, the plate is a plain 0→1 opacity over 120ms with no transform or
  tracking animation, the pip stagger collapses to a single 0→1, and the numeral pop is dropped.
- **Low-time takeover.** When `turnLeft / turnMs` crosses 0.17 downward *during your turn*: the vignette
  re-tints to `OUTCOME_COLOR.botch` over 200ms and starts a 2 Hz `opacity 0.18 ↔ 0.30` pulse; the mast
  numeral takes a 2 Hz `scale(1 ↔ 1.06)`. Nothing else moves. This is the CS bomb-timer read and it must
  never fire on somebody else's clock.

---

## 5. Colour + state system

One derived value, `hudState`, published once as a CSS custom property `--hud-state` on the wrapper that
already publishes `--play-h`. First match wins.

| # | State | Condition | Value | Where it shows |
|---|---|---|---|---|
| 1 | **WIN** | `match.winner === match.seat.faction` | `#34D399` (`--palette-emerald`) | stripe, breech wash 12%, spine |
| 2 | **LOSS** | `match.winner && match.winner !== match.seat.faction` | `#EF4444` (`OUTCOME_COLOR.botch`) | same |
| 3 | **ILLEGAL** | `match.blockReason?.kind === 'hard'` | `#FB7185` (`--palette-rose`) | stripe (2 flashes @ 160ms then hold), commit key hatch, reason text |
| 4 | **SEALED** | `match.blockReason?.kind === 'sealed'` | `#A78BFA` (`--palette-purple`) | stripe, reason text, `SEALED` chip on a **live** commit key |
| 5 | **RESOLVING** | `match.busy \|\| match.pending` | `#94A3B8` (`--palette-slate`) | stripe desaturated, no glow; mast drain + loadout to 45% |
| 6 | **CRITICAL** | `match.isMyTurn && match.turnLeft / match.turnMs <= 0.17` | `#EF4444` | stripe pulse 2 Hz, mast numeral, vignette re-tint |
| 7 | **LOW** | `match.isMyTurn && match.turnLeft / match.turnMs <= 0.40` | `#FBBF24` (`--palette-gold-l`) | stripe, mast numeral + drain bar |
| 8 | **ARMED** | `match.isMyTurn && match.armed` | `KIND_COLOR[match.armed.kind]` — `strike #FB7185` · `implant #F472B6` · `recon #38BDF8` · `control #A78BFA` · `econ #FBBF24` · `utility #34D399` | stripe, commit key fill, AP cost pips, card chip |
| 9 | **YOURS** | `match.isMyTurn` | `match.seat.color` | stripe, mast, spine, crest halo, vignette |
| 10 | **IDLE** | otherwise | `color-mix(in srgb, ${match.activeKlass.color} 45%, var(--fg-dim))` | stripe at 0.5 opacity, mast, waiting plate |

**Rules that are not in the ladder.**
- The **outcome band** and the roll readout always use `OUTCOME_COLOR` and never `--hud-state`. A clean roll
  is green whoever you are; overriding it with a state colour would make the same result read differently in
  two turns.
- The **standing bar** always uses its own three-stop ramp (`#34D399` / `#FBBF24` / `#FB7185`). It measures a
  different clock from the turn timer and must not go amber in sympathy with it.
- **Seat hues are data, not tokens** — `match.seat.color` (`#F472B6` Maintainer, `#FB923C` Handler,
  `#38BDF8` Architect, and the Hunter's) comes out of `rules.gen.ts`. Never hard-code one.
- Every text colour on a filled `--hud-state` surface is `var(--bg-elev, #0b0f16)`, not `--fg`.

---

## 6. What I cut, and why

1. **The 62×62 radial turn ring.** It spent 62px of the densest column in the game saying "less than
   before", then needed a numeral drawn on top of it because a ring cannot say `27s`. A horizontal drain bar
   says the same thing in 8px, reads faster at the corner of the eye, and — the real reason — shares its
   geometry with the round ticks, the standing bar and the outcome band, so the whole HUD is made of one
   shape instead of circles-and-rectangles.
2. **The duplicate turn clock in MyStats.** The same `turnLeft` was drawn twice, ~120px apart, with two
   independently-computed copies of the same amber/red ramp. One of them was going to drift. The mast is
   directly above; there is no saccade to save.
3. **The AP dial in MyStats.** AP is not a standing fact, it is a *price*, and a price belongs at the till.
   It moves to the breech's left zone where it sits 20px from the cost of the card you are pointing at, so
   "can I afford this" becomes a comparison instead of a memory test.
4. **`round {match.round} of 12` in the MyStats identity line.** The mast owns the round, in 28px, one panel
   section above.
5. **The `any` / `clean` / `botch` percentage triplet.** Three numerals to describe one distribution. The
   outcome band *is* the distribution, drawn to scale, and it answers the question nobody could answer
   before — "how much worse than clean is the likely outcome" — without arithmetic. One headline `%` survives
   because a number you can say out loud to a teammate is worth keeping.
6. **`drag onto the world to play →`.** A permanent instruction is chrome; the eye files it once and never
   returns. The board already lights every legal site the moment a card is armed, and there is now a COMMIT
   key that says what to press. The hint is redundant twice over.
7. **The card's `text` blurb in row two.** The card face in the hand carries it, and the breech is a firing
   solution, not a rulebook — the row it occupied is worth more as the outcome band. It survives as the
   commit key's `Tooltip`.
8. **`N sites lit`.** The board is the count. Only the zero case survives (B22), because
   `inspectedSites === 0` is the one reading that changes what you do next.
9. **The skills row.** Already gone from MyStats and it stays gone — the ledger (B13) prints the finished
   sum with the skill named in it, which is the only place the number is actionable.
10. **The separate `Panel` frame between the clock and the seat.** Two headers, two borders, two 10px
    gutters, ~34px of vertical space to say "these are different things" — when they are two halves of "what
    can I still do this turn". One plate, one header, a 2px spine.

---

## 7. Implementation notes

### Component split

```
mockups/breach-hud/
  Breech.svelte          the bottom strip — replaces PlayTicker for the mockup
    BreechAp.svelte      left zone (fixed 168px)
    BreechSolution.svelte  centre zone (2 fixed rows)
    OutcomeBand.svelte   the 4-segment distribution — the one genuinely new graphic
    BreechCommit.svelte  right zone (fixed 208px)
    TurnTakeover.svelte  the §4 plate, mounted inside BreechSolution's grid cell
  SeatPlate.svelte       ONE Panel holding both:
    MastSection.svelte
    LoadoutSection.svelte
  hud-state.ts           the §5 ladder as one pure function: (match) => { color, key }
  TurnVignette.svelte    full-viewport z-[2] layer, mounted once by +page.svelte
```

`hud-state.ts` must be a **pure function of the match**, not a store — every surface calls it and derives its
own `$derived`, which is what guarantees they cannot disagree.

### Existing design-system components to use

| Need | Use | Notes |
|---|---|---|
| The seat plate frame | `Panel shape="chamfer" padding="dense"` | `chamfer` is a `CLIPPED_SHAPES` member — it draws its own outline as a clipped layer behind a clipped fill and **opts out of the glass surface**. That is correct here: the plate floats over a moving globe and a backdrop-filter on it is the single most expensive thing on the screen. |
| AP pips, resource pips, round ticks, charge pips | `Pips` (`display/progress/Pips.svelte`) | Already built for exactly this: `shape="diamond"` for spend, `shape="bar"` for the round ladder, `color` overrides the variant palette with a seat hue, `hollow` for the not-your-turn state, `muted` for an opponent read. |
| Standing bar, drain bar | `ProgressBar` | Wrap in a chamfer-clipped span for the angled ends. |
| Every glyph with a meaning | `Tooltip placement="top"` | Not `title`. The existing MyStats note on this is right and stands. |
| Track slot rings | **Not** `RadialProgress` | The slots are rectangles now. A vertical fill inside the chamfered cell, drawn as a `linear-gradient` stop at `pct` — cheaper than an SVG arc and it matches the bar language. |
| END TURN | `Button size="xs" variant="ghost"` | Unchanged. |
| Takeover corners | `HudCorners color={seat.color} size={9} offset={6}` | Already exists, already the right idiom. |
| Icons | `Icon` only, and only from the map | Available and used here: `zap`, `eye`, `eye-off`, `shield`, `lock`, `clock`, `plus`, `users`, `user`, `radar`, `shapes`, `alert-triangle`, `crestlink`, `flame`, `layers`, `check`, `x`, `loader-2`, `chevron-right`. **There is no `target`, `crosshair`, `dice` or `sword` glyph — do not reach for one.** |

### Layout traps

1. **`--play-h` moves from 52px to 76px and `--play-block` follows.** It is published in **two** places:
   `Breach.svelte` (as `PLAY_H` / `PLAY_GAP` constants, with `--play-block: PLAY_H + PLAY_GAP * 2`) and
   hard-coded in the mockup's `+page.svelte` (`52px` / `14px` / `80px`). Change both or the felt gradient —
   which is positioned `bottom-[var(--play-block)]` — will overlap the strip in one app and float above it in
   the other. New values: `--play-h: 76px`, `--play-gap: 14px`, `--play-block: 104px`.
2. **The breech is a CSS grid, not a flex row.** `grid-template-columns: 168px minmax(0,1fr) 208px`. A flex
   row with `flex-1` on the middle would let a long building name or a five-term ledger push the commit key
   sideways, which is the exact failure the fixed-height rule exists to prevent, in the other axis.
3. **The centre zone's two rows are `grid-template-rows: 30px 22px` with `overflow: hidden`,** and both rows
   are always rendered. An `{#if}` that removes row two collapses the strip.
4. **z-index.** Globe `0` → **vignette `2`** → left/right rails `3` → GameEvents `4` → felt `5` → breech `6`.
   The vignette must be **below** the rails: above them it washes out the numerals it is trying to draw
   attention to, and above the felt it tints the card fan.
5. **Do not animate `filter: drop-shadow` on the breech.** The current PlayTicker transitions
   `drop-shadow(...)` on a 832px always-mounted element; at 1024px, over a globe running rAF, that is a
   full-width filter re-rasterised every frame. Put the glow on a pre-composited absolutely-positioned
   sibling and animate its `opacity` — compositor-only.
6. **`clip-path` erases borders.** Every chamfered plate is the two-layer trick PlayTicker already uses: an
   outer element that *is* the rim, and an inner one inset by 1px with the same clip. Chamfer path:
   `polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)`.
7. **Every numeral gets `tabular-nums`.** A turn clock that reflows between `9s` and `10s` is the single most
   visible amateur tell in a HUD.
8. **The mast reads `activeKlass`, the loadout reads `seat`, and they are not the same seat.** The header tag
   belongs to whoever is on the clock; the crest belongs to you. Getting this backwards is the bug that makes
   the plate lie during someone else's turn.
9. **`match.maxAp()` is not 3.** It is `3 + bonus(seat, round, 'ap')` and it grows mid-match. Size the pip
   row for `maxAp()`, never for a literal — and the left zone's 168px must hold the widest case (6 diamonds
   at 9px + gaps + a 2-digit numeral ≈ 148px, so there is 20px of headroom and no more).
10. **The takeover suppresses on `busy`.** A turn that arrives while a resolution is still playing out would
    otherwise fire the ceremony over the top of the verdict card.
