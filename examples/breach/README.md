# BREACH

A 2v2 supply-chain skirmish, and the first real consumer of this package.

It exists to prove the library works for something that is not a dashboard: a
full application with its own domain, its own state machine and a real-time
canvas, built entirely out of `showcase` primitives. If a primitive is awkward
here, that is a bug in the primitive.

## The boundary

```
internal/     the game. Zero `$lib` imports, zero DOM, no Svelte components.
*.svelte      the view. Composed from `$lib` primitives; owns no rules.
```

`internal/` is the whole game as a headless engine — it runs in Node under
vitest with no browser. Everything it needs from the outside arrives through a
port (`internal/cinema.ts`), so a host that cannot play a cinematic installs
`NO_CINEMA` and the rules run identically.

The view never reaches past that line. It reads state off `BreachMatch`, calls
its methods, and renders. Anything a component computes for itself is layout —
never a rule.

## Running it

It is a real app, not a fixture. It runs on its own:

```sh
cd showcase/examples/breach
npm run dev      # → http://localhost:5199
npm run build    # → dist/, a static bundle you can host anywhere
```

**No install of its own.** There is no `node_modules` and no `dependencies`
block here: the app is nested inside `showcase/`, so Node resolves `vite`,
`svelte` and `tailwindcss` by walking up, and npm puts the parent's `.bin` on
PATH. A fresh clone runs it after one `npm install` in `showcase/`.

It also mounts inside the showcase app at `/showcase/examples/breach`, which is
the same components with SvelteKit doing the routing. Both work, and keeping
both honest is the point — the standalone entry is what proves the library needs
no framework, and the routed one is what proves it composes with one.

## Consuming it

```svelte
<script lang="ts">
	import { Breach } from 'showcase/examples/breach';
</script>

<Breach />
```

Or drive the engine yourself and bring your own chrome:

```ts
import { BreachMatch } from 'showcase/examples/breach/internal';

const match = new BreachMatch();
const stop = match.start(); // timers + the demonstrator loop
match.takeSeat('maintainer');
```

## Features

The complete list, so a refactor can be checked against it.

### Match flow
- **Character select** — four seats, each showing skills, passive and opening
  hand; the two you do not take are played by the demonstrator. Bench roster
  shown as "not in this match".
- **Rules overlay** — four stats, one roll formula, two ways to win.
- **Twelve rounds**, four seats in fixed initiative, 3 AP each.
- **Turn clock** — 30s, drains only while the player is thinking. A resolution
  playing out is the game's time, not theirs.
- **Auto** — hands all four chairs to the demonstrator so one person can watch a
  fog-of-war game happen around them.
- **Victory** — red holds all five path steps; blue survives to the horizon.
- **New match** resets every accumulated value.

### Fog of war
- Per-seat visibility: red sees its own work, blue sees only what it revealed.
- The **log is fogged too** — rows carry an audience and never render to the
  wrong seat.
- Standing forces are fogged by derivation, so a reveal reveals the people too.
- A fogged action shows a ripple in the *region*, never on the building.

### The board
- Globe with five territories and sixteen structures on real terrain.
- Payload path drawn as a lane; held segments light up.
- Condition bars, garrison figures, severed links, one-shot pings.
- Dice thrown at the region and left lying on the terrain.
- **First-person POV** cutaway with four cut points (prelude/roll/verdict/full).
- **Tactical toolbar** — camera + layout controls.

### Play
- Hand of four, dealt one at a time from the dispenser.
- Click a card to read it; **drag it onto the world** to play it — the drop
  target is a building, hit-tested forgivingly against the drawn node boxes.
- Legal sites light the moment a card is armed; sealed sites stay lit because
  you are allowed to run at a wall.
- Two kinds of "no": `hard` (the chain runs in order / not your side) and
  `sealed` (a quarantine — you may try, and watch it get swatted).
- Roll itemisation: `2d6 + skill + card + resource + leverage vs target`.
- Odds for *any*, *clean* and *botch*.

### Rules the board enforces
- **Chain order** — a step is only attackable from the one before it.
- **Leverage** — holding the previous step pays on the next (+1 held, +1 per
  implant to 2, +2 if staged).
- **Heat/detection** per territory; at 80 a region stops keeping secrets.
- **Dwell** — an unattended implant burrows a point of hardening a round.
- **Chip damage and repair** — a failed attack still wears the wall down; upkeep
  repairs a point a round.
- **Expiry** — softening and quarantine lapse on a timer.
- **Capitalising** — attacking ground you already hold digs in instead.
- **Garrison** — posted defenders are worth hardening and can be driven off.

### Demonstrator
Plays the line the game teaches: red softens what it cannot yet beat and strikes
when the odds turn; blue sinkholes the relay once red is established, sweeps the
loudest region, and otherwise builds wall.
