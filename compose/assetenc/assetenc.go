// Package assetenc writes the precompressed sidecars that compose serves.
//
// It is the build-time half of one contract whose other half is compose's
// Accept-Encoding negotiation: this package decides what <file>.gz means and
// which files get one, and the serving side opens exactly that name. They live
// in the same module so the two halves cannot drift apart across a repo
// boundary without a test noticing.
//
// A separate PACKAGE and not part of compose itself, though: compose is linked
// into every binary that serves a bundle, and none of them ever needs a gzip
// ENCODER — serving a sidecar is opening a second file and setting a header.
// Keeping the encoder out here is what lets the serving path stay as small as
// it claims to be.
package assetenc

import (
	"compress/gzip"
	"fmt"
	"io"
	"io/fs"
	"os"
	"path"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"sync/atomic"
)

// Compressor is one content coding, used at build time to emit sidecars.
//
// Deliberately not an io.Writer factory: the caller always has the whole file
// in hand and never needs to stream, and a narrower interface is one an
// experimental codec can satisfy in a dozen lines. Adding brotli is one type
// with three methods and one entry in Default.
type Compressor interface {
	// Encoding is the Accept-Encoding token this produces: "gzip", "br".
	Encoding() string
	// Ext is the sidecar suffix, including the dot: ".gz", ".br".
	Ext() string
	// Compress writes the encoded form of src to dst.
	Compress(dst io.Writer, src io.Reader) error
}

// Default is the set of codings emitted unless a caller says otherwise.
//
// gzip alone, measured rather than assumed: of the ~5.1 MB a cold armornet
// console load has available to save, gzip captures 92 % of it with zero
// dependencies, and brotli's entire marginal contribution was 412 KB for a
// 261k-line vendored tree.
var Default = []Compressor{GzipCompressor{}}

// GzipCompressor encodes with the standard library at BestCompression.
type GzipCompressor struct{}

func (GzipCompressor) Encoding() string { return "gzip" }
func (GzipCompressor) Ext() string      { return ".gz" }

func (GzipCompressor) Compress(dst io.Writer, src io.Reader) error {
	// BestCompression because this runs once per deploy and the result is
	// downloaded by every visitor until the next one. The CPU is free here in
	// a way it never is on the request path.
	zw, err := gzip.NewWriterLevel(dst, gzip.BestCompression)
	if err != nil {
		return err
	}
	if _, err := io.Copy(zw, src); err != nil {
		zw.Close()
		return err
	}
	return zw.Close()
}

// Compressible is the set of extensions worth encoding: everything a bundle
// ships that is not already compressed. woff2, png and jpg carry their own
// coding and gzip only makes them bigger.
var Compressible = map[string]bool{
	".js":   true,
	".mjs":  true,
	".css":  true,
	".html": true,
	".json": true,
	".svg":  true,
	".wasm": true,
	".map":  true,
	".txt":  true,
	".xml":  true,
}

// knownSidecarExts stops a second run compressing this tool's own output into
// <file>.gz.gz. ".br" is listed even with no brotli compressor wired in, so a
// tree carrying sidecars from a comparison branch survives a gzip-only run.
var knownSidecarExts = map[string]bool{".gz": true, ".br": true, ".zst": true}

// Options tunes a run. The zero value is usable: it means the defaults below.
type Options struct {
	// MinSize is the floor below which a file is skipped. Zero means 1024.
	//
	// It matters more than it looks: a gzip member costs ~20 bytes of header
	// and trailer, so below about a kilobyte the sidecar is routinely LARGER
	// than the file, and either way the saving is lost inside one TCP segment.
	MinSize int64
	// Workers is the parallel compression count. Zero means NumCPU.
	Workers int
	// Compressors is the codec set. Nil means Default.
	Compressors []Compressor
}

func (o Options) minSize() int64 {
	if o.MinSize <= 0 {
		return 1024
	}
	return o.MinSize
}

func (o Options) workers() int {
	if o.Workers <= 0 {
		return runtime.NumCPU()
	}
	return o.Workers
}

func (o Options) compressors() []Compressor {
	if len(o.Compressors) == 0 {
		return Default
	}
	return o.Compressors
}

// Stats is what a run saved, for a build log that can be checked against the
// numbers the decision was made on.
type Stats struct {
	Files   int64
	Raw     int64
	Encoded int64
}

// Saved is the byte count not sent to a client that accepts the coding.
func (s Stats) Saved() int64 { return s.Raw - s.Encoded }

