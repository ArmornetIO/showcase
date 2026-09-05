// Command assetcompress writes precompressed sidecars beside static assets.
//
// Build time and not request time: a bundle's bytes are identical for every
// visitor and do not change between deploys, so compressing per request pays
// CPU and adds latency on every hit to produce a file we could have had once.
//
// Run it over the directories //go:embed reads, from the one build step every
// path goes through, so the sidecars land inside the binary beside the
// originals compose will look for them next to.
package main

import (
	"flag"
	"fmt"
	"os"
	"runtime"

	"github.com/ArmornetIO/showcase/compose/assetenc"
)

func main() {
	var (
		min     = flag.Int64("min", 1024, "skip files smaller than this many bytes")
		workers = flag.Int("workers", runtime.NumCPU(), "parallel compressions")
		quiet   = flag.Bool("quiet", false, "suppress the summary line")
	)
	flag.Usage = func() {
		fmt.Fprintf(os.Stderr, "usage: assetcompress [flags] <dir>...\n\n")
		flag.PrintDefaults()
	}
	flag.Parse()

	if flag.NArg() == 0 {
		flag.Usage()
		os.Exit(2)
	}

	stats, err := assetenc.Dirs(flag.Args(), assetenc.Options{
		MinSize: *min,
		Workers: *workers,
	})
	if err != nil {
		fmt.Fprintf(os.Stderr, "assetcompress: %v\n", err)
		os.Exit(1)
	}
	if !*quiet {
		fmt.Printf("assetcompress: %s\n", stats)
	}
}
