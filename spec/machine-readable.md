<!-- markdownlint-disable MD013 -->

# Machine-Readable Spec

**Version:** 0.1.0 · **Binds:** the seven spec documents

| § | Section | Stability |
| --- | --- | --- |
| 1 | Document header | `beta` |
| 2 | Requirement definitions | `beta` |
| 3 | Note forms | `alpha` |
| 4 | The Conformance table | `beta` |
| 5 | Emitted JSON | `alpha` |
| 6 | Validation | `beta` |
| 7 | Withdrawn requirements | `beta` |

## Overview

*Non-normative.*

Design principle 7 says the contract is the product: *a rule that does not
survive into the generated contract has not been kept.* This document turns that
principle on the spec itself.

Six of the seven documents end with a **Conformance** table mapping every
requirement to an enforcement class and the gates that cover it. Those tables
are the spec's most load-bearing content and its most fragile — they are the one
place where a fact is stated in two documents at once (the per-document table
and `conformance.md` §4), which `types.md` TYP-12b already identifies as a
pending contradiction unless a `--check` fails on disagreement.

It was not a hypothetical. In the single revision that introduced these tables,
by hand:

- three tables listed a requirement in two rows with different classes,
- one table left four requirements (STY-25 – STY-28) with no class at all,
- `conformance.md` CNF-5a listed three `review-only` requirements when eight
  existed,
- and two sections claimed `stable` on gates that do not exist.

Every one of those is mechanically detectable. So this document specifies the
markdown as a **format** rather than as prose, and `scripts/gen-spec-index.mjs`
parses it into `spec/spec.json`, failing CI on any of the above.

**What the JSON is for.** Generating the CNF-5a review checklist rather than
maintaining it. Letting the exception-marker gate (CNF-21) validate that a
`spec-exception: PROP-19` names a requirement that exists. Rendering the docs
site. Giving an agent writing a component the spec as data rather than as 2,000
lines of prose to re-read.

## Model

```
  spec/*.md                    authored — prose is the source of truth
      │
      │  scripts/gen-spec-index.mjs
      ▼
  spec/spec.json               derived — never hand-edited (TYP-12a)
      │
      ├──▶ review checklist         CNF-5a, generated not maintained
      ├──▶ exception-marker check   CNF-21, validates the ID exists
      ├──▶ docs site / agent context
      └──▶ Spec index --check       CI gate; §6
```

The parser reads five structures out of each document. Everything else in a
document is prose and is ignored.

| Structure | Where | Yields |
| --- | --- | --- |
| Header line | Line 3-ish | `version`, `binds` |
| Section stability table | Below the header | `sections[]` with stability |
| `## N. Title` headings | Body | Section membership |
| Requirement definitions | Body | `requirements[]` |
| `## Conformance` table | End of document | `class`, `gates` |

## 1. Document header

**MRS-1.** Every spec document **MUST** open with an H1, then a header line of
the form:

```markdown
# Appearance

**Version:** 0.3.0 · **Binds:** Public components
```

**MRS-2.** A document that defines requirements **MUST** carry a section
stability table immediately after the header, with columns `§`, `Section`, and
`Stability`, and one row per numbered section:

```markdown
| § | Section | Stability |
| --- | --- | --- |
| 1 | The axes | `beta` |
```

Stability values are drawn from the taxonomy in `README.md`. A section number
**MUST** match a `## <n>. <Title>` heading in the body.

> *Why the table rather than per-heading annotations.* One table is one thing to
> read when you want to know how settled a document is, and one thing to diff
> when a section is promoted. Annotations scattered across headings answer the
> same question only by scrolling.

## 2. Requirement definitions

A **requirement definition** is the single authoritative statement of a rule.
There are exactly two forms, and both put the ID in bold at the start.

**MRS-3.** A requirement **MUST** be defined in one of these two forms, and
**MUST NOT** be defined more than once:

```markdown
**APP-1.** A component **MUST NOT** introduce an appearance prop outside this
table.
```

```markdown
| | |
| --- | --- |
| **A11Y-9** | **MUST** be a `<button>`, or `<a>` when `href` is set |
```

The prose form is the default. The table form is for categories of short,
parallel requirements — it is used only in `accessibility.md` §§2–12, where
twelve tables of ARIA obligations read better than fifty paragraphs.

**MRS-4.** A requirement ID **MUST** match `^(APP|PROP|COMP|STY|A11Y|TYP|CNF|MRS)-[0-9]+[a-z]?$`
and **MUST** be globally unique across all documents. The prefix **MUST** be the
one owned by the document defining it.

