<!-- markdownlint-disable MD013 -->

# Accessibility

**Version:** 0.3.0 · **Binds:** Public components

| § | Section | Stability |
| --- | --- | --- |
| 1 | Universal | `beta` |
| 2 | Control | `beta` |
| 3 | Input | `beta` |
| 4 | Choice — roving tabindex | `beta` |
| 5 | Listbox and Combobox | `beta` |
| 6 | Toggle | `beta` |
| 7 | Disclosure | `beta` |
| 8 | Dialog | `beta` |
| 9 | Menu | `beta` |
| 10 | Feedback | `alpha` |
| 11 | Display | `alpha` |
| 12 | Navigation | `alpha` |

## Overview

*Non-normative.*

A component that cannot be operated without a pointer is not finished. That is
design principle 6, and this document is what it costs.

The document is organised by **category** rather than by component, because
accessibility contracts are properties of *behaviour*, not of names. Anything
that opens a surface over the page and traps focus owes the Dialog contract,
whether it is called `Modal`, `SheetDrawer`, or `SelectionModal`. Anything that
presents a set of mutually exclusive choices along an axis owes the Choice
contract, whether it is `Tabs` or `SegmentGroup`.

None of these contracts are invented here. They restate settled ARIA Authoring
Practices. What this document adds is the **assignment** — a single place that
says which category each component is in, so the obligation is discoverable
before the component is written rather than after an audit.

**What is `beta` and what is not.** The contracts themselves are settled
practice. Which component sits in which category is not yet fixed, and §§10–12
are `alpha` because those three categories have the loosest boundaries — a chart
and a data table have little in common beyond neither being interactive.

## Model

**Every public component belongs to exactly one category** and owes that
category's contract plus §1, which binds all of them.

Pick the category by behaviour, in this order — the first match wins:

| Ask | If yes | § |
| --- | --- | --- |
| Does it open a surface that traps focus and makes the page behind inert? | Dialog | 8 |
| Does it open a surface of **commands** only? | Menu | 9 |
| Does it open a surface of **options** you pick a value from? | Listbox / Combobox | 5 |
| Does it expand and collapse content in place? | Disclosure | 7 |
| Does it present mutually exclusive choices along a visual axis? | Choice | 4 |
| Does it flip a binary state? | Toggle | 6 |
| Does it accept typed text? | Input | 3 |
| Is it a single actionable thing? | Control | 2 |
| Does it announce something the user did not initiate? | Feedback | 10 |
| Does it navigate between pages or views? | Navigation | 12 |
| Otherwise — it presents information. | Display | 11 |

### The two focus patterns

The single most common implementation error in this document is using the wrong
one. They are not interchangeable, and §5 says so normatively.

| | **Roving tabindex** (§4) | **`aria-activedescendant`** (§5) |
| --- | --- | --- |
| DOM focus | Moves to the active option | Stays on the trigger or input |
| Tab stops | The group is one stop | The trigger is the stop |
| Active option marked by | Being focused | `aria-activedescendant` pointing at its id |
| Use when | The options *are* the control — `Tabs`, `RadioList` | The user is typing or the options are in a popup — `Select`, `Combobox` |

The dividing question is whether DOM focus can afford to leave the element the
user is interacting with. In a combobox it cannot: focus must stay in the input
so typing keeps working, so the active option is tracked by reference instead.

## 1. Universal

These bind every public component in every category.

**A11Y-1.** Every interactive element **MUST** be reachable and operable by
keyboard alone.

**A11Y-2.** Every focusable element **MUST** show a visible focus indicator
meeting 3:1 contrast against its adjacent background. `outline: none` without a
replacement **MUST NOT** appear.

**A11Y-3.** Every control **MUST** have an accessible name, from `label`, a
visible `<label>` association, or `aria-label` where no visible text exists.

**A11Y-4.** Text **MUST** meet 4.5:1 contrast, and non-text UI indicators 3:1,
in every theme.

> *Why "in every theme" is the operative clause.* Contrast is a property of a
> token pair, not of a component. `styling.md` STY-4 makes light and dark token
> values rather than component branches, which is what makes checking every
> theme tractable — but also means a token change can break contrast in a theme
> nobody was looking at.

**A11Y-5.** Meaning **MUST NOT** be carried by colour alone. A `variant` **MUST**
be accompanied by text, an icon, or a shape difference.

