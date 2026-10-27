# roadmap

Armornet's product roadmap as a month-by-month Gantt: one row per pillar, one
card per item, and the release train across the top. A plain Vite + Svelte app
on the `showcase` package, like [`breach`](../breach) and [`dbmgr`](../dbmgr),
mounted at `/roadmap`.

## Where the data comes from

`roadmap.gen.json` is generated. Edit the YAML in `docs/roadmap/` in the
armornet repo — a folder per pillar, a file per item — then:

```sh
go run ./cmd/roadmapgen          # rewrite roadmap.gen.json
go run ./cmd/roadmapgen -check   # fail if it is stale (also a Go test)
```

The generator decodes strictly and refuses a misspelled field, an unknown
release, a `depends_on` naming no item, and a shipped item with open work. See
`docs/roadmap/README.md` for the item format.

## Run it

```sh
npm run dev      # http://localhost:5699
npm run check
```

`model.ts` turns the JSON into what `Roadmap.svelte` draws and runs the plan's
checks. `buildRoadmap` takes optional extra tracks, which is how armornet's
unpublished mockup adds its business and marketing views to the same page.
