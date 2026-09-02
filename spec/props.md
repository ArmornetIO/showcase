<!-- markdownlint-disable MD013 -->

# Props

**Version:** 0.3.0 · **Binds:** Public and Internal components (§1–§8)

| § | Section | Stability |
| --- | --- | --- |
| 1 | Content | `beta` |
| 2 | Collections | `beta` |
| 3 | State | `beta` |
| 4 | Events | `beta` |
| 5 | Booleans | `beta` |
| 6 | Optionality and defaults | `beta` |
| 7 | Escape props | `beta` |
| 8 | Localisation | `beta` |
| 9 | Reserved words | `beta` |

*Amended 0.3.0 — §7 was `stable` in 0.2.0 with `advisory` enforcement, which
`conformance.md` CNF-9 forbids; corrected to `beta`. No normative text changed.*

## Overview

*Non-normative.*

This is the mechanical contract: what props are called, what they carry, and who
owns the state behind them. Appearance props — `variant`, `emphasis`, `size`,
`hue`, and structural unions — are specified in `appearance.md` and do not
appear here.

A prop name is the smallest unit of API in the library and the one a consumer
meets first. The cost of getting it wrong is not aesthetic: a `label` that means
*heading* on one component and *field name* on another cannot be typed by a
shared alias, cannot be defaulted by the theme, and cannot be described by one
line in the generated contract. So the names are closed.

Uniquely, §1–§8 bind **Internal** components too. Internal components are exempt
from demos, slots, overrides, and a11y (`conformance.md` CNF-8) — but not from
naming, because an Internal component is the most likely thing to be promoted
later, and renaming its props at promotion time is the expensive path.

## Model

Every prop is exactly one **kind**. The kind decides which section governs it,
which names are available to it, and how it is typed.

| Kind | Carries | Names available | §|
| --- | --- | --- | --- |
| **Content** | What the component displays | 6 fixed roles | 1 |
| **Collection** | A list the component renders | 3 fixed names | 2 |
| **State** | A value the consumer may own and bind | 4 fixed names | 3 |
| **Event** | A callback fired on something happening | `on<verb>` | 4 |
| **Boolean** | A binary mode | Positively phrased | 5 |
| **Appearance** | How it looks | The 5 axes | `appearance.md` |
| **Escape** | A hole for the consumer to reach through | `class`, `id`, `overrides`, `...rest` | 7 |
| **Domain** | Anything specific to what this component is for | Free, if it is none of the above | — |

Only the last row is open. A prop that *could* be expressed as one of the closed
kinds **is** that kind — `chosen: string` is a state prop spelled wrongly, not a
domain prop.

## 1. Content

**Content** is what the component puts on screen on the consumer's behalf. There
are six roles, distinguished by the job the text does, not by where it sits.

| Role | Prop | Type |
| --- | --- | --- |
| Heading of a container | `title` | `TextOrSnippet` |
| Text naming a control | `label` | `TextOrSnippet` |
| Supporting help text | `description` | `TextOrSnippet` |
| Validation message | `error` | `TextOrSnippet` |
| Kicker above a title | `eyebrow` | `TextOrSnippet` |
| Body | `children` | `Snippet` |

`title` and `label` are the pair most often confused. A container is *titled*; a
control is *labelled*, and its label is wired to it by `accessibility.md`
A11Y-3. A component that renders a control inside a container has both.

**PROP-1.** A content prop **MUST** use the role name above. `name`,
`headline`, `caption`, `lede`, `sub`, `text`, `heading`, `body`, and `content`
**MUST NOT** be used as content props.

> *Why six and not more.* Each additional role must be renderable, defaultable,
> and describable on every component that has it. Six covers the roles that
> recur; a seventh that appears on one component is that component's domain prop
> and does not need to join the vocabulary.

**PROP-2.** A content prop **MUST** be typed with the shared exported alias:

```ts
export type TextOrSnippet<T extends unknown[] = []> = string | Snippet<T>;
```

**PROP-3.** A component **MUST** detect a snippet with `typeof x === 'function'`
and render it; otherwise it renders the string. It **MUST NOT** render both.

```svelte
{#if typeof title === 'function'}{@render title()}{:else}{title}{/if}
```