> *Why this lands on `variant` specifically.* `variant` is the axis that carries
> meaning (`appearance.md` §2) — it is the only one a user is entitled to
> perceive. `hue` carries none, which is exactly why APP-17 keeps it off
> components where a reader would interpret colour as state.

**A11Y-6.** Focus **MUST NOT** be moved on render. A component **MAY** move
focus in response to a user-initiated open — Dialog, Menu, Listbox, Combobox —
and **MUST** restore it to the trigger on close.

> *Why the distinction is "user-initiated".* Focus movement is only ever
> acceptable as a response to something the user just did. A component that
> grabs focus when it mounts steals it from wherever the user actually was —
> which on a page that mounts components asynchronously is unpredictable.

**A11Y-7.** A decorative element **MUST** be `aria-hidden="true"`.

**A11Y-8.** Tab order **MUST** follow visual order. Positive `tabindex` values
**MUST NOT** be used.

## 2. Control — `Button`, `IconButton`, `Chip` (actionable)

A **Control** is a single actionable thing: press it, something happens. It has
no state of its own beyond disabled and loading.

| | |
| --- | --- |
| **A11Y-9** | **MUST** be a `<button>`, or `<a>` when `href` is set |
| **A11Y-10** | **MUST** activate on <kbd>Enter</kbd> and <kbd>Space</kbd> |
| **A11Y-11** | Icon-only controls **MUST** have `aria-label` |
| **A11Y-12** | `loading` **MUST** set `aria-busy`, **MUST** remain focusable, and **MUST** suppress activation |
| **A11Y-13** | `disabled` **MUST** use the native attribute, not `aria-disabled` alone |
| **A11Y-13a** | The reason a control is disabled **MUST** be conveyed by adjacent text, not by a tooltip on the disabled element |

> *Why A11Y-12 keeps a loading control focusable.* Removing it from the tab order
> mid-interaction moves the user's focus without their asking, violating A11Y-6.
> `aria-busy` plus suppressed activation says "wait" without moving anything.
>
> *Cost of A11Y-13, accepted.* A natively disabled control leaves the tab order,
> so a keyboard user cannot land on it to discover why it is unavailable. The
> alternative — `aria-disabled` on a focusable element — requires every such
> control to suppress its own activation correctly, and one that forgets is a
> button that silently does the thing it claimed not to. A11Y-13a is what keeps
> the accepted cost honest: the reason must be readable without focusing it.

## 3. Input — `Input`, `Textarea`, `PasswordInput`, `SearchInput`

An **Input** accepts typed text. Its contract is mostly about wiring the four
content props in `props.md` §1 to the right ARIA relationships.

| | |
| --- | --- |
| **A11Y-14** | **MUST** associate `label` with the control via `for`/`id` |
| **A11Y-15** | `description` **MUST** be linked with `aria-describedby` |
| **A11Y-16** | A present `error` **MUST** set `aria-invalid` |
| **A11Y-17** | `error` **MUST** be in a live region, linked by `aria-errormessage` |
| **A11Y-18** | `required` **MUST** use the native attribute |

> *Why `description` and `error` are wired differently.* `description` is
> standing help text — it should be read once, when the field is reached.
> `error` arrives after the fact and must be announced when it appears, which
> needs a live region. This is the accessibility reason `props.md` PROP-4a keeps
> them as two props rather than one.

## 4. Choice — roving tabindex

`Tabs`, `RadioList`, `SegmentGroup`, `ViewToggle`.

A **Choice** presents mutually exclusive options along a visual axis, all
visible at once. The whole group is one tab stop; arrows move within it.

| | |
| --- | --- |
| **A11Y-19** | The group **MUST** be one tab stop, with a roving `tabindex` |
| **A11Y-20** | Arrow keys **MUST** move between options along the visual axis, following writing direction — in RTL, <kbd>←</kbd> moves forward |
| **A11Y-21** | <kbd>Home</kbd>/<kbd>End</kbd> **MUST** jump to first/last |
| **A11Y-22** | Selection **MUST** carry `aria-selected` or `aria-checked` |
| **A11Y-23** | Tabs **MUST** link each tab to its panel with `aria-controls` |

> *Why one tab stop.* A ten-tab bar that is ten tab stops means a keyboard user
> tabs ten times to get past it. Arrow-key navigation within a single stop is
> the pattern every native equivalent uses, and it is what A11Y-19 buys.

## 5. Listbox and Combobox — `aria-activedescendant`

