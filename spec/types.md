<!-- markdownlint-disable MD013 -->

# Types and Publication

**Version:** 0.3.0 · **Binds:** Public and Internal components (§1–§3)

| § | Section | Stability |
| --- | --- | --- |
| 1 | Props declaration | `beta` |
| 2 | Unions | `stable` |
| 3 | Documentation | `beta` |
| 4 | Generated contract | `beta` |
| 5 | Publication | `beta` |
| 6 | Rendering | `beta` |
| 7 | Naming | `beta` |

## Overview

*Non-normative.*

Design principle 7: **the contract is the product.** The library is read by
machines — the builder, the contract generator, the API-diff gate, an LLM
writing a page against it — as much as by people. A rule that does not survive
into the generated contract has not been kept, because nothing downstream can
see it.

This document is what makes that survival possible. It covers what a component
**declares** (§§1–3), what is **derived** from those declarations (§4), and what
a consumer can **import** (§5). §6 and §7 are the two constraints that do not
fit that arc: components must survive prerendering in Node, and names must be
predictable.

The organising idea is that **facts have exactly one home**, and everything
downstream derives rather than restates. A prop's type is declared in the props
interface and nowhere else. A component's tier is authored in the manifest and
nowhere else. Where a fact appears twice, TYP-12b requires a `--check` that
fails on disagreement — because two homes for one fact is not redundancy, it is
a pending contradiction.

## Model

### The registry lineage

Four representations of the library, each deriving from the one before:

```
   source                     the truth for everything derivable
     │  gen:api
     ▼
   generated contract         props, types, defaults, slots, regions,
     │                        signatures, root element  ── DERIVED
     │
     ├──◀── exports.manifest.json   tier, stability      ── AUTHORED
     │
     ▼
   builder registry           category, control presentation ── AUTHORED
```

**TYP-12a** draws the line: *derivable* facts are generated and must never be
hand-authored; *editorial* facts — tier, stability, builder category, control
presentation — are authored and must never be overwritten by a generator.

**TYP-12b** governs the arrows: each layer derives from or validates against the
one below, without cycles, and any fact appearing in two layers gets a `--check`
that fails on disagreement.

### What is declared where

| Fact | Home | Read by |
| --- | --- | --- |
| Prop names, types, optionality | `<Name>Props` interface | Type check, generator |
| Prop meaning | JSDoc on the prop | Generator, consumers |
| Slot names | `<Name>Slot` union | Overrides, CSS, regions, tests |
| Axis defaults | The theme seam call | Generator |
| Tier | `exports.manifest.json` | Manifest check, tier check |
| Stability | `exports.manifest.json` | API-diff gate |
| Root element | The extended attribute type | Generator, API-diff gate |

## 1. Props declaration

A component's props interface is the single declaration of its input surface. It
is **named**, **exported**, and **extends the attribute type of the element it
spreads onto**.

**TYP-1.** Props **MUST** be declared through a named, **exported** interface:

```svelte
<script lang="ts">
  export interface PanelProps extends HTMLAttributes<HTMLDivElement> {
    title?: TextOrSnippet;
    variant?: Variant;
    overrides?: Partial<Record<PanelSlot, CSSDeclaration>>;
    class?: string;
    children?: Snippet;
  }

  const props: PanelProps = $props();
  const p = $derived(withDefaults('Panel', props, { variant: 'default' }));
</script>
```

**TYP-1a.** A component that spreads `{...rest}` **MUST** extend the attribute
type of the element it spreads onto — `HTMLAttributes<E>` or the narrower
element interface — and **MUST** name that element in its generated contract.

> *Why.* Changing the root element is already a breaking change under
> `conformance.md` CNF-12, but without this rule it is an *invisible* one — the
> exported type says nothing about it, so the API-diff gate has nothing to
> compare. Extending the attribute type makes the root element part of the
> published type, and therefore diffable.

**TYP-2.** The interface **MUST** be named `<ComponentName>Props`.

**TYP-3.** An inline type literal on `$props()` **MUST NOT** be used, and
`$props()` **MUST NOT** be left unannotated.

