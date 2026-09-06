// Command compose runs the micro-frontend composition engine on its own.
//
// It exists so the engine is usable without armornet, and so the decisions the
// product makes at runtime can be inspected without running the product. FR-027
// requires the two to agree for identical inputs — with the REGISTERED TRAIT SET
// counted as an input, which is why this tool registers none of the product's
// families and offers --trait overrides instead.
package main

import (
	"fmt"
	"os"
)

// usage is printed for no subcommand and for an unknown one. The two cases get
// the same text on purpose: a person who typed the wrong verb needs the list,
// not a rebuke.
const usage = `compose — serve and inspect declared micro-frontends

  compose print    --resolved            fully defaulted and derived manifest
  compose validate --rules FILE          exit non-zero with named problems
  compose serve    --rules FILE          serve the declared apps

Run a subcommand with -h for its flags.
`

func main() {
	if len(os.Args) < 2 {
		fmt.Fprint(os.Stderr, usage)
		os.Exit(2)
	}
	var err error
	switch os.Args[1] {
	case "print":
		err = runPrint(os.Args[2:])
	case "validate":
		err = runValidate(os.Args[2:])
	case "serve":
		err = runServe(os.Args[2:])
	default:
		fmt.Fprintf(os.Stderr, "compose: unknown subcommand %q\n\n%s", os.Args[1], usage)
		os.Exit(2)
	}
	if err != nil {
		fmt.Fprintf(os.Stderr, "compose: %v\n", err)
		os.Exit(1)
	}
}