`Select`, `Combobox`, `CommandPalette`, and any typeahead.

DOM focus stays on the trigger or input; the active option is tracked with
`aria-activedescendant`. This is a different pattern from §4 and **MUST NOT** be
implemented with a roving `tabindex`.

| | |
| --- | --- |
| **A11Y-24** | <kbd>Esc</kbd> **MUST** close and restore focus to the trigger |
| **A11Y-51** | The popup **MUST** be `role="listbox"` with `role="option"` children |
| **A11Y-52** | The trigger or input **MUST** carry `aria-expanded`, `aria-controls`, and `aria-activedescendant` |
| **A11Y-53** | A combobox input **MUST** be `role="combobox"`. It **MUST NOT** be placed inside a `role="menu"` |
| **A11Y-54** | <kbd>↑</kbd><kbd>↓</kbd> **MUST** move the active option without moving DOM focus |
| **A11Y-55** | The active option **MUST** be scrolled into view |
| **A11Y-56** | Result-count changes **MUST** be announced through a live region |

> *Why A11Y-53's second sentence exists.* A search box inside a dropdown is the
> most common way this goes wrong: `role="menu"` promises commands, and a text
> input inside one is invalid — screen readers in menu mode intercept the
> keystrokes the user is trying to type. A surface with a text input is a
> combobox, and §9 says the same thing from the Menu side.
>
> *Why A11Y-55 is a requirement and not a nicety.* With DOM focus staying put,
> the browser does no scrolling of its own. Without an explicit
> `scrollIntoView`, arrowing past the tenth option moves an active marker the
> user cannot see.

## 6. Toggle — `Checkbox`, `Toggle`, `SettingRow`

| | |
| --- | --- |
| **A11Y-25** | **MUST** expose `role="switch"` or a native checkbox |
| **A11Y-26** | <kbd>Space</kbd> **MUST** toggle |
| **A11Y-27** | Indeterminate state **MUST** set `aria-checked="mixed"` |

## 7. Disclosure — `Panel`, `Accordion`, `FaqAccordion`, non-modal drawers

A **Disclosure** expands and collapses content in place. It does not trap focus
and does not make the rest of the page inert — that is a Dialog (§8).

| | |
| --- | --- |
| **A11Y-28** | The trigger **MUST** carry `aria-expanded` and `aria-controls` |
| **A11Y-29** | <kbd>Enter</kbd> and <kbd>Space</kbd> **MUST** toggle |
| **A11Y-30** | Collapsed content **MUST** be removed or `hidden`, never merely invisible |

> *Why A11Y-30 names the failure mode.* `opacity: 0`, `height: 0` with
> `overflow: hidden`, and `visibility` left visible all hide content from sight
> while leaving it focusable — so a keyboard user tabs into a collapsed panel
> and lands somewhere invisible. `styling.md` STY-29 is the constraint on the
> other side: flip the state attribute before removal so the exit transition can
> still run.

## 8. Dialog — `Modal`, `SheetDrawer`, `SelectionModal`, `NavDrawer`

A **Dialog** opens a surface over the page, takes focus, and makes everything
behind it inert. Focus trapping is the defining property; a surface that does
not trap focus belongs to §5, §7, or §9.

| | |
| --- | --- |
| **A11Y-31** | **MUST** have `role="dialog"` and `aria-modal="true"` |
| **A11Y-32** | **MUST** be named by its own `title` via `aria-labelledby` |
| **A11Y-33** | **MUST** trap focus while open |
| **A11Y-34** | **MUST** move focus in on open and restore it to the trigger on close |
| **A11Y-35** | <kbd>Esc</kbd> **MUST** close |
| **A11Y-36** | Background content **MUST** be inert |

> *Why A11Y-36 is separate from A11Y-33.* A focus trap stops <kbd>Tab</kbd> from
> leaving. It does not stop a screen reader's virtual cursor, which reads the
> DOM rather than following focus — so without `inert`, the content behind the
> dialog remains fully readable and the dialog is not modal in any sense that
> matters. `styling.md` STY-25 puts the portal host in charge of applying it.

## 9. Menu — `ActionsMenu`, `PageContextMenu`, `ExportMenu`

A **Menu** contains commands only. A surface containing a text input is a
combobox and belongs to §5.

