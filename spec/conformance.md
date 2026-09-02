<!-- markdownlint-disable MD013 -->

# Conformance

**Version:** 0.3.0 · **Binds:** the library, and this spec

| § | Section | Stability |
| --- | --- | --- |
| 1 | Tiers | `beta` |
| 2 | Required artifacts — Public | `beta` |
| 3 | Required artifacts — Internal | `beta` |
| 4 | Enforcement | `alpha` — most gates unbuilt |
| 5 | Stability and breaking changes | `beta` |
| 6 | Deprecation cycle | `beta` |
| 7 | Versioning | `beta` |
| 8 | Exceptions | `development` |

## Overview

*Non-normative.*

The other six documents say what a good component looks like. This one says who
has to be one, what they must ship to prove it, and what happens when the rules
are broken — deliberately (§8) or by a change that breaks a consumer (§§5–7).

Three ideas do most of the work.

**Tiers make the spec adoptable.** A spec that binds every component on day one
is a spec nothing conforms to, and a spec nothing conforms to gets ignored.
**Internal** is a real, permanent tier that owes only naming and typing —
enough that promotion later is cheap, little enough that a component can exist
without a demo, slots, or an a11y audit. **Public** owes everything, and is
where the guarantees live.

**Enforcement is coupled to stability, in both directions.** A requirement may
only be `stable` if something actually enforces it (CNF-9). This is deliberately
uncomfortable: it means the spec cannot promote a rule by feeling confident
about it, only by building its gate. The gate roster in §4 is therefore not a
status report — it is the spec's roadmap, and every `advisory` row is a rule the
build currently cannot hold anyone to.

**Exceptions are data.** CNF-20 requires them inline and machine-readable, not
because individual exceptions matter but because their *distribution* does. A
requirement collecting exceptions is a defect in the requirement (CNF-22), and
that signal only exists if the exceptions are countable.

## Model

### A component's path

```
   written  ──▶  INTERNAL  ──── conformance pass (CNF-3) ────▶  PUBLIC
                 owes: props §1–§8              owes: everything
                       types §1–§3              plus the 8 artifacts of CNF-5
                                                        │
                                                        ▼
                                              declares a STABILITY level
                                              development → alpha → beta
                                                        → rc → stable
                                                             │
                                        at `stable`, CNF-12 changes require §6
```

### The two stability axes, which are not the same thing

| | Applies to | Set by | Governs |
| --- | --- | --- | --- |
| **Requirement stability** | A rule in this spec | Its enforcement class (CNF-9) | Whether the rule may change |
| **Component stability** | A component | Its manifest entry (CNF-11) | Whether the component's API may change |

They meet at CNF-11's second sentence: a component **MUST NOT** be `stable`
while it still violates a `stable` requirement. Everything else about them is
independent — a `development` requirement can bind a `stable` component, and
usually does.

## 1. Tiers

Every component is exactly one tier. This section is the single normative
definition of the tiers; no other document restates it.

| Tier | Meets | Barrel export |
| --- | --- | --- |
| **Public** | The entire spec | Required |
| **Internal** | `props.md` §1–§8, `types.md` §1–§3 | Forbidden |

**CNF-1.** Tier **MUST** be declared per component in `exports.manifest.json`,
the registry that already carries editorial facts and is already gated:

```json
{ "Button": { "tier": "public" }, "CommandPalette": { "tier": "internal" } }
```

A second tier registry **MUST NOT** be introduced.

> *Why the manifest and not a new file.* Tier is an editorial fact under
> `types.md` TYP-12a — it cannot be derived from source — so it needs an
> authored home. The manifest is already authored, already gated by
> `Manifest --check`, and already the thing that decides what is exported, which
> is the decision tier most directly constrains.

**CNF-2.** *Withdrawn in 0.2.0.* Directory-granular tiers made a single
non-conforming component demote its neighbours out of the barrel, and forced the
migration into topologically ordered, directory-sized commits. Tier is per
component.

