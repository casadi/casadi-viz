# 3.8.7

- Fix "Layout failed: Cannot read properties of null (reading 'shape')" in the default view (matrix contents shown) of graphs with an empty 0-by-0 MX, e.g. any graph calling `qpsol`.

# 3.8.6

- Use casadi-reader 0.3.1: read `.casadi` data written by CasADi 3.8.2, including the new `erk` and `rosenbrock` integrators.

# 3.8.5

- Use casadi-reader 0.3.0: read `.casadi` data written by earlier CasADi releases, and by CasADi main (FunctionInternal version 9), so `Function.export_graph` bundles from CasADi main open.

- Operands of commutative operations (CasADi's CommChecker: `ordered` is false) no longer cross above the node: when dot places them the other way round, the two arrows trade in-ports after layout and are routed again the way dot routes them. No re-layout. Applies to the dot engine. Only pairs whose present route the transcription reproduces within 1 pt are touched; others (edges across several ranks, and in practice every flow but the default top-to-bottom) are left as dot drew them.
- Uncross commutative operands also when one joins over several ranks: the last piece of its edge, between the head's rank and the adjacent one, trades in-ports. New routes that would enter a node are dropped.
- Dive into helper Functions (an nlpsol's oracle and `nlp_hess_l`, a Map's inner Function, ...): use the **ƒ** badge on the call node, which becomes a direct link when there is only one, or the clickable list in the side pane. Entries show the helper's Function name.
- Find helpers generically, from the Function-typed fields of serialized records.
- Show infinite constants as ∞ and −∞.
- Render Functions containing an empty 0-by-0 MX constant (e.g. qpsol's qrqp).
- Bundle every called Function. Only MX/SX callees can be stepped into; double-clicking any other call opens its helpers, and a helper of a solver call opens directly, with the call in the breadcrumbs. A Function exported without an expression graph is shown as a single call with its helpers listed.

# 3.8.4

- Use casadi-reader 0.2.2, generated from the CasADi 3.8.1 release serialization scheme.
- Keep the CasADi 3.8 compatibility pin for browser exports.

# 3.8.3

- Use casadi-reader 0.2.1 with directly generated serialization readers.
- Retain native Function and expression graph import, including debug serializations.

# 3.8.2

- Read native `.casadi` Functions and MX/SX expressions through casadi-reader 0.2, including structural JSON from its language bindings.
- Derive expression/Function presentation from the serialized input, retaining expression concatenations and split outputs.
- Inspect serialized Function properties, including selected opaque calls, without an option-name catalogue.
- Show destination ranges for Function output writes, with separate arrow targets and matrix previews.
- Add layout engines, flow directions, logarithmic spacing controls and spacing reset.
- Improve slicing labels, call class captions, operation ports, input/output grouping, numeric formatting and fonts.
- Keep trace replay optional, matrix contents and sizes enabled by default, and the CasADi 3.8 compatibility line.

Requires Node.js 22 or later for Node consumers, matching casadi-reader. Browser use remains supported.
