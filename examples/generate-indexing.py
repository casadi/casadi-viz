"""Regenerate the submatrix examples with a CasADi build supporting export_graph."""
from pathlib import Path
import casadi as ca

a = ca.MX.sym("A", 4, 4)
y = ca.MX.sym("Y", 2, 2)
assigned = ca.MX(a)
assigned[[0, 2], [1, 3]] = y
s = ca.MX.sym("S", ca.Sparsity.lower(4))
for name, inputs, output, names in [
    ("subref", [a], a[[0, 2], [1, 3]], ["A"]),
    ("subassign", [a, y], assigned, ["A", "Y"]),
    ("sparse_subref", [s], s.nz[[8, 0, 5]], ["S"]),
]:
    f = ca.Function(name, inputs, [output], names, ["B" if name != "sparse_subref" else "y"])
    f.export_graph(str(Path(__file__).parent / "graphs" / (name + ".casadi_viz")))