func (s Stats) String() string {
	return fmt.Sprintf("%d files, %s -> %s (%s saved)",
		s.Files, human(s.Raw), human(s.Encoded), human(s.Saved()))
}

// Eligible reports whether a file should get sidecars.
func Eligible(name string, size int64, minSize int64) bool {
	ext := strings.ToLower(path.Ext(name))
	if knownSidecarExts[ext] {
		return false
	}
	return Compressible[ext] && size >= minSize
}

// Dirs compresses several trees, skipping any that do not exist.
//
// A missing directory is not an error on purpose: the installer and job-board
// bundles are conditionally built, and failing here would break a plain build
// for a UI the selected profile does not carry.
func Dirs(dirs []string, opts Options) (Stats, error) {
	var total Stats
	for _, dir := range dirs {
		if fi, err := os.Stat(dir); err != nil || !fi.IsDir() {
			continue
		}
		s, err := Dir(dir, opts)
		total.Files += s.Files
		total.Raw += s.Raw
		total.Encoded += s.Encoded
		if err != nil {
			return total, err
		}
	}
	return total, nil
}

// Dir walks one tree and writes a sidecar per codec beside every eligible file.
func Dir(dir string, opts Options) (Stats, error) {
	var (
		files, raw, encoded atomic.Int64
		mu                  sync.Mutex
		firstErr            error
		wg                  sync.WaitGroup
	)
	codecs := opts.compressors()
	jobs := make(chan string)

	for range opts.workers() {
		wg.Add(1)
		go func() {
			defer wg.Done()
			// Keep draining after a failure rather than returning. A worker
			// that stops reading leaves the walker blocked on an unbuffered
			// send forever, so the build hangs instead of reporting the error.
			for p := range jobs {
				n, r, e, err := compressFile(p, codecs)
				files.Add(n)
				raw.Add(r)
				encoded.Add(e)
				if err != nil {
					mu.Lock()
					if firstErr == nil {
						firstErr = err
					}
					mu.Unlock()
				}
			}
		}()
	}

	minSize := opts.minSize()
	walkErr := filepath.WalkDir(dir, func(p string, d fs.DirEntry, err error) error {
		if err != nil || d.IsDir() {
			return err
		}
		info, err := d.Info()
		if err != nil {
			return err
		}
		if Eligible(p, info.Size(), minSize) {
			jobs <- p
		}
		return nil
	})
	close(jobs)
	wg.Wait()

	s := Stats{Files: files.Load(), Raw: raw.Load(), Encoded: encoded.Load()}
	if walkErr != nil {
		return s, walkErr
	}
	return s, firstErr
}

// compressFile writes one sidecar per codec, discarding any that did not help.
//
// A sidecar bigger than its original is worse than none: the server would
// prefer it, spend the client a decode, and send more bytes than doing nothing
// would have. Deleting it here makes that impossible rather than unlikely.
func compressFile(p string, codecs []Compressor) (files, raw, encoded int64, err error) {
	for _, c := range codecs {
		out := p + c.Ext()
		if err := encodeTo(out, p, c); err != nil {
			os.Remove(out)
			return files, raw, encoded, err
		}
		rawSize, err := sizeOf(p)
		if err != nil {
			return files, raw, encoded, err
		}
		encSize, err := sizeOf(out)
		if err != nil {
			return files, raw, encoded, err
		}
		if encSize >= rawSize {
			os.Remove(out)
			continue
		}
		files++
		raw += rawSize
		encoded += encSize
	}
	return files, raw, encoded, nil
}

func encodeTo(out, in string, c Compressor) error {
	src, err := os.Open(in)
	if err != nil {
		return err
	}
	defer src.Close()
	dst, err := os.Create(out)
	if err != nil {
		return err
	}
	err = c.Compress(dst, src)
	if cerr := dst.Close(); err == nil {
		err = cerr
	}
	if err != nil {
		return fmt.Errorf("%s: %w", in, err)
	}
	return nil
}

func sizeOf(p string) (int64, error) {
	fi, err := os.Stat(p)
	if err != nil {
		return 0, err
	}
	return fi.Size(), nil
}

func human(n int64) string {
	switch {
	case n >= 1<<20:
		return fmt.Sprintf("%.1f MB", float64(n)/(1<<20))
	case n >= 1<<10:
		return fmt.Sprintf("%.0f KB", float64(n)/(1<<10))
	default:
		return fmt.Sprintf("%d B", n)
	}
}