**CNF-3.** Promoting a component from Internal to Public **MUST** be a
conformance pass, reviewed against the full artifact list in §2.

**CNF-4.** An Internal component **MUST NOT** appear in a Public component's
markup. Public depends only on Public.

> *Why.* A Public component's guarantees are only as strong as what it renders.
> If a Public `Card` contains an Internal helper, then the helper's missing ARIA
> is the `Card`'s missing ARIA, and the tier means nothing. This is also what
> keeps `composition.md` COMP-1 checkable: a preset built from published parts
> is built from Public parts.

## 2. Required artifacts — Public

**CNF-5.** A Public component **MUST** ship all of:

| Artifact | Requirement |
| --- | --- |
| Component | `PascalCase.svelte`, ≤20 declared props |
| Props type | Exported `<Name>Props`, extending its root element's attributes, every prop documented |
| Slot union | Exported `<Name>Slot`, matching its `data-slot` attributes |
| Manifest entry | Tier, and the entry generating its export |
| Generated contract | Current with source, including defaults, slots, regions, signatures |
| Demo | One demo per axis value it supports |
| Unit test | Renders at default props, and at each `variant` |
| Keyboard test | Every interaction its category owes in `accessibility.md` |

**CNF-5a.** The review checklist for a Public component **MUST** include every
`review-only` requirement in the spec:

| Requirement | Check |
| --- | --- |
| `props.md` PROP-6a | No collection prop is mutated in place |
| `props.md` PROP-29 | No user-facing string is hardcoded |
| `composition.md` COMP-1 | Built only from published parts |
| `composition.md` COMP-16 | Context-dependent parts throw in dev, degrade in prod |
| `types.md` TYP-8 | JSDoc says what each prop does, not what it is typed as |
| `types.md` TYP-9a | At least one `@example`; demoed at every axis value |
| `accessibility.md` A11Y-5 | Meaning is not carried by colour alone |
| `accessibility.md` A11Y-8 | Tab order follows visual order |

*Amended 0.3.0 — 0.2.0 listed three items. The other five were `review-only` in
substance but unlisted, so CNF-9's requirement that every rule carry a class was
unsatisfied for them. Each document's own Conformance table is now the source;
this table aggregates them.*

**CNF-6.** A Public component **MUST NOT** ship without a demo. An undemoed
component is Internal.

> *Why a demo is an artifact and not documentation.* The demo is where every
> axis value is exercised, and therefore the only place a value that renders
> nothing — or renders identically to its neighbour — becomes visible. It is a
> test with a human assertion.

## 3. Required artifacts — Internal

**CNF-7.** An Internal component **MUST** meet `props.md` §1–§8 and `types.md`
§1–§3 — the naming and typing rules — and nothing else.

**CNF-8.** An Internal component **MAY** exceed the prop ceiling and **MAY**
omit demos, docs, slots, overrides, and a11y conformance.

> *Why naming and typing are the two that survive.* They are the expensive ones
> to retrofit. Adding a demo or a slot to an existing component is additive;
> renaming its props at promotion time breaks every existing call site, and by
> then there are some. Everything Internal owes is chosen to make CNF-3 cheap.

## 4. Enforcement

**CNF-9.** Every requirement **MUST** carry one enforcement class from
`README.md`: `gate`, `review-only`, or `advisory`. A requirement **MUST NOT** be
`stable` unless it is `gate` or `review-only`; an `advisory` requirement
**MUST NOT** exceed `beta`.

> *Why.* This makes the gate roster the spec's own roadmap: raising a section to
> `stable` is the same act as building its gate.
>
> *How it is discharged.* Each document ends with a **Conformance** table
> assigning a class to every requirement it defines. Those tables are normative
> for the assignment; the roster below is normative for what each gate covers.
> *(Added 0.3.0 — 0.2.0 stated CNF-9 but only three requirements carried a
> class.)*

