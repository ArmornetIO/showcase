<!-- markdownlint-disable MD013 -->

# Showcase Component Specification

**Version:** 0.3.0 · **Applies to:** `showcase/src/lib/**`

## Overview

*Non-normative.*

This is the normative contract for components in the showcase library: what a
component may be called, how it varies, how it is composed, styled, operated by
keyboard, typed, and published.

A component library earns its keep only if a consumer can predict a component
they have never used from one they have. That prediction is the product. It
survives exactly as long as the names, the axes, and the escape hatches stay the
same across every component — which is not something taste enforces on its own
at fifty components and four contributors. Hence a spec.

The spec optimises for a **small** interface surface. Where two designs are
equally correct, the one with fewer names wins.

**What this spec does not do.** It does not say what components should exist,
what they should look like, or how they should be implemented internally. It
constrains the seams — the props, the slots, the tokens, the exports — and
leaves everything behind them to design judgement.

## The model

Seven entities. Everything in the seven documents is a rule about one of them or
about how two of them meet.

```
                 exports.manifest.json  ──┐
                          ▲               │ editorial facts
                          │               │ (tier, stability)
  source  ──gen:api──▶  generated contract ──▶ builder registry
    │                        ▲
    │                        │ describes
    ▼                        │
 ┌──────────────────────────────────────────────┐
 │  COMPONENT                                   │
 │    takes  ── appearance axes  (appearance.md)│
 │    takes  ── props            (props.md)     │
 │    renders ── slots           (styling.md)   │
 │    reads  ── theme seam ──▶ tokens           │
 │                                              │
 │  is either a PART (composes with siblings)   │
 │         or a PRESET (assembles parts,        │
 │                      exposes regions)        │
 └──────────────────────────────────────────────┘
```

**Component** — one `PascalCase.svelte` file with an exported props interface. It
is exactly one **tier** (Public or Internal) and belongs to exactly one
**accessibility category**.

**Appearance axis** — a named, closed, shared dimension of visual variation:
`variant`, `emphasis`, `size`, `hue`, plus a component-scoped structural union.
Defined in `appearance.md`.

**Slot** — a named element **inside a single component's own markup**, carrying
`data-slot`. A unit of *styling*. Every component declares a `<Name>Slot` union.

**Part component** — a component that composes with siblings to form a family:
`Card.Root`, `Card.Header`. A unit of *composition*. A **published part** is one
exported from the barrel, and therefore reproducible by a consumer.

**Preset** — an opinionated assembly of part components with a small prop
surface: `StatCard`. A **region** is a slot of a preset whose content a consumer
may replace with a snippet; region names are drawn from the slot vocabulary.

**Theme seam** — `withDefaults(name, props, fallbacks)`, the single function
through which a component reads theme default props and style overrides. Defined
in `styling.md` §4.

**Generated contract** — the machine-readable description emitted per component
by `gen:api`: props, types, defaults, slots, regions, callback signatures, tier,
stability. The library's public description of itself.

### Two distinctions worth stating twice

**Part component ≠ slot.** A preset's `header` *region* is a slot of the preset
**and** is rendered by a `Card.Header` *part component*. They are different
entities that happen to share a name. `styling.md` STY-16 governs how an
override crosses that boundary.

**Axis ≠ structural union.** `size` is ordinal and shared library-wide;
`ButtonShape` is unordered and means nothing outside `Button`. `appearance.md`
§6 governs the second.

### `CSSDeclaration`

A style object accepted by an override. Flat CSS properties plus nested
`&`-prefixed selector and at-rule keys:
`{ color, '&:hover': { … }, '@media (…)': { … } }`.

## Documents

Read in this order on a first pass; each assumes the model above and nothing
else.

| Document | Owns | Read it when |
| --- | --- | --- |
| [`appearance.md`](./appearance.md) | The appearance axes and their value sets | Adding a prop that changes how something looks |
| [`props.md`](./props.md) | Content, events, state, booleans, prop naming | Adding any other prop |
| [`composition.md`](./composition.md) | Part components, presets, snippets, prop ceiling | A component is outgrowing itself |
| [`styling.md`](./styling.md) | Tokens, slots, layers, the overrides pattern | Writing CSS, or exposing a styling seam |
| [`accessibility.md`](./accessibility.md) | Per-category keyboard and ARIA contract | The component can be interacted with |
| [`types.md`](./types.md) | Typing style, exported contracts, publication | Before export; when the contract generator complains |
| [`conformance.md`](./conformance.md) | Tiers, required artifacts, gates, versioning | Promoting to Public; changing a `stable` component |

## Notational conventions