**TYP-4.** A consumer **MUST** be able to write `import type { PanelProps }`.
`ComponentProps<typeof Panel>` **MUST NOT** be the only route to a component's
type.

> *Why.* `ComponentProps<typeof Panel>` requires importing the component to name
> its type — so a consumer writing a wrapper's signature drags the whole
> component into a module that only needed the shape. A named export is also the
> only form the generator can resolve without evaluating the component.

## 2. Unions

Every literal union in a props interface is a **named, exported, singly-declared
type**. This is the mechanism behind `appearance.md`'s closed sets: an axis is
only shared if there is exactly one declaration of it to share.

**TYP-5.** A prop typed as a literal union **MUST** reference a named exported
type. Inline unions **MUST NOT** appear in a props interface.

```ts
// no
variant?: 'default' | 'error';
// yes
variant?: Extract<Variant, 'default' | 'error'>;
```

**TYP-5a.** *Where* a prop is narrowed with `Extract`, the generated contract
**MUST** record the resolved value set, not the unresolved type expression.

> *Why.* `Extract<Variant, 'default' | 'error'>` is the right thing to *write* —
> it stays correct if `Variant` changes — and the wrong thing to *publish*. A
> consumer, a builder control, or a docs page needs the two values, not the
> expression that computes them.

**TYP-6.** A union used by more than one component **MUST** live in a shared
module: `appearance.types.ts` for axes and `TextOrSnippet`, `<domain>.types.ts`
for a family.

**TYP-7.** A union **MUST** be declared exactly once. Two declarations of one
name **MUST NOT** exist, even byte-identically.

> *Why byte-identical still counts.* The copy is not wrong today; it is wrong on
> the day the original gains a value and the copy does not. `appearance.md`
> APP-3 states the same rule for axis unions specifically.

## 3. Documentation

**TYP-8.** Every prop on a Public component **MUST** carry a JSDoc comment
stating what it does, not what it is typed as.

```ts
/** Rows to render; the `empty` region is shown when this is empty. */
rows?: Row[];
```

> *Why the distinction.* `/** The rows. */ rows?: Row[]` restates the signature
> and tells the reader nothing the type did not. The useful content is the
> behaviour around the prop — what happens when it is empty, what it interacts
> with, what it does not do.

**TYP-9.** Slot names, region snippet names, callback signatures, defaults, the
root element, tier, and stability **MUST** appear in the component's generated
contract.

**TYP-9a.** Every Public component **MUST** carry at least one `@example` usage
block, and **MUST** be demoed at every axis value it supports per
`conformance.md` CNF-5.

## 4. Generated contract

The **generated contract** is the library's public description of itself: one
machine-readable record per component, emitted by `gen:api` from source. It is
what the builder reads, what the API-diff gate compares, and what documentation
renders.

**TYP-10.** Every Public component **MUST** be covered by the generated API
contract. The generator **MUST** resolve interfaces declared in the component,
imported from a sibling module, declared as type aliases, and extended from a
base type.

> *Why the four forms are enumerated.* A generator that handles only the common
> case fails silently on the others — and a component absent from the contract
> is a component with no published description, which TYP-11 exists to make
> impossible.

**TYP-11.** A component absent from the generated contract **MUST** fail the
build. Silent omission **MUST NOT** be possible.

**TYP-12.** The generated contract **MUST** be current with source. A stale
contract **MUST** fail CI.

**TYP-12a.** Facts derivable from source — props, types, defaults, slots,
regions, signatures — **MUST** be generated and **MUST NOT** be hand-authored.
Editorial facts — tier, stability, builder category, control presentation —
**MUST** be authored in `exports.manifest.json` or `builder/registry.ts` and
**MUST NOT** be overwritten by a generator.

> *Why both halves are needed.* A hand-authored derivable fact goes stale. A
> generated editorial fact is a decision nobody made — a generator cannot know
> that a component is deliberately Internal, and will happily promote it.

**TYP-12b.** Each registry **MUST** derive from, or validate against, the layer
below it without cycles: source → generated contract → export manifest →
builder registry. *Where* a fact appears in more than one registry, a `--check`
mode **MUST** fail on disagreement.

## 5. Publication

