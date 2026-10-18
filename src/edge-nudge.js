// Uncrossing the operands of commutative operations after layout.
//
// A binary operation gets one in-port per operand (e.g. nw and ne in a top-to-bottom flow),
// in operand order. For commutative operations (CasADi's CommChecker: the exporter's
// `ordered` is false) that order carries no meaning, so when dot places the operands the
// other way round, their two arrows cross just above the node for nothing. Here the two
// edges trade in-ports after layout: each is routed again, the way dot routes it, into the
// other port. No re-layout; nothing else moves.
//
// Only the part of an edge between the head's rank and the adjacent one is re-routed: the whole
// edge when it joins adjacent ranks in a single Bézier piece, else its last piece when that starts
// in the gap next to the head (dot splits edges across several ranks at bends on their way).
// That part must leave its tail through a port, or along the curve at the bend, and be reproduced
// by the transcription within 1 pt. Edges are not re-routed past other ranks: avoiding the nodes
// there needs dot's routing corridor, which is not reproduced here. A new route that would enter a
// node is dropped. On random expression graphs (test/edge-nudge.test.mjs) this never sent an edge
// through a node.
//
// Self-contained (the layout worker receives it as source): edgeNudge() returns the functions.
export function edgeNudge() {
  const degrees = {n: 90, ne: 45, e: 0, se: -45, s: -90, sw: -135, w: 180, nw: 135};
  const angle = side => degrees[side] * Math.PI / 180;

  // dot's route for an edge between adjacent ranks with nothing in the way, transcribed from
  // Graphviz (lib/pathplan/route.c, lib/common/{shapes,routespl,splines,arrows}.c):
  //  compassPort: a compass port lies on the node outline at angle θ; the curve leaves a tail
  //    port along (cos θ, sin θ) and arrives at a head port along −(cos θ, sin θ).
  //  mkspline: for a two-point path the tangent scale is dist/3.
  //  splinefits: control points P0 + a/3·scale·ev0 and P3 − a/3·scale·ev1, with a = 4 halved
  //    until the curve stays inside the routing corridor (a ∈ 4, 2, 1, ½, …). The corridor is
  //    not reproduced: dotA() reads a back from an edge dot drew (and says how well it fits).
  //  arrowEndClip → bezier_clip: binary search for the point at the arrow's length from the tip.
  // Graph coordinates (y up), as in Graphviz's JSON output. Returns P0, P1, P2, end of curve.
  function dotEdge(p0, ev0, p3, theta, elen, a = 4) {
    const ev1 = [-Math.cos(theta), -Math.sin(theta)];
    const k = a / 3 * Math.hypot(p3[0] - p0[0], p3[1] - p0[1]) / 3;
    const sp = [p3, [p3[0] - k * ev1[0], p3[1] - k * ev1[1]], [p0[0] + k * ev0[0], p0[1] + k * ev0[1]], p0];
    const split = (c, t) => {  // de Casteljau: the part of c from t to 1
      const m = (u, v) => [u[0] + t * (v[0] - u[0]), u[1] + t * (v[1] - u[1])];
      const q = m(c[0], c[1]), r = m(c[1], c[2]), s = m(c[2], c[3]), u = m(q, r), v = m(r, s);
      return [m(u, v), v, s, c[3]];
    };
    let low = 0, high = 1, pt = sp[0], opt, best = null, seg;
    do {
      opt = pt;
      const t = (low + high) / 2;
      seg = split(sp, t); pt = seg[0];
      if (Math.hypot(pt[0] - p3[0], pt[1] - p3[1]) <= elen) { low = t; best = seg; } else high = t;
    } while (Math.abs(opt[0] - pt[0]) > .5 || Math.abs(opt[1] - pt[1]) > .5);
    return (best || seg).reverse();
  }

  // The `a` dot used for an edge it drew (pts: its Bézier, tip: its arrow tip), and how
  // closely dotEdge then reproduces that edge (err: worst control point, in points).
  function dotA(pts, tip, ev0, theta, elen) {
    let a = 4, err = Infinity;
    for (let k = 4; k > .005; k /= 2) {
      const c = dotEdge(pts[0], ev0, tip, theta, elen, k);
      const e = Math.max(...c.map((p, i) => Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1])));
      if (e < err) { err = e; a = k; }
    }
    return {a, err};
  }

  // layout: Graphviz JSON. operands: {id, head, tail, input} for every edge into a commutative
  // binary operation, tail being a node left through the `outputSide` port. sides: the in-ports
  // per operand. Returns {id, d, points} for the SVG path and arrowhead of every re-routed edge.
  function operandNudges(layout, operands, sides, outputSide, horizontal) {
    const objects = new Map(layout.objects.filter(o => o.pos).map(o => [o.name, o.pos.split(',').map(Number)]));
    const axis = horizontal ? 0 : 1, levels = [...new Set([...objects.values()].map(p => Math.round(p[axis])))].sort((u, v) => u - v);
    const rank = name => levels.indexOf(Math.round(objects.get(name)[axis]));
    const edges = new Map((layout.edges || []).map(e => [e.id, e]));
    const shapes = layout.objects.filter(o => o.pos && o.width).map(o => {
      const [x, y] = o.pos.split(',').map(Number);
      return {name: o.name, x, y, rx: o.width * 36, ry: o.height * 36};
    });
    const at = (c, t) => { const u = 1 - t; return [0, 1].map(k => u * u * u * c[0][k] + 3 * u * u * t * c[1][k] + 3 * u * t * t * c[2][k] + t * t * t * c[3][k]); };
    // inside the head's ellipse (shrunk 15%: the curve ends on its outline) or another node's box
    const blocked = (c, head, tail) => shapes.some(s => s.name !== tail && Array.from({length: 41}, (_, k) => at(c, k / 40)).some(([x, y]) =>
      s.name === head ? ((x - s.x) / s.rx) ** 2 + ((y - s.y) / s.ry) ** 2 < .85 : Math.abs(x - s.x) < s.rx - 1 && Math.abs(y - s.y) < s.ry - 1));
    const ev0 = [Math.cos(angle(outputSide)), Math.sin(angle(outputSide))];
    const pairs = new Map();
    for (const o of operands) pairs.set(o.head, [...(pairs.get(o.head) || []), o]);
    const patches = [];
    for (const [head, pair] of pairs) {
      if (pair.length !== 2 || pair[0].tail === pair[1].tail || !objects.has(head)) continue;
      pair.sort((u, v) => u.input - v.input);
      const geo = pair.map(o => {
        const e = edges.get(o.id);
        if (!e?.pos || !objects.has(o.tail)) return null;
        const parts = e.pos.split(' '), tip = parts.find(t => t.startsWith('e,'));
        const pts = parts.filter(t => !/^[se],/.test(t)).map(t => t.split(',').map(Number));
        const arrow = (e._hdraw_ || []).find(op => op.op === 'P' || op.op === 'p');
        if (!tip || parts.some(t => t.startsWith('s,')) || !arrow) return null;
        const me = {o, tip: tip.slice(2).split(',').map(Number), arrow: arrow.points}, span = Math.abs(rank(head) - rank(o.tail));
        if (span === 1 && pts.length === 4) return {...me, pts, before: [], ev0};
        if (span < 2 || pts.length < 7 || (pts.length - 1) % 3) return null;
        // the last piece, if it lies between the head's rank and the adjacent one
        const start = pts[pts.length - 4], ahead = levels[rank(head) + Math.sign(objects.get(o.tail)[axis] - objects.get(head)[axis])];
        if ((start[axis] - ahead) * (start[axis] - objects.get(head)[axis]) >= 0) return null;
        const d = [pts[pts.length - 3][0] - start[0], pts[pts.length - 3][1] - start[1]], l = Math.hypot(...d);
        return {...me, pts: pts.slice(-4), before: pts.slice(0, -4), ev0: [d[0] / l, d[1] / l]};
      });
      if (geo.some(g => !g)) continue;
      // Re-route only edges whose present route dotEdge reproduces: then they are the simple
      // case transcribed here (no bend in dot's routing path), and so is the new route.
      geo.forEach((me, i) => {
        me.elen = Math.hypot(me.tip[0] - me.pts[3][0], me.tip[1] - me.pts[3][1]);
        Object.assign(me, dotA(me.pts, me.tip, me.ev0, angle(sides[i]), me.elen));
      });
      if (geo.some(g => g.err > 1)) continue;
      // crossed: the re-routed parts start in the opposite order to the in-ports they arrive at
      const t0 = geo[0].pts[0], t1 = geo[1].pts[0];
      if ((t0[0] - t1[0]) * (geo[0].tip[0] - geo[1].tip[0]) + (t0[1] - t1[1]) * (geo[0].tip[1] - geo[1].tip[1]) >= 0) continue;
      const curves = geo.map((me, i) => dotEdge(me.pts[0], me.ev0, geo[1 - i].tip, angle(sides[1 - i]), me.elen, me.a));
      if (curves.some((c, i) => blocked(c, head, geo[i].o.tail))) continue;
      geo.forEach((me, i) => {
        const other = geo[1 - i], curve = curves[i];
        // the arrowhead: dot's own polygon, moved from the old base→tip onto the new one
        const frame = (base, tip) => { const l = Math.hypot(tip[0] - base[0], tip[1] - base[1]); return [base, [(tip[0] - base[0]) / l, (tip[1] - base[1]) / l]]; };
        const [b0, u0] = frame(me.pts[3], me.tip), [b1, u1] = frame(curve[3], other.tip);
        const points = me.arrow.map(([px, py]) => {
          const dx = px - b0[0], dy = py - b0[1], s = dx * u0[0] + dy * u0[1], t = -dx * u0[1] + dy * u0[0];
          return [b1[0] + s * u1[0] - t * u1[1], b1[1] + s * u1[1] + t * u1[0]];
        });
        const svg = p => +p[0].toFixed(2) + ',' + +(-p[1]).toFixed(2);  // SVG: y down
        const route = [...me.before, ...curve];
        patches.push({id: me.o.id, d: 'M' + svg(route[0]) + 'C' + route.slice(1).map(svg).join(' '), points: points.map(svg).join(' ')});
      });
    }
    return patches;
  }

  return {dotEdge, dotA, operandNudges};
}