> *Why this is a narrowing contract, not an arbitration.* A string and a snippet
> of the same name occupy the same prop slot in Svelte 5, so a component never
> actually receives both. The rule exists to fix *how* the narrowing is written,
> so that every component narrows identically and the generated contract can
> describe the prop once.

**PROP-3a.** A component **MAY** warn in development when a content prop is
neither a string nor a function.

**PROP-4.** `label` **MUST** be present on every component that renders an
interactive control, and **MUST** be associated with it per `accessibility.md`
A11Y-3.

**PROP-4a.** Validation state **MUST** be carried by `error`, distinct from
`description`. `variant='error'` **MUST** be derived from its presence, not set
independently. `description` wires to `aria-describedby`; `error` wires to
`aria-errormessage` per `accessibility.md` A11Y-17.

> *Why `variant` is derived rather than set.* Two sources of truth for "is this
> field invalid" diverge the moment one of them is updated and the other is not,
> and the failure mode is a field that looks fine and reads as invalid to a
> screen reader, or the reverse. One prop, one truth.

## 2. Collections

A **collection prop** carries records the component renders one per item. The
three names are distinguished by what the component does with them, which is
what decides the ARIA the component owes.

| Prop | Carries |
| --- | --- |
| `items` | A general list to render |
| `options` | The choices of a choice control |
| `rows` | Tabular records |

**PROP-5.** A collection prop **MUST** use one of the three names above.
`data`, `entries`, `list`, `records`, and `tabs` **MUST NOT** be used.

**PROP-6.** `rows` **MUST NOT** be used for anything other than tabular
records. A line count is `lines`.

**PROP-6a.** A component **MUST NOT** mutate a collection prop. Sorting,
filtering, and reordering **MUST** be derived internally and emitted through a
callback.

> *Why.* A collection is frequently a consumer-owned `$state` proxy. In-place
> mutation writes through to the caller — a table that sorts its `rows` array
> silently reorders the consumer's own data, and the consumer's next render
> disagrees with its own model.

**PROP-6b.** A component taking a collection **MUST** expose `empty` and
`error` slots with default renderings, per `composition.md` COMP-8.

> *Why this is mandatory rather than encouraged.* Empty and failed are not edge
> cases of a collection, they are two of its three states. A component that
> renders only the third pushes the other two back onto every call site, where
> they are written inconsistently or not at all.

## 3. State

A **state prop** is a value the consumer may own. Every one is `$bindable`, so
the same component works uncontrolled (the component owns the value),
controlled (the consumer owns it and passes it), or bound (both, via `bind:`).

| Concept | Prop | Type |
| --- | --- | --- |
| Single selection | `value` | `T` |
| Multiple selection | `values` | `T[]` |
| Binary | `checked` | `boolean` |
| Disclosure | `open` | `boolean` |

**PROP-7.** A state prop **MUST** use the name above. `active`, `selected`,
`current`, `chosen`, and `expanded` **MUST NOT** be used as the state prop.

**PROP-8.** A state prop **MUST** be declared `$bindable`.

**PROP-9.** A state prop **MUST NOT** be required. A component **MUST** render
and operate with no state prop supplied.

> *Why.* This is what makes the three modes one component instead of three. A
> required `value` forces every consumer into controlled mode, including the
> ones that only wanted the default behaviour, and each of them writes the same
> `let value = $state(...)` boilerplate.

**PROP-10.** The change callback **MUST** fire on every state change the
component itself commits, including when the prop is driven by `bind:`. It
**MUST NOT** fire in response to a write originating outside the component. A
component **MUST NOT** use `$effect` to derive a callback from a prop's value.

> *Why.* The banned form is `$effect(() => onchange?.(value))`. Bound to a value
> the parent also writes — a tab bar driven from the URL — it re-emits the
> parent's own write and loops. Fire the callback from the event handler that
> commits the change, where the origin is known.

**PROP-11.** A component **MUST NOT** expose a `default<X>` prop. `$bindable`
covers both modes.

## 4. Events

An **event prop** is a callback the component invokes. Its name says what
happened; its first argument says what it happened to.

