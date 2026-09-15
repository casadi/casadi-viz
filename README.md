# @casadi/casadi-viz

An embeddable viewer for CasADi expressions and Functions. It displays graph
bundles produced by CasADi's C++ exporter, with matrix previews, nested-function
navigation and optional evaluation trace replay.

This is a working development prototype. The npm name is prepared; the package
has not been published. The browser playground requires a CasADi WASM build
containing `Function.export_graph`; the published 3.8.0 runtime predates this API.

## Embed a viewer

After publication, the intended installation is `npm install @casadi/casadi-viz`.
For now, install a tarball made with `npm pack`, or run the examples below.

```js
import {createGraphViewer} from '@casadi/casadi-viz';

const viewer = createGraphViewer(document.querySelector('#graph'));
await viewer.setGraph(JSON.parse(f.export_graph()));
```

Give the host element a height, for example `height: 650px`. Each instance owns
its shadow DOM, interaction state and layout worker. It does not change the
page's styles, title or global event handlers. The viewer has no dependency on
`@casadi/casadi-wasm` and never evaluates CasADi expressions itself.

`setGraph` also accepts a JSON string. The same API can display a `.casadi_viz`
file loaded with `File.text()` or a bundle generated on a server. No fetch of
graph data occurs inside the viewer.

```js
await viewer.setGraph(await file.text());
await viewer.loadTrace(traceFile);          // Blob/File or JSONL string
viewer.setView('expression');               // or 'function'
viewer.destroy();                          // release timers, workers and DOM
```

`setGraph` resolves when the first layout is installed. Replacing a graph cancels
its pending layout and clears selection, breadcrumb and trace state. An invalid
bundle is rejected before replacing the current graph. Superseded pending
`setGraph` calls reject with `AbortError`.

Trace controls remain hidden until the user activates **Trace**, even when a
trace has been loaded programmatically. Both matrix toggles start enabled.

## Browser and bundler distributions

`dist/index.js` is an ES module, with TypeScript declarations. A classic-script
build exposes `CasadiViz.createGraphViewer` in `dist/casadi-viz.global.js`.
`dist/viz-global.js` is the pinned Viz.js renderer, including its WASM payload.
Keep it next to `index.js`, or supply its URL explicitly when your bundler moves
assets:

```js
const viewer = createGraphViewer(host, {
  runtime: {url: '/assets/viz-global.js'}
});
```

`runtime: {source: rendererSource}` embeds the renderer in the worker instead,
which is also how a fully offline native HTML export works. Browser deployments
must allow the component's blob worker and the configured renderer location.
Serve the module-based examples over HTTP; native standalone exports can be
opened directly as `file://` pages with an embedded renderer.

## Run the prototypes

```sh
npm ci
npm run build
npm run dev
```

Open http://127.0.0.1:8766/examples/bundles.html for the independent bundle viewer.
It has sparse SX/MX examples and nested calls, and accepts uploaded bundles.

The expression playground at `/examples/index.html` additionally needs a local
CasADi WASM runtime:

```sh
node scripts/stage-runtime.mjs /path/to/casadi/build-viz-wasm/swig/wasm-js
```

It runs edited JavaScript in a dedicated worker, constructs the expression,
exports the graph through C++, and evaluates or optimizes it with `sqpmethod`
and `qrqp`. An optional `g` defines equality constraints (`g = 0`). The example
is a small smooth optimization playground; it is not a general-purpose solver
configuration interface.

Each run uses a fresh computation worker, and releases it after evaluation. A
cancel button can terminate a long-running solve. Graph layout uses a separate
worker. Optional traces record the displayed Function's evaluation at the
selected point or solution, not every solver-internal evaluation. Expressions
are JavaScript written by the page's user; do not automatically run third-party
code with this demo.

The runtime and solver plugins are not part of this npm package or its Git
repository. See `toolchain/README.md` for the tested source-build recipe.

## Native HTML export uses this same viewer

CasADi's `misc/casadi_viz.html` is a small HTML shell that loads this package
from unpkg using the producing CasADi major/minor version. Graph data stays embedded in the exported
HTML; opening it requires internet access to load the viewer and renderer.
The `viz_js` option can embed a local renderer, but the viewer still loads from
unpkg. No JavaScript toolchain or vendored viewer bundle is needed to build CasADi.
CasADi `3.8.x` selects `@casadi/casadi-viz@3.8`, resolving to the latest stable
`3.8.y` viewer. The two patch numbers are independent. Every viewer patch in
that line must support graphs and traces from all CasADi `3.8.x` releases.
Breaking format changes belong to a new compatibility line (for example `3.11`).
Keep old lines published and backport compatible viewer fixes as needed.

The `viewer_url` string option overrides the default module URL, for example
for a locally served development build. The HTML imports the ESM viewer. Its renderer URL is relative to the resolved
module URL, so both assets come from the same exact package release even if a
new patch is published between requests. Explicit graph and trace schema
versions remain independent of this package compatibility convention.

C++ remains responsible for graph extraction, JSON serialization and standalone
DOT generation. Interactive DOT assembly and rendering live in this repository.

