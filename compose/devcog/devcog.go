// Package devcog embeds the dev console bundle compose injects into every page
// in development (see compose.HandlerOptions.DevTools).
//
// Its own package so a host that never turns dev tools on can leave it
// unimported, and the bundle then never enters the binary.
//
// The bundle is built from showcase/src/lib/devcog by this directory's
// vite.config.ts. dist/ is build output; the committed .gitkeep beside it is
// what keeps the embed directive compilable on a tree that has never been built.
package devcog

import (
	"embed"
	"io/fs"

	"github.com/ArmornetIO/showcase/compose"
)

//go:embed all:dist
var dist embed.FS

// FS returns the bundle, built or not. Unbuilt, compose still serves the app
// index and injects nothing; check Built to report that.
func FS() fs.FS {
	sub, err := fs.Sub(dist, "dist")
	if err != nil {
		// "dist" is the embed directive's own constant, so this is unreachable.
		panic(err)
	}
	return sub
}

// Built reports whether the console script was built into this binary — a
// host should say so when it is not, since pages then quietly have no console.
func Built() bool {
	_, err := fs.Stat(FS(), compose.DevScript)
	return err == nil
}
