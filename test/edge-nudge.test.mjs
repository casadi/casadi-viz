import test from 'node:test';
import assert from 'node:assert/strict';
import {instance} from '@viz-js/viz';
import {edgeNudge} from '../src/edge-nudge.js';

const {dotEdge, dotA, operandNudges} = edgeNudge();
const viz = await instance();
const FLOWS = {TB: [['nw', 'ne'], 's'], BT: [['se', 'sw'], 'n'], LR: [['nw', 'sw'], 'e'], RL: [['se', 'ne'], 'w']};
const angle = side => ({n: 90, ne: 45, e: 0, se: -45, s: -90, sw: -135, w: 180, nw: 135})[side] * Math.PI / 180;

// Random expression DAGs with the viewer's node and edge style; + and * are commutative.
function randomGraphs(count, seed) {
  const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648, out = [];
  for (let g = 0; g < count; g++) {
    const nodes = [], symbols = 2 + Math.floor(rnd() * 3), ops = 3 + Math.floor(rnd() * 12);
    for (let i = 0; i < symbols; i++) nodes.push({id: 'n' + i, label: 'x' + i, ins: []});
    for (let i = 0; i < ops; i++) {
      const k = nodes.length, unary = rnd() < .15, a = nodes[Math.floor(rnd() * k)], b = nodes[Math.floor(rnd() * k)];
      if (!unary && a === b) { i--; continue; }
      nodes.push({id: 'n' + k, label: unary ? 'sin' : ['+', '*', '-', '/', '+', '*'][Math.floor(rnd() * 6)], ins: unary ? [a] : [a, b]});
    }
    out.push(nodes);
  }
  return out;
}
function toDot(nodes, flow) {
  const [sides, out] = FLOWS[flow], operands = [], lines = ['digraph G {',
    `graph [rankdir=${flow}, bgcolor="white", newrank=true, pad="0.4", nodesep="0.65", ranksep="0.9"];`,
    'node [shape=ellipse, style=filled, fontname="Times-Roman", fontsize=14, margin="0.15,0.08", width=0.5, height=0.5];',
    'edge [color="#000000", penwidth=1.5, arrowsize=0.65];'];
  for (const n of nodes) {
    lines.push(`${n.id} [label="${n.label}"];`);
    n.ins.forEach((a, i) => {
      const id = `operand-${n.id}-${i}`, port = n.ins.length === 2 ? sides[i] : {TB: 'n', BT: 's', LR: 'w', RL: 'e'}[flow];
      if (n.ins.length === 2 && ['+', '*'].includes(n.label)) operands.push({id, head: n.id, tail: a.id, input: i});
      lines.push(`${a.id}:${out} -> ${n.id}:${port} [id="${id}", head="${n.id}", port="${port}"];`);
    });
  }
  lines.push('}');
  return {dot: lines.join('\n'), operands, sides, out};
}
const bezier = (c, n) => Array.from({length: n + 1}, (_, i) => {
  const t = i / n, u = 1 - t;
  return [0, 1].map(k => u * u * u * c[0][k] + 3 * u * u * t * c[1][k] + 3 * u * t * t * c[2][k] + t * t * t * c[3][k]);
});

