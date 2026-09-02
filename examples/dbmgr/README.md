# dbmgr console

The web UI for [`dbmgr`](../../../dbmgr), and the second real consumer of the
`showcase` package after [`breach`](../breach).

It is a plain Vite + Svelte app — no SvelteKit, no router, no adapter. The Go
binary serves whatever `vite build` emits from a single `//go:embed`, so the
shipped `dbmgr` is one file with no runtime asset dependency.

## Run it

```sh
# terminal 1 — the API
go run ./cmd/dbmgr ui --db-url "postgres://…"

# terminal 2 — the UI with HMR, proxying /api to the above
npm run dev            # http://localhost:5200
```

## Build it

```sh
make build-dbmgr-ui    # emits into dbmgr/ui/dist/
make build-dbmgr       # the above, then the binary
```

`vite.config.ts` writes straight into `dbmgr/ui/dist` because that is the
directory Go embeds. `emptyOutDir` is off: the directory holds a committed
`.gitkeep` without which `//go:embed all:dist` will not compile on a fresh
checkout. Output filenames are fixed, so nothing goes stale.

## Scope

Read-only. Everything that mutates schema — `plan`, `apply`, `mark-reverted` —
is a CLI verb, because a browser is the wrong place to trigger a migration.