## Bundle contract

The package accepts `format: "casadi_viz", version: 1`. The root Function is
index 0; `functions[i]` is index `i+1`. Call nodes' `callee` fields index that
registry. `include_functions: false` exports keep calls but omit their internals.
`casadi_version` records the producing CasADi version (for example `"3.8.1"`),
independently of the bundle schema version. Older exports may omit it.
Sparsities are compressed-column arrays; constants are strings in nonzero order.
Instruction IDs match CasADi `dump_trace` records. TypeScript declarations describe
the fields. Full mathematical metadata remains available independently of the
viewer-specific presentation.

A bundle is a graph description, not a serialized executable CasADi Function.
Changing values needs CasADi evaluation; changing expressions produces a new
bundle. A matching trace must be supplied for each graph revision.

## Validation and release preparation

```sh
npm test
npx playwright install chromium
# In another terminal: npm run dev
npm run test:browser
VIZ_TEST_WASM=1 npm run test:browser   # requires the staged runtime
npm pack --dry-run
```

Browser tests cover independent instances, navigation, toggles and lifecycle.
The optional WASM tests cover real C++ graph export, optimization, trace replay,
expression edits and recovery from an editor error. Native CasADi's Python tests
check JSON/file equivalence and overload dispatch.

The GitHub workflow builds and tests from source, then packs exactly those built
files into the downloadable `casadi-viz-package` artifact. Published npm packages
come from this CI artifact; the publish job does not rebuild or run lifecycle
scripts. Pushes and pull requests build artifacts without publishing to npm.

To release, update the version in `package.json` and `package-lock.json`, commit,
and publish a GitHub release with the matching `v<version>` tag. That release
runs the build and tests before publishing its artifact to npm. Prereleases use
npm's `next` tag; stable versions use `latest`. Version and prerelease mismatches
fail before packaging.

The release job uses npm trusted publishing (OIDC), with provenance. Before the
first npm release, arrange package access and configure npm's trusted publisher
for GitHub organization `casadi`, repository `casadi-viz`, workflow `publish.yml`,
with direct publishing allowed and no environment restriction. This registry-side
configuration has not been performed by the repository setup. See
[npm trusted publishing](https://docs.npmjs.com/trusted-publishers/).

## Submatrix operations

Open `examples/indexing.html` to compare submatrix extraction, assignment and
sparse-entry reordering. Selecting an operation shows row/column mappings;
hovering or focusing a mapping row highlights the corresponding matrix cells.
Coordinates are zero-based. The matrix contents toggle also controls these grids.
Regenerate the bundled examples with `python examples/generate-indexing.py` using
a CasADi build supporting graph export.

The optional `mapping_kind` field (`extract`, `assign`, `add`) describes the
existing nonzero `mapping` array. Extraction maps each output entry to an input
entry; assignment/addition maps each values entry to an output entry. Bundles
without this field retain the original nonzero-list inspector.

## Direct `.casadi` import prototype

Branch `poc/casadi-file-reader` uses the published `@casadi/casadi-reader`
package. To run the prototype:

```sh
npm install
npm run build
PORT=8774 npm run dev
# Open http://127.0.0.1:8774/examples/casadi-files.html
```

The reader emits typed fields and shared-object references without interpreting
SX or MX operations. `src/casadi-structure.js` interprets the MX records, and
`src/casadi-adapter.js` reconstructs instruction edges and supplies labels and
entry mappings to the existing viewer. All mathematical interpretation lives
in casadi-viz. `dist/casadi-import.js` is an
experimental separate entry point; the normal viewer API is unchanged.

The public `@casadi/casadi-viz/casadi-import` entry point accepts native files
and the same `casadi_serialization` JSON produced by JavaScript, Python, C, C++,
MATLAB or Julia:

```js
import {readCasadi, toGraphBundle} from '@casadi/casadi-viz/casadi-import';
const records = await readCasadi(fileOrJsonString);
await viewer.setGraph(toGraphBundle(records));
```

The adapter validates the structural document version and requires one Function
root. Mathematical interpretation remains in this package; the reader stays
independent of visualization. Current visualization coverage is the supported
MX subset, even though the reader can decode SX and other serialized classes.

The demo accepts native `Function.save()` files and structural `.json` files, displays their decoded
index/slice metadata, and downloads the intermediate JSON. CasADi WASM is not
loaded; Graphviz's renderer still uses its own WASM payload as usual.

`npm test` compares the resulting graphs with native CasADi exports. With the
server running, `node test/casadi-files-browser.mjs` checks file upload, rendering,
JSON download and invalid-file recovery. Run `python scripts/generate-casadi-fixtures.py`
after regenerating fixtures in the decoder repository to update the local copies.
This remains a limited MX prototype; consult the decoder README for supported
serialization versions and constructs.

Browser integration tests can also upload other readers’ output with
`VIZ_PYTHON_JSON=/path/python.json VIZ_NATIVE_JSON=/path/native.json node test/casadi-files-browser.mjs`.
