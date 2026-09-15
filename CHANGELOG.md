# 3.8.2

- Read native `.casadi` Functions and MX/SX expressions through casadi-reader 0.2, including structural JSON from its language bindings.
- Derive expression/Function presentation from the serialized input, retaining expression concatenations and split outputs.
- Inspect serialized Function properties, including selected opaque calls, without an option-name catalogue.
- Show destination ranges for Function output writes, with separate arrow targets and matrix previews.
- Add layout engines, flow directions, logarithmic spacing controls and spacing reset.
- Improve slicing labels, call class captions, operation ports, input/output grouping, numeric formatting and fonts.
- Keep trace replay optional, matrix contents and sizes enabled by default, and the CasADi 3.8 compatibility line.

Requires Node.js 22 or later for Node consumers, matching casadi-reader. Browser use remains supported.
