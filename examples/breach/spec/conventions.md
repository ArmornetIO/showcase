<!-- markdownlint-disable MD013 -->

# Conventions

How a requirement in this specification is written, numbered, argued with, and
retired. The grammar of every other document.

## Normative language

**MUST**, **MUST NOT**, **SHOULD**, **SHOULD NOT**, **MAY** as in
[RFC 2119](https://www.rfc-editor.org/rfc/rfc2119).

Prose outside a requirement is not normative. If a paragraph matters, it is a
requirement; if it is context, it is a blockquote.

## Anatomy of a requirement

Every requirement is one paragraph and carries four things:

```
**ECON-4.** `proposed` A side's currency MUST NOT be visible to the other
side.

> A running total of red's patience is a countdown to red's next purchase.
```

| Part | Rule |
| --- | --- |
| **Identifier** | `FAMILY-n`. Stable forever. Never reused, never renumbered. |
| **Status** | One of `built`, `partial`, `proposed`. See below. |
| **Statement** | One rule, in one sentence where possible, with exactly one **MUST**/**SHOULD**/**MAY**. |
| **Rationale** | An optional blockquote saying *why*. Not normative, and not optional in practice — a rule with no recoverable reason is a rule nobody can correctly change later. |

**One decision per requirement.** If a statement contains "and" joining two
things that could be independently wrong, it is two requirements.

> This is the rule that makes the audit possible. A requirement that bundles
> three claims can only ever be `partial`, and `partial` forever is how a
> specification stops being checkable.

## Status

Status says whether the rule **exists in the code today**. It is orthogonal to
how settled the rule is.

| Status | Meaning |
| --- | --- |
| `built` | The engine does this today, and a test or a cited line proves it. |
| `partial` | The engine does some of this. The requirement **MUST** name the gap. |
| `proposed` | Designed, not built. A `proposed` rule **MUST NOT** be cited as behaviour. |

> A settled rule at `proposed` is normal and healthy — it means we know what to
> build. A rule at `partial` with no named gap is a defect in the specification,
> not in the engine.

Where a requirement claims `built`, it **SHOULD** cite the file and symbol that
makes it true. A citation that has rotted is how you find out the rule did.

**Status may be declared per section and inherited.** A document describing work
that does not exist yet — `card-supply.md`, `economy.md` — declares the status
in its header table and omits it from every requirement, rather than stamping
`proposed` eighteen times. A requirement that differs from its section's status
**MUST** state its own.

> Inline status earns its keep in a mixed document like `gameplay.md`,
> where `built` sits next to `partial` and the difference is the whole point. In
> a document that is uniformly `proposed`, repeating it is noise that makes the
> one exception harder to see.

## Stability

Status says whether a rule exists. **Stability** says how likely it is to
change, and it is declared per *section*, not per requirement — a whole area is
settled or it is not.

| Stability | Meaning |
| --- | --- |
| `stable` | Changing this changes the game. Expect an argument. |
| `beta` | The shape is right; the numbers or the edges may move. |
| `alpha` | Being worked out. Build against it at your own risk. |

A section with no declared stability is `stable`. A document that is entirely
`alpha` — like `card-supply.md`'s slice 2 — says so in a table at the top rather
than repeating it on every rule.

> Two axes, because they genuinely come apart. A `stable` rule at `proposed` is
> the healthiest thing in this document: settled design, not yet built. An
> `alpha` rule at `built` is the most dangerous: shipped, and still moving.

## Families

A family is a document's worth of rules. Identifiers are unique across the whole
specification, so a family name is never reused in two documents.

| Family | Owns | Document |
| --- | --- | --- |
| `PILLAR` | The three pillars and the tiebreakers | `pillars.md` |
| `SUP` | How a card reaches a hand | `card-supply.md` |
| `ECON` | Currency, the markets, the neutral ground | `economy.md` |
| `MATCH`, `LOB`, `ROLE`, `DECK`, `EFF`, `TURN`, `BOARD`, `RES`, `FOG` | Unmigrated | `gameplay.md` |

A **mechanism document** like `card-supply.md` implements requirements owned
elsewhere and says so at the top. It owns the mechanism, the data shape and the
edges; the owning document owns the rule. Where the two disagree, the owner
governs.

A rule that is not about the system it would be extending goes to a **new
family** rather than stretching an existing one. An identifier is a permanent
address, so it is worth spending a family name to keep addresses meaningful:
`SUP-8` says where to look in a way `DECK-31` never would.

`CFG`, `PARAM`, `SEED` and `PRE` are **closed families**. They described a
configuration layer that no code consumed, and both the layer and their
documents are gone — see [`README.md`](./README.md#retired-configuration).
Their numbers are not reissued, and nothing new joins them.

## Retiring a rule

A withdrawn requirement is marked ***Withdrawn*** and left in place, with a line
saying what replaced it. The number is never reissued.

```
**DECK-9.** ***Withdrawn*** — the floor it guaranteed is a property of the
opening deal, and now lives with it as `SUP-4`. Kept so a link to `DECK-9`
lands somewhere that explains itself.
```

Withdrawal is not deletion. A requirement that turns out to be **factually
wrong about the code** is withdrawn *and* filed as a defect, because the gap
between what was believed and what was built is the interesting part.

A whole FAMILY can go the same way. When it does the documents may be deleted
rather than annotated — a closed family is recorded once, in `README.md`, and
the reader is told where the surviving idea went. That is the difference
between retiring a rule and retiring a plan.

## Defects

Each document owns a defect register for its own area, at the bottom of the
document or in a sibling `audit.md` where the findings need working. A defect
is a **discrepancy between a `built` requirement and the code**, or a rule the
pillars imply and nothing implements.

Defect identifiers are namespaced by area (`CFG-DEF-1`), because a single global
table stopped being readable at six rows and will not survive sixty.

A defect entry carries: what is wrong, what it costs a player, and which
requirement it violates. A defect that cannot name a violated requirement is
either a missing requirement or a preference.

## Changing this specification

1. Find the pillar the change serves. If none, the change is a preference and
   needs saying so out loud.
2. Write or amend the requirement, with its rationale.
3. Set the status honestly. `proposed` is not an insult.
4. If the change makes existing code wrong, file the defect in the same commit.

> Step 4 is the one that gets skipped. A specification that is only ever updated
> to match the code is a changelog.
