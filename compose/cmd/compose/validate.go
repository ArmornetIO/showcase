package main

import (
	"context"
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/ArmornetIO/showcase/compose"
)

// inputs are everything a decision depends on, gathered once so `validate` and
// `serve` cannot gather them differently. FR-027's "identical inputs" is only
// checkable if there is one thing to point at when saying "the inputs".
type inputs struct {
	root     string
	manifest compose.Manifest
	resolved compose.Resolved
	rules    compose.RuleSet
	// present is what this "build" carries. On disk rather than linked in, so
	// the CLI's notion of absent matches the host's: an app with no bundle is
	// one whose bytes are not here.
	present []string
}

// bindInputs registers the flags every subcommand shares. Shared because a tool
// whose two verbs read the same file under two different flag names is a tool
// that can be made to disagree with itself.
func bindInputs(fs *flag.FlagSet, traits *traitOverrides) func() (inputs, error) {
	root := fs.String("root", ".", "directory the manifest's source paths are relative to")
	manifest := fs.String("manifest", "apps.yaml", "path to the app manifest")
	rules := fs.String("rules", "", "path to the visibility document (required)")
	present := fs.String("present", "", "comma-separated apps to treat as built (default: those with a bundle on disk)")
	dev := fs.Bool("dev", false, "enable the development refusal diagnostic")
	fs.Var(traits, "trait", "answer a trait family: family[:arg]=true|false (repeatable)")

	return func() (inputs, error) {
		if *rules == "" {
			return inputs{}, fmt.Errorf("--rules is required: a manifest says which apps exist, not who may see them")
		}
		compose.SetDev(*dev)
		traits.register()

		m, err := decodeManifest(filepath.Join(*root, *manifest))
		if err != nil {
			return inputs{}, err
		}
		rs, err := compose.NewFileSource(*rules).Rules(context.Background())
		if err != nil {
			return inputs{}, err
		}

		in := inputs{root: *root, manifest: m, resolved: m.Resolve(), rules: rs}
		if *present != "" {
			in.present = splitList(*present)
		} else {
			in.present = builtOnDisk(*root, in.resolved)
		}
		return in, nil
	}
}

func decodeManifest(path string) (compose.Manifest, error) {
	f, err := os.Open(path)
	if err != nil {
		return compose.Manifest{}, fmt.Errorf("opening %s: %w", path, err)
	}
	defer f.Close()
	m, err := compose.DecodeManifest(f)
	if err != nil {
		return compose.Manifest{}, fmt.Errorf("%s: %w", path, err)
	}
	return m, nil
}

// builtOnDisk reports which declared apps have a bundle here.
//
// index.html and not the directory: a build directory left behind by a cleaned
// build is present and empty, and treating that as built turns a missing bundle
// into a 404 on every page instead of the diagnostic that names the app.
func builtOnDisk(root string, res compose.Resolved) []string {
	var out []string
	for _, a := range res.Apps {
		if _, err := os.Stat(filepath.Join(root, a.Source, a.BuildDir, "index.html")); err == nil {
			out = append(out, a.Name)
			continue
		}
		if a.Builtin != "" {
			if _, err := os.Stat(filepath.Join(root, a.Builtin)); err == nil {
				out = append(out, a.Name)
			}
		}
	}
	return out
}

func splitList(s string) []string {
	var out []string
	for p := range strings.SplitSeq(s, ",") {
		if p = strings.TrimSpace(p); p != "" {
			out = append(out, p)
		}
	}
	return out
}

// runValidate checks a manifest and a visibility document together and exits
// non-zero with named problems.
//
// Warnings are printed and do not fail, which is the same split the engine
// makes at load time and for the same reason: ONE document is expected to
// configure several build profiles, so a rule naming an app this profile does
// not carry is inert rather than wrong. Printing them anyway is what stops
// "inert" from meaning "invisible".
func runValidate(args []string) error {
	traits := newTraitOverrides()
	fs := flag.NewFlagSet("validate", flag.ExitOnError)
	load := bindInputs(fs, traits)
	if err := fs.Parse(args); err != nil {
		return err
	}
	in, err := load()
	if err != nil {
		return err
	}

	ps := compose.Validate(in.manifest, in.rules, in.present)
	for _, p := range ps {
		fmt.Fprintf(os.Stderr, "%s\n", p)
	}
	if ps.Failed() {
		// Not wrapped in the problems again: they are already on stderr, and
		// printing every one twice is how a long list stops being read.
		return fmt.Errorf("visibility rules are not usable (%d problem(s) above)", len(ps))
	}
	fmt.Printf("compose: %d apps declared, %d built here, %d warning(s)\n", len(in.resolved.Apps), len(in.present), len(ps))
	return nil
}
