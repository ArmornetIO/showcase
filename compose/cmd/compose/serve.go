package main

import (
	"errors"
	"flag"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"sort"
	"strings"
	"syscall"

	"github.com/ArmornetIO/showcase/compose"
)

// addrFlags maps a listener to the address serving it.
//
// Repeatable and listener-qualified because the engine's listener split is not
// a detail this tool may flatten: the installer answers on loopback in another
// process, and a serve command that could only bind one listener would be
// unable to reproduce the composition it is meant to inspect.
type addrFlags struct {
	byListener map[string]string
	order      []string
}

func newAddrFlags() *addrFlags { return &addrFlags{byListener: map[string]string{}} }

func (a *addrFlags) String() string { return strings.Join(a.order, ",") }

// Set parses `[listener=]host:port`. A bare address is the web listener, which
// is the everyday case and the one worth not making anybody spell.
func (a *addrFlags) Set(v string) error {
	listener, addr := compose.WebListener, v
	if l, rest, ok := strings.Cut(v, "="); ok {
		listener, addr = l, rest
	}
	if addr == "" {
		return fmt.Errorf("address %q has no host:port", v)
	}
	if _, dup := a.byListener[listener]; dup {
		return fmt.Errorf("listener %q given two addresses: one listener answers on one address", listener)
	}
	a.byListener[listener] = addr
	a.order = append(a.order, v)
	return nil
}

// runServe serves the declared apps.
//
// The bundles come off DISK, not from an embed directive, and that is the whole
// reason this subcommand exists: it lets the engine be run against a checkout
// of the component library alone, with no armornet code present and nothing
// compiled in. What the product does with generated embed packages and what
// this does with os.DirFS are two sources for the same Set — which is what
// makes FR-027's agreement a property of the engine rather than of the host.
func runServe(args []string) error {
	traits := newTraitOverrides()
	fs := flag.NewFlagSet("serve", flag.ExitOnError)
	load := bindInputs(fs, traits)
	addrs := newAddrFlags()
	fs.Var(addrs, "addr", "where to listen: [listener=]host:port (repeatable, default :8080 for the web listener)")
	if err := fs.Parse(args); err != nil {
		return err
	}
	in, err := load()
	if err != nil {
		return err
	}

	// Validated before anything binds. A process that starts and then refuses
	// every request is the failure this engine's whole last-known-good design
	// exists to avoid, and at boot there is no last known good to keep.
	if ps := compose.Validate(in.manifest, in.rules, in.present); len(ps) > 0 {
		for _, p := range ps {
			fmt.Fprintf(os.Stderr, "%s\n", p)
		}
		if ps.Failed() {
			return fmt.Errorf("visibility rules are not usable (%d problem(s) above)", len(ps))
		}
	}

	set, err := setFromDisk(in)
	if err != nil {
		return err
	}
	holder, err := compose.NewHolder(in.manifest, in.present, in.rules)
	if err != nil {
		return err
	}

	if len(addrs.byListener) == 0 {
		addrs.byListener[compose.WebListener] = ":8080"
	}
	for _, l := range listenersOf(in.resolved) {
		if _, ok := addrs.byListener[l]; !ok {
			fmt.Fprintf(os.Stderr, "compose: listener %q has no --addr; its apps will not be served\n", l)
		}
	}

	return serveAll(set, holder, addrs, in)
}

// setFromDisk builds the Set this process carries.
//
// Every declared app is added, including ones with no bundle. Leaving an
// unbuilt app OUT would make it indistinguishable from an app nobody declared,
// and telling those two apart — by name, with the command that fixes it — is
// the diagnostic this feature was born from.
func setFromDisk(in inputs) (compose.Set, error) {
	rootedAt := map[string]bool{}
	var opts []compose.Option
	opts = append(opts, compose.Shared(in.resolved.Shared...))

	for _, ra := range in.resolved.Apps {
		app := compose.App{
			Name:        ra.Name,
			Path:        ra.Path,
			AssetPrefix: ra.AssetPrefix,
			Listener:    ra.Listener,
		}
		bundle := filepath.Join(in.root, ra.Source, ra.BuildDir)
		if st, err := os.Stat(bundle); err == nil && st.IsDir() {
			app.Files = os.DirFS(bundle)
		}
		if ra.Builtin != "" {
			b, err := os.ReadFile(filepath.Join(in.root, ra.Builtin))
			if err != nil {
				return compose.Set{}, fmt.Errorf("app %s: builtin %s: %w", ra.Name, ra.Builtin, err)
			}
			app.Builtin = b
		}

		// MustSet requires a root per listener or it panics: a binary whose "/"
		// answers nothing is not a runnable program. The FIRST "/"-claiming app
		// on each listener takes the role. It is only a fallback for a listener
		// whose scope names no root — which app actually answers a given
		// hostname is the scope's Root, decided per request.
		if ra.Path == "/" && !rootedAt[ra.Listener] {
			rootedAt[ra.Listener] = true
			opts = append(opts, compose.Root(app))
			continue
		}
		opts = append(opts, compose.Also(app))
	}
	return compose.MustSet(opts...), nil
}

func listenersOf(res compose.Resolved) []string {
	seen := map[string]bool{}
	for _, a := range res.Apps {
		seen[a.Listener] = true
	}
	out := make([]string, 0, len(seen))
	for l := range seen {
		out = append(out, l)
	}
	sort.Strings(out)
	return out
}

// serveAll runs one HTTP server per listener and returns when any of them stops
// or the process is interrupted.
func serveAll(set compose.Set, holder *compose.Holder, addrs *addrFlags, in inputs) error {
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)

	errs := make(chan error, len(addrs.byListener))
	listeners := make([]string, 0, len(addrs.byListener))
	for l := range addrs.byListener {
		listeners = append(listeners, l)
	}
	sort.Strings(listeners)

	servers := make([]*http.Server, 0, len(listeners))
	for _, listener := range listeners {
		addr := addrs.byListener[listener]
		// Principal stays nil: this tool resolves no identity, so every caller
		// is anonymous and only `anyone`, `dev` and the --trait overrides can
		// hold. Inventing a caller here would be inventing an input, and the
		// inputs are the thing the host and this tool have to share.
		h := compose.Handler(set, holder, compose.HandlerOptions{Listener: listener})
		srv := &http.Server{Addr: addr, Handler: h}
		servers = append(servers, srv)
		fmt.Printf("compose: listener %q on %s — apps: %s\n", listener, addr, strings.Join(appsOn(in.resolved, listener), " "))
		go func() {
			if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
				errs <- fmt.Errorf("listener %q on %s: %w", listener, addr, err)
			}
		}()
	}

	select {
	case err := <-errs:
		return err
	case <-stop:
		for _, srv := range servers {
			_ = srv.Close()
		}
		return nil
	}
}

func appsOn(res compose.Resolved, listener string) []string {
	var out []string
	for _, a := range res.Apps {
		if a.Listener == listener {
			out = append(out, a.Name+"@"+a.Path)
		}
	}
	return out
}
