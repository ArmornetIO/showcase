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
