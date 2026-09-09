package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"os"

	"github.com/ArmornetIO/showcase/compose"
)

// runPrint writes the manifest with every default and derivation applied.
//
// This matters more than it looks. A default that exists only inside a struct
// literal is how you get "it works on my machine": nobody can see what the
// build system will actually do until it does it. Printing the resolved form
// makes the asset namespaces, the build directories and the listener
// assignments inspectable — and it is the artifact the generator's enforcement
// test diffs against, so a hand-edited constant somewhere downstream fails a
// test rather than surviving into a release.
func runPrint(args []string) error {
	fs := flag.NewFlagSet("print", flag.ExitOnError)
	manifest := fs.String("manifest", "apps.yaml", "path to the app manifest")
	resolved := fs.Bool("resolved", false, "apply defaults and derivations")
	if err := fs.Parse(args); err != nil {
		return err
	}

	f, err := os.Open(*manifest)
	if err != nil {
		return fmt.Errorf("opening %s: %w", *manifest, err)
	}
	defer f.Close()

	m, err := compose.DecodeManifest(f)
	if err != nil {
		return fmt.Errorf("%s: %w", *manifest, err)
	}

	if !*resolved {
		// There is no un-resolved mode worth printing: the authored form is the
		// file the caller already has. Refusing is more useful than echoing it.
		return fmt.Errorf("nothing to print without --resolved; the authored form is %s itself", *manifest)
	}
	enc := json.NewEncoder(os.Stdout)
	enc.SetIndent("", "  ")
	return enc.Encode(m.Resolve())
}
