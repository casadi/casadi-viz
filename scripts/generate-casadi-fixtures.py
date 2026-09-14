"""Copy native reader fixtures from the adjacent casadi2json proof of concept."""
from pathlib import Path
import shutil
root = Path(__file__).resolve().parents[1]
for path in (root.parent/'casadi2json/test/fixtures').iterdir():
    shutil.copyfile(path, root/'test/fixtures/casadi'/path.name)
