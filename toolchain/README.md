# Prototype CasADi runtime

The runtime must contain the graph exporter and filename-free overload from the
release-3.8.1-based CasADi worktree. A stock 3.8.0 npm runtime cannot export these
bundles. No JavaScript reimplementation of graph extraction is used here.

Example Emscripten build (adapt paths to your installation):

```sh
EMSDK_PYTHON=/usr/bin/python3 emcmake cmake -S /path/to/casadi -B /path/to/casadi/build-viz-wasm \
  -DWITH_WASM_JS=ON -DWITH_PYTHON=OFF -DWITH_EXAMPLES=OFF \
  -DSWIG_EXECUTABLE=/path/to/casadi-patched-swig/swig \
  -DCMAKE_BUILD_TYPE=Release -DCMAKE_CXX_FLAGS='-fwasm-exceptions -DEMSCRIPTEN'
EMSDK_PYTHON=/usr/bin/python3 cmake --build /path/to/casadi/build-viz-wasm --target casadi_wasm -j12
node scripts/stage-runtime.mjs /path/to/casadi/build-viz-wasm/swig/wasm-js
```

The tested local SWIG generator exposed a constructor-only EM_VAL conversion
bug: Function option dictionaries were passed as raw JS objects to WASM rather
than handles, silently discarding options such as `never_inline` and
`dump_trace`. The small fix is retained in `swig-wasm-constructor-emval.patch`.
Apply it to that generator if needed, rebuild SWIG, touch CasADi's `swig/casadi.i`,
and rebuild the WASM target. Skip it if your SWIG already contains the fix.

`node test/wasm-runtime.cjs /path/to/runtime/casadi.js` verifies that constructor
options are honored and graph-export overloads work before staging a runtime.
The included loader handles the current CommonJS packaging inside a worker;
a future browser ESM entry point in `@casadi/casadi-wasm` can replace this adapter
without changing the viewer API.
