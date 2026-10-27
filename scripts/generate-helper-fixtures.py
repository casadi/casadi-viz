"""Generate .casadi fixtures with helper functions (nlpsol, Map) for the Functions picker."""
from pathlib import Path
import casadi as ca

out = Path(__file__).resolve().parents[1]/'test/fixtures/casadi'
x, p = ca.MX.sym('x', 2), ca.MX.sym('p')
solver = ca.nlpsol('solver', 'ipopt', {'x': x, 'p': p, 'f': (x[0]-p)**2+x[1]**2, 'g': x[0]+x[1]})
solver.save(str(out/'helpers_nlpsol.casadi'))
s = ca.SX.sym('s')
mapped = ca.Function('f', [s], [ca.sin(s)*s]).map(4)
y = ca.MX.sym('y', 1, 4)
ca.Function('model', [y, x, p], [mapped(y), solver(x0=x, p=p)['x']],
            ['y', 'x', 'p'], ['fy', 'xopt']).save(str(out/'helpers_calls.casadi'))
z = ca.MX.sym('z', 2)
newton = ca.rootfinder('newton_solver', 'newton', {'x': z, 'p': p, 'g': ca.vertcat(z[0]**3+z[1]-p, z[1]-z[0])})
ca.Function('mixed', [x, p], [solver(x0=x, p=p)['x'], newton(x, p)],
            ['x', 'p'], ['xopt', 'zroot']).save(str(out/'helpers_mixed.casadi'))
qp = ca.qpsol('qp', 'qrqp', {'x': x, 'f': ca.dot(x, x)})
ca.Function('empty_constant', [x], [qp(x0=x)['x']], ['x'], ['xopt']).save(str(out/'empty_constant.casadi'))