This roster is the **single source of truth for whether a gate exists**. The
per-document Conformance tables name gates; they never restate the Built column.

| Gate | Enforces | Class | Built |
| --- | --- | --- | --- |
| Type check | `types.md` §1–§2 | `gate` | yes |
| Manifest `--check` | `types.md` §5, CNF-1 | `gate` | yes |
| Unit tests | CNF-5 | `gate` | yes |
| Keyboard tests | CNF-5, against `accessibility.md` §2–§12 | `advisory` | no |
| Token lint | `styling.md` §1, APP-26 | `advisory` | no |
| Prerender build | `types.md` §6 | `gate` | yes |
| Spec index `--check` | `machine-readable.md` §6 | `gate` | yes |
| Contract generator `--check` | `types.md` §4, COMP-11, `styling.md` §2 | `advisory` | no |
| Registry lineage `--check` | `types.md` TYP-12b | `advisory` | no |
| Lint: prop names | `props.md` §1–§5, §9 | `advisory` | no |
| Lint: axes | `appearance.md` §1–§11 | `advisory` | no |
| Lint: `$effect` callbacks | PROP-10 | `advisory` | no |
| Lint: layers and literals | `styling.md` §6, STY-22a | `advisory` | no |
| Prop-count check | COMP-5, PROP-25 | `advisory` | no |
| Duplicate-type check | APP-3, TYP-7 | `advisory` | no |
| Tier check | CNF-1, CNF-4, TYP-15, COMP-12, COMP-13 | `advisory` | no |
| API-diff gate | CNF-12 | `advisory` | no |
| Exception-marker check | CNF-20, CNF-21 | `advisory` | no |
| Playwright a11y suite | `accessibility.md` §2–§12 | `advisory` | no |
| Contrast check | A11Y-4, in every theme | `advisory` | no |
| Review checklist | CNF-5a | `review-only` | yes |

**CNF-9a.** A gate's class **MUST** be `advisory` until the gate is built.
A requirement classed `gate` **MUST** name at least one gate whose Built column
reads *yes*.

> *Why the Built column cannot be cosmetic.* `README.md` defines `advisory` as
> "its gate does not exist yet". A planned gate listed as `gate` would let a
> requirement reach `stable` on the strength of an intention, which is exactly
> the drift CNF-9 exists to prevent. `Token lint` and `Keyboard tests` are
> therefore `advisory` today, and `styling.md` §1 and `appearance.md` §10 are
> `beta` rather than `stable` as a consequence. Both promote on the day their
> gate lands, in one commit that changes both files.
>
> The `Spec index --check` gate (`machine-readable.md`) is what makes this
> table's own claims checkable rather than asserted.

**CNF-10.** A gate enforcing a `stable` requirement **MUST** fail the build.
Warnings **MUST NOT** be used for violations of `stable` requirements.

> *Why warnings are excluded.* A warning on a `stable` requirement is an
> `advisory` requirement wearing a gate's name — and CNF-9 already forbids that
> combination. A rule the build tolerates is one the codebase will accumulate
> violations of.

**CNF-10a.** The API-diff gate **MUST** compare the generated contract against
the previous release and fail on any change in a CNF-12 category to a `stable`
component.

## 5. Stability and breaking changes

**CNF-11.** A Public component's stability level **MUST** be declared in its
generated contract, drawn from the taxonomy in `README.md`. A component
**MUST NOT** be `stable` while it still violates a `stable` requirement.

**CNF-12.** These are breaking changes to a `stable` component:

- Removing or renaming a prop, slot, region snippet, or exported type
- Narrowing a prop's accepted type, or removing a union value
- Changing a callback signature or argument order
- Changing a default that alters rendered output
- Changing which element is the root