test('dotEdge reproduces the edges dot draws between adjacent ranks (top-to-bottom flow)', () => {
  for (const flow of ['TB']) {
    const errors = [];
    for (const nodes of randomGraphs(60, 4242)) {
      const {dot, out} = toDot(nodes, flow), layout = JSON.parse(viz.renderString(dot, {format: 'json'}));
      for (const e of layout.edges) {
        const parts = e.pos.split(' '), pts = parts.filter(t => !/^[se],/.test(t)).map(t => t.split(',').map(Number));
        if (pts.length !== 4) continue;
        const tip = parts.find(t => t.startsWith('e,')).slice(2).split(',').map(Number);
        const elen = Math.hypot(tip[0] - pts[3][0], tip[1] - pts[3][1]), ev0 = [Math.cos(angle(out)), Math.sin(angle(out))];
        const {a} = dotA(pts, tip, ev0, angle(e.port), elen), c = dotEdge(pts[0], ev0, tip, angle(e.port), elen, a);
        errors.push(Math.max(...c.map((p, k) => Math.hypot(p[0] - pts[k][0], p[1] - pts[k][1]))));
      }
    }
    errors.sort((u, v) => u - v);
    const median = errors[errors.length >> 1], p99 = errors[Math.floor(.99 * (errors.length - 1))];
    assert(errors.length > 500 && median < .5 && p99 < 3, `${flow}: ${errors.length} edges, median ${median}, p99 ${p99} pt`);
  }
});

// In the other flows dot routes edges into some in-ports along a bent path, which dotEdge does
// not reproduce: the fit check in operandNudges then leaves those pairs as dot drew them.
test('re-routed operands never run through another node, in any flow', () => {
  let patched = 0;
  for (const flow of Object.keys(FLOWS)) for (const nodes of randomGraphs(100, 99)) {
    const {dot, operands, sides, out} = toDot(nodes, flow), layout = JSON.parse(viz.renderString(dot, {format: 'json'}));
    const patches = operandNudges(layout, operands, sides, out, flow === 'LR' || flow === 'RL');
    patched += patches.length;
    for (const p of patches) {
      const nums = p.d.match(/-?[\d.]+/g).map(Number), c = [0, 2, 4, 6].map(k => [nums[k], -nums[k + 1]]);
      const e = layout.edges.find(x => x.id === p.id), ends = [layout.objects[e.tail].name, e.head];
      for (const o of layout.objects) {
        if (!o.pos || ends.includes(o.name)) continue;
        const [x, y] = o.pos.split(',').map(Number), rx = o.width * 36, ry = o.height * 36;
        assert(!bezier(c, 40).some(q => ((q[0] - x) / rx) ** 2 + ((q[1] - y) / ry) ** 2 < .85), `${flow}: ${p.id} runs through ${o.name}`);
      }
    }
  }
  assert(patched >= 40, `only ${patched} edges re-routed`);  // all in the top-to-bottom flow (68 with this seed)
});

test('r*c+2*r: the arrows into the final + no longer cross', () => {
  // dot puts 2*r left of r*c, so the first operand (r*c) arrives from the right
  const dot = `digraph G { graph [rankdir=TB, newrank=true, pad="0.4", nodesep="0.65", ranksep="0.9"];
    node [shape=ellipse, width=0.5, height=0.5]; edge [penwidth=1.5, arrowsize=0.65];
    a; b; c; d [label="/"]; r [label="+"]; m [label="*"]; two [label="2"]; t [label="*"]; z [label="+"];
    b:s -> d:nw; c:s -> d:ne; a:s -> r:nw; d:s -> r:ne; r:s -> m:nw; c:s -> m:ne; two:s -> t:nw; r:s -> t:ne;
    m:s -> z:nw [id="operand-z-0"]; t:s -> z:ne [id="operand-z-1"]; }`;
  const layout = JSON.parse(viz.renderString(dot, {format: 'json'})), x = n => +layout.objects.find(o => o.name === n).pos.split(',')[0];
  assert(x('m') > x('t'), 'fixture no longer crossed');
  const patches = operandNudges(layout, [{id: 'operand-z-0', head: 'z', tail: 'm', input: 0}, {id: 'operand-z-1', head: 'z', tail: 't', input: 1}],
    ['nw', 'ne'], 's', false);
  assert.equal(patches.length, 2);
  const tipX = id => { const p = patches.find(q => q.id === id).points.split(' ').map(q => +q.split(',')[0]); return p[1]; };
  assert(tipX('operand-z-0') > tipX('operand-z-1'), 'r*c (right) should now arrive at the right in-port');
});
