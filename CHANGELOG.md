# Unreleased

- Operands of commutative operations (CasADi's CommChecker: `ordered` is false) no longer cross above the node: when dot places them the other way round, the two arrows trade in-ports after layout and are routed again the way dot routes them. No re-layout. Applies to the dot engine. Only pairs whose present route the transcription reproduces within 1 pt are touched; others (edges across several ranks, and in practice every flow but the default top-to-bottom) are left as dot drew them.

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