> *Why slots and regions are on this list alongside props.* Both are public API
> under `styling.md` STY-6 and `composition.md` COMP-11 — a consumer's
> `overrides` object and region snippet are keyed by them, and both break
> silently on a rename rather than failing to compile. Root element is on the
> list because `types.md` TYP-1a makes it part of the published type; that rule
> exists precisely so this one is detectable.

**CNF-13.** A breaking change to a `stable` component **MUST** follow the cycle
in §6. A component below `stable` **MAY** change without one.

**CNF-14.** Adding an optional prop, a union value, a slot, or a region is not
breaking, provided defaults preserve existing output.

> *Why the proviso is load-bearing.* An added prop whose default changes what
> renders is a changed default under CNF-12, not an addition — the additive part
> of the change is not what the consumer experiences.

## 6. Deprecation cycle

**CNF-15.** Deprecation **MUST** proceed:

1. **Announce** — mark `@deprecated` in JSDoc with the replacement named. The
   generated contract carries the marker.
2. **Warn** — the old path keeps working and logs once per session in dev.
   Minimum one minor release.
3. **Remove** — deleted in the next major.

> *Why "once per session" and why dev only.* A warning per render is noise a
> consumer filters out, which defeats the purpose; a warning in production is
> noise in *their* users' consoles for a decision they may not control yet.

**CNF-16.** A deprecation **MUST** name its replacement in a machine-readable
form the generated contract can carry. "Do not use" without an alternative
**MUST NOT** be shipped.

**CNF-17.** *Where* a rename is mechanical, a codemod **SHOULD** ship with the
announcement.

## 7. Versioning

**CNF-18.** The library is semver'd. Major covers removals under CNF-12, minor
covers additions under CNF-14, patch covers fixes that change no contract.

**CNF-19.** A spec revision that adds a requirement **MUST** bump this spec's
minor version, and **MUST NOT** retroactively fail components until the
requirement is `gate` or `review-only`.

> *Why the second clause.* Without it, adding a requirement would break every
> existing component at once, and the only way to land a new rule would be to
> land its migration in the same commit. Instead a new rule enters as
> `advisory`, is reviewed against, and starts failing builds when its gate is
> built — which is the same statement as CNF-9 from the other direction.

## 8. Exceptions

An **exception** is a deliberate, recorded violation. It is not a failure of the
spec; an unrecorded violation is.

**CNF-20.** An exception **MUST** be recorded inline, naming the requirement and
the reason:

```ts
// spec-exception: PROP-19 — mirrors the native `hidden` attribute
```

**CNF-21.** An exception without a requirement ID **MUST NOT** be accepted. The
gate reads these markers and reports them.

**CNF-22.** Exceptions **MUST** be reviewable in aggregate. A requirement
accumulating exceptions is a defect in the requirement.

> *Why the aggregate is the point.* One exception is a component with a good
> reason. Nine exceptions against the same requirement is a rule that does not
> describe the library it governs, and the correct response is to amend the
> rule — which is only possible if someone can see the nine.
>
> *Status.* `development`. The marker format is settled; nothing yet reads it,
> so CNF-21's "the gate reports them" is aspirational.

## Conformance

| Requirement | Class | Enforced by |
| --- | --- | --- |
| CNF-1 | `gate` | `Manifest --check` |
| CNF-5 | `gate` | `Unit tests`, `Keyboard tests` |
| CNF-4, CNF-11 – CNF-14 | `advisory` | `Tier check`, `API-diff gate` |
| CNF-20, CNF-21 | `advisory` | `Exception-marker check` |
| CNF-3, CNF-5a, CNF-6 – CNF-10a, CNF-15 – CNF-19, CNF-22 | `review-only` | `Review checklist` |

CNF-2 is *Withdrawn* and carries no class, per `machine-readable.md` MRS-9.

Requirements binding the spec's own process — the deprecation cycle, versioning,
the definition of the enforcement classes themselves — are `review-only` by
nature: there is no artifact for a gate to inspect.
