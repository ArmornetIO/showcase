<!-- markdownlint-disable MD013 -->

# Composition

**Version:** 0.3.0 · **Binds:** Public components

| § | Section | Stability |
| --- | --- | --- |
| 1 | The two layers | `beta` |
| 2 | Prop ceiling | `alpha` — the ceiling value is unvalidated |
| 3 | Regions | `beta` |
| 4 | Sub-components | `beta` |
| 5 | Context | `beta` |
| 6 | Polymorphism | `development` |

## Overview

*Non-normative.*

Every component library eventually meets the same request: *"this is almost
right, but I need the footer to be different."* There are three answers. Add a
prop — and keep adding props until the component has forty and none of them
compose. Tell the consumer to fork it — and lose every future fix. Or give them
a way down to the pieces.

This document specifies the third answer. The library is **two layers**:

- **Part components** — unopinionated primitives that compose with siblings to
  form a family: `Card.Root`, `Card.Header`, `Card.Footer`.
- **Presets** — opinionated assemblies of parts with a small prop surface:
  `StatCard`.

A consumer reaches for a preset first, replaces a **region** with a snippet when
one piece needs to differ, and drops to parts when the preset's shape is wrong
entirely. Each step down costs more code and buys more control.

The property that makes this work is that **the escape is lossless**: dropping
from a preset to parts never costs fidelity, because the preset was built from
nothing but those same parts (COMP-1). A consumer who drops down can rebuild
exactly what they had and then change one thing. If a preset contains private
markup, the drop-down loses something, and the consumer forks instead — which is
the outcome the whole design exists to prevent.

## Model

```
        StatCard                     ← PRESET: small prop surface, opinionated
           │  composed only of
           ▼
  Card.Root ─ Card.Header ─ Card.Value ─ Card.Footer   ← PARTS: published,
           │                                              unopinionated
           │  Root provides context to siblings
           ▼
        data-slot="root" | "header" | "body" | "footer" ← SLOTS: styling targets
                     ▲
                     │ region names are drawn from the slot vocabulary
        {#snippet footer(stats)}  ← REGION: a slot the preset lets you replace
```

| Entity | Unit of | Owned by | Governed by |
| --- | --- | --- | --- |
| Part component | Composition | The family | §1, §4, §5 |
| Preset | Convenience | Itself | §1, §2 |
| Region | Content replacement | The preset | §3 |
| Slot | Styling | The component | `styling.md` §2 |

Regions and slots share a vocabulary deliberately (COMP-10): a consumer who has
learned that a card has a `footer` can both restyle it and replace it, using the
same word.

## 1. The two layers

```svelte
<!-- preset — the common case -->
<StatCard variant="error" label="Blocked" value={1284} />

<!-- preset with one region replaced -->
<StatCard variant="error" label="Blocked" value={1284}>
  {#snippet footer(stats)}<Sparkline data={stats.trend} />{/snippet}
</StatCard>

<!-- part components — assembled by hand -->
<Card.Root variant="error">
  <Card.Header label="Blocked" />
  <Card.Value>{1284}</Card.Value>
  <Card.Footer><Sparkline data={trend} /></Card.Footer>
</Card.Root>
```

**COMP-1.** A preset **MUST** be implemented entirely from published part
components. A preset **MUST NOT** contain markup a consumer could not reproduce
by assembling parts.

> *Why.* This is the requirement that makes the escape lossless, and therefore
> the one the whole two-layer design rests on. Everything else in this document
> is machinery in service of it.

**COMP-2.** Part components **MUST** be exported as a namespace object named for
the family: `Card.Root`, `Card.Header`, `Card.Footer`.

> *Cost, accepted.* A namespace object is an object literal, not a module
> namespace, so property-level dead-code elimination is bundler-dependent.
> Importing `Card` to use only `Card.Root` may retain the family. Accepted
> because the alternative — twelve flat exports per family — makes the barrel
> unreadable and the relationship between parts invisible at the import site.

**COMP-3.** Every family **MUST** have a `Root` part. `Root` owns the family's
appearance axes and provides context to the other parts.

> *Why the axes live on `Root`.* `variant='error'` describes the card, not the
> header. Putting it on `Root` means one place to set it, one place for the
> theme to default it, and siblings that read it from context rather than
> re-declaring it — which would violate `appearance.md` APP-2.

**COMP-4.** A part **MUST NOT** require another part as a prop. Parts compose
through markup and context, never through configuration.

> *Why.* `<Card.Root header={Card.Header} />` is configuration wearing the
> costume of composition: the consumer cannot pass props to the part, cannot
> wrap it, and cannot put anything between it and its siblings. Markup does all
> three for free.

## 2. Prop ceiling

The ceiling is a **tripwire, not a budget**. Its job is to make "this component
is doing too much" fire automatically rather than waiting for someone to notice
during review.

**COMP-5.** A public component **MUST NOT** exceed **20 declared props**. Props
inherited from an HTML attribute base type (`types.md` TYP-1a) are not counted.
All region snippets together count as **one** prop.

> *Why the two exemptions.* Inherited HTML attributes are not API the library
> designed — counting them would make the ceiling a function of which element a
> component happens to render. Region snippets are counted as one because they
> are the *cure* for prop growth; charging per region would push components back
> toward the parameters they are meant to replace.
>
> *Status.* The number 20 is unvalidated. This section stays `alpha` until a
> real component has been converted end to end and the ceiling has either bitten
> correctly or been shown to be wrong.

**COMP-6.** A component that would exceed the ceiling **MUST** be split into a
part family plus presets. Widening a structural union to cover more shapes
**MUST NOT** be used to avoid the split.

