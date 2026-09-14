"""Copy native reader fixtures from the adjacent casadi-reader proof of concept."""
from pathlib import Path
import shutil
import json
root = Path(__file__).resolve().parents[1]
for path in (root.parent/'casadi-reader/test/fixtures').iterdir():
    shutil.copyfile(path, root/'test/fixtures/casadi'/path.name)

# Operation labels are visualization metadata, independent of the reader runtime.
scheme=json.loads((root.parent/'casadi-reader/schemes/serialization_scheme.json').read_text())
(root/'src/casadi-ops.js').write_text('// CasADi operation labels belong to the visualization adapter.\nexport const OP='+json.dumps({
    name[3:].lower(): value for name, value in scheme['operations'].items()
}, indent=2)+';\n')
