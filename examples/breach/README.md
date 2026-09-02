# BREACH — the client

A 2v2 supply-chain skirmish, and the first real consumer of this package.

It exists to prove the library works for something that is not a dashboard: a
full application with its own domain and a real-time canvas, built out of
`showcase` primitives. If a primitive is awkward here, that is a bug in the
primitive.

## What is in this directory

**The client, and only the client.** This directory renders a game it does not
decide. Everything here draws, animates, listens and sends; nothing here rules
on whether an attack landed.

```
*.svelte          the view. Composed from $lib primitives, owns no rules.
hud/ presence/    readouts. Pure render over what the server sent.
parts/ lobby/     smaller view pieces.
internal/         data and view-models — the board, the roster, the deck
                  catalogue, the choreography. See "the rules" below.
net.svelte.ts     the wire, browser side. Transport only, no rules.
wasm.ts           names the Agent Line capability this app speaks.
api.ts            REST calls that set a table up before it exists.
rulebook/         the rules-and-deck reference page.
```

## What is NOT in this directory

The **game itself** — the rules, the dice, the fog, and the only copy of the
board that any outcome is measured against — is Go, and it lives outside this
module in the armornet tree:

```
internal/breach/            the engine. Rules, resolution, upkeep, the fog.
internal/breach/cards.yaml  the deck.        ┐ canonical. Generated into this
internal/breach/rules.yaml  the board+roster ┘ directory; never edited here.
internal/breach/breachview/ the wire shapes, and nothing else.
internal/proto/breachproto/ the protocol: Intent, Snapshot, Event, Error.
server/opamp/breach.go      the Line host: identity, fog, fan-out.
```

If you are reading this from inside the `showcase` repository, none of those
paths exist for you — `showcase/` is its own git repository nested inside
armornet. The engine is one level up.

## How a move actually happens

```
you drop a card
  → CardFan endDrag → match.resolve()
  → net.svelte.ts sends  Intent{op:"commit", card_key, site_id}
  → Agent Line custom message, capability io.armornet.breach
  → the server's Line host: WHO is read off the verified connection
  → internal/breach Match.Perform: legality checked, 2d6 rolled, state changed
  ← Snapshot (fogged for you) + Event (the resolution, to animate)
  → applyRemote() overwrites the board; the animation plays the server's dice
```

The inbound message is a verb and at most five ids. **No dice, no outcome, no
modifier, no AP, no foothold, and no seat** — the seat is derived from the
connection, because a client that can name itself can name somebody else. That
asymmetry is the whole design; `internal/proto/breachproto` states it at length.

The practical rule when working in here: **`resolve()`, never `perform()`.**
`perform()` is the local engine. Calling it directly on a networked table
resolves a card in this browser and tells nobody — a phantom breach the next
snapshot silently undoes. It now refuses to run when a server is attached.

## The rules, and why some of them are here anyway

`internal/` holds the board, the roster, the deck catalogue and the upgrade
tracks. That looks like a second copy of the rules, and it used to be one.

The **data** is generated from the canonical YAML in `internal/breach/`, so it
cannot drift. The line it draws:

- **Generated and safe here** — what cards exist, what they cost, what a
  building is worth, what the territories are called. This is the printed
  rulebook. Every player is entitled to it; the rules page publishes it.
- **Never here** — live match state: what is in a hand right now, what the pile
  holds, the shuffle order, and the fog. Those exist only where there is an
  authority to own them.

Do not hand-edit the generated data. Change the YAML and regenerate.

### The decision procedure is NOT generated, and it did drift

This section used to claim the local resolver "interprets generated rules rather
than carrying its own", and that therefore nothing could drift. **That was
false, and it shipped a live bug.**

`cmd/breachgen` emits *data* — the board, the roster, the deck — and says so in
its own header. It has never emitted the decision procedure, because doing so
would mean writing a Go-to-TypeScript compiler. So `match.svelte.ts` grew a full
second engine: `hardeningOf`, `leverageFor`, `oddsFor`, `applyStrike`,
`applyBlue`, `upkeep`, `checkVictory`, the demonstrator — about 2,300 lines that
no generator ever checked.

It diverged from Go on which chairs count toward blue's `harden` upgrades. At
1v1 the Threat Hunter is not seated, so from round 9 this client displayed a wall
**two higher than the server resolved against**. The player was shown one number
and rolled against another.

Two things fixed it, and both are worth knowing before you touch this directory:

1. **The authority's number wins.** `RemoteMatchView` carries `sites`, each with
   the `hardening` the engine will actually resolve against, and `hardeningOf`
   returns it whenever it is present. The server had been sending this all
   along; not reading it was the bug. **Do not recompute anything the snapshot
   already contains.**
2. **The rules now travel.** `cmd/breachwasm` is `internal/breach` compiled for
   the browser (`internal/rules-engine.ts` wraps it). `internal/local-table.ts`
   makes an offline table a `RemotePort` backed by that module — so a solo game
   is hosted by the real engine instead of a copy of it, and `applyRemote`
   becomes the single door state comes through on either path.

The local TypeScript resolver is what remains to be deleted once the offline
table is switched over. Treat it as legacy: fix bugs in `internal/breach` and
let them arrive here, rather than patching both.

## It runs standalone

**This example plays with no backend at all.** That is a requirement, not a
fallback: `showcase` is a component library, and an example you cannot open
without standing up a Go server and a database is an example nobody opens.

That requirement is what produced the second ruleset: something had to resolve a
card when there was no server to ask. The generator covers the *data* — the
board, the deck, the roster and every tunable number come out of
`internal/breach/*.yaml`, so a balance change lands in both engines at once. It
never covered the resolution, which is where they came apart (above).

The answer is not a better generator, it is one engine: `cmd/breachwasm` puts
the real `internal/breach` in the page, so the standalone game keeps this
property **and** stops being a second implementation. It costs 0.29 MB gzipped,
built with TinyGo — see `docs/development/browser-wasm-agents.md`.

A server is needed for **multiplayer**, and only for that. With one attached
the local resolver is inert — the server rules, and this directory animates
what it decided.

## Running it

```sh
npm run dev            # the showcase app; the example is at /examples/breach
npm run check          # svelte-check
make breachgen         # regenerate the data after editing the canonical YAML
```
