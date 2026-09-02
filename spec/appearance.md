<!-- markdownlint-disable MD013 -->

# Appearance

**Version:** 0.3.0 · **Binds:** Public components

| § | Section | Stability |
| --- | --- | --- |
| 1 | The axes | `beta` |
| 2 | `variant` — meaning | `beta` |
| 3 | `emphasis` — weight | `beta` |
| 4 | `size` — scale | `beta` |
| 5 | `hue` — decoration | `beta` |
| 6 | Structure | `beta` |
| 7 | `status` — reserved | `beta` |
| 8 | `color` — escape | `beta` |
| 9 | Defaults | `beta` |
| 10 | Token binding | `beta` |
| 11 | Reserved words | `beta` |

*Amended 0.3.0 — §§1–4 and §9 were `stable` in 0.2.0. Their only enforcement is
the `Lint: axes` gate, which does not exist yet and is classed `advisory`.
`conformance.md` CNF-9 forbids a `stable` requirement from being `advisory`, so
they are corrected to `beta`. They return to `stable` when the lint ships — the
requirements themselves did not change.*

*Amended 0.4.0 — §10 corrected from `stable` for the same reason, under the
sharper CNF-9a: `Token lint` is specified but unbuilt, so APP-26 is `advisory`.
No document in the spec now claims `stable` on a gate that does not run.*

## Overview

*Non-normative.*

Two components look like they belong to the same library because they vary along
the **same dimensions**, not because one person drew them both. This document
fixes those dimensions.

An **appearance axis** is one named dimension of visual variation. Four
properties make it an axis rather than a prop that happens to affect looks:

- **Closed** — its values are a fixed, exported union, never a free string.
- **Shared** — one declaration serves the whole library, so `variant` means the
  same thing on `Button` as on `Toast`.
- **Orthogonal** — it answers a question no other axis answers.
- **Token-bound** — each value resolves to a design token, never a literal
  colour, so the theme can restyle every component at that value at once.

There are five axes. A component takes the ones that apply to it and introduces
nothing else.

| Axis | The question it answers | Prop | Scope |
| --- | --- | --- | --- |
| Meaning | What does this signify? | `variant` | Shared |
| Weight | How loudly does it say it? | `emphasis` | Shared |
| Scale | How big is it? | `size` | Shared |
| Decoration | Which arbitrary colour distinguishes it? | `hue` | Shared |
| Structure | Which sub-shape renders? | `type` | Component-scoped |

**Why orthogonality is the load-bearing property.** When two axes fuse into one
enum — a `kind` prop whose values are `'ghost'`, `'error'`, `'ghost-error'` —
the value set becomes the cross product of the dimensions. Every new meaning
must be written out against every existing weight, the union grows
multiplicatively, and a theme can no longer restyle *error* without also
enumerating every weight it appears at. §§2–6 exist to keep that product from
ever being written down.

## Applicability

These requirements bind every **Public** component. Internal components are
exempt: `conformance.md` CNF-7 binds them to `props.md` §1–§8 and `types.md`
§1–§3 only.

A component that exposes no visual variation owes nothing here. The axes are a
vocabulary to draw from, not a checklist to satisfy — APP-1 forbids inventing a
sixth axis, it does not require taking all five.

## 1. The axes

The five axes above are the complete vocabulary of appearance variation. A prop
that changes how a component looks is either one of them or is not an appearance
prop at all.

**APP-1.** A component **MUST NOT** introduce an appearance prop outside the
table in the Overview.

> *Why.* The value of a shared axis is that learning it once is learning it
> everywhere. A sixth axis on one component is a term the reader must learn for
> that component alone, and a dimension the theme cannot reach.

**APP-2.** The four shared unions **MUST** be declared once, in
`src/lib/appearance.types.ts`, and imported. A component **MUST NOT** re-declare
an axis union, even byte-identically.

**APP-3.** Two exported type aliases with the same name **MUST NOT** exist with
different membership.

> *Why.* A byte-identical copy is not harmless: it is a second declaration that
> will not be updated when the first one gains a value, and the divergence
> surfaces as a type error at an unrelated call site months later.

## 2. `variant` — meaning

`variant` carries **semantics**: what the component is telling the reader. It is
the only axis a screen reader's user is also entitled to learn about, which is
why `accessibility.md` A11Y-5 forbids it from being signalled by colour alone.

```ts
export type Variant = 'default' | 'accent' | 'success' | 'warn' | 'error';
```

**APP-4.** *When* colour carries meaning, it **MUST** be expressed as `variant`,
typed `Variant`. *(Amended 0.2.0 — the default is per component, see §9.)*

**APP-5.** The severe-negative value is spelled **`error`**. `danger`,
`critical`, `fail`, and `destructive` **MUST NOT** be used as variant values.

> *Why.* One spelling, chosen arbitrarily but chosen once. `error` wins over the
> alternatives because `props.md` PROP-4a already names the validation prop
> `error`, and `styling.md` STY-2 derives the token name from the axis value —
> so a second spelling would mean `--variant-danger-fg` and `--variant-error-fg`
> both existing and neither being obviously wrong.