**PROP-12.** A callback prop **MUST** be named `on<verb>` in **lowercase**, with
no separator: `onchange`, `onclose`, `onrowclick`, `onpointclick`. camelCase
**MUST NOT** be used.

> *Why lowercase.* It matches the native DOM attribute spelling Svelte 5 uses
> (`onclick`, not `onClick`), so PROP-18's forwarded native handlers and the
> library's semantic callbacks are spelled the same way and a consumer never has
> to know which they are looking at.

**PROP-13.** A callback prop **MUST** be optional and **MUST** default to
`undefined`, invoked with optional chaining: `onchange?.(v, e)`.

**PROP-14.** A callback **MUST** take the semantic value as its first argument
and the originating event, where one exists, as its second:

```ts
onchange?:   (value: string, e: Event) => void;
ontoggle?:   (checked: boolean, e: Event) => void;
onrowclick?: (row: Row, e: MouseEvent) => void;
```

> *Why value first.* The overwhelming majority of handlers want the value and
> not the event. Putting it first means the common case reads
> `onchange={(v) => …}` with no unused parameter, and the event stays available
> for the minority that needs `preventDefault`.

**PROP-15.** A callback **MUST NOT** take a bare DOM event as its only
argument, and **MUST NOT** take no argument, *where a semantic value exists*.

**PROP-16.** A callback whose only meaning is that something happened —
`onclose`, `onopen`, `ondismiss` — takes the event alone: `(e: Event) => void`.

**PROP-17.** A callback **MUST NOT** be nested inside a data object. An action
is a prop pair (`actionLabel` + `onaction`) or a snippet, never
`{ label, onclick }`.

> *Why.* A callback inside a data prop is invisible to the generated contract,
> untyped by the props interface, and impossible for the theme to default. It
> also makes the data prop unserialisable, which rules out the builder and any
> CMS-driven use.

**PROP-18.** A component that wraps a single interactive element **MUST**
forward the native handler under its native name, unchanged.

**PROP-18a.** *When* a component's semantic callback name equals a native event
handler attribute of its root element — `onchange`, `onselect`, `ontoggle`,
`onclose`, `oncancel`, `oninput` — the semantic callback **MUST** win: the
component **MUST** declare it as a prop, **MUST NOT** leave it in the spread,
and **MUST** record the shadowed native event in its generated contract. A
component **MUST NOT** forward a native handler under a name it also uses
semantically.

> *Why the semantic one wins.* The collision is real and unavoidable — a
> `<select>`-based component genuinely has both a native `change` event and a
> semantic one. Silently spreading both means the consumer's handler fires
> twice, with different argument shapes. Declaring the semantic one and
> recording the shadow makes the loss visible in the contract instead.

## 5. Booleans

A **boolean prop** is a binary mode. Booleans multiply: three of them describe
eight states, most of which are meaningless. §5 exists mainly to keep them from
accumulating.

**PROP-19.** A boolean prop **MUST** be positively phrased. `hide<X>`,
`disable<X>`, `no<X>`, and `without<X>` **MUST NOT** be used; use `show<X>` and
`<x>`. A boolean **SHOULD** default to `false`; defaulting to `true` **MUST**
carry a `spec-exception` marker per `conformance.md` CNF-20.

> *Why.* `hideFooter={false}` is a double negative the reader resolves at every
> call site. Positive phrasing with a `false` default also means the absent prop
> and the default prop read the same way.

**PROP-20.** `disabled`, `readonly`, `required`, and `loading` are the sanctioned
negatives, matching their HTML meaning.

**PROP-21.** Three or more mutually exclusive booleans describing one decision
**MUST** be a single union prop.

```ts
// no
bordered?: boolean; filled?: boolean; dot?: boolean;
// yes
emphasis?: Emphasis;
```

> *Why three and not two.* Two booleans have four states and the illegal
> combinations are still enumerable in the reader's head. At three the count is
> eight, the component grows a precedence rule nobody wrote down, and the
> contract cannot express which combinations are legal.

**PROP-22.** A boolean **MUST NOT** be used where an axis exists. A component
**MUST NOT** take `accent?: boolean` when `variant` says the same thing.

## 6. Optionality and defaults

