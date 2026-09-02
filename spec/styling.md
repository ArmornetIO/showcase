<!-- markdownlint-disable MD013 -->

# Styling

**Version:** 0.3.0 · **Binds:** Public components

| § | Section | Stability |
| --- | --- | --- |
| 1 | Tokens | `beta` |
| 2 | Slots | `beta` |
| 3 | State attributes | `beta` |
| 4 | Theme overrides | `beta` |
| 5 | Instance overrides | `beta` |
| 6 | Layers and precedence | `beta` |
| 7 | Layout and direction | `beta` |
| 8 | Layering and portals | `alpha` |
| 9 | Motion | `beta` |

## Overview

*Non-normative.*

A consumer needs to change how a component looks at three different scales, and
each scale wants a different mechanism:

| Scale | "Make every error red-orange instead of red" | **Tokens** |
| --- | --- | --- |
| | "Make every panel in this product flatter" | **Theme** |
| | "Make *this* panel's header borderless" | **Overrides** |

Reaching for the wrong one is the failure mode this document is designed
against. A per-instance override that gets copy-pasted to forty call sites was a
theme change; a theme override that only ever applies to one component was an
instance override; a token redefined inside a component was never a token.
STY-17 says this outright.

Two properties hold the system together:

- **Nothing is a literal.** Every colour, space, radius, duration, and z-index
  is a token (STY-1), which is what makes a single theme change reach every
  component at once.
- **Precedence comes from layers, not specificity.** Svelte's scoping attribute
  makes component CSS more specific than almost anything a consumer will write
  (STY-20). Cascade layers make the ladder in §6 true regardless.

## Model

The three mechanisms, and where each one enters:

```
  token sheet          --variant-error-fg: …        the vocabulary
       │
       ▼
  @layer showcase.base      component CSS           consumes tokens only
       │
       ▼
  @layer showcase.theme     theme.components.Panel  re-skins the library
       │                      ├─ defaultProps  ──┐
       │                      └─ overrides       │  both read through
       ▼                                         │  withDefaults()
  consumer (unlayered)      class="my-cta"       │  ── the THEME SEAM
       │                                         │
       ▼                                         │
  overrides prop            <Panel overrides={…}> ┘  one call site
```

Later wins. Note that **consumer styles beat both library layers** regardless of
specificity — that is the point of declaring the library's own CSS inside named
layers.

A **slot** is a named element inside a single component's own markup, carrying
`data-slot`. It is the addressing scheme all four styling seams share: theme
overrides key by slot, instance overrides key by slot, consumer CSS targets by
slot, and region snippets (`composition.md` COMP-10) are named for slots.
STY-7 forbids a second scheme for any of them.

## 1. Tokens

A **token** is a design decision named once and referenced as a custom property.
Tokens are the vocabulary; components are consumers of it, never authors.

**STY-1.** Every colour, space, radius, duration, z-index, and type size **MUST**
be a design token referenced as a custom property. A literal value **MUST NOT**
appear in component CSS.

```css
/* no */  color: #ff4d4d;
/* yes */ color: var(--variant-error-fg);
```

**STY-2.** An appearance axis value **MUST** resolve to a token named for the
axis and value: `--variant-<value>-*`, `--hue-<value>-*`, `--size-<value>-*`.

> *Why the naming is mandated and not just the tokenisation.* The derivable name
> is what lets a theme restyle an axis value without knowing which components
> use it. Given `appearance.md` APP-5 fixes the spelling `error`, the token
> `--variant-error-fg` is predictable from the axis alone.

**STY-3.** A component **MUST NOT** define a token. Tokens live in the token
sheet; components consume them.

> *Why.* A token defined inside a component is scoped to that component, so it
> is not a shared decision — it is a literal with a longer name, and the theme
> cannot reach it.

**STY-4.** Light and dark are token values, not component branches. A component
**MUST NOT** contain a theme conditional.

> *Why.* A conditional in one component is a theme that must be re-implemented
> in the next one, and a third theme means editing every component that has one.
> Token values make theme count a property of the sheet, not of the library.

## 2. Slots

**STY-5.** Every element a consumer may reasonably need to target **MUST** carry
a `data-slot` attribute naming it.

```svelte
<div class="panel" data-slot="root" {...rest}>
  <header data-slot="header">…</header>
  <div    data-slot="body">{@render children?.()}</div>
</div>
```

**STY-6.** Slot names **MUST** be declared as an exported union and are public
API:

```ts
export type PanelSlot = 'root' | 'header' | 'body' | 'footer';
```

**STY-7.** One slot vocabulary **MUST** serve overrides, CSS targeting, region
snippets (`composition.md` COMP-10), and test selectors. A component **MUST NOT**
maintain a second naming scheme for any of these.