| | |
| --- | --- |
| **A11Y-37** | **MUST** use `role="menu"` with `role="menuitem"` children |
| **A11Y-38** | <kbd>↑</kbd><kbd>↓</kbd> **MUST** move, <kbd>Esc</kbd> **MUST** close and restore focus |
| **A11Y-39** | The trigger **MUST** carry `aria-haspopup` and `aria-expanded` |
| **A11Y-40** | Opening **MUST** focus the first item; the menu **MUST** wrap |

## 10. Feedback — `AlertBlade`, `Toast`, `DangerBanner`, progress

**Feedback** announces something the user did not directly initiate. Its whole
contract is about being *noticed* — which means the live region must already
exist when the message arrives.

| | |
| --- | --- |
| **A11Y-41** | An urgent message **MUST** use `role="alert"`; a passive one `role="status"` |
| **A11Y-42** | A live region **MUST** exist in the DOM before the message arrives, mounted per `styling.md` STY-28 |
| **A11Y-43** | Determinate progress **MUST** set `role="progressbar"` with `aria-valuenow`/`min`/`max` |
| **A11Y-44** | Indeterminate progress **MUST** omit `aria-valuenow` |
| **A11Y-45** | An auto-dismissing message **MUST** be dismissible by keyboard and **MUST NOT** be the only delivery of critical information |

> *Why A11Y-45 has two clauses.* A toast that vanishes on a timer is a message
> the user may never have finished reading, and one they cannot get back. Making
> it keyboard-dismissible handles the user who *did* read it; the second clause
> concedes that anything important needs a second, persistent home.
>
> *Status.* `alpha`. The category is right, but the boundary with §11 — where a
> persistent inline error lives — is not yet settled.

## 11. Display — `Card`, `DataTable`, `Timeline`, charts

**Display** components present information. They are not interactive as a
category, but many contain interactive parts, which owe their own category's
contract.

| | |
| --- | --- |
| **A11Y-46** | A table **MUST** use `<table>` semantics with scoped headers |
| **A11Y-47** | A sortable column header **MUST** carry `aria-sort` and be a button |
| **A11Y-48** | A whole-card click target **MUST** be a real link or button, not a `div` handler |
| **A11Y-49** | A chart **MUST** provide a text alternative — caption, summary, or an accessible data table |
| **A11Y-50** | A tooltip **MUST** be reachable on focus, not hover alone |
| **A11Y-57** | A virtualised collection **MUST** set `aria-rowcount`/`aria-rowindex` (or `aria-setsize`/`aria-posinset`) reflecting the full set, not the rendered window |

> *Why A11Y-57 says "the full set".* Virtualisation renders a window of maybe
> thirty rows out of ten thousand. Left alone, assistive technology reports
> "row 4 of 30" — the user believes they have reached the end of a list they are
> 0.3% into. The ARIA attributes are the only way to describe the set that
> actually exists.
>
> *Status.* `alpha`. Charts in particular are underspecified: A11Y-49 accepts
> three alternatives without saying when each is adequate.

## 12. Navigation

| | |
| --- | --- |
| **A11Y-58** | On client-side navigation, focus **MUST** move to the main landmark or the new page heading |
| **A11Y-59** | On client-side navigation, the new page title **MUST** be announced through a live region |
| **A11Y-60** | A skip-to-content link **MUST** be the first focusable element of the application shell |

> *Why §12 exists at all in a component spec.* A client-side route change is the
> one navigation the browser does not narrate. Nothing announces, and focus
> stays on the link that was clicked — which is now gone. These three
> requirements are the application shell's share of the contract, and they bind
> the shell components the library ships.
>
> *Status.* `alpha`. A11Y-58's choice between "main landmark" and "page heading"
> is unresolved; both are defensible and the library should pick one.

## Conformance

| Requirement | Class | Enforced by |
| --- | --- | --- |
| A11Y-4 | `advisory` | `Contrast check` |
| A11Y-1 – A11Y-3, A11Y-6, A11Y-7, A11Y-9 – A11Y-60 | `advisory` | `Playwright a11y suite`, `Keyboard tests` |
| A11Y-5, A11Y-8 | `review-only` | `Review checklist` |

Per `conformance.md` CNF-5, a Public component additionally ships a **keyboard
test** covering every interaction its category owes. That test is a `gate`; the
requirements above are what it is written against.

A11Y-5 and A11Y-8 are `review-only` because neither is mechanically decidable: a
tool cannot tell whether an icon distinguishes a variant meaningfully, and
cannot compare DOM order to *visual* order once CSS has reordered it.