> *Why the letter suffix exists.* `README.md` forbids renumbering, so a
> requirement inserted between `PROP-6` and `PROP-7` becomes `PROP-6a`. The
> suffix is what lets the spec grow in the middle without invalidating every
> citation downstream of the insertion point.

**MRS-5.** A citation of a requirement — an ID appearing anywhere other than its
own definition — **MUST** resolve to a defined requirement. Citations are
unbolded, so bold is what distinguishes *defining* a requirement from *referring*
to one.

## 3. Note forms

**MRS-11.** A non-normative note beneath a requirement **MUST** use a blockquote
opening with one of four italicised labels, and **MUST NOT** contain RFC 2119
keywords in bold:

| Label | Carries |
| --- | --- |
| *Why.* | The reasoning. Read before proposing an amendment. |
| *Cost.* | A downside the rule knowingly accepts, and what compensates for it. |
| *Example.* | An illustration. |
| *Status.* | Why a section is not further along than its stability says. |

**MRS-12.** A condition restricting when a requirement applies **SHOULD** be
introduced by an italicised *When* or *Where* inside the requirement text.

> *Status.* `alpha`. The labels are extracted into `notes` on each requirement,
> but nothing consumes them yet, and the four-label set has not been stressed —
> *Cost* and *Status* each appear fewer than ten times across the spec.

## 4. The Conformance table

Every document defining requirements ends with a `## Conformance` section whose
table assigns each requirement exactly one enforcement class.

**MRS-6.** The Conformance table **MUST** have columns `Requirement`, `Class`,
and `Enforced by`. The `Requirement` column is a comma-separated list of IDs and
**ranges**; `Class` is one of `gate`, `review-only`, `advisory`; `Enforced by` is
a comma-separated list of gate names in backticks, or `—` for none.

```markdown
| Requirement | Class | Enforced by |
| --- | --- | --- |
| APP-1, APP-2, APP-4 – APP-25, APP-27, APP-28 | `advisory` | `Lint: axes` |
| APP-3 | `advisory` | `Duplicate-type check` |
```

**MRS-7.** A range is written `X – Y` with an en dash and surrounding spaces, and
expands over **document order** — the order in which requirements are *defined* —
not numeric order. Both endpoints **MUST** be in the same document, and `Y`
**MUST NOT** precede `X`.

> *Why document order.* Numeric order and document order diverge wherever a
> section was renumbered or added late: `styling.md` §8 holds STY-25 – STY-28
> while §9 holds STY-23, STY-24, STY-29, so `STY-25 – STY-29` in document order
> is exactly "§8 and §9 entire" and in numeric order is a different, wrong set.
> Document order is the one that matches how a reader would say it aloud.
>
> *Cost, accepted.* A range is not readable in isolation — you must know where
> the endpoints sit in the file. Mitigated by MRS-8: any expansion error is a
> build failure, not a silent misclassification, and a document whose ranges
> would surprise a reader carries a note saying so.

**MRS-8.** Every requirement in a document **MUST** be covered by **exactly one**
row of that document's Conformance table. Zero rows and two rows are both
errors.

> *Why exactly one and not at least one.* A requirement in two rows has two
> classes, and nothing decides which wins. This is the check that would have
> caught PROP-25, PROP-6a, TYP-7, and TYP-9a, each of which was listed twice in
> the first draft of these tables.

**MRS-9.** A requirement whose text begins with *Withdrawn* is exempt from
MRS-8, **MUST NOT** appear in any Conformance row, and **MUST NOT** be cited as
binding.

**MRS-10.** A gate named in a document's `Enforced by` column **MUST** appear in
the roster in `conformance.md` §4. A requirement classed `gate` **MUST** name at
least one gate whose Built column reads *yes* (`conformance.md` CNF-9a).

> *Why the roster owns Built and the per-document tables do not.* Whether a gate
> exists is one fact. Restating it in seven places is seven places to update on
> the day it ships — and `types.md` TYP-12b already forbids exactly that shape.
> The per-document tables name the gate; §4 says whether it runs.

## 5. Emitted JSON

**MRS-13.** The generator **MUST** emit `spec/spec.json` with this shape:

```jsonc
{
  "spec": { "version": "0.4.0", "documents": 8, "requirements": 236 },
  "documents": [
    {
      "id": "appearance",              // basename without .md
      "file": "appearance.md",
      "title": "Appearance",
      "version": "0.3.0",
      "binds": "Public components",
      "prefix": "APP",
      "sections": [{ "n": "1", "title": "The axes", "stability": "beta" }]
    }
  ],
  "requirements": [
    {
      "id": "APP-1",
      "document": "appearance",
      "section": "1",
      "stability": "beta",             // inherited from its section
      "class": "advisory",
      "gates": ["Lint: axes"],
      "keywords": ["MUST NOT"],        // RFC 2119 keywords used
      "conditional": false,            // has a *When* / *Where* clause
      "withdrawn": false,
      "cites": ["APP-2"],              // other requirements it references
      "notes": { "why": "The value of a shared axis is…" },
      "text": "A component MUST NOT introduce an appearance prop…"
    }
  ],
  "gates": [
    { "name": "Type check", "class": "gate", "built": true,
      "enforces": "types.md §1–§2", "requirements": ["TYP-1", "…"] }
  ],
  "checklist": ["PROP-6a", "PROP-29", "COMP-1", "…"]   // every review-only ID
}
```

**MRS-14.** The output **MUST** be deterministic: no timestamps, no absolute
paths, and stable ordering — documents in read order, requirements in document
order, gates in roster order. A second run over unchanged input **MUST** produce
a byte-identical file.

> *Why determinism is a requirement and not a nicety.* `--check` compares the
> emitted bytes against the committed file. A timestamp would make every run
> report a stale index, which trains everyone to ignore the gate.

**MRS-15.** `spec.json` is a derived artifact under `types.md` TYP-12a and
**MUST NOT** be hand-edited. It **MUST** be committed, so that consumers can
read it without running the generator.

## 6. Validation

**MRS-16.** `gen-spec-index.mjs --check` **MUST** fail on any of:

| # | Failure | Enforces |
| --- | --- | --- |
| 1 | A requirement is defined twice | MRS-3 |
| 2 | An ID does not match the pattern, or uses the wrong prefix | MRS-4 |
| 3 | A cited ID is not defined anywhere | MRS-5 |
| 4 | A requirement is covered by zero Conformance rows | MRS-8 |
| 5 | A requirement is covered by two or more rows | MRS-8 |
| 6 | A range endpoint is missing, cross-document, or reversed | MRS-7 |
| 7 | A named gate is absent from the `conformance.md` §4 roster | MRS-10 |
| 8 | A requirement classed `gate` names no built gate | MRS-10, CNF-9a |
| 9 | A `stable` requirement is classed `advisory` | CNF-9 |
| 10 | An `advisory` requirement exceeds `beta` | CNF-9 |
| 11 | A section in the stability table has no `##` heading, or vice versa | MRS-2 |
| 12 | The CNF-5a checklist disagrees with the set of `review-only` IDs | CNF-5a |
| 13 | `spec.json` differs from a fresh generation | MRS-14 |

> *Why 9 and 10 are the point of the whole exercise.* They are `conformance.md`
> CNF-9 — the rule coupling stability to enforcement — restated as an executable
> check. CNF-9 was stated in 0.2.0 and violated by six sections of the spec that
> stated it. A rule the spec cannot check on itself is a rule the spec is not
> entitled to impose on components.

**MRS-17.** Check 12 **MUST** compare sets, not order, and **MUST** report
additions and omissions separately.

## 7. Withdrawn requirements

**MRS-18.** A withdrawn requirement **MUST** remain in place, keep its ID, and
state the version that withdrew it and the reason:

```markdown
**CNF-2.** *Withdrawn in 0.2.0.* Directory-granular tiers made a single
non-conforming component demote its neighbours out of the barrel.
```

> *Why it stays.* `README.md` forbids reusing or renumbering an identifier. A
> deleted requirement leaves a hole that a future editor fills, and every commit
> message citing the old CNF-2 silently starts referring to something else.

## Conformance

| Requirement | Class | Enforced by |
| --- | --- | --- |
| MRS-1 – MRS-10, MRS-13, MRS-14, MRS-16 – MRS-18 | `gate` | `Spec index --check` |
| MRS-11, MRS-12 | `advisory` | `Spec index --check` |
| MRS-15 | `review-only` | `Review checklist` |

MRS-11 and MRS-12 are `advisory`: the parser extracts labelled notes and *When*
clauses but does not fail on their absence, because no requirement is obliged to
have a rationale — only to be right.