> *Why this is the section's load-bearing rule.* Four addressing schemes for the
> same elements means four things to learn, four things to keep in sync, and
> four ways for a rename to half-land. One vocabulary makes a slot rename a
> single, visible, breaking change (STY-8) instead of a slow drift.

**STY-8.** Renaming or removing a slot on a `stable` component is a breaking
change under `conformance.md` CNF-12.

## 3. State attributes

Interactive state is exposed on the DOM so consumers can style against it
without the library shipping a class for every combination.

**STY-9.** Interactive state **MUST** be exposed as a `data-` attribute on the
relevant slot, not as a class: `data-disabled`, `data-open`, `data-checked`,
`data-loading`.

> *Why attributes rather than classes.* An attribute selector has specificity
> (0,1,0) and composes cleanly with the slot selector a consumer is already
> using; a state class invites the library to ship `.panel--open--disabled`
> combinations, which multiply.

**STY-10.** Axis values **MUST** be exposed on the root as `data-variant`,
`data-emphasis`, `data-size`, `data-hue`.

## 4. Theme overrides

The **theme** re-skins the library: it sets default props and style overrides
per component, per slot. A component reaches it through exactly one function —
the **theme seam** — and never touches the theme object directly.

**STY-11.** The theme **MUST** be able to set default props and style overrides
for any public component, keyed by component name and slot:

```ts
theme.components.Panel = {
  defaultProps: { emphasis: 'outline' },
  overrides: {
    root:   { padding: 'var(--space-3)' },
    header: { borderBottom: 'none' }
  }
};
```

**STY-12.** `defaultProps` **MUST** apply beneath an explicitly passed prop.
Passing a prop always wins.

**STY-13.** A theme override **MUST** only reference tokens, per STY-1.

**STY-14.** A component **MUST** read theme defaults and overrides through the
theme seam, and **MUST NOT** read the theme object directly:

```ts
export function withDefaults<T extends object>(
  name: string,
  props: T,
  fallbacks: Partial<T>
): T;
```

```svelte
<script lang="ts">
  const props: PanelProps = $props();
  const p = $derived(withDefaults('Panel', props, { variant: 'default', size: 'md' }));
</script>
```

The seam resolves, in order: an explicitly passed prop, `defaultProps`, the
component's own fallback.

> *Why a seam rather than direct reads.* One function is one place to add
> caching, one place to change the resolution order, and one thing to stub in a
> test. Fifty `getContext(themeKey)` calls are fifty.
>
> *Why it forces PROP-23.* The seam can only apply `defaultProps` if it can see
> that a prop was **absent**. A `$props()` destructure default fills the value in
> before the seam ever runs, so the seam sees a value that was passed and, per
> STY-12, correctly declines to override it. The theme default is then silently
> inert — which is why `props.md` PROP-23 forbids destructure defaults on
> themable props.

## 5. Instance overrides

An **instance override** adjusts one call site. It is the last rung of the
ladder and the narrowest: it reaches the named slot and, at most, one level
further.

**STY-15.** Every public component **MUST** accept an `overrides` prop keyed by
its slot union:

```ts
overrides?: Partial<Record<PanelSlot, CSSDeclaration>>;
```

**STY-16.** `overrides` **MUST** apply to the named slot only. *Where* a slot is
rendered by a nested part component, the parent **MUST** forward the declaration
to that part's `root` slot and **MUST NOT** forward it further. `overrides`
**MUST NOT** reach a component the consumer passed in as a snippet or child.

> *Why the one-level forward exists.* Without it, `overrides` would be inert on
> every preset — under `composition.md` COMP-1 each non-root region *is* a
> nested part, so the declaration would have nothing of the preset's own to
> land on.
>
> *Why it stops at one level.* Deeper forwarding makes an override's blast
> radius unknowable from the call site, and reaching into consumer-passed
> content means a component restyling markup it does not own.

**STY-17.** `overrides` is an adjustment, not a re-skin. A repeated override
**SHOULD** be promoted to a theme override or an axis value.

> *Why this is `SHOULD` and not `MUST`.* "Repeated" has no threshold a gate
> could check, and the right promotion target differs — three call sites wanting
> the same padding is a theme override; three wanting the same colour and border
> is probably a missing `emphasis` value.

## 6. Layers and precedence

**STY-18.** Styles **MUST** resolve in this order, later winning:

```
@layer showcase.base  <  @layer showcase.theme  <  consumer (unlayered)  <  overrides prop
```

**STY-19.** `!important` **MUST NOT** appear in component CSS.

**STY-19a.** Component base styles **MUST** be emitted inside
`@layer showcase.base`, and theme overrides inside `@layer showcase.theme`,
declared in that order. Consumer styles are unlayered and therefore win over
both regardless of specificity.

