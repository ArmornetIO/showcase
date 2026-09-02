<!-- markdownlint-disable MD013 -->

# Glossary

One meaning each, across every document. A term used in two senses is a defect
in whichever document invented the second one.

## The match

| Term | Definition |
| --- | --- |
| **Side** | `red` (Intrusion) or `blue` (Defence). Owns a deck and a win condition. |
| **Seat** | A chair at the table: `R1`, `B1`, `R2`, `B2`. Fixed initiative position. |
| **Role** | The character occupying a seat — skills, passive, resource, signature. |
| **Horizon** | The round blue must survive to. The match's length, in rounds. |
| **Initiative** | The fixed order seats act in: `R1 → B1 → R2 → B2`. |

## The board

| Term | Definition |
| --- | --- |
| **Structure** | One of 18 buildings. Carries `hardening`, an owner, and optionally a chain position. |
| **Territory** | One of 5 regions. Owned by `red`, `blue`, or `neutral`. Carries **heat**. |
| **Chain** | The payload path: 5 structures. The first four in any order; the payload needs all four. Red's win condition. |
| **Foothold** | Red standing on a structure. Private until revealed. |
| **Heat** | Per-territory detection, 0–100. Red's exposure. |
| **Hardening** | The number an attack roll must beat at a structure. |
| **Terrain** | The board's fixed geography — which structures exist, where, and at what base hardening. |

## Play

| Term | Definition |
| --- | --- |
| **Effect** | A named, sourced, expiring modification to a structure, territory or side. |
| **Card** | A playable ability instance. Held in a hand, drawn from a side's deck. |
| **Signature** | A card guaranteed to one role, never shuffled into the shared deck. |
| **Fog** | The rule that a seat may only read what it has earned. |
| **Feed** | The log filtered to what a seat may read. |
| **Stage** | One of the seven Cyber Kill Chain steps. Red's card categories. |
| **Function** | One of the five NIST CSF functions. Blue's card categories. |
| **Kind** | The engine's `AbilityKind` — what a card *does* mechanically. Orthogonal to stage and function. |

## The economy

Terms introduced by `economy.md`. All `proposed` — none of these exist yet, and
they are recorded here so the second document to use one cannot invent a second
meaning for it.

| Term | Definition |
| --- | --- |
| **Pool** | A side's currency, owned by the side and not by a seat. Two exist: red's `REP`, blue's `BUDGET`. |
| **Market** | A neutral structure that can be claimed and bought from. Two exist: the Vendor Market and the Observatory. |
| **Open** | A market nobody holds. Claimable by either side. |
| **Held** | A market one side has claimed. Only that side may buy there. |
| **Threshold** | The currency a side must reach to claim an `open` market, and which claiming spends. |
| **Flip** | A `held` market returned to `open` by an attack resolved against its hardening. |
| **Good** | What a market sells. Different for each side, by `ECON-11`. |

## Card supply

Terms introduced by `card-supply.md`.

| Term | Definition |
| --- | --- |
| **Basics** | The pile present in a side's deck from the opening deal. Tier 0. |
| **Tier** | A card's entry band. Cards of tier *n* enter the deck when their side reaches advance level *n*. |
| **Advance level** | How far a side has progressed for supply purposes — red by chain position, blue by footholds revealed. |
| **Enter** | A tier joining the draw pile. One-way: a tier never un-enters. |
| **Floor** | The guarantee on the opening deal that each side holds at least one playable card. |

## Configuration

`Parameter`, `Class`, `Reach` and `Contract` retired with the `configuration/`
tree — they were vocabulary for a register that was never built. One term
survives, because the game still has settings.

| Term | Definition |
| --- | --- |
| **Configuration** | The values chosen once, before a match exists, and true for its whole length. Two of them: the table's size and how characters are handed out. |
| **Commit point** | The instant the configuration becomes constructor arguments and stops being editable. |
| **Seed envelope** | The exact set of random draws a seed reproduces. Everything outside it is unseeded. |
| **Stream** | One named generator derived from the root seed, belonging to one consumer. |
| **Preset** | A named, balance-tested configuration. The opposite of a custom one. |
| **Table** | The assembled match-to-be: the configuration plus the people in the lobby. |
| **Lobby** | The room of people. Outlives the match. Not part of the configuration. |