**APP-6.** A component **MAY** narrow the union and **MUST NOT** widen it:

```ts
variant?: Extract<Variant, 'default' | 'error'>;
```

> *Why narrowing is safe and widening is not.* Narrowing removes a value the
> component cannot render meaningfully — a checkbox has no `success` state — and
> the theme's token for that value is simply unused. Widening adds a value with
> no token behind it and no meaning on any other component, which is APP-1 by
> another route.

**APP-7.** A value that does not describe meaning **MUST NOT** appear in a
variant union. Weight belongs to `emphasis`, decoration to `hue`, structure to
§6.

## 3. `emphasis` — weight

`emphasis` carries **how loudly** the meaning is stated, holding the meaning
itself constant. A destructive button and a destructive inline note are the same
`variant='error'` at different weights.

```ts
export type Emphasis = 'solid' | 'ghost' | 'outline';
```

**APP-8.** *When* a component draws the same meaning at different visual
weights, it **MUST** expose `emphasis` as its own prop. *(Amended 0.2.0 — the
default is per component, see §9.)*

**APP-9.** Fused values — `'ghost-error'`, `'solid-ghost'`, `'primary-outline'`
— **MUST NOT** be defined. They are `emphasis` × `variant`.

**APP-10.** A component **MUST NOT** ship a separate sibling whose only
difference is weight. `GhostButton` is `<Button emphasis="ghost">`.

> *Why this is a composition rule and not just a naming one.* A `GhostButton`
> sibling has its own props interface, its own slots, its own tests, and its own
> deprecation cycle under `conformance.md` CNF-12. Every fix to `Button` must
> then be applied twice, and the two drift. See `composition.md` COMP-14 for the
> same rule stated over presets.

## 4. `size` — scale

`size` is **ordinal**: its values are ordered, and a consumer may reasonably
assume `lg` is larger than `md`. That ordering is what distinguishes it from a
structural union (§6), whose values have no order.

```ts
export type Size = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
```

**APP-11.** `size` **MUST** be typed `Size` or a **contiguous** subset.
*(Amended 0.2.0 — the default is per component, see §9.)*

> *Why contiguous.* `'sm' | 'lg'` with no `'md'` reads as a scale with a hole in
> it, and a consumer stepping a component up a size lands on a value that does
> not exist. Narrow from either end, not from the middle.

**APP-12.** A non-ordinal value **MUST NOT** appear in a size union. A value like
`'md-long'` describes shape and belongs to §6.

**APP-13.** *When* a component is sized in raw pixels — glyphs, crests, icons,
diagram atoms — that prop **MUST** be named `px: number`. `size` is always
ordinal.

> *Why.* An icon at 14px is not "small" on any library-wide scale; it is
> whatever its container needs. Overloading `size` to be sometimes ordinal and
> sometimes numeric breaks both the theme's ability to default it and the
> reader's ability to predict it.

## 5. `hue` — decoration

`hue` carries **no meaning**. It exists for the case where several instances of
the same component must be told apart at a glance — series in a legend, tags in
a list — and the distinction is arbitrary rather than semantic.

```ts
export type Hue = 'cyan' | 'emerald' | 'blue' | 'amber' | 'red';
```

**APP-14.** *When* colour is chosen for visual variety rather than meaning, it
**MUST** be `hue`, typed `Hue`.

**APP-15.** `hue` **MUST NOT** contain a value that also appears in `Variant`.
The two sets are disjoint by construction.

**APP-16.** `hue` and `variant` **MAY** coexist. *When* both are set, `variant`
**MUST** govern any element that signals state; `hue` tints chrome only.

**APP-17.** A component in the Control, Input, Choice, Listbox, Toggle, or
Feedback categories of `accessibility.md` **MUST NOT** take `hue`.

> *Why.* A reader interprets colour on an interactive or status-bearing
> component as state — a red input is invalid, a red button is destructive.
> `hue` carries no state, so on those categories it is indistinguishable from a
> lie. On a `Card` or a chart series there is no state to be confused with.

## 6. Structure

A **structural union** selects which sub-shape a component renders. Unlike the
four shared axes it is component-scoped: `ButtonShape` means nothing to `Card`.
Its values are unordered and carry no colour, weight, or scale.

**APP-18.** A structural union **MUST** select which sub-shape renders. It
**MUST NOT** carry colour, weight, or scale.

**APP-19.** The primary structural union **MUST** be named `type` and exported
as `<Name>Type`. *When* `type` is claimed by a native HTML attribute on the
component's root, one alternative **MUST** be chosen from the allowlist
`shape` · `layout` · `density` · `orientation`, exported as `<Name><Word>`. A
component **MAY** declare more than one structural union. Every structural union
**MUST** appear in the generated contract.

> *Example.* `Button` holds native `type="button|submit|reset"`, so its
> structural axis is `shape: ButtonShape`.
>
> *Why an allowlist rather than free choice.* The axes lint must be able to
> decide whether an unknown prop is a structural union or an APP-1 violation. A
> closed list of five names makes that decidable; "pick something sensible" does
> not.