**STY-20.** A component **MUST NOT** rely on specificity for precedence.
Svelte's scoping attribute is exempt from any specificity ceiling, which
layering makes moot.

> *Why layering is not optional here.* Svelte compiles `.btn` to
> `.btn.svelte-hash` — specificity (0,2,0). A consumer's `class="my-cta"` is
> (0,1,0) and loses. Without cascade layers, every consumer override would need
> to out-specify a hash they cannot see, and the honest advice would be
> `!important` — which STY-19 forbids. Layering, not specificity, is what makes
> the ladder above true.

## 7. Layout and direction

A component styles **itself**. Its position, its outer spacing, and its width
belong to whatever is arranging it.

**STY-21.** A component **MUST NOT** set its own outer margin. Spacing between
components belongs to the parent.

> *Why.* A component that carries its own margin cannot be placed in a grid, a
> flex gap, or adjacent to itself without the consumer first cancelling the
> margin — and margin collapse makes the cancellation non-obvious.

**STY-22.** A component **MUST NOT** set its own width unless width is its
purpose. It fills what it is given.

**STY-22a.** Logical properties **MUST** be used for all inset, margin, padding,
border, and text alignment. `margin-left`, `padding-right`, `left`, and `right`
**MUST NOT** appear in component CSS.

> *Why now rather than at RTL time.* Logical properties cost nothing to adopt
> while components are being written and are a full audit of every stylesheet
> afterwards. `accessibility.md` A11Y-20 makes the same bet on the keyboard
> side, where arrow keys follow writing direction.

## 8. Layering and portals

An **overlay** is any surface that must escape its parent's stacking and
overflow context: dialog, popover, listbox, menu, tooltip, toast. All of them
render into a portal target the library provides.

**STY-25.** Every overlay **MUST** render into a portal target provided by the
library, and **MUST NOT** create its own.

> *Why a shared target.* Overlays created ad hoc land in DOM order, so which one
> covers which depends on mount order rather than on intent. One host means one
> place that owns ordering, one place that owns inertness for
> `accessibility.md` A11Y-36, and one place to mount the live region A11Y-42
> requires.

**STY-26.** Stacking **MUST** be expressed with `--z-*` tokens. A component
**MUST NOT** set a numeric `z-index`.

**STY-27.** The token sheet **MUST** define a single ordered stacking scale
covering, at minimum: raised content, sticky chrome, overlay scrim, dialog,
popover and listbox, menu, tooltip, toast.

**STY-28.** A live region required by `accessibility.md` A11Y-42 **MUST** be
mounted by the portal host at application start, not by the component that
announces into it.

> *Why.* A live region inserted at the same moment as its message is frequently
> not announced — the assistive technology must observe the region before the
> mutation to report it. Mounting at start is the only reliable form.
>
> *Status.* `alpha`. The portal host and the stacking scale are specified but
> not yet built; the ordering in STY-27 is a first pass.

## 9. Motion

**STY-23.** Every transition and animation **MUST** be disabled under
`prefers-reduced-motion: reduce`.

**STY-24.** Durations and easings **MUST** come from motion tokens.

**STY-29.** State attributes (STY-9) **MUST** be updated before an element is
removed, so an exit transition can run. Focus restore required by
`accessibility.md` A11Y-34 **MUST** happen at close, not at unmount.

> *Why the two clauses travel together.* Both are the same bug: treating
> *closed* and *unmounted* as one moment. An exit transition needs the element
> to still be present with its state attribute already flipped; focus restore
> needs to happen while the trigger is still known and before the browser has
> defaulted focus to `<body>`.

## Conformance

| Requirement | Class | Enforced by |
| --- | --- | --- |
| STY-1 – STY-4 | `advisory` | `Token lint` |
| STY-5 – STY-8 | `advisory` | `Contract generator --check` |
| STY-18 – STY-20, STY-22a | `advisory` | `Lint: layers and literals` |
| STY-9 – STY-17, STY-21, STY-22, STY-25 – STY-29 | `advisory` | — |

Ranges expand over **document order**, not numeric order (`machine-readable.md`
MRS-6). `STY-25 – STY-29` is therefore §8 and §9 entire — STY-25, STY-26,
STY-27, STY-28, STY-23, STY-24, STY-29 — because §8 was numbered after §9 was
written.

*Amended 0.4.0 — §1 was `stable` in 0.2.0 and 0.3.0 on the strength of the
`Token lint` gate. That gate is specified but **not built** (`conformance.md` §4,
Built column), which CNF-9a makes `advisory` — and an `advisory` requirement
cannot exceed `beta`. §1 is therefore `beta`, and promotes to `stable` on the
day the lint lands. Its normative text is unchanged; it is the best-enforced
section here and the first that should get a gate.*