Every optional prop has a default. **Where that default is written** decides
whether the theme can override it, which is the whole of PROP-23.

**PROP-23.** Every optional prop **MUST** have a defined default.

- A prop the theme may default — every appearance axis, and any prop listed as
  themable in the generated contract — **MUST** supply its default to the theme
  seam (`styling.md` STY-14) and **MUST NOT** default in the `$props()`
  destructure.
- Every other prop **MUST** default in the `$props()` destructure.
- Callback and snippet props are exempt; they default to `undefined`.

`undefined` **MUST** mean absent and **MUST NOT** be a meaningful value.

> *Why.* A destructure default fires the moment a prop is omitted, erasing the
> difference between *omitted* and *explicitly passed the same value* — which is
> the only signal a theme default can act on. Once erased, `defaultProps` in the
> theme is silently inert, and the failure is invisible at the component.

**PROP-24.** A prop **MUST** be required only where no sane default exists.

**PROP-25.** A public component **MUST NOT** exceed the prop ceiling in
`composition.md` COMP-5.

## 7. Escape props

**Escape props** are the deliberate holes through which a consumer reaches a
component without editing it. Design principle 5 in `README.md` makes them part
of the contract rather than a concession — a component that cannot be restyled,
extended, or targeted from outside will be forked instead.

**PROP-26.** Every public component **MUST** accept `class?: string` and merge
it onto its root element after its own classes.

**PROP-27.** Every public component **MUST** accept `id?: string` and spread
unrecognised props onto its root element. Its Props interface **MUST** extend
the root element's attribute type per `types.md` TYP-1a. An `id` used to wire
ARIA relationships internally **MUST** be generated with `$props.id()` when the
consumer supplies none.

> *Why generated rather than required.* Half the ARIA contracts in
> `accessibility.md` need an id to point at. Requiring the consumer to supply
> one makes correct accessibility opt-in; generating it makes the default
> correct and lets the consumer override when they need a stable selector.

**PROP-28.** `className`, `styleOverrides`, and `sx` **MUST NOT** be used.
Styling reaches inside via `styling.md`, not via new props.

## 8. Localisation

**PROP-29.** Every user-facing string a component renders of its own accord —
empty-state text, pagination labels, the `aria-label` of an icon-only control —
**MUST** be a prop with an English default. A component **MUST NOT** hardcode
display text.

> *Why this is here rather than deferred to an i18n effort.* A hardcoded string
> is not a translation problem until there is a second language, but it is
> immediately an override problem: a consumer who needs "No results" to say "No
> vendors found" has no seam and forks. The prop-with-default form solves both,
> and costs nothing to adopt now versus retrofitting fifty components later.

## 9. Reserved words

A **finding aid**, not an independent source of rules. Every ruling restates a
numbered requirement above; where the two disagree, the requirement governs.

| Word | Ruling | Requirement |
| --- | --- | --- |
| `title`, `label`, `description`, `error`, `eyebrow`, `children` | Content roles only | PROP-1 |
| `items`, `options`, `rows` | Collections only | PROP-5, PROP-6 |
| `value`, `values`, `checked`, `open` | State only | PROP-7 |
| `class`, `id`, `overrides` | Escape only | PROP-26 – PROP-28 |
| `data`, `entries`, `list`, `name`, `text`, `content`, `active`, `selected`, `current` | **MUST NOT** be used | PROP-1, PROP-5, PROP-7 |

## Conformance

| Requirement | Class | Enforced by |
| --- | --- | --- |
| PROP-1 – PROP-6, PROP-6b, PROP-7 – PROP-9, PROP-11 – PROP-24, PROP-26 – PROP-28 | `advisory` | `Lint: prop names` |
| PROP-10 | `advisory` | `Lint: $effect callbacks` |
| PROP-25 | `advisory` | `Prop-count check` |
| PROP-6a | `review-only` | `Review checklist` |
| PROP-29 | `review-only` | `Review checklist` |

PROP-6a and PROP-29 are `review-only` because neither is mechanically decidable:
a lint cannot tell a derived sort from an in-place one through an aliased
reference, and cannot tell a user-facing string from a `data-` attribute value.
