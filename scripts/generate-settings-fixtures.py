"""Generate Function-settings examples and native graph oracles with CasADi."""
from pathlib import Path
import casadi as ca

root = Path(__file__).resolve().parents[1]/'test/fixtures/casadi'
s = ca.SX.sym('s', 3)
inner = ca.Function('settings_inner', [s], [ca.sin(s)+2*s],
                    {'regularity_check': True, 'enable_forward': False})
x = ca.MX.sym('x', 3)
outer = ca.Function('settings_outer', [x], [inner(x)],
                    {'print_in': True, 'ad_weight': 0.75, 'forward_options': {'print_time': True}})
for name, function in [('settings_sx', inner), ('settings_mx', outer)]:
    function.save(str(root/(name+'.casadi')))
    (root/(name+'.json')).write_text(function.export_graph())

for X, name in [(ca.MX, 'mx_expression'), (ca.SX, 'sx_expression')]:
    x = X.sym('x', 2)
    nested = ca.Function('nested', [x], [x*x, x+1], {'never_inline': True})
    a, b = nested(x)
    ca.export_graph([ca.vertcat(a, x, b), x], str(root/(name+'.casadi_viz')))

x = ca.MX.sym('x', 4, 4)
d = ca.MX.sym('d', ca.diagcat(ca.Sparsity.dense(1, 1), ca.Sparsity.dense(3, 3)))
v = ca.MX.sym('v', 4)
ca.export_graph([-ca.horzsplit(x, [0, 1, 4])[1], -ca.vertsplit(v, [0, 1, 4])[1],
                 -ca.diagsplit(d, [0, 1, 4])[1]], str(root/'split_outputs.casadi_viz'))

z, x, y = ca.MX.sym('z', 2, 4), ca.MX.sym('x', 2, 3), ca.MX.sym('y', 3, 4)
ca.export_graph(ca.mac(x, y, z), str(root/'mtimes.casadi_viz'))

for X, name in [(ca.MX, 'mx_output_ranges'), (ca.SX, 'sx_output_ranges')]:
    a, b, c = X.sym('a', 2), X.sym('b', 10), X.sym('c')
    stacked = ca.Function('stacked', [a, b, c], [ca.vertcat(a, b, c)],
                          ['a', 'b', 'c'], ['result'])
    stacked.export_graph(str(root/(name+'.casadi_viz')))