**APP-20.** *When* a structural union mirrors a native HTML attribute, its values
**MUST** match the HTML values exactly, and it **MUST NOT** be widened with
non-native values.

**APP-21.** *When* a structural union discriminates renderings that share little
markup, the family **MUST** be split under `composition.md` COMP-6.

> *Why.* A union is an axis when the renderings are variations of one thing. Once
> the branches share no markup it is not an axis, it is two components wearing
> one name — and every consumer pays the bundle cost of the branch they do not
> use.

## 7. `status` — reserved

`status` is reserved, library-wide, for **system and connectivity health**. It is
the one domain concept promoted to a shared name, because it appears on enough
components that letting each spell it differently was the larger cost.

```ts
export type StatusLevel = 'healthy' | 'degraded' | 'offline';
```

**APP-22.** `status` is reserved for system and connectivity health, typed
`StatusLevel`. It **MUST NOT** be used for validation, workflow stage, or as a
free string.

**APP-23.** Validation feedback **MUST** use `error` per `props.md` PROP-4a.
Workflow stage **MUST** use a domain-named prop such as `stage` or `review`.

> *Why a domain-named prop rather than a shared one.* A workflow's stages differ
> per domain — an assessment's stages are not a risk's. There is no shared union
> to be had, so the prop is named for its domain and stays out of the axis
> vocabulary entirely.

## 8. `color` — escape

`color` is the deliberate hole in the closed-set rule: the one place a consumer
may hand a component a colour the library never enumerated. It exists because
the alternative — consumers forking a component to change one colour — is worse.

**APP-24.** `color` **MUST** be `string | undefined` — a CSS colour or custom
property — and **MUST NOT** be a closed union. *When* set, it overrides `variant`
and `hue`.

**APP-25.** A domain enumeration **MUST NOT** be carried on a colour prop. HTTP
verbs belong on `method`.

> *Why.* `color={method === 'DELETE' ? 'red' : 'green'}` at the call site puts
> the mapping from domain to colour in the consumer, where it will be written
> again, differently, at the next call site. The component takes `method` and
> owns the mapping once.

## 9. Defaults

The spec fixes each axis's **union**. It does not fix which value a given
component starts at — that is a per-component design decision.

**APP-27.** Each component **MUST** declare exactly one default for every axis
it exposes, and **MUST** state it in its generated contract.

> *Why the choice is delegated.* `Button` defaulting to `emphasis: 'ghost'` and
> `Toast` to `'solid'` are both correct — a page of solid buttons is unreadable,
> a ghost toast is invisible. Mandating one default library-wide would make
> every justified divergence a breaking change under `conformance.md` CNF-12,
> for no design benefit.

**APP-28.** An axis default **MUST** be supplied through the theme seam, not a
`$props()` destructure default, so `styling.md` STY-11 can override it. See
`props.md` PROP-23.

> *Why.* A destructure default fires the instant a prop is omitted, so the
> component cannot tell *omitted* from *explicitly passed the same value* — and
> that difference is the only signal a theme default has to act on.

## 10. Token binding

**APP-26.** An axis value **MUST** resolve to a design token. A component
**MUST NOT** map an axis value to a literal colour. See `styling.md` STY-1.

> *Why this is the rule to gate first.* Token binding is what makes the axes
> worth having: it is the mechanism by which a theme restyles every
> `variant='error'` in the library at once. It is also the only appearance rule
> that is cheaply decidable by a linter — a literal colour in component CSS is a
> regex away — so `Token lint` is both the highest-value and the lowest-cost
> gate in `conformance.md` §4.

## 11. Reserved words

This table is a **finding aid**, not an independent source of rules. Every ruling
in it restates a numbered requirement above; where the two disagree, the
requirement governs.

| Word | Ruling | Requirement |
| --- | --- | --- |
| `variant` | Meaning only | APP-4, APP-7 |
| `emphasis` | Weight only | APP-8, APP-9 |
| `size` | Ordinal scale only; pixels are `px` | APP-11, APP-13 |
| `hue` | Decoration only | APP-14, APP-17 |
| `type`, `shape`, `layout`, `density`, `orientation` | Structure only | APP-19 |
| `status` | System health only | APP-22 |
| `color` | Free-string override only | APP-24 |
| `kind`, `intent`, `severity`, `state`, `tone`, `appearance`, `theme` | **MUST NOT** be used as props | APP-1 |

## Conformance

Enforcement classes are defined in `README.md` and rostered per gate in
`conformance.md` §4. Per CNF-9, every requirement carries exactly one.

| Requirement | Class | Enforced by |
| --- | --- | --- |
| APP-1, APP-2, APP-4 – APP-25, APP-27, APP-28 | `advisory` | `Lint: axes` |
| APP-3 | `advisory` | `Duplicate-type check` |
| APP-26 | `advisory` | `Token lint` |

**APP-19's contract requirement** (structural unions appear in the generated
contract) is additionally covered by `types.md` TYP-9 and the contract
generator's `--check` mode.