The **barrel** is the public API. Everything importable is exported from it;
nothing importable is reachable any other way.

**TYP-13.** The barrel is the public API. A consumer **MUST** be able to import
every Public component and every type it exposes from the package root.

**TYP-14.** Deep imports into `src/lib/**` are unsupported. A Public component
**MUST NOT** require one.

> *Why deep imports are forbidden rather than merely discouraged.* Every deep
> import is a consumer depending on the file layout, which freezes it —
> `conformance.md` CNF-12 does not list "moved a file" as breaking precisely
> because the barrel is supposed to make it not breaking.

**TYP-15.** An Internal component **MUST NOT** be exported from the barrel.

**TYP-16.** The export manifest **MUST** reference only files that exist, and
**MUST** list every Public component with its tier. Drift in either direction
**MUST** fail CI.

**TYP-17.** Every exported component **MUST** export its `Props` interface, its
`Slot` union, and any structural union it defines.

> *Why all three.* Each is something a consumer must be able to name: `Props` to
> type a wrapper, `Slot` to type an `overrides` object, the structural union to
> type a variable they pass in. A component exporting only itself forces
> consumers to re-declare types the library already has.

## 6. Rendering

`adapter-static` prerenders every route at build time, so **every component
executes in Node** before it ever executes in a browser.

**TYP-21.** A component **MUST NOT** read `window`, `document`, `matchMedia`,
`localStorage`, or any other browser global during initialisation.

> *Why this is a build failure and not a runtime one.* A browser global read at
> init throws during prerender, which fails `make build-ui` — not the browser,
> and not a test. The failure is loud, but it arrives at the wrong end of the
> loop, so the rule is stated rather than left to be discovered.

**TYP-22.** A component whose rendering depends on a browser measurement
**MUST** render a deterministic pre-hydration fallback and refine it in
`$effect`.

> *Why "deterministic".* The prerendered HTML and the first client render must
> agree or hydration mismatches. A fallback that depends on anything varying
> between build and load — a random id, a timestamp, a locale-formatted date —
> is not a fallback.

**TYP-23.** An icon **MUST** be accepted as a `Snippet` or a token name from the
icon registry. An icon **MUST NOT** be passed as a raw string of markup, and
**MUST NOT** be nested inside a data object with a callback per `props.md`
PROP-17.

> *Why raw markup is excluded.* Rendering a caller-supplied string as markup is
> an injection seam, and an icon passed that way carries no type, no size
> binding, and nothing the theme can reach.

## 7. Naming

**TYP-18.** Component files **MUST** be `PascalCase.svelte` and match the
exported name.

**TYP-19.** A family's part components **MUST** be exported as one namespace
object named for the family, per `composition.md` COMP-2.

**TYP-20.** Type names **MUST** be `PascalCase` and suffixed by role: `Props`,
`Slot`, `Type`, `Item`, `Row`, `Option`.

> *Why suffixed by role.* The suffix is what makes a type's job predictable
> without opening it, and what lets the generator and the tier check find types
> by convention — `<Name>Props` and `<Name>Slot` are looked up by name, not
> discovered.

## Conformance

| Requirement | Class | Enforced by |
| --- | --- | --- |
| TYP-1 – TYP-7 | `gate` | `Type check`, `Duplicate-type check` |
| TYP-13 – TYP-17 | `gate` | `Manifest --check` |
| TYP-21, TYP-22 | `gate` | `Prerender build` |
| TYP-9, TYP-10 – TYP-12a | `advisory` | `Contract generator --check` |
| TYP-12b | `advisory` | `Registry lineage --check` |
| TYP-8, TYP-9a | `review-only` | `Review checklist` |
| TYP-18 – TYP-20, TYP-23 | `advisory` | — |

A requirement carries exactly one **class** but may be covered by more than one
**gate**: TYP-7 is enforced by `Type check` within a module and by
`Duplicate-type check` across modules.

§2 is `stable` because `Type check` — a gate that exists and fails the build —
enforces it. TYP-8 and TYP-9a are `review-only` because a tool can check that a
JSDoc comment *exists* but not that it says what the prop does rather than what
it is typed as.
