<!-- markdownlint-disable MD013 -->

# BREACH — specification

**Version:** 0.2.0 · **Applies to:** `showcase/examples/breach/**`

The normative contract for how BREACH plays. This is the document a
disagreement is settled against: if the code and this text differ, one of them
is a defect, and the requirement's **status** says which.

## How this is organised

A single file described the whole game until it stopped fitting on a screen and
started hiding its own contradictions. It is now split the way design
documentation is normally split — by **what kind of question a section answers**,
not by what order the game does things in.

Four layers, and the direction of dependency runs downward. A lower layer may
cite a higher one; a higher one may never cite a lower one.

| Layer | Answers | Documents |
| --- | --- | --- |
| **Spine** | What is this, and how do we argue about it? | `pillars.md`, `conventions.md`, `glossary.md` |
| **Systems** | What happens while playing? | `economy.md`, `gameplay.md` *(unmigrated)* |
| **Mechanisms** | How is one system actually built? | `card-supply.md` |
| **Content** | What are the specific cards, roles, buildings? | *(in `gameplay.md`, unmigrated)* |

A **mechanism document** sits below the system that owns its rules. It names
that owner at the top and defers to it — `card-supply.md` implements `DECK-6`,
`DECK-7` and `DECK-8`, and `gameplay.md` governs where they disagree.

> The direction matters. A pillar that has to reference a card is not a pillar,
> it is a preference about that card. A configuration rule that has to reference
> a card is a balance decision hiding in the options screen.

## Reading order

1. **`pillars.md`** — three pillars and the tiebreakers under them. Everything
   else is downstream of this, including every argument about it.
2. **`conventions.md`** — how a requirement is written, numbered, and retired.
   Read once; it is the grammar of the rest.
3. **`glossary.md`** — one meaning per term, across every document.
4. **`gameplay.md`** — everything not yet migrated.
5. **`economy.md`** — the neutral ground: currency, markets, and what each side
   buys there.
6. **`card-supply.md`** — the deck-supply mechanism, when you need that detail.

## Retired: `configuration/`

The `CFG`, `PARAM`, `SEED` and `PRE` families are **withdrawn**, and the six
documents that held them are deleted.

They specified `internal/config.ts` — a `MatchConfig` and a `SessionPort`
persistence seam that had **zero importers** and was never wired to anything.
The tree also cited `internal/session.svelte.ts` and `setup/match-menu.ts`,
neither of which ever existed. Twenty-nine requirements described a layer no
code consumed, which is not a specification of the game — it is a specification
of a plan.

What those documents were actually reaching for is now owned by the server and
already built: a table's settings are `breachview.Config`, and they are changed
through the `set_size` and `set_mode` intents, validated at both doors. That is
a smaller idea than the register, and it is the one the game runs on.

Determinism went with it deliberately. `SEED` wanted a stored seed so a table
could be replayed — but on an authoritative server the seed **is** both hands
and the pile order, so any surface that ever leaked it hands one player the
game. Reproducibility stays a test property, injected through `Rand`, and never
persisted.

## Document status

| Document | State | Notes |
| --- | --- | --- |
| `pillars.md` | current | Rewritten from the old §"Design principles". |
| `conventions.md` | current | Rewritten; adds requirement anatomy. |
| `glossary.md` | current | Migrated verbatim. |
| `economy.md` | current | `ECON-*`. New system — the Outlands, currency, the two markets. |
| `card-supply.md` | current | `SUP-*`. Mechanism for `DECK-6`–`DECK-8`. Predates the split; conforms to it. |
| `gameplay.md` | **being migrated** | Sections 1, 3–12 still live here. |

## Migration state

Migrated so far: the spine, and §2 *Match configuration*.

`gameplay.md` keeps everything else and is authoritative for it. Its front
matter (notation, terms, principles) has been replaced by pointers so there is
exactly one copy of each. When a section migrates, it leaves a pointer behind
and never a duplicate.

Remaining, in the order they should probably be taken:

| Next | Becomes | Why this order |
| --- | --- | --- |
| §7, §9 | `turn/` — the turn, resolution | The core loop. Everything else is priced against it. |
| §6 | `effects/` | The largest `proposed` block; needs its own document to be buildable. |
| §5 | `content/cards.md` | Data plus two framework taxonomies. |
| §4 | `content/roles.md` | Depends on the card model. |
| §8, §10 | `board/`, `information/` | Board geography and the fog contract. |
| §1, §3 | `match.md`, `table.md` | Small; fold in last. |
| §11, §12 | Per-document defect registers + one build order | A global defect table stops scaling once documents own their own. |