The key words **MUST**, **MUST NOT**, **SHOULD**, **SHOULD NOT**, and **MAY**
are to be interpreted as described in [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119).

Requirements carry stable identifiers (`APP-1`, `PROP-7`, …). Cite them in code
review and in migration commits. Identifiers are never reused or renumbered; a
withdrawn requirement is marked *Withdrawn* and left in place.

Each document is structured the same way: an **Overview** and, where the
document introduces entities, a **Model** — both non-normative — then numbered
sections, each opening with a definition of its concept before constraining it,
and closing with a **Conformance** table listing every requirement's enforcement
class.

Three labelled note forms appear beneath requirements. All are non-normative:

- ***Why.*** The reasoning. Read this before proposing an amendment.
- ***Cost.*** A downside the rule knowingly accepts, and what compensates for it.
- ***Example.*** An illustration. Code samples are Svelte 5 with runes; where a
  sample and a requirement disagree, the requirement governs.

Where a requirement applies only in a situation, that situation is introduced by
an italicised ***When***.

## Conformance tiers

Every component is exactly one tier, declared per component in
`exports.manifest.json`. `conformance.md` §1 is the single normative definition;
no other document restates it.

| Tier | Meets | Barrel export |
| --- | --- | --- |
| **Public** | The entire spec | Required |
| **Internal** | `props.md` §1–§8, `types.md` §1–§3 | Forbidden |

## Stability

Stability is a property of each **requirement**, not of the document that
carries it. Levels follow the OpenTelemetry semantic-convention taxonomy:

| Level | Meaning |
| --- | --- |
| `development` | Under active design. May change or be withdrawn without notice. |
| `alpha` | Shape agreed, details unsettled. Breaking changes expected. |
| `beta` | Details settled. Breaking changes only for defects found in use. |
| `rc` | Feature-complete. Only defect fixes before `stable`. |
| `stable` | Changing it requires the deprecation cycle in `conformance.md` §6. |
| `deprecated` | Superseded. Names its replacement. |

Each document declares the level of its sections in a table below its header. A
requirement inherits its section's level unless it states its own.

**Stability describes how settled the requirement is — not how much code
complies with it.** A `stable` requirement that nothing yet satisfies is normal;
that gap is the migration's business, not the spec's.

## Enforcement classes

Every requirement is enforced in exactly one of three ways. Each document's
**Conformance** table assigns the class per requirement; `conformance.md` §4
rosters them per gate.

| Class | Meaning |
| --- | --- |
| `gate` | An automated check fails the build. |
| `review-only` | Not mechanically decidable. Carries a named item on the review checklist in `conformance.md` §2. |
| `advisory` | Its gate does not exist yet. Reviewed against, but not build-failing. |

A requirement **MUST NOT** be `stable` unless it is `gate` or `review-only`.
An `advisory` requirement **MUST NOT** exceed `beta`.

> *Why these two rules matter more than they look.* Together they make the gate
> roster the spec's own roadmap: raising a section to `stable` is the same act
> as building its gate. A spec whose stability levels are set by confidence
> rather than by enforcement drifts into aspiration, and stops predicting what
> the build will actually reject.

## Design principles

The tiebreakers. Where a requirement is ambiguous, resolve it in the direction
these point.

1. **One name, one meaning.** A prop name means the same thing in every
   component in the library, or it is two different names.
2. **Closed sets over free strings.** An appearance axis is a shared, named,
   exported union — never a per-component literal and never an open string.
3. **Orthogonal axes over fused enums.** Prefer `variant` × `emphasis` over one
   enum whose values fuse meaning with weight.
4. **Presets over parameters.** A component that needs fifty props is a family
   of components over a set of part components.
5. **The escape hatch is part of the contract.** A consumer must be able to
   restyle, extend, and target a component without editing it.
6. **Keyboard first.** A component that cannot be operated without a pointer is
   not finished.
7. **The contract is the product.** The library is read by machines as much as
   by people. A rule that does not survive into the generated contract has not
   been kept.

## Revision history

| Version | Change |
| --- | --- |
| 0.3.0 | Structural revision. Each document gains an Overview, per-section definitions, labelled *Why* / *Cost* / *When* notes, and a Conformance table assigning an enforcement class to every requirement — discharging CNF-9, which 0.2.0 stated but did not satisfy. `appearance.md` §§1–4 and §9 corrected from `stable` to `beta`: their enforcement is `advisory`, which CNF-9 forbids at `stable`. No requirement's normative text changed. |
| 0.2.0 | Per-component tiers (CNF-2 withdrawn); per-component axis defaults (APP-27); theme seam (STY-14). |
