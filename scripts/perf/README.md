# perf/ — comparing two builds

```sh
npm run perf:compare -- \
  --scenario=marketing-hero \
  --target="stage=http://127.0.0.1:5401" \
  --target="dev=http://127.0.0.1:5402" \
  --repeats=3
```

Four files and a scenario directory:

| | |
|---|---|
| `probe.js` | the page-side agent, **injected** with `addInitScript` |
| `run.mjs` | one target, one scenario → one result object |
| `compare.mjs` | N targets, interleaved and repeated → a table and a verdict |
| `attribute.mjs` | one target, one longtask → the function on the stack |
| `../../perf-scenarios/*.mjs` | what to measure, as data |

## The one idea

**Nothing is compiled into the build under test.** The project's headline metric
used to be read out of `globalThis.__hitch`, which exists only because
`src/lib/perf/hitch-watch.ts` was bundled — and that file is not on `main`, so it
is not in any deployed image. The number every performance decision was justified
by could not be taken against the build users were looking at.

An instrument you have to ship in advance can only measure builds you already
thought to measure. This one injects, so it runs against a container pulled from
a registry, a static bundle in a temp directory, or a dev server, with no
cooperation from any of them.

`hitch-watch` still earns its place: its `beat()` tags are a loop naming itself,
which no injected script can fake. When the page has it, both run, and the report
says so.

## Two rules that are not configurable

**Interleaved, never batched.** Targets run A,B,A,B. A laptop that warms up or a
fan that spins late turns A,A,B,B into "B is slower", and that conclusion is
indistinguishable from a real regression.

**The noise band is measured, not remembered.** The spread across a target's own
repeats *is* the band, and a delta inside it prints as `noise`. A perf tool that
cannot say "no difference" will find a difference every time it is run.

## Writing a scenario

Selectors may be a **list**, first match wins. This is not a convenience: element
names drift across the versions this exists to compare — the marketing board's
section went `#game` → `#showcase`, and the hero's globe went from an SVG to a
`canvas.gs`. A single hardcoded selector scrolls one build nowhere and then
reports it as calm. `expectSelector` matching nothing is a hard failure, which is
what stops a redirect-to-login from being measured as a very fast page.

Assert on the **container**, not on the thing that changed. If you assert on the
canvas, you have asserted that the two builds render the same way, which is the
question rather than the premise.

## Reading the output

`worstFrame` carries `atSec` and the overlapping `longtask`, because "there was a
600ms frame" is a complaint and "there was a 600ms frame at t+9.7s with a 260ms
longtask under it" is a diagnosis. No longtask means the main thread was idle
through it and the cost was the collector, the compositor or the driver.

`forced-layout reads/frame` is a **count, not a cost**. The first
`getBoundingClientRect` after a DOM mutation pays the whole layout and the rest
are nearly free — halving this number has been measured to halve nothing. It is
here to point at a caller.

## Naming the function under a spike

`compare.mjs` says a 250 ms task happened; `attribute.mjs` says what was on the
stack.

```sh
npm run perf:attribute -- \
  --scenario=marketing-mesh-cluster \
  --url=http://127.0.0.1:5533
```

**It takes the same `--scenario` as `compare.mjs`, and for the same reason.**
Viewport, path, scroll target, settle and hold are read out of
`perf-scenarios/`, not re-typed here — a driver carrying its own copy profiles a
page adjacent to the one the comparison convicted, and the two then disagree
about a spike neither can reproduce. `expectSelector` is asserted here too, so a
redirect to the login page fails loudly instead of profiling a very calm empty
document. Only `--hold` may be overridden, because a profile is heavier than a
measurement.

The window is the whole difficulty. A one-shot task is ~1.5% of a 15-second
profile and reads as noise, and a short window opened at the scroll catches
steady state instead — the task that led to this script fired *twelve seconds*
after the scroll that caused it. So it profiles the entire hold at 60 µs, asks
the page's own `PerformanceObserver` when the longtask was, and slices the
samples to it afterwards. The window is positioned by measurement, not by guess.

Build with `--minify false` or the stacks are single letters. And **confirm the
server is serving the build you just made** — stale `python -m http.server`
instances have been found squatting these ports, and a fix measured against a
stale bundle reproduces the bug perfectly.

## Standing up two targets

Both sides are the armornet binary serving its own embedded UI, so two versions
is two servers on two ports. For a front-end comparison the static bundle is
enough:

```sh
git worktree add --detach /tmp/perf-a <sha>
ln -s "$PWD/../app-ui/node_modules" /tmp/perf-a/app-ui/node_modules
ln -s "$PWD/node_modules"           /tmp/perf-a/showcase/node_modules
cd /tmp/perf-a && make generate-appui-assets   # app-ui/src/lib/generated is gitignored
cd /tmp/perf-a/showcase && npx svelte-kit sync
cd /tmp/perf-a/app-ui   && npx svelte-kit sync && npx vite build
```

`showcase` resolves through a path alias relative to `app-ui` (see
`app-ui/svelte.config.js`), so a worktree builds against **its own** showcase —
sharing `node_modules` does not leak the current checkout's library in. Confirm
`package.json` and the lockfiles match between the two commits before symlinking.

When the whole server matters rather than the bundle, run the images instead: the
Dockerfile is `ENTRYPOINT ["/armornet"]`, so `docker run <image> model init
--db-url …` migrates a database with that image's own registry. Give each side
its **own** database — see `specs/009-perf-ab-harness/spec.md` for why sharing one
is only safe for migrations you have personally audited.
