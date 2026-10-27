# compose — declared micro-frontend composition

`compose` serves several separately-built single-page apps from one process,
deciding per request which app answers, and refusing in a way that does not
reveal what else was compiled in.

## The dependency rule is the contract

The engine imports **the Go standard library and a YAML decoder. Nothing else.**

Specifically it must not import:

- a web framework (`gin`, `chi`, `echo`, …) — it is a plain `http.Handler`, and
  the host adapts it at its own edge with one line
- a Kubernetes client — everything cluster-aware lives behind `RuleSource`
- a policy engine (`cel-go`, OPA, …) — the rule vocabulary is closed and named,
  which is what lets `Validate` answer "is this rule set satisfiable" at all
- anything under `github.com/ArmornetIO/armornet`

This is why `compose` is a separate Go module rather than a package inside
armornet: the rule is negative, and a package in the main module would satisfy
it today and silently accrete imports tomorrow. `deps_test.go` checks it on
every run, so the boundary is enforced rather than aspirational.

The host supplies what the engine deliberately lacks: framework adaptation,
caller identity as an opaque `Principal`, its own trait families
(`entitled`, `role`, `fga`), and any rule source that is not a file.

## What it does not decide

`compose` decides **which app answers, and whether this caller may see it.**
It does not decide who the caller is, what they are entitled to, or where rules
come from. Those are host responsibilities reached through `PrincipalFunc`,
`RegisterTrait` and `RuleSource` respectively — which is also what makes the
standalone CLI (`cmd/compose`) able to serve the same manifest with no product
code present.

## Build check

Every app has a build id: a short hash of its raw shell, taken once at
construction and before the host's `Shell` hook, so every replica of one image
agrees. It goes into each page the app serves as
`<meta name="compose-build" content="…">` (`BuildMeta`) and onto each HTML
response as `X-Compose-Build` (`BuildHeader`).

A tab still running an old bundle keeps the old meta while the server answers
with the new header. `buildWatch` in the showcase library does the comparison:
`start()` polls every five minutes and when the tab is shown again, `stale`
flips once they differ, and `check()` asks on demand, for example before joining
a BREACH match. It works for SvelteKit and plain Vite apps alike; under a dev
server there is no meta, so nothing is ever stale. The demo is
`/showcase/build-watch`.

Known gap: a deploy that changes only an unfingerprinted file (`static/`,
`public/`) keeps the same shell, so the id does not change.

## Dev tools

Give a handler the dev console bundle (`HandlerOptions.DevTools`, usually
`devcog.FS()`) and, for that handler only:

- every page it renders boots the console: `DevToolsTag()` is injected after
  the host's own `Shell` hook, and only once (`InjectDevTools` is idempotent,
  because a dev front door may inject into the same page again);
- `DevNamespace` (`/_compose/`) answers `devcog.js` (never cached) and
  `apps.json`: the apps this caller can reach on this hostname, which is
  `Resolve` asked for every app at once.

Nil means none of it exists; the host decides when it is development. The
bundle is built from `showcase/src/lib/devcog` by `devcog/vite.config.ts`, and
`devcog/dist/.gitkeep` keeps the embed compilable before that has run.

```sh
compose serve --root . --rules visibility.yaml --devtools
```