> *Why the second sentence.* Moving props into `type: 'a' | 'b' | 'c' | 'd'`
> reduces the prop count without reducing the component's surface — the same
> complexity, now hidden behind a discriminant, with every branch shipped to
> every consumer. `appearance.md` APP-21 states the same rule from the axis
> side.

**COMP-7.** A runtime dispatcher — one component selecting a preset from a
structural value known only at runtime — **MAY** exist for builder and CMS use.
It is Internal tier and **MUST NOT** be exported from the barrel.

> *Why it is allowed at all.* The builder genuinely does not know which
> component it is rendering until runtime, and there is no static form of that.
> Keeping it Internal confines the cost — the whole registry in the bundle — to
> the one consumer that needs it.

## 3. Regions

A **region** is a slot of a preset whose content the consumer may replace with a
snippet. Regions are the middle rung of the escape ladder: cheaper than dropping
to parts, more powerful than a prop.

**COMP-8.** Every visually distinct region of a preset **MUST** be overridable
by a snippet of that region's name. A preset rendering a collection **MUST**
include `empty` and `error` regions with default renderings.

**COMP-9.** A region snippet **MUST** receive the data the preset would have
used to render it, typed `Snippet<[T]>`, so an override can reuse it:

```svelte
{#snippet footer(stats: StatSummary)}
  <Sparkline data={stats.trend} />
{/snippet}
```

> *Why the data is passed rather than left to the consumer.* Without it the
> consumer must re-derive what the preset already computed — refetch it, or
> recompute the same aggregate — and the two derivations drift. Passing it makes
> a region override an edit of the rendering, not a reimplementation of the
> logic behind it.

**COMP-10.** Region names **MUST** be drawn from the component's slot
vocabulary (`styling.md` STY-6). A preset **MUST NOT** invent a region name with
no corresponding slot.

**COMP-11.** Region names are public API and **MUST** be listed in the
component's generated contract per `types.md` TYP-9.

## 4. Sub-components

**COMP-12.** A component used only inside one other component **MUST NOT** be
exported. Co-locate it and leave it unexported.

> *Why.* An export is a promise under `conformance.md` CNF-12. A helper exported
> "just in case" acquires consumers, and then its props, slots, and root element
> are frozen by the deprecation cycle — for a component nobody deliberately
> published.

**COMP-13.** A component **MUST** have exactly one public entry point. A family
is entered through its namespace object or a preset — never through a private
file path.

**COMP-14.** A preset **MUST NOT** be a thin alias of another preset. *Where* two
presets differ only in an axis value, there is one preset.

> *Why.* `<ErrorCard>` as an alias of `<StatCard variant="error">` doubles the
> API for zero capability, and the alias will drift — gaining a prop the
> original does not have, then diverging. `appearance.md` APP-10 states the same
> rule for components differing only in weight.

## 5. Context

A family's parts coordinate through Svelte context: `Root` provides, siblings
consume. Context is an implementation detail of the family, never an API.

**COMP-15.** A family **MAY** use Svelte context to pass state from `Root` to
its parts. That context **MUST** be private to the family and **MUST NOT** be
exported.

**COMP-16.** A purely presentational part **MUST** render standalone, outside
its `Root`, falling back to its own defaults.

A part whose accessibility contract depends on family context — anything owing
`aria-controls`, `aria-expanded`, `aria-activedescendant`, or a roving
`tabindex` — **MUST** throw in development with a message naming its required
`Root`, and **MUST** degrade to a non-interactive rendering in production.

> *Why the split.* `getContext` returning `undefined` makes this failure silent
> by default. A trigger rendered without its `Root` still renders, so a render
> test passes and broken ARIA ships. Presentational parts can safely fall back;
> parts that owe an ARIA relationship cannot, because the fallback is a control
> that looks operable and is not.
>
> *Why it degrades rather than throws in production.* A missing `Root` should
> not white-screen a page in front of a user. Development throws loudly;
> production renders something inert and honest.

**COMP-16a.** A component **MAY** use `<svelte:boundary>` to contain a part
failure. A boundary **MUST NOT** be used to suppress the COMP-16 development
throw.

## 6. Polymorphism

**COMP-17.** A component that renders a different root element depending on
usage — a link-styled button, a heading level — **MUST** express that through
a documented prop (`href`, `level`), not through an `as` or `component` prop.

> *Why.* `as` makes the root element unknowable statically, which breaks
> `types.md` TYP-1a (the props interface extends the root element's attribute
> type) and makes `conformance.md` CNF-12's "changing which element is the root"
> undetectable by the API-diff gate. `href` is a documented prop whose effect on
> the root element the generated contract can state.
>
> *Status.* `development`. The rule is right for the cases seen so far, but the
> library has not yet met a case where the root element varies across more than
> two possibilities, and that case may need a different answer.

## Conformance

| Requirement | Class | Enforced by |
| --- | --- | --- |
| COMP-1, COMP-16 | `review-only` | `Review checklist` |
| COMP-5 | `advisory` | `Prop-count check` |
| COMP-2, COMP-3, COMP-7, COMP-12, COMP-13, COMP-15 | `advisory` | `Tier check` |
| COMP-11 | `advisory` | `Contract generator --check` |
| COMP-4, COMP-6, COMP-8 – COMP-10, COMP-14, COMP-16a, COMP-17 | `advisory` | — |

COMP-1 and COMP-16 are `review-only` because neither is mechanically decidable:
a lint cannot tell whether markup inside a preset is reproducible from published
parts, and cannot tell which parts owe an ARIA relationship.
