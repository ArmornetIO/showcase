# dbmgr console

The web UI for [`dbmgr`](https://github.com/ArmornetIO/dbmgr), and the second real consumer of the
`showcase` package after [`breach`](../breach).

It is a plain Vite + Svelte app — no SvelteKit, no router, no adapter. The Go
binary serves whatever `vite build` emits from a single `//go:embed`, so the
shipped `dbmgr` is one file with no runtime asset dependency.

## Run it

```sh
# terminal 1 — the API, from a dbmgr checkout
go run ./cmd/dbmgr ui --db-url "postgres://…"

# terminal 2 — the UI with HMR, proxying /api to the above
npm run dev            # http://localhost:5200
```

## Build it

```sh
DBMGR_UI_DIST=/path/to/dbmgr/ui/dist npm run build
```

`vite.config.ts` writes straight into `DBMGR_UI_DIST` because that is the
directory Go embeds (unset, it builds into a local `dist/`). `emptyOutDir` is off: the directory holds a committed
`.gitkeep` without which `//go:embed all:dist` will not compile on a fresh
checkout. Output filenames are fixed, so nothing goes stale.

## Scope

Read-only. Everything that mutates schema — `plan`, `apply`, `mark-reverted` —
is a CLI verb, because a browser is the wrong place to trigger a migration.
